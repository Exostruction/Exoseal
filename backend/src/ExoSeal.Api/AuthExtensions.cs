using ExoSeal.Api.Resources;
using ExoSeal.Application;
using Microsoft.AspNetCore.Authentication;
using Microsoft.AspNetCore.Authentication.Cookies;
using Microsoft.AspNetCore.Authentication.OpenIdConnect;
using Microsoft.Extensions.Localization;
using Microsoft.IdentityModel.Protocols.OpenIdConnect;

namespace ExoSeal.Api;

public sealed class AuthOptions
{
    public string? MetadataAddress { get; set; }   // OIDC-Discovery-URL
    public string? ClientId { get; set; }
    public string? ClientSecret { get; set; }
    /// <summary>Öffentliche Basis inkl. Proxy-Präfix, z. B. https://seal.example.com/api/v1</summary>
    public string PublicBaseUrl { get; set; } = "http://localhost:3000/api/v1";
    public string? AllowedEmailDomains { get; set; }
    public string? AllowedEmails { get; set; }
    /// <summary>Nur für lokale Tests mit einem Mock-Anbieter über http. Produktiv nie setzen.</summary>
    public bool AllowInsecureMetadata { get; set; }
    public bool Configured => !string.IsNullOrWhiteSpace(ClientId);
}

public sealed record MeDto(string Sub, string? Email, string? Name);

public static class AuthExtensions
{
    public const string CallbackPath = "/auth/callback";

    public static void AddExoSealAuth(this IServiceCollection services, IConfiguration config)
    {
        var o = config.GetSection("Auth").Get<AuthOptions>() ?? new();
        services.AddSingleton(o);
        var cookiePolicy = o.PublicBaseUrl.StartsWith("https://", StringComparison.OrdinalIgnoreCase)
            ? CookieSecurePolicy.Always : CookieSecurePolicy.SameAsRequest;

        var auth = services.AddAuthentication(CookieAuthenticationDefaults.AuthenticationScheme)
            .AddCookie(c =>
            {
                c.Cookie.Name = "exoseal.session";
                c.Cookie.HttpOnly = true;
                c.Cookie.SameSite = SameSiteMode.Lax;
                c.Cookie.SecurePolicy = cookiePolicy;
                c.ExpireTimeSpan = TimeSpan.FromHours(8);
                c.SlidingExpiration = false; // Bewusst einfach: feste 8h, kein serverseitiges Widerrufen; bei Bedarf Session-Store in Valkey
                c.Events.OnRedirectToLogin = ctx => { ctx.Response.StatusCode = 401; return Task.CompletedTask; };
                c.Events.OnRedirectToAccessDenied = ctx => { ctx.Response.StatusCode = 403; return Task.CompletedTask; };
            });

        services.AddAuthorization();
        if (!o.Configured) return;

        var allowlist = new Allowlist(o.AllowedEmailDomains, o.AllowedEmails);
        if (allowlist.IsEmpty)
            throw new InvalidOperationException("Auth ist konfiguriert, aber die Allowlist ist leer (Auth__AllowedEmailDomains / Auth__AllowedEmails).");

        auth.AddOpenIdConnect(OpenIdConnectDefaults.AuthenticationScheme, c =>
        {
            c.MetadataAddress = o.MetadataAddress;
            c.RequireHttpsMetadata = !o.AllowInsecureMetadata;
            c.ClientId = o.ClientId;
            c.ClientSecret = o.ClientSecret;
            c.ResponseType = OpenIdConnectResponseType.Code;
            c.UsePkce = true;
            c.ResponseMode = OpenIdConnectResponseMode.Query; // form_post = Cross-Site-POST, da würden SameSite=Lax-Cookies fehlen
            c.CallbackPath = CallbackPath;
            c.SignInScheme = CookieAuthenticationDefaults.AuthenticationScheme;
            c.Scope.Clear();
            foreach (var s in new[] { "openid", "email", "profile" }) c.Scope.Add(s);
            c.SaveTokens = false;                  // Tokens werden nach dem Login nicht gebraucht
            c.GetClaimsFromUserInfoEndpoint = true;
            c.MapInboundClaims = false;
            c.ClaimActions.MapUniqueJsonKey("email", "email");
            c.ClaimActions.MapUniqueJsonKey("email_verified", "email_verified");
            c.ClaimActions.MapUniqueJsonKey("name", "name");
            // Hinter dem Frontend-Proxy: Cookies müssen für /api/v1/auth/callback gelten, nicht nur für /auth/callback.
            foreach (var ck in new[] { c.CorrelationCookie, c.NonceCookie })
            {
                ck.Path = "/";
                ck.SameSite = SameSiteMode.Lax;
                ck.SecurePolicy = cookiePolicy;
            }
            c.Events.OnRedirectToIdentityProvider = ctx =>
            {
                ctx.ProtocolMessage.RedirectUri = o.PublicBaseUrl.TrimEnd('/') + CallbackPath;
                return Task.CompletedTask;
            };
            c.Events.OnTicketReceived = ctx =>
            {
                var p = ctx.Principal!;
                var verified = string.Equals(p.FindFirst("email_verified")?.Value, "true", StringComparison.OrdinalIgnoreCase);
                if (p.FindFirst("sub") is null || !allowlist.IsAllowed(p.FindFirst("email")?.Value, verified))
                {
                    ctx.HandleResponse();
                    ctx.Response.Redirect("/?error=forbidden");
                }
                return Task.CompletedTask;
            };
            c.Events.OnRemoteFailure = ctx => { ctx.HandleResponse(); ctx.Response.Redirect("/?error=login"); return Task.CompletedTask; };
        });
    }

    public static void MapExoSealAuth(this WebApplication app)
    {
        var o = app.Services.GetRequiredService<AuthOptions>();

        app.MapGet("/auth/login", (string? returnUrl, IStringLocalizer<Messages> l) =>
        {
            if (!o.Configured) return Results.Problem(l["AuthNotConfigured"], statusCode: 503);
            // nur lokale Pfade, sonst Open Redirect
            var local = returnUrl is { Length: > 0 } && returnUrl[0] == '/' && !returnUrl.StartsWith("//") && !returnUrl.StartsWith("/\\");
            return Results.Challenge(new AuthenticationProperties { RedirectUri = local ? returnUrl : "/" },
                [OpenIdConnectDefaults.AuthenticationScheme]);
        }).AddEndpointFilter(RateLimitFilter.For("auth-login", 30, TimeSpan.FromMinutes(1))); // schützt den Anbieter vor Dauerumleitungen

        // POST + SameSite=Lax-Cookie: fremde Seiten können nicht ausloggen.
        app.MapPost("/auth/logout", () =>
            Results.SignOut(new AuthenticationProperties { RedirectUri = "/" }, [CookieAuthenticationDefaults.AuthenticationScheme]));

        app.MapGet("/me", (HttpContext ctx) => new MeDto(
                ctx.User.FindFirst("sub")!.Value, ctx.User.FindFirst("email")?.Value, ctx.User.FindFirst("name")?.Value))
            .RequireAuthorization();
    }
}
