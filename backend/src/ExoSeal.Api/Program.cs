using ExoSeal.Api;
using ExoSeal.Application;
using ExoSeal.Infrastructure;
using Microsoft.AspNetCore.HttpOverrides;
using Microsoft.EntityFrameworkCore;

var builder = WebApplication.CreateBuilder(args);

// Alles hier ist klein (verschlüsselter Text, max. 64 KiB); große Bodies gar nicht erst annehmen.
builder.WebHost.ConfigureKestrel(k => k.Limits.MaxRequestBodySize = 128 * 1024);

// Client-IP fürs Rate-Limit (nur im Zähler-Hash, nie gespeichert oder geloggt). Next.js reicht X-Forwarded-For
// unverändert durch und fügt nichts hinzu; die echte IP kennt nur ein Reverse-Proxy davor.
// 0 (Standard) = Header ignorieren: nicht fälschbar, aber alle Besucher teilen sich einen Zähler (Peer = Frontend).
// 1 = genau ein Reverse-Proxy (hängt die Client-IP rechts an) sitzt vor dem Frontend.
// Zu hoch eingestellt lässt sich das Limit per gefälschtem Header umgehen. (Network__TrustedProxyHops)
var proxyHops = builder.Configuration.GetValue("Network:TrustedProxyHops", 0);
if (proxyHops > 0)
    builder.Services.Configure<ForwardedHeadersOptions>(o =>
    {
        o.ForwardedHeaders = ForwardedHeaders.XForwardedFor;
        o.ForwardLimit = proxyHops;
        o.KnownIPNetworks.Clear();
        o.KnownProxies.Clear();
    });

// Alternative zu den Hops: ein Header, den nur der Betreiber-Proxy setzt (z. B. CF-Connecting-IP bei Cloudflare). Nur setzen, wenn der Server
// ausschließlich über diesen Proxy erreichbar ist, sonst kann jeder den Header fälschen. (Network__ClientIpHeader)
var ipHeader = builder.Configuration["Network:ClientIpHeader"]?.Trim();
if (!string.IsNullOrEmpty(ipHeader) && proxyHops > 0)
    throw new InvalidOperationException("Network__ClientIpHeader und Network__TrustedProxyHops schließen sich aus: bitte nur eines setzen.");

builder.Services.AddInfrastructure(builder.Configuration);
builder.Services.AddScoped<SecretService>();
builder.Services.AddScoped<SecretRequestService>();
builder.Services.AddLocalization();
builder.Services.AddProblemDetails(); // einheitliche JSON-Fehler, im Produktivbetrieb ohne Stacktrace
builder.Services.AddExoSealAuth(builder.Configuration);
builder.Services.AddHealthChecks().AddDbContextCheck<AppDbContext>();

var app = builder.Build();

// Migrationen laufen beim Start automatisch (Plan: "saubere Migrationen, Auto-Migration").
using (var scope = app.Services.CreateScope())
    await scope.ServiceProvider.GetRequiredService<AppDbContext>().Database.MigrateAsync();

// Fehler als generisches Problem-JSON; Details (und damit Pfade/Inhalte) landen weder in der Antwort noch im Log-Level Warning.
app.UseExceptionHandler();
app.Use((ctx, next) =>
{
    // Alles Dynamische: nie zwischenspeichern, Content-Type nicht erraten lassen.
    ctx.Response.Headers.CacheControl = "no-store";
    ctx.Response.Headers.XContentTypeOptions = "nosniff";
    return next(ctx);
});
if (proxyHops > 0) app.UseForwardedHeaders();
if (!string.IsNullOrEmpty(ipHeader))
    app.Use((ctx, next) =>
    {
        // Genau ein gültiger IP-Wert, sonst bleibt die Adresse der Gegenstelle.
        if (ctx.Request.Headers.TryGetValue(ipHeader, out var v) && System.Net.IPAddress.TryParse(v.ToString().Trim(), out var ip)) ctx.Connection.RemoteIpAddress = ip;
        return next(ctx);
    });
if (proxyHops == 0 && string.IsNullOrEmpty(ipHeader) && !app.Environment.IsDevelopment())
    app.Logger.LogWarning("Besucher-IP nicht konfiguriert (TRUSTED_PROXY_HOPS=0, CLIENT_IP_HEADER leer): Alle Besucher teilen sich die Ratenlimits der öffentlichen Seiten. Hinter einem Reverse-Proxy bitte setzen, siehe docs/OPERATIONS.md.");

// Schreibende Aufrufe nur vom eigenen Ursprung. SameSite=Lax trennt Geschwister-Subdomains nicht (seal.x.com und blog.x.com sind "same-site").
// Maßgeblich ist Sec-Fetch-Site: Browser setzen es immer selbst, Seiten können es nicht fälschen. Origin gilt nur als Rückfall für sehr alte
// Browser, denn bei Formularen schickt der Browser wegen "Referrer-Policy: no-referrer" "Origin: null" (das Abmelden ist so ein Formular).
// Aufrufe ganz ohne diese Header (Server, curl) kommen nicht aus dem Browser eines Opfers.
var allowedOrigin = new Uri(app.Services.GetRequiredService<AuthOptions>().PublicBaseUrl).GetLeftPart(UriPartial.Authority);
app.Use((ctx, next) =>
{
    if (!HttpMethods.IsGet(ctx.Request.Method) && !HttpMethods.IsHead(ctx.Request.Method) && !HttpMethods.IsOptions(ctx.Request.Method))
    {
        var origin = ctx.Request.Headers.Origin.ToString();
        var site = ctx.Request.Headers["Sec-Fetch-Site"].ToString();
        var foreign = site.Length > 0 ? site is not ("same-origin" or "none")
            : origin.Length > 0 && !string.Equals(origin, allowedOrigin, StringComparison.OrdinalIgnoreCase);
        if (foreign)
        {
            ctx.Response.StatusCode = StatusCodes.Status403Forbidden;
            return Task.CompletedTask;
        }
    }
    return next(ctx);
});
app.UseRequestLocalization(new RequestLocalizationOptions()
    .SetDefaultCulture(Locales.Default).AddSupportedCultures(Locales.Supported).AddSupportedUICultures(Locales.Supported));
app.UseAuthentication();
app.UseAuthorization();
app.MapHealthChecks("/health");
app.MapExoSealAuth();
app.MapSecrets();
app.MapRequests();
app.Run();

public partial class Program;
