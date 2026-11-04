using ExoSeal.Api.Resources;
using ExoSeal.Application;
using Microsoft.Extensions.Localization;

namespace ExoSeal.Api;

internal static class RateLimitFilter
{
    /// <summary>
    /// Zähler pro Besucher und Bucket. Eingeloggte werden nach ihrer Nutzer-ID gezählt, alle anderen nach IP. Die Nutzer-ID ist der einzige
    /// verlässliche Schlüssel, denn Aufrufe der Seiten kommen vom Frontend-Server und hätten sonst alle dieselbe IP (ein Zähler für alle).
    /// Beides geht nur gehasht an den Zähler (siehe ValkeyRateLimiter).
    /// </summary>
    public static Func<EndpointFilterInvocationContext, EndpointFilterDelegate, ValueTask<object?>> For(string bucket, int limit, TimeSpan window) =>
        async (ctx, next) =>
        {
            var http = ctx.HttpContext;
            var sub = http.User.Identity?.IsAuthenticated == true ? http.User.FindFirst("sub")?.Value : null;
            var who = sub is not null ? $"user:{sub}" : $"ip:{http.Connection.RemoteIpAddress?.ToString() ?? "unknown"}";
            if (await http.RequestServices.GetRequiredService<IRateLimiter>().AllowAsync(bucket, who, limit, window, http.RequestAborted))
                return await next(ctx);
            http.Response.Headers.RetryAfter = ((int)window.TotalSeconds).ToString();
            return Results.Problem(http.RequestServices.GetRequiredService<IStringLocalizer<Messages>>()["RateLimited"],
                statusCode: StatusCodes.Status429TooManyRequests);
        };
}
