using ExoSeal.Domain;

namespace ExoSeal.Application;

public enum RequestSort { CreatedDesc, CreatedAsc, ExpiresAsc, ExpiresDesc }

public sealed record RequestQuery(RequestStatus? Status, RequestSort Sort, int Page, int PageSize);

public sealed record RequestSummary(Guid Id, string Question, RequestStatus Status, DateTimeOffset CreatedAt, DateTimeOffset ExpiresAt, DateTimeOffset? AnsweredAt);

public sealed record Page<T>(IReadOnlyList<T> Items, int Total, int PageNumber, int PageSize);

public sealed record PublicRequestInfo(string Question, string? OwnerName, byte[] PublicKey, DateTimeOffset ExpiresAt);

/// <summary>Was die Benachrichtigung braucht, nie Inhalte.</summary>
public sealed record PendingNotification(Guid Id, string? OwnerEmail, string Locale, DateTimeOffset AnsweredAt, int Attempts, bool NeedsMail, bool NeedsWebhook);

public interface ISecretRequestStore
{
    Task AddAsync(SecretRequest request, CancellationToken ct = default);

    /// <summary>Anfragen des Erstellers, die noch laufen (nicht abgelaufen, Antwort nicht abgeholt). Fürs Kontingent.</summary>
    Task<int> CountActiveOwnedAsync(string ownerSub, DateTimeOffset now, CancellationToken ct = default);

    /// <summary>Nur wenn noch offen (nicht beantwortet, nicht abgelaufen).</summary>
    Task<PublicRequestInfo?> GetOpenAsync(Guid id, DateTimeOffset now, CancellationToken ct = default);

    /// <summary>Atomar: nur die erste Antwort gewinnt. false = nicht offen.</summary>
    Task<bool> TryAnswerAsync(Guid id, byte[] ciphertext, DateTimeOffset now, CancellationToken ct = default);

    /// <summary>Filter, Sortierung und Pagination laufen komplett in der Datenbank; Blobs werden nicht geladen.</summary>
    Task<Page<RequestSummary>> ListAsync(string ownerSub, RequestQuery query, DateTimeOffset now, CancellationToken ct = default);

    Task<RequestSummary?> GetOwnedAsync(string ownerSub, Guid id, DateTimeOffset now, CancellationToken ct = default);

    /// <summary>Der verschlüsselte Private Key, solange eine ungeöffnete Antwort da ist. Nicht destruktiv: erst Passphrase prüfen, dann öffnen.</summary>
    Task<byte[]?> GetWrappedKeyAsync(string ownerSub, Guid id, CancellationToken ct = default);

    /// <summary>Atomar: gibt die Antwort genau einmal heraus und löscht Antwort und Schlüssel.</summary>
    Task<byte[]?> TakeResponseAsync(string ownerSub, Guid id, DateTimeOffset now, CancellationToken ct = default);

    Task<bool> DeleteOwnedAsync(string ownerSub, Guid id, CancellationToken ct = default);

    /// <summary>Löscht Blobs, die nicht mehr gebraucht werden, und alte Metadaten-Zeilen.</summary>
    Task<int> CleanupAsync(DateTimeOffset now, CancellationToken ct = default);

    /// <summary>Nur Einträge, die jetzt dran sind: Wartezeiten nach Fehlern werden in der Datenbank gefiltert, sonst verdrängen sie neue Einträge aus dem Limit.</summary>
    Task<IReadOnlyList<PendingNotification>> GetPendingNotificationsAsync(bool mail, bool webhook, int maxAttempts, int take, DateTimeOffset now, CancellationToken ct = default);

    /// <summary>retryAt != null heißt: etwas ist fehlgeschlagen. Zählt einen Versuch und setzt den nächsten Zeitpunkt.</summary>
    Task MarkNotifiedAsync(Guid id, bool mailSent, bool webhookSent, DateTimeOffset? retryAt, DateTimeOffset now, CancellationToken ct = default);
}
