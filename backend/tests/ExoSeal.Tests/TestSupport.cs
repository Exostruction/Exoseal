using ExoSeal.Application;
using ExoSeal.Domain;
using ExoSeal.Infrastructure;
using Microsoft.EntityFrameworkCore;

// Alle Tests teilen sich eine Datenbank, und der Aufräum-Test löscht abgelaufene Einträge mit einer Uhr in der Zukunft: parallel würde er frische Links der anderen Tests mitlöschen.
[assembly: CollectionBehavior(DisableTestParallelization = true)]

namespace ExoSeal.Tests;

/// <summary>Datenbank-Tests laufen nur mit TEST_POSTGRES (Connection-String einer leeren Postgres), sonst werden sie übersprungen.</summary>
public sealed class DbFactAttribute : FactAttribute
{
    public DbFactAttribute() { if (TestDb.Conn is null) Skip = "TEST_POSTGRES nicht gesetzt"; }
}

public static class TestDb
{
    public static string? Conn => Environment.GetEnvironmentVariable("TEST_POSTGRES");
    private static readonly object Gate = new();
    private static bool _migrated;

    private static AppDbContext Raw() => new(new DbContextOptionsBuilder<AppDbContext>().UseNpgsql(Conn).Options);

    /// <summary>Einmal pro Testlauf migrieren, bevor irgendein Test (oder der API-Host, der beim Start selbst migriert) loslegt.
    /// Sonst migrieren zwei Stellen parallel und eine scheitert mit "relation already exists".</summary>
    public static void EnsureMigrated()
    {
        if (Conn is null) return;
        lock (Gate)
        {
            if (_migrated) return;
            using var db = Raw();
            db.Database.Migrate();
            _migrated = true;
        }
    }

    public static AppDbContext NewContext()
    {
        EnsureMigrated();
        return Raw();
    }

    public static byte[] Blob(int length = 64) => Enumerable.Range(0, length).Select(i => (byte)(i % 251)).ToArray();
}

public sealed class FakeClock(DateTimeOffset now) : TimeProvider
{
    public DateTimeOffset Now { get; set; } = now;
    public override DateTimeOffset GetUtcNow() => Now;
}

public sealed class MemoryStore : ISecretStore
{
    public Dictionary<Guid, Secret> Items { get; } = [];
    public Dictionary<Guid, SecretOutcome> Outcomes { get; } = [];
    private readonly List<Secret> _history = [];
    public Task AddAsync(Secret s, CancellationToken ct = default) { Items[s.Id] = s; _history.Add(s); return Task.CompletedTask; }
    public Task<int> CountActiveOwnedAsync(string ownerSub, DateTimeOffset now, CancellationToken ct = default) => Task.FromResult(Items.Values.Count(s => s.OwnerSub == ownerSub && !s.IsExpired(now)));
    public Task<byte[]?> TakeAsync(Guid id, DateTimeOffset now, CancellationToken ct = default)
    {
        if (!Items.Remove(id, out var s) || s.IsExpired(now)) return Task.FromResult<byte[]?>(null);
        Outcomes[id] = SecretOutcome.Opened;
        return Task.FromResult<byte[]?>(s.Ciphertext);
    }
    public Task<int> DeleteExpiredAsync(DateTimeOffset now, CancellationToken ct = default) => Task.FromResult(0);
    public Task<bool> DeleteAsync(Guid id, DateTimeOffset now, CancellationToken ct = default)
    {
        var removed = Items.Remove(id);
        if (removed) Outcomes[id] = SecretOutcome.Reported;
        return Task.FromResult(removed);
    }
    public Task<bool> RevokeOwnedAsync(string ownerSub, Guid id, DateTimeOffset now, CancellationToken ct = default)
    {
        if (!Items.TryGetValue(id, out var s) || s.OwnerSub != ownerSub) return Task.FromResult(false);
        Items.Remove(id);
        Outcomes[id] = SecretOutcome.Revoked;
        return Task.FromResult(true);
    }
    public Task<Page<SentSummary>> ListOwnedAsync(string ownerSub, int page, int pageSize, DateTimeOffset now, CancellationToken ct = default)
    {
        var mine = _history.Where(s => s.OwnerSub == ownerSub).OrderByDescending(s => s.CreatedAt).ToList();
        SentState St(Secret s) => Outcomes.TryGetValue(s.Id, out var o) ? (SentState)(int)o : s.ExpiresAt <= now ? SentState.Expired : SentState.Available;
        var items = mine.Skip((page - 1) * pageSize).Take(pageSize).Select(s => new SentSummary(s.Id, s.Label, St(s), s.CreatedAt, s.ExpiresAt)).ToList();
        return Task.FromResult(new Page<SentSummary>(items, mine.Count, page, pageSize));
    }
    public Task<SecretOutcome?> GetOutcomeAsync(Guid id, DateTimeOffset now, CancellationToken ct = default) =>
        Task.FromResult<SecretOutcome?>(Outcomes.TryGetValue(id, out var o) ? o : null);
}

public sealed class DbTheoryAttribute : TheoryAttribute
{
    public DbTheoryAttribute() { if (TestDb.Conn is null) Skip = "TEST_POSTGRES nicht gesetzt"; }
}
