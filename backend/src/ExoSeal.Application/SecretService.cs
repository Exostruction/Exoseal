using ExoSeal.Domain;

namespace ExoSeal.Application;

public enum SecretError { TooLarge, TooSmall, InvalidTtl, InvalidLabel, QuotaReached }

public readonly record struct CreateResult(Guid? Id, SecretError? Error);

public sealed class SecretService(ISecretStore store, TimeProvider clock)
{
    public const int MaxCiphertextBytes = 64 * 1024;
    /// <summary>Kleinste gültige Blob-Größe von Format v1: 2 Header + 16 Salt + 12 IV + 16 GCM-Tag.</summary>
    public const int MinCiphertextBytes = 46;
    public static readonly TimeSpan MinTtl = TimeSpan.FromMinutes(1);
    public static readonly TimeSpan MaxTtl = TimeSpan.FromDays(7);
    public const int MaxLabelLength = 80;
    public const int MaxActivePerUser = 500; // laufende Links pro Nutzer
    public const int MaxPageSize = 50;

    public async Task<CreateResult> CreateAsync(byte[] ciphertext, TimeSpan ttl, string? ownerSub = null, string? label = null, CancellationToken ct = default)
    {
        if (ciphertext.Length > MaxCiphertextBytes) return new(null, SecretError.TooLarge);
        if (ciphertext.Length < MinCiphertextBytes) return new(null, SecretError.TooSmall);
        if (ttl < MinTtl || ttl > MaxTtl) return new(null, SecretError.InvalidTtl);
        label = string.IsNullOrWhiteSpace(label) ? null : label.Trim();
        if (label is { Length: > MaxLabelLength }) return new(null, SecretError.InvalidLabel);

        var now = clock.GetUtcNow();
        // Kontingent: ein gekaperter oder fehlerhafter Zugang soll die Datenbank nicht füllen können.
        if (ownerSub is not null && await store.CountActiveOwnedAsync(ownerSub, now, ct) >= MaxActivePerUser) return new(null, SecretError.QuotaReached);
        var secret = new Secret { Ciphertext = ciphertext, CreatedAt = now, ExpiresAt = now + ttl, OwnerSub = ownerSub, Label = label };
        await store.AddAsync(secret, ct);
        return new(secret.Id, null);
    }

    /// <summary>Einmaliger Abruf: danach ist das Secret gelöscht. null = unbekannt, schon abgerufen oder abgelaufen.</summary>
    public Task<byte[]?> RevealAsync(Guid id, CancellationToken ct = default) => store.TakeAsync(id, clock.GetUtcNow(), ct);

    /// <summary>Meldung (Notice-and-Action): löscht das Secret, ohne es zu lesen. Wer die ID kennt, konnte es schon per Abruf verbrauchen, die Meldung gibt also keine neue Macht. false = gab es nicht (mehr), dann bleibt der alte Status stehen.</summary>
    public Task<bool> ReportAsync(Guid id, CancellationToken ct = default) => store.DeleteAsync(id, clock.GetUtcNow(), ct);

    public Task<bool> RevokeAsync(string ownerSub, Guid id, CancellationToken ct = default) => store.RevokeOwnedAsync(ownerSub, id, clock.GetUtcNow(), ct);

    public Task<Page<SentSummary>> ListSentAsync(string ownerSub, int page, int pageSize, CancellationToken ct = default) =>
        store.ListOwnedAsync(ownerSub, Math.Max(1, page), Math.Clamp(pageSize, 1, MaxPageSize), clock.GetUtcNow(), ct);

    /// <summary>Wozu der Link nicht mehr taugt, falls ein Abruf ins Leere ging. Gibt nur Auskunft, wer die ID schon kennt.</summary>
    public Task<SecretOutcome?> OutcomeAsync(Guid id, CancellationToken ct = default) => store.GetOutcomeAsync(id, clock.GetUtcNow(), ct);
}
