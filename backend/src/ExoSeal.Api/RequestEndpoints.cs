using System.Buffers.Text;
using ExoSeal.Api.Resources;
using ExoSeal.Application;
using ExoSeal.Domain;
using Microsoft.AspNetCore.Localization;
using Microsoft.Extensions.Localization;

namespace ExoSeal.Api;

public sealed record CreateRequestRequest(string Question, string PublicKey, string WrappedPrivateKey, int ExpiresInDays);
public sealed record CreateRequestResponse(Guid Id);
public sealed record PublicRequestDto(string Question, string? OwnerName, string PublicKey, DateTimeOffset ExpiresAt);
public sealed record AnswerRequestBody(string Ciphertext);
public sealed record RequestSummaryDto(Guid Id, string Question, string Status, DateTimeOffset CreatedAt, DateTimeOffset ExpiresAt, DateTimeOffset? AnsweredAt);
public sealed record PageDto<T>(IReadOnlyList<T> Items, int Total, int Page, int PageSize);
public sealed record WrappedKeyDto(string WrappedPrivateKey);
public sealed record OpenedResponseDto(string Ciphertext);

public static class RequestEndpoints
{
    private static int EncodedMax(int bytes) => bytes / 3 * 4 + 8; // Base64url: 4 Zeichen je 3 Byte

    private static bool TryDecode(string? s, int maxBytes, out byte[] bytes)
    {
        bytes = [];
        if (s is null || s.Length > EncodedMax(maxBytes) || !Base64Url.IsValid(s)) return false;
        bytes = Base64Url.DecodeFromChars(s);
        return true;
    }

    private static string Name(RequestStatus s) => s.ToString().ToLowerInvariant(); // stabile Codes, das Frontend übersetzt

    private static string? Claim(HttpContext c, string type) => c.User.FindFirst(type)?.Value;

    public static void MapRequests(this WebApplication app)
    {
        var g = app.MapGroup("/requests");
        var minute = TimeSpan.FromMinutes(1);

        // ---- Eingeloggter Ersteller ----------------------------------------------------------------

        g.MapPost("/", async (CreateRequestRequest req, HttpContext http, SecretRequestService svc, IStringLocalizer<Messages> l, CancellationToken ct) =>
        {
            if (!TryDecode(req.PublicKey, SecretRequestService.PublicKeyBytes, out var pub) ||
                !TryDecode(req.WrappedPrivateKey, SecretRequestService.MaxWrappedKeyBytes, out var wrapped))
                return Results.Problem(l["SecretInvalid"], statusCode: StatusCodes.Status400BadRequest);

            var locale = http.Features.Get<IRequestCultureFeature>()?.RequestCulture.UICulture.TwoLetterISOLanguageName ?? Locales.Default;
            var r = await svc.CreateAsync(new CreateRequestCommand(
                Claim(http, "sub")!, Claim(http, "email"), Claim(http, "name"), locale,
                req.Question, pub, wrapped, req.ExpiresInDays), ct);
            return r.Error switch
            {
                null => Results.Created($"/requests/{r.Id}", new CreateRequestResponse(r.Id!.Value)),
                RequestError.QuotaReached => Results.Problem(l["QuotaReached"], statusCode: StatusCodes.Status409Conflict),
                _ => Results.Problem(l["SecretInvalid"], statusCode: StatusCodes.Status400BadRequest),
            };
        }).RequireAuthorization().AddEndpointFilter(RateLimitFilter.For("rq-create", 20, minute));

        // Filter, Sortierung und Pagination macht die Datenbank (siehe SecretRequestStore.ListAsync).
        g.MapGet("/", async (HttpContext http, SecretRequestService svc, IStringLocalizer<Messages> l, CancellationToken ct,
            string? status, string? sort, int page = 1, int pageSize = 20) =>
        {
            RequestStatus? st = null;
            if (!string.IsNullOrEmpty(status) && status != "all")
            {
                if (!Enum.TryParse<RequestStatus>(status, ignoreCase: true, out var parsed)) return Results.Problem(l["SecretInvalid"], statusCode: 400);
                st = parsed;
            }
            var order = sort switch
            {
                null or "" or "created_desc" => RequestSort.CreatedDesc,
                "created_asc" => RequestSort.CreatedAsc,
                "expires_asc" => RequestSort.ExpiresAsc,
                "expires_desc" => RequestSort.ExpiresDesc,
                _ => (RequestSort?)null,
            };
            if (order is null) return Results.Problem(l["SecretInvalid"], statusCode: 400);

            var p = await svc.ListAsync(Claim(http, "sub")!, new RequestQuery(st, order.Value, page, pageSize), ct);
            return Results.Ok(new PageDto<RequestSummaryDto>(
                p.Items.Select(x => new RequestSummaryDto(x.Id, x.Question, Name(x.Status), x.CreatedAt, x.ExpiresAt, x.AnsweredAt)).ToList(),
                p.Total, p.PageNumber, p.PageSize));
        }).RequireAuthorization().AddEndpointFilter(RateLimitFilter.For("rq-read", 120, minute));

        g.MapGet("/{id:guid}", async (Guid id, HttpContext http, SecretRequestService svc, CancellationToken ct) =>
            await svc.GetAsync(Claim(http, "sub")!, id, ct) is { } x
                ? Results.Ok(new RequestSummaryDto(x.Id, x.Question, Name(x.Status), x.CreatedAt, x.ExpiresAt, x.AnsweredAt))
                : Results.NotFound())
            .RequireAuthorization().AddEndpointFilter(RateLimitFilter.For("rq-read", 120, minute));

        // Nicht destruktiv: der Browser prüft damit die Passphrase, bevor die Antwort verbraucht wird.
        g.MapGet("/{id:guid}/key", async (Guid id, HttpContext http, SecretRequestService svc, CancellationToken ct) =>
            await svc.GetWrappedKeyAsync(Claim(http, "sub")!, id, ct) is { } k
                ? Results.Ok(new WrappedKeyDto(Base64Url.EncodeToString(k)))
                : Results.NotFound())
            .RequireAuthorization().AddEndpointFilter(RateLimitFilter.For("rq-open", 30, minute));

        // POST, nicht GET: einmalig und mit Wirkung.
        g.MapPost("/{id:guid}/open", async (Guid id, HttpContext http, SecretRequestService svc, CancellationToken ct) =>
            await svc.OpenAsync(Claim(http, "sub")!, id, ct) is { } c
                ? Results.Ok(new OpenedResponseDto(Base64Url.EncodeToString(c)))
                : Results.NotFound())
            .RequireAuthorization().AddEndpointFilter(RateLimitFilter.For("rq-open", 30, minute));

        g.MapDelete("/{id:guid}", async (Guid id, HttpContext http, SecretRequestService svc, CancellationToken ct) =>
            await svc.DeleteAsync(Claim(http, "sub")!, id, ct) ? Results.NoContent() : Results.NotFound())
            .RequireAuthorization().AddEndpointFilter(RateLimitFilter.For("rq-read", 120, minute));

        // ---- Kunde ohne Login: der Link ist die Berechtigung ---------------------------------------

        g.MapGet("/{id:guid}/public", async (Guid id, SecretRequestService svc, CancellationToken ct) =>
            await svc.GetPublicAsync(id, ct) is { } p
                ? Results.Ok(new PublicRequestDto(p.Question, p.OwnerName, Base64Url.EncodeToString(p.PublicKey), p.ExpiresAt))
                : Results.NotFound())
            .AddEndpointFilter(RateLimitFilter.For("rq-public", 60, minute));

        g.MapPost("/{id:guid}/answer", async (Guid id, AnswerRequestBody body, SecretRequestService svc, IStringLocalizer<Messages> l, CancellationToken ct) =>
        {
            if (!TryDecode(body.Ciphertext, SecretRequestService.MaxAnswerBytes, out var blob))
                return Results.Problem(l["SecretTooLarge"], statusCode: StatusCodes.Status413PayloadTooLarge);
            return await svc.AnswerAsync(id, blob, ct) switch
            {
                AnswerResult.Ok => Results.NoContent(),
                AnswerResult.NotOpen => Results.NotFound(),
                AnswerResult.TooLarge => Results.Problem(l["SecretTooLarge"], statusCode: StatusCodes.Status413PayloadTooLarge),
                _ => Results.Problem(l["SecretInvalid"], statusCode: StatusCodes.Status400BadRequest),
            };
        }).AddEndpointFilter(RateLimitFilter.For("rq-answer", 10, minute));
    }
}
