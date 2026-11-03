using System.Buffers.Text;
using ExoSeal.Api.Resources;
using ExoSeal.Application;
using ExoSeal.Domain;
using Microsoft.Extensions.Localization;

namespace ExoSeal.Api;

public sealed record CreateSecretRequest(string Ciphertext, int ExpiresInMinutes, string? Label = null);
public sealed record SentSummaryDto(Guid Id, string? Label, string State, DateTimeOffset CreatedAt, DateTimeOffset ExpiresAt);
public sealed record CreateSecretResponse(Guid Id);
public sealed record RevealSecretResponse(string Ciphertext);
public sealed record GoneResponse(string Reason);

public static class SecretEndpoints
{
    // Base64url ist 4/3 so groß wie die Rohdaten; alles darüber ist sicher zu groß, bevor wir dekodieren.
    private const int MaxEncodedLength = SecretService.MaxCiphertextBytes / 3 * 4 + 8;

    public static void MapSecrets(this WebApplication app)
    {
        var g = app.MapGroup("/secrets");

        // Nur eingeloggte Nutzer erzeugen Links (Plan: Missbrauchsschutz).
        g.MapPost("/", async (CreateSecretRequest req, HttpContext http, SecretService svc, IStringLocalizer<Messages> l, CancellationToken ct) =>
        {
            if (req.Ciphertext is null || req.Ciphertext.Length > MaxEncodedLength)
                return Results.Problem(l["SecretTooLarge"], statusCode: StatusCodes.Status413PayloadTooLarge);
            if (!Base64Url.IsValid(req.Ciphertext))
                return Results.Problem(l["SecretInvalid"], statusCode: StatusCodes.Status400BadRequest);

            var r = await svc.CreateAsync(Base64Url.DecodeFromChars(req.Ciphertext), TimeSpan.FromMinutes(req.ExpiresInMinutes), http.User.FindFirst("sub")?.Value, req.Label, ct);
            return r.Error switch
            {
                null => Results.Created($"/secrets/{r.Id}", new CreateSecretResponse(r.Id!.Value)),
                SecretError.TooLarge => Results.Problem(l["SecretTooLarge"], statusCode: StatusCodes.Status413PayloadTooLarge),
                SecretError.QuotaReached => Results.Problem(l["QuotaReached"], statusCode: StatusCodes.Status409Conflict),
                SecretError.InvalidLabel => Results.Problem(l["SecretInvalid"], statusCode: StatusCodes.Status400BadRequest),
                _ => Results.Problem(l["SecretInvalid"], statusCode: StatusCodes.Status400BadRequest),
            };
        })
        .RequireAuthorization()
        .AddEndpointFilter(RateLimitFilter.For("create", limit: 20, TimeSpan.FromMinutes(1)));

        // Die gesendeten Links des Erstellers (Status wie geöffnet, abgelaufen, gemeldet). Inhalte und Empfänger kennt der Server nicht.
        g.MapGet("/mine", async (HttpContext http, SecretService svc, CancellationToken ct, int page = 1, int pageSize = 20) =>
        {
            http.Response.Headers.CacheControl = "no-store";
            var p = await svc.ListSentAsync(http.User.FindFirst("sub")!.Value, page, pageSize, ct);
            return Results.Ok(new PageDto<SentSummaryDto>(
                p.Items.Select(x => new SentSummaryDto(x.Id, x.Label, x.State.ToString().ToLowerInvariant(), x.CreatedAt, x.ExpiresAt)).ToList(),
                p.Total, p.PageNumber, p.PageSize));
        })
        .RequireAuthorization()
        .AddEndpointFilter(RateLimitFilter.For("sent-list", limit: 60, TimeSpan.FromMinutes(1)));

        // Ersteller zieht einen noch nicht abgerufenen Link zurück.
        g.MapDelete("/{id:guid}", async (Guid id, HttpContext http, SecretService svc, CancellationToken ct) =>
            await svc.RevokeAsync(http.User.FindFirst("sub")!.Value, id, ct) ? Results.NoContent() : Results.NotFound())
        .RequireAuthorization()
        .AddEndpointFilter(RateLimitFilter.For("sent-revoke", limit: 30, TimeSpan.FromMinutes(1)));

        // POST statt GET: Link-Vorschau-Bots und Prefetch rufen nur GET auf und verbrauchen das Secret so nicht.
        // Öffentlich (Empfänger haben keinen Login), deshalb strenger begrenzt.
        g.MapPost("/{id:guid}/reveal", async (Guid id, SecretService svc, HttpContext ctx, CancellationToken ct) =>
        {
            ctx.Response.Headers.CacheControl = "no-store";
            var blob = await svc.RevealAsync(id, ct);
            if (blob is not null) return Results.Ok(new RevealSecretResponse(Base64Url.EncodeToString(blob)));
            // Wer die ID kennt, erfährt, warum der Link nicht mehr geht (geöffnet, abgelaufen, gemeldet).
            var outcome = await svc.OutcomeAsync(id, ct);
            return Gone(outcome);
        })
        .AddEndpointFilter(RateLimitFilter.For("reveal", limit: 30, TimeSpan.FromMinutes(1)));

        // Melden = löschen, ohne den Inhalt zu lesen. Gab es den Link nicht mehr, sagt die Antwort wie beim Abruf warum (nichts Neues,
        // das kennt jeder mit der ID), damit niemand "gemeldet und gelöscht" liest, obwohl der Link längst geöffnet war. Der Status beim Absender bleibt dann stehen.
        g.MapPost("/{id:guid}/report", async (Guid id, SecretService svc, CancellationToken ct) =>
        {
            if (await svc.ReportAsync(id, ct)) return Results.NoContent();
            return Gone(await svc.OutcomeAsync(id, ct));
        })
        .AddEndpointFilter(RateLimitFilter.For("report", limit: 10, TimeSpan.FromMinutes(1)));
    }

    private static IResult Gone(SecretOutcome? outcome) =>
        Results.Json(new GoneResponse(outcome switch { SecretOutcome.Opened => "opened", SecretOutcome.Expired => "expired", SecretOutcome.Reported => "reported", SecretOutcome.Revoked => "revoked", _ => "unknown" }), statusCode: StatusCodes.Status404NotFound);
}
