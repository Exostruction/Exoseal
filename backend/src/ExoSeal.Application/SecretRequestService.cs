using ExoSeal.Domain;

namespace ExoSeal.Application;

public enum RequestError { QuestionInvalid, PublicKeyInvalid, WrappedKeyInvalid, TtlInvalid, QuotaReached }
public enum AnswerResult { Ok, NotOpen, TooLarge, Invalid }

public readonly record struct CreateRequestResult(Guid? Id, RequestError? Error);

public sealed record CreateRequestCommand(
    string OwnerSub, string? OwnerEmail, string? OwnerName, string Locale,
    string Question, byte[] PublicKey, byte[] WrappedPrivateKey, int ExpiresInDays);

public sealed class SecretRequestService(ISecretRequestStore store, TimeProvider clock)
{
    public const int MaxQuestionLength = 200;
    public const int MaxActivePerUser = 200; // laufende Anfragen pro Nutzer
    public const int PublicKeyBytes = 65;                     // unkomprimierter P-256-Punkt: 0x04 || X || Y
    public const int MinWrappedKeyBytes = 100, MaxWrappedKeyBytes = 1024;
    public const int MinAnswerBytes = 94;                     // 1 Version + 65 flüchtiger Public Key + 12 IV + 16 GCM-Tag
    public const int MaxAnswerBytes = 64 * 1024;
    public const int MinDays = 1, MaxDays = 30;
    public const int MaxPageSize = 50;
    public static readonly TimeSpan AnswerRetention = TimeSpan.FromDays(7);   // so lange bleibt eine Antwort abholbar
    public static readonly TimeSpan HistoryRetention = TimeSpan.FromDays(30); // so lange bleibt die Zeile in der Übersicht

    public async Task<CreateRequestResult> CreateAsync(CreateRequestCommand c, CancellationToken ct = default)
    {
        var question = c.Question?.Trim() ?? "";
        if (question.Length is 0 or > MaxQuestionLength) return new(null, RequestError.QuestionInvalid);
        if (c.PublicKey.Length != PublicKeyBytes || c.PublicKey[0] != 0x04) return new(null, RequestError.PublicKeyInvalid);
        if (c.WrappedPrivateKey.Length is < MinWrappedKeyBytes or > MaxWrappedKeyBytes) return new(null, RequestError.WrappedKeyInvalid);
        if (c.ExpiresInDays is < MinDays or > MaxDays) return new(null, RequestError.TtlInvalid);

        var now = clock.GetUtcNow();
        if (await store.CountActiveOwnedAsync(c.OwnerSub, now, ct) >= MaxActivePerUser) return new(null, RequestError.QuotaReached);
        var r = new SecretRequest
        {
            OwnerSub = c.OwnerSub, OwnerEmail = c.OwnerEmail, OwnerName = c.OwnerName, Locale = c.Locale,
            Question = question, PublicKey = c.PublicKey, WrappedPrivateKey = c.WrappedPrivateKey,
            CreatedAt = now, ExpiresAt = now.AddDays(c.ExpiresInDays),
        };
        await store.AddAsync(r, ct);
        return new(r.Id, null);
    }

    public Task<PublicRequestInfo?> GetPublicAsync(Guid id, CancellationToken ct = default) => store.GetOpenAsync(id, clock.GetUtcNow(), ct);

    public async Task<AnswerResult> AnswerAsync(Guid id, byte[] ciphertext, CancellationToken ct = default)
    {
        if (ciphertext.Length > MaxAnswerBytes) return AnswerResult.TooLarge;
        if (ciphertext.Length < MinAnswerBytes) return AnswerResult.Invalid;
        return await store.TryAnswerAsync(id, ciphertext, clock.GetUtcNow(), ct) ? AnswerResult.Ok : AnswerResult.NotOpen;
    }

    public Task<Page<RequestSummary>> ListAsync(string ownerSub, RequestQuery q, CancellationToken ct = default) =>
        store.ListAsync(ownerSub, q with { Page = Math.Max(1, q.Page), PageSize = Math.Clamp(q.PageSize, 1, MaxPageSize) }, clock.GetUtcNow(), ct);

    public Task<RequestSummary?> GetAsync(string ownerSub, Guid id, CancellationToken ct = default) => store.GetOwnedAsync(ownerSub, id, clock.GetUtcNow(), ct);
    public Task<byte[]?> GetWrappedKeyAsync(string ownerSub, Guid id, CancellationToken ct = default) => store.GetWrappedKeyAsync(ownerSub, id, ct);
    public Task<byte[]?> OpenAsync(string ownerSub, Guid id, CancellationToken ct = default) => store.TakeResponseAsync(ownerSub, id, clock.GetUtcNow(), ct);
    public Task<bool> DeleteAsync(string ownerSub, Guid id, CancellationToken ct = default) => store.DeleteOwnedAsync(ownerSub, id, ct);
}
