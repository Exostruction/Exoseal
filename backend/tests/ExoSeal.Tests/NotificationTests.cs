using System.Net;
using System.Net.Http.Json;
using System.Net.Sockets;
using System.Security.Cryptography;
using System.Text;
using System.Text.Json;
using ExoSeal.Application;
using ExoSeal.Infrastructure;
using Microsoft.EntityFrameworkCore;
using Microsoft.Extensions.DependencyInjection;
using Microsoft.Extensions.Logging.Abstractions;

namespace ExoSeal.Tests;

public class WebhookSignerTests
{
    [Fact]
    public void Signature_is_hmac_sha256_over_timestamp_dot_body()
    {
        // Referenzwert unabhängig berechnet: HMAC-SHA256("geheim-geheim-geheim", "1700000000.{\"a\":1}")
        var expected = "v1=" + Convert.ToHexStringLower(HMACSHA256.HashData(Encoding.UTF8.GetBytes("geheim-geheim-geheim"), Encoding.UTF8.GetBytes("1700000000.{\"a\":1}")));
        Assert.Equal(expected, WebhookSigner.Sign("geheim-geheim-geheim", 1700000000, "{\"a\":1}"));
    }

    [Fact]
    public void Signature_changes_with_secret_timestamp_and_body()
    {
        var s = WebhookSigner.Sign("secret-secret-secret", 1, "x");
        Assert.NotEqual(s, WebhookSigner.Sign("other-secret-secret", 1, "x"));
        Assert.NotEqual(s, WebhookSigner.Sign("secret-secret-secret", 2, "x"));
        Assert.NotEqual(s, WebhookSigner.Sign("secret-secret-secret", 1, "y"));
    }

    [Fact]
    public void Misconfiguration_fails_fast()
    {
        Assert.Throws<InvalidOperationException>(() => new NotificationOptions { Webhook = { Url = "http://x/", Secret = "kurz" } }.Validate());
        Assert.Throws<InvalidOperationException>(() => new NotificationOptions { Mail = { Host = "smtp.example.org" } }.Validate()); // From fehlt
        new NotificationOptions().Validate(); // alles aus ist gültig
    }
}

/// <summary>Teilen sich die Datenbank mit den Store-Tests und laufen deshalb nie parallel zu ihnen (die Warteschlange ist global).</summary>
[Collection("notification-queue")]
public class NotificationServiceTests
{
    private const string Secret = "webhook-secret-0123456789";

    private sealed record Received(string Body, string Timestamp, string Signature);

    private static (HttpListener Listener, List<Received> Calls, string Url) StartReceiver()
    {
        var port = ((IPEndPoint)new Func<EndPoint>(() => { var t = new TcpListener(IPAddress.Loopback, 0); t.Start(); var e = t.LocalEndpoint; t.Stop(); return e; })()).Port;
        var url = $"http://127.0.0.1:{port}/hook/";
        var l = new HttpListener();
        l.Prefixes.Add(url);
        l.Start();
        var calls = new List<Received>();
        _ = Task.Run(async () =>
        {
            while (l.IsListening)
            {
                try
                {
                    var ctx = await l.GetContextAsync();
                    using var r = new StreamReader(ctx.Request.InputStream, Encoding.UTF8);
                    var body = await r.ReadToEndAsync();
                    lock (calls) calls.Add(new(body, ctx.Request.Headers["X-ExoSeal-Timestamp"] ?? "", ctx.Request.Headers["X-ExoSeal-Signature"] ?? ""));
                    ctx.Response.StatusCode = 200;
                    ctx.Response.Close();
                }
                catch (Exception) when (!l.IsListening) { }
            }
        });
        return (l, calls, url);
    }

    private static NotificationService Service(NotificationOptions o)
    {
        var sp = new ServiceCollection()
            .AddDbContext<AppDbContext>(b => b.UseNpgsql(TestDb.Conn))
            .AddScoped<ISecretRequestStore, SecretRequestStore>()
            .BuildServiceProvider();
        return new NotificationService(sp.GetRequiredService<IServiceScopeFactory>(), o, new MailSender(o), new WebhookSender(o, TimeProvider.System),
            TimeProvider.System, NullLogger<NotificationService>.Instance);
    }

    private static async Task<bool> RunUntil(NotificationService svc, Func<Task<bool>> done)
    {
        for (var i = 0; i < 30; i++) // andere Tests lassen ältere Zeilen in der Warteschlange, bis die eigene dran ist
        {
            await svc.RunOnceAsync(default);
            if (await done()) return true;
        }
        return false;
    }

    [DbFact]
    public async Task Webhook_is_signed_has_no_content_and_is_sent_once()
    {
        var (listener, calls, url) = StartReceiver();
        try
        {
            await Req.DrainNotificationQueue();
            var blob = Req.Answer(300);
            var r = await Req.Seed(Req.NewOwner(), x => { x.Question = "Geheime-Frage-XYZ"; x.AnsweredAt = DateTimeOffset.UtcNow; x.ResponseCiphertext = blob; });
            var svc = Service(new NotificationOptions { PublicUrl = "https://seal.example.org", Webhook = { Url = url, Secret = Secret } });

            Assert.True(await RunUntil(svc, async () => (await Req.Reload(r.Id)).WebhookSentAt is not null));
            await svc.RunOnceAsync(default); // zweiter Lauf: nichts mehr für diese Anfrage

            Received[] mine;
            lock (calls) mine = calls.Where(c => c.Body.Contains(r.Id.ToString())).ToArray();
            var call = Assert.Single(mine);

            Assert.Equal(WebhookSigner.Sign(Secret, long.Parse(call.Timestamp), call.Body), call.Signature);
            Assert.True(Math.Abs(DateTimeOffset.UtcNow.ToUnixTimeSeconds() - long.Parse(call.Timestamp)) < 60);

            using var doc = JsonDocument.Parse(call.Body);
            Assert.Equal("request.answered", doc.RootElement.GetProperty("event").GetString());
            Assert.Equal($"https://seal.example.org/en/requests/{r.Id}", doc.RootElement.GetProperty("dashboardUrl").GetString());
            Assert.DoesNotContain("Geheime-Frage-XYZ", call.Body);                      // keine Frage, keine Antwort
            Assert.DoesNotContain(Convert.ToBase64String(blob)[..20], call.Body);
            Assert.DoesNotContain("owner@example.org", call.Body);                      // auch keine Adresse
        }
        finally { listener.Stop(); }
    }

    [DbFact]
    public async Task Failed_webhook_counts_an_attempt_and_waits_before_retrying()
    {
        var closedPort = ((IPEndPoint)new Func<EndPoint>(() => { var t = new TcpListener(IPAddress.Loopback, 0); t.Start(); var e = t.LocalEndpoint; t.Stop(); return e; })()).Port;
        await Req.DrainNotificationQueue();
        var r = await Req.Seed(Req.NewOwner(), x => { x.AnsweredAt = DateTimeOffset.UtcNow; x.ResponseCiphertext = Req.Answer(); });
        var svc = Service(new NotificationOptions { Webhook = { Url = $"http://127.0.0.1:{closedPort}/", Secret = Secret } });

        Assert.True(await RunUntil(svc, async () => (await Req.Reload(r.Id)).NotifyAttempts >= 1));
        var after = await Req.Reload(r.Id);
        Assert.Null(after.WebhookSentAt);

        Assert.True(after.NotifyNextAt > DateTimeOffset.UtcNow.AddSeconds(20)); // Backoff 30 s
        await svc.RunOnceAsync(default);                                        // sofort kein zweiter Versuch
        Assert.Equal(after.NotifyAttempts, (await Req.Reload(r.Id)).NotifyAttempts);
    }

    [DbFact]
    public async Task Request_without_owner_email_does_not_loop_on_mail()
    {
        await Req.DrainNotificationQueue();
        var r = await Req.Seed(Req.NewOwner(), x => { x.OwnerEmail = null; x.AnsweredAt = DateTimeOffset.UtcNow; x.ResponseCiphertext = Req.Answer(); });
        var svc = Service(new NotificationOptions { Mail = { Host = "127.0.0.1", Port = 1, From = "seal@example.org" } });
        Assert.True(await RunUntil(svc, async () => (await Req.Reload(r.Id)).MailSentAt is not null)); // abgehakt, ohne es zu versuchen
        Assert.Equal(0, (await Req.Reload(r.Id)).NotifyAttempts);
    }
}

public sealed class SmtpFactAttribute : FactAttribute
{
    public SmtpFactAttribute() { if (Environment.GetEnvironmentVariable("TEST_SMTP") is null) Skip = "TEST_SMTP (z. B. localhost:1025 für Mailpit) nicht gesetzt"; }
}

public class MailSenderTests
{
    [SmtpFact]
    public async Task Sends_localized_mail_without_content()
    {
        var smtp = Environment.GetEnvironmentVariable("TEST_SMTP")!.Split(':');
        var api = Environment.GetEnvironmentVariable("TEST_MAILPIT") ?? "http://localhost:8025";
        var sender = new MailSender(new NotificationOptions { Mail = { Host = smtp[0], Port = int.Parse(smtp[1]), From = "seal@example.org" } });

        var to = $"{Guid.NewGuid():N}@example.org";
        await sender.SendAsync(to, "de", "https://seal.example.org/de/requests/abc", default);

        using var http = new HttpClient();
        var found = await http.GetFromJsonAsync<JsonElement>($"{api}/api/v1/search?query=to:{to}");
        var msg = found.GetProperty("messages")[0];
        Assert.Equal("ExoSeal: Antwort auf deine Anfrage eingegangen", msg.GetProperty("Subject").GetString());
        var full = await http.GetFromJsonAsync<JsonElement>($"{api}/api/v1/message/{msg.GetProperty("ID").GetString()}");
        var text = full.GetProperty("Text").GetString()!;
        Assert.Contains("https://seal.example.org/de/requests/abc", text);
        Assert.Contains("keine Inhalte", text);
    }
}
