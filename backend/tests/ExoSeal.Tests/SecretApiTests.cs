using System.Buffers.Text;
using System.Net;
using System.Net.Http.Json;
using System.Text.Encodings.Web;
using ExoSeal.Api;
using ExoSeal.Application;
using Microsoft.AspNetCore.Authentication;
using Microsoft.AspNetCore.Hosting;
using Microsoft.AspNetCore.Mvc.Testing;
using Microsoft.AspNetCore.TestHost;
using Microsoft.Extensions.DependencyInjection;
using Microsoft.Extensions.DependencyInjection.Extensions;
using Microsoft.Extensions.Logging;
using Microsoft.Extensions.Options;

namespace ExoSeal.Tests;

public sealed class SwitchLimiter : IRateLimiter
{
    public bool Allow { get; set; } = true;
    public System.Collections.Concurrent.ConcurrentQueue<string> Seen { get; } = new();
    public Task<bool> AllowAsync(string bucket, string clientId, int limit, TimeSpan window, CancellationToken ct = default)
    {
        Seen.Enqueue(clientId);
        return Task.FromResult(Allow);
    }
}

/// <summary>Test-Login: Header X-Test-User = eingeloggt. Der echte OIDC-Flow braucht einen Anbieter und ist hier nicht Thema.</summary>
public sealed class HeaderAuth(IOptionsMonitor<AuthenticationSchemeOptions> o, ILoggerFactory l, UrlEncoder e) : AuthenticationHandler<AuthenticationSchemeOptions>(o, l, e)
{
    protected override Task<AuthenticateResult> HandleAuthenticateAsync() =>
        Task.FromResult(Request.Headers.ContainsKey("X-Test-User")
            ? AuthenticateResult.Success(new AuthenticationTicket(
                new System.Security.Claims.ClaimsPrincipal(new System.Security.Claims.ClaimsIdentity([new("sub", Request.Headers["X-Test-User"].ToString()), new("email", "tester@example.org"), new("name", "Tester")], "Test")), "Test"))
            : AuthenticateResult.NoResult());
}

public sealed class ApiFactory : WebApplicationFactory<Program>
{
    public SwitchLimiter Limiter { get; } = new();

    public ApiFactory() => TestDb.EnsureMigrated();

    protected override void ConfigureWebHost(IWebHostBuilder b)
    {
        b.UseSetting("ConnectionStrings:Postgres", TestDb.Conn);
        b.ConfigureTestServices(s =>
        {
            s.AddAuthentication("Test").AddScheme<AuthenticationSchemeOptions, HeaderAuth>("Test", _ => { });
            s.RemoveAll<IRateLimiter>();
            s.AddSingleton<IRateLimiter>(Limiter);
        });
    }

    public HttpClient LoggedIn(string? lang = null, string user = "tester")
    {
        var c = CreateClient();
        c.DefaultRequestHeaders.Add("X-Test-User", user);
        if (lang is not null) c.DefaultRequestHeaders.AcceptLanguage.ParseAdd(lang);
        return c;
    }
}

public class SecretApiTests : IClassFixture<ApiFactory>
{
    private readonly ApiFactory _f;
    public SecretApiTests(ApiFactory f) => _f = f;

    private static CreateSecretRequest Req(int bytes = 64, int minutes = 60) => new(Base64Url.EncodeToString(TestDb.Blob(bytes)), minutes);

    [DbFact]
    public async Task Create_requires_login() =>
        Assert.Equal(HttpStatusCode.Unauthorized, (await _f.CreateClient().PostAsJsonAsync("/secrets", Req())).StatusCode);

    [DbFact]
    public async Task Create_reveal_once_then_gone()
    {
        var created = await _f.LoggedIn().PostAsJsonAsync("/secrets", Req());
        Assert.Equal(HttpStatusCode.Created, created.StatusCode);
        var id = (await created.Content.ReadFromJsonAsync<CreateSecretResponse>())!.Id;

        var anon = _f.CreateClient(); // Empfänger ohne Login
        var first = await anon.PostAsync($"/secrets/{id}/reveal", null);
        Assert.Equal(HttpStatusCode.OK, first.StatusCode);
        Assert.Contains("no-store", first.Headers.CacheControl!.ToString());
        Assert.Equal(Req().Ciphertext, (await first.Content.ReadFromJsonAsync<RevealSecretResponse>())!.Ciphertext);

        var gone = await anon.PostAsync($"/secrets/{id}/reveal", null);
        Assert.Equal(HttpStatusCode.NotFound, gone.StatusCode);
        Assert.Equal("opened", (await gone.Content.ReadFromJsonAsync<GoneResponse>())!.Reason);
    }

    [DbFact]
    public async Task Get_does_not_consume_secret() // Link-Vorschau-Bots machen GET
    {
        var id = (await (await _f.LoggedIn().PostAsJsonAsync("/secrets", Req())).Content.ReadFromJsonAsync<CreateSecretResponse>())!.Id;
        var anon = _f.CreateClient();
        await anon.GetAsync($"/secrets/{id}/reveal");
        Assert.Equal(HttpStatusCode.OK, (await anon.PostAsync($"/secrets/{id}/reveal", null)).StatusCode);
    }

    [DbFact]
    public async Task Unknown_id_is_404_with_reason_unknown()
    {
        var r = await _f.CreateClient().PostAsync($"/secrets/{Guid.NewGuid()}/reveal", null);
        Assert.Equal(HttpStatusCode.NotFound, r.StatusCode);
        Assert.Equal("unknown", (await r.Content.ReadFromJsonAsync<GoneResponse>())!.Reason);
    }

    [DbTheory]
    [InlineData(70_000, 60, HttpStatusCode.RequestEntityTooLarge)]   // schon als Base64-Länge zu groß
    [InlineData(SecretService.MaxCiphertextBytes + 1, 60, HttpStatusCode.RequestEntityTooLarge)] // knapp drüber
    [InlineData(10, 60, HttpStatusCode.BadRequest)]
    [InlineData(64, 0, HttpStatusCode.BadRequest)]
    [InlineData(64, 7 * 24 * 60 + 1, HttpStatusCode.BadRequest)]
    public async Task Create_validates(int bytes, int minutes, HttpStatusCode expected) =>
        Assert.Equal(expected, (await _f.LoggedIn().PostAsJsonAsync("/secrets", Req(bytes, minutes))).StatusCode);

    [DbFact]
    public async Task Create_rejects_non_base64() =>
        Assert.Equal(HttpStatusCode.BadRequest, (await _f.LoggedIn().PostAsJsonAsync("/secrets", new CreateSecretRequest("***", 60))).StatusCode);

    [DbFact]
    public async Task Rate_limit_gives_429_in_requested_language()
    {
        _f.Limiter.Allow = false;
        try
        {
            var r = await _f.LoggedIn("de").PostAsJsonAsync("/secrets", Req());
            Assert.Equal(HttpStatusCode.TooManyRequests, r.StatusCode);
            Assert.NotNull(r.Headers.RetryAfter);
            Assert.Contains("Zu viele Anfragen", await r.Content.ReadAsStringAsync());
        }
        finally { _f.Limiter.Allow = true; }
    }

    [DbFact]
    public async Task Rate_limit_counts_logged_in_users_by_user_and_everyone_else_by_ip()
    {
        _f.Limiter.Seen.Clear();
        Assert.Equal(HttpStatusCode.OK, (await _f.LoggedIn(user: "alice-sub").GetAsync("/secrets/mine")).StatusCode);
        Assert.Contains("user:alice-sub", _f.Limiter.Seen);
        _f.Limiter.Seen.Clear();
        await _f.CreateClient().PostAsync($"/secrets/{Guid.NewGuid()}/reveal", null);
        Assert.All(_f.Limiter.Seen, id => Assert.StartsWith("ip:", id)); // ohne Login nur die IP, nie eine Nutzer-ID
    }

    [DbFact]
    public async Task Writing_calls_from_a_foreign_origin_are_refused()
    {
        var me = _f.LoggedIn();
        using var evil = new HttpRequestMessage(HttpMethod.Post, "/secrets") { Content = JsonContent.Create(Req()) };
        evil.Headers.Add("Origin", "https://blog.evil.example");
        Assert.Equal(HttpStatusCode.Forbidden, (await me.SendAsync(evil)).StatusCode);
        using var cross = new HttpRequestMessage(HttpMethod.Post, "/secrets") { Content = JsonContent.Create(Req()) };
        cross.Headers.Add("Sec-Fetch-Site", "same-site"); // z. B. eine Geschwister-Subdomain, ohne Origin
        Assert.Equal(HttpStatusCode.Forbidden, (await me.SendAsync(cross)).StatusCode);
        using var own = new HttpRequestMessage(HttpMethod.Post, "/secrets") { Content = JsonContent.Create(Req()) };
        own.Headers.Add("Origin", "http://localhost:3000");
        own.Headers.Add("Sec-Fetch-Site", "same-origin");
        Assert.Equal(HttpStatusCode.Created, (await me.SendAsync(own)).StatusCode);
        using var form = new HttpRequestMessage(HttpMethod.Post, "/secrets") { Content = JsonContent.Create(Req()) };
        form.Headers.Add("Origin", "null"); // Formular auf der eigenen Seite mit Referrer-Policy no-referrer
        form.Headers.Add("Sec-Fetch-Site", "same-origin");
        Assert.Equal(HttpStatusCode.Created, (await me.SendAsync(form)).StatusCode);
    }

    [DbFact]
    public async Task Report_deletes_secret_without_login()
    {
        var id = (await (await _f.LoggedIn().PostAsJsonAsync("/secrets", Req())).Content.ReadFromJsonAsync<CreateSecretResponse>())!.Id;
        var anon = _f.CreateClient();
        Assert.Equal(HttpStatusCode.NoContent, (await anon.PostAsync($"/secrets/{id}/report", null)).StatusCode);
        var after = await anon.PostAsync($"/secrets/{id}/reveal", null);
        Assert.Equal(HttpStatusCode.NotFound, after.StatusCode);
        Assert.Equal("reported", (await after.Content.ReadFromJsonAsync<GoneResponse>())!.Reason); // der Absender sieht, dass gemeldet wurde
    }

    [DbFact]
    public async Task Reporting_a_link_that_is_already_gone_says_why_and_keeps_the_old_status()
    {
        var id = (await (await _f.LoggedIn().PostAsJsonAsync("/secrets", Req())).Content.ReadFromJsonAsync<CreateSecretResponse>())!.Id;
        var anon = _f.CreateClient();
        Assert.Equal(HttpStatusCode.OK, (await anon.PostAsync($"/secrets/{id}/reveal", null)).StatusCode);
        var report = await anon.PostAsync($"/secrets/{id}/report", null);
        Assert.Equal(HttpStatusCode.NotFound, report.StatusCode);
        Assert.Equal("opened", (await report.Content.ReadFromJsonAsync<GoneResponse>())!.Reason); // geöffnet bleibt geöffnet, wird nicht zu "gemeldet"
        var unknown = await anon.PostAsync($"/secrets/{Guid.NewGuid()}/report", null);
        Assert.Equal("unknown", (await unknown.Content.ReadFromJsonAsync<GoneResponse>())!.Reason); // wie beim Abruf, kein zusätzliches Signal
    }

    [DbFact]
    public async Task Responses_are_never_cacheable_and_not_sniffable()
    {
        var r = await _f.CreateClient().PostAsync($"/secrets/{Guid.NewGuid()}/reveal", null);
        Assert.Contains("no-store", r.Headers.CacheControl!.ToString());
        Assert.Equal("nosniff", r.Headers.GetValues("X-Content-Type-Options").Single());
    }

    [DbFact]
    public async Task Sent_list_requires_login_and_shows_own_link_with_status()
    {
        Assert.Equal(HttpStatusCode.Unauthorized, (await _f.CreateClient().GetAsync("/secrets/mine")).StatusCode);

        var me = _f.LoggedIn();
        var body = new CreateSecretRequest(Base64Url.EncodeToString(TestDb.Blob()), 60, "Server-Login");
        var id = (await (await me.PostAsJsonAsync("/secrets", body)).Content.ReadFromJsonAsync<CreateSecretResponse>())!.Id;
        var list = (await (await me.GetAsync("/secrets/mine")).Content.ReadFromJsonAsync<PageDto<SentSummaryDto>>())!;
        var mine = list.Items.Single(x => x.Id == id);
        Assert.Equal("available", mine.State);
        Assert.Equal("Server-Login", mine.Label);

        await _f.CreateClient().PostAsync($"/secrets/{id}/reveal", null);
        var after = (await (await me.GetAsync("/secrets/mine")).Content.ReadFromJsonAsync<PageDto<SentSummaryDto>>())!;
        Assert.Equal("opened", after.Items.Single(x => x.Id == id).State);
    }

    [DbFact]
    public async Task Owner_can_revoke_and_recipient_learns_it()
    {
        var me = _f.LoggedIn();
        var id = (await (await me.PostAsJsonAsync("/secrets", Req())).Content.ReadFromJsonAsync<CreateSecretResponse>())!.Id;
        Assert.Equal(HttpStatusCode.Unauthorized, (await _f.CreateClient().DeleteAsync($"/secrets/{id}")).StatusCode);
        Assert.Equal(HttpStatusCode.NoContent, (await me.DeleteAsync($"/secrets/{id}")).StatusCode);
        Assert.Equal(HttpStatusCode.NotFound, (await me.DeleteAsync($"/secrets/{id}")).StatusCode);
        var gone = await _f.CreateClient().PostAsync($"/secrets/{id}/reveal", null);
        Assert.Equal("revoked", (await gone.Content.ReadFromJsonAsync<GoneResponse>())!.Reason);
    }

    [DbFact]
    public async Task Too_long_label_is_400()
    {
        var r = await _f.LoggedIn().PostAsJsonAsync("/secrets", new CreateSecretRequest(Base64Url.EncodeToString(TestDb.Blob()), 60, new string('x', 81)));
        Assert.Equal(HttpStatusCode.BadRequest, r.StatusCode);
    }
}
