using System.Globalization;
using System.Net.Http.Headers;
using System.Resources;
using System.Security.Cryptography;
using System.Text;
using ExoSeal.Application;
using ExoSeal.Infrastructure.Resources;
using MailKit.Net.Smtp;
using MailKit.Security;
using Microsoft.Extensions.DependencyInjection;
using Microsoft.Extensions.Hosting;
using Microsoft.Extensions.Logging;
using MimeKit;

namespace ExoSeal.Infrastructure;

public sealed class MailOptions
{
    public string? Host { get; set; }
    public int Port { get; set; } = 587;
    public string? User { get; set; }
    public string? Password { get; set; }
    public string? From { get; set; }
    public bool Enabled => !string.IsNullOrWhiteSpace(Host);
}

public sealed class WebhookOptions
{
    public string? Url { get; set; }
    public string? Secret { get; set; }
    public bool Enabled => !string.IsNullOrWhiteSpace(Url);
}

public sealed class NotificationOptions
{
    public MailOptions Mail { get; set; } = new();
    public WebhookOptions Webhook { get; set; } = new();
    /// <summary>Öffentliche Adresse ohne /api/v1, für den Dashboard-Link.</summary>
    public string PublicUrl { get; set; } = "http://localhost:3000";

    public void Validate()
    {
        if (Mail.Enabled && string.IsNullOrWhiteSpace(Mail.From))
            throw new InvalidOperationException("Mail ist aktiviert, aber Notifications__Mail__From fehlt.");
        if (Webhook.Enabled && (Webhook.Secret?.Length ?? 0) < 16)
            throw new InvalidOperationException("Webhook ist aktiviert, aber Notifications__Webhook__Secret fehlt oder ist kürzer als 16 Zeichen.");
    }
}

/// <summary>Signatur wie bei gängigen Webhook-Anbietern: HMAC-SHA256 über "{timestamp}.{body}". Der Zeitstempel schützt vor Replay.</summary>
public static class WebhookSigner
{
    public static string Sign(string secret, long timestamp, string body) =>
        "v1=" + Convert.ToHexStringLower(HMACSHA256.HashData(Encoding.UTF8.GetBytes(secret), Encoding.UTF8.GetBytes($"{timestamp}.{body}")));
}

public sealed class WebhookSender(NotificationOptions options, TimeProvider clock)
{
    // Keine Weiterleitungen folgen: das Ziel ist Betreiber-Konfiguration, nicht Nutzereingabe.
    private readonly HttpClient _http = new(new SocketsHttpHandler { AllowAutoRedirect = false }) { Timeout = TimeSpan.FromSeconds(10) };

    public async Task SendAsync(PendingNotification n, string dashboardUrl, CancellationToken ct)
    {
        // Nie Inhalte, nur dass etwas da ist.
        var body = System.Text.Json.JsonSerializer.Serialize(new { @event = "request.answered", requestId = n.Id, answeredAt = n.AnsweredAt, dashboardUrl });
        var ts = clock.GetUtcNow().ToUnixTimeSeconds();
        using var req = new HttpRequestMessage(HttpMethod.Post, options.Webhook.Url) { Content = new StringContent(body, Encoding.UTF8, new MediaTypeHeaderValue("application/json")) };
        req.Headers.Add("X-ExoSeal-Timestamp", ts.ToString(CultureInfo.InvariantCulture));
        req.Headers.Add("X-ExoSeal-Signature", WebhookSigner.Sign(options.Webhook.Secret!, ts, body));
        using var res = await _http.SendAsync(req, ct);
        res.EnsureSuccessStatusCode();
    }
}

public sealed class MailSender(NotificationOptions options)
{
    private static readonly ResourceManager Texts = new(typeof(MailMessages));

    public async Task SendAsync(string to, string locale, string dashboardUrl, CancellationToken ct)
    {
        // Nur aufgerufen, wenn Mail eingerichtet ist (NotificationOptions prüft das); hier zur Sicherheit und für den Compiler.
        var mail = options.Mail;
        if (string.IsNullOrWhiteSpace(mail.Host) || string.IsNullOrWhiteSpace(mail.From)) throw new InvalidOperationException("SMTP ist nicht konfiguriert.");
        var culture = CultureInfo.GetCultureInfo(locale);
        var msg = new MimeMessage();
        msg.From.Add(MailboxAddress.Parse(mail.From));
        msg.To.Add(MailboxAddress.Parse(to));
        msg.Subject = Texts.GetString("MailSubject", culture)!;
        msg.Body = new TextPart("plain") { Text = string.Format(culture, Texts.GetString("MailBody", culture)!, dashboardUrl) };

        using var smtp = new SmtpClient();
        await smtp.ConnectAsync(mail.Host, mail.Port, SecureSocketOptions.Auto, ct);
        if (!string.IsNullOrEmpty(mail.User)) await smtp.AuthenticateAsync(mail.User, mail.Password ?? "", ct);
        await smtp.SendAsync(msg, ct);
        await smtp.DisconnectAsync(true, ct);
    }
}

/// <summary>
/// Arbeitet die Benachrichtigungs-Warteschlange ab (Zustand steht in der Datenbank, übersteht also Neustarts).
/// Mail und Webhook werden getrennt abgehakt, ein Retry schickt deshalb nichts doppelt.
/// </summary>
public sealed class NotificationService(IServiceScopeFactory scopes, NotificationOptions options, MailSender mail, WebhookSender webhook, TimeProvider clock, ILogger<NotificationService> log) : BackgroundService
{
    public const int MaxAttempts = 5;
    // Wartezeit bis zum nächsten Versuch, je nach Anzahl bisheriger Fehlschläge.
    private static readonly TimeSpan[] Backoff = [TimeSpan.FromSeconds(30), TimeSpan.FromMinutes(2), TimeSpan.FromMinutes(10), TimeSpan.FromHours(1)];

    protected override async Task ExecuteAsync(CancellationToken stop)
    {
        if (!options.Mail.Enabled && !options.Webhook.Enabled) return;
        using var timer = new PeriodicTimer(TimeSpan.FromSeconds(10));
        do
        {
            try { await RunOnceAsync(stop); }
            catch (Exception ex) when (ex is not OperationCanceledException) { log.LogWarning("Benachrichtigungen fehlgeschlagen: {Type}", ex.GetType().Name); }
        } while (await timer.WaitForNextTickAsync(stop));
    }

    public async Task RunOnceAsync(CancellationToken ct)
    {
        using var scope = scopes.CreateScope();
        var store = scope.ServiceProvider.GetRequiredService<ISecretRequestStore>();
        var now = clock.GetUtcNow();
        var pending = await store.GetPendingNotificationsAsync(options.Mail.Enabled, options.Webhook.Enabled, MaxAttempts, 20, now, ct);

        foreach (var n in pending)
        {
            var url = $"{options.PublicUrl.TrimEnd('/')}/{n.Locale}/requests/{n.Id}";
            bool mailSent = false, hookSent = false, failed = false;

            if (n.NeedsMail)
            {
                if (string.IsNullOrWhiteSpace(n.OwnerEmail)) mailSent = true; // keine Adresse bekannt: nichts zu senden, nicht endlos wiederholen
                else try { await mail.SendAsync(n.OwnerEmail, n.Locale, url, ct); mailSent = true; }
                catch (Exception ex) when (ex is not OperationCanceledException) { failed = true; log.LogWarning("Mail-Versand fehlgeschlagen: {Type}", ex.GetType().Name); }
            }
            if (n.NeedsWebhook)
            {
                try { await webhook.SendAsync(n, url, ct); hookSent = true; }
                catch (Exception ex) when (ex is not OperationCanceledException) { failed = true; log.LogWarning("Webhook fehlgeschlagen: {Type}", ex.GetType().Name); }
            }
            await store.MarkNotifiedAsync(n.Id, mailSent, hookSent, failed ? now + Backoff[Math.Min(n.Attempts, Backoff.Length - 1)] : null, now, ct);
        }
    }
}
