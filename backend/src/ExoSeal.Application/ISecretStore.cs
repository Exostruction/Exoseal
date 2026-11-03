using ExoSeal.Domain;

namespace ExoSeal.Application;

public enum SentState { Available, Opened, Expired, Reported, Revoked }

public sealed record SentSummary(Guid Id, string? Label, SentState State, DateTimeOffset CreatedAt, DateTimeOffset ExpiresAt);

public interface ISecretStore
{
    Task AddAsync(Secret secret, CancellationToken ct = default);

    /// <summary>Wie viele noch nicht abgerufene, nicht abgelaufene Links der Ersteller hat (fürs Kontingent).</summary>
    Task<int> CountActiveOwnedAsync(string ownerSub, DateTimeOffset now, CancellationToken ct = default);

    /// <summary>Atomar lesen und löschen und dabei "geöffnet" vermerken. Genau ein Aufrufer bekommt den Chiffretext, alle anderen null.</summary>
    Task<byte[]?> TakeAsync(Guid id, DateTimeOffset now, CancellationToken ct = default);

    /// <summary>Löscht Abgelaufene (vermerkt "abgelaufen") und räumt alte Vermerke auf.</summary>
    Task<int> DeleteExpiredAsync(DateTimeOffset now, CancellationToken ct = default);

    /// <summary>Löscht anhand der ID, ohne den Inhalt zu lesen. Gibt zurück, ob es etwas zu löschen gab.</summary>
    Task<bool> DeleteAsync(Guid id, DateTimeOffset now, CancellationToken ct = default);

    /// <summary>Der Ersteller zieht seinen noch nicht abgerufenen Link zurück. false = nicht (mehr) vorhanden oder nicht seiner.</summary>
    Task<bool> RevokeOwnedAsync(string ownerSub, Guid id, DateTimeOffset now, CancellationToken ct = default);

    /// <summary>Die gesendeten Links eines Erstellers, neueste zuerst. Seitenbildung läuft in der Datenbank, Inhalte werden nie geladen.</summary>
    Task<Page<SentSummary>> ListOwnedAsync(string ownerSub, int page, int pageSize, DateTimeOffset now, CancellationToken ct = default);

    /// <summary>Grund, warum die ID nicht mehr abrufbar ist. null = unbekannt (nie gesehen oder Vermerk schon aufgeräumt).</summary>
    Task<SecretOutcome?> GetOutcomeAsync(Guid id, DateTimeOffset now, CancellationToken ct = default);
}

public interface IRateLimiter
{
    /// <summary>true = erlaubt. <paramref name="clientId"/> (z. B. IP) wird nie im Klartext gespeichert.</summary>
    Task<bool> AllowAsync(string bucket, string clientId, int limit, TimeSpan window, CancellationToken ct = default);
}
