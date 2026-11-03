using ExoSeal.Application;
using ExoSeal.Domain;
using Microsoft.EntityFrameworkCore;
using Npgsql;

namespace ExoSeal.Infrastructure;

public sealed class SecretStore(AppDbContext db) : ISecretStore
{
    /// <summary>So lange bleibt der Vermerk: Der Link kann den Grund nennen, und der Ersteller behält den Eintrag in seiner Liste.</summary>
    public static readonly TimeSpan TombstoneRetention = TimeSpan.FromDays(30);

    public async Task AddAsync(Secret secret, CancellationToken ct = default)
    {
        db.Secrets.Add(secret);
        await db.SaveChangesAsync(ct);
    }

    public Task<int> CountActiveOwnedAsync(string ownerSub, DateTimeOffset now, CancellationToken ct = default) =>
        db.Secrets.CountAsync(s => s.OwnerSub == ownerSub && s.ExpiresAt > now, ct);

    // Ein einziges Statement: kein Fenster zwischen Lesen, Löschen und Vermerken, auch bei parallelen Abrufen.
    // Roh über ADO, weil EF DELETE ... RETURNING nicht in eine Unterabfrage packen kann.
    public async Task<byte[]?> TakeAsync(Guid id, DateTimeOffset now, CancellationToken ct = default)
    {
        await using var cmd = await Command(
            """
            WITH d AS (DELETE FROM secrets WHERE "Id" = @id AND "ExpiresAt" > @now RETURNING "Id", "Ciphertext", "OwnerSub", "Label", "CreatedAt", "ExpiresAt"),
                 t AS (INSERT INTO secret_tombstones ("Id", "Outcome", "At", "OwnerSub", "Label", "CreatedAt", "ExpiresAt") SELECT "Id", 1, @now, "OwnerSub", "Label", "CreatedAt", "ExpiresAt" FROM d ON CONFLICT ("Id") DO NOTHING)
            SELECT "Ciphertext" FROM d
            """, ct);
        cmd.Parameters.Add(new NpgsqlParameter("id", id));
        cmd.Parameters.Add(new NpgsqlParameter("now", now));
        return await cmd.ExecuteScalarAsync(ct) as byte[];
    }

    public async Task<int> DeleteExpiredAsync(DateTimeOffset now, CancellationToken ct = default)
    {
        await using var cmd = await Command(
            """
            WITH d AS (DELETE FROM secrets WHERE "ExpiresAt" <= @now RETURNING "Id", "OwnerSub", "Label", "CreatedAt", "ExpiresAt")
            INSERT INTO secret_tombstones ("Id", "Outcome", "At", "OwnerSub", "Label", "CreatedAt", "ExpiresAt") SELECT "Id", 2, @now, "OwnerSub", "Label", "CreatedAt", "ExpiresAt" FROM d ON CONFLICT ("Id") DO NOTHING
            """, ct);
        cmd.Parameters.Add(new NpgsqlParameter("now", now));
        var expired = await cmd.ExecuteNonQueryAsync(ct);
        var cutoff = now - TombstoneRetention;
        await db.Tombstones.Where(t => t.At < cutoff).ExecuteDeleteAsync(ct);
        return expired;
    }

    public async Task<bool> DeleteAsync(Guid id, DateTimeOffset now, CancellationToken ct = default)
    {
        await using var cmd = await Command(
            """
            WITH d AS (DELETE FROM secrets WHERE "Id" = @id RETURNING "Id", "OwnerSub", "Label", "CreatedAt", "ExpiresAt")
            INSERT INTO secret_tombstones ("Id", "Outcome", "At", "OwnerSub", "Label", "CreatedAt", "ExpiresAt") SELECT "Id", 3, @now, "OwnerSub", "Label", "CreatedAt", "ExpiresAt" FROM d ON CONFLICT ("Id") DO NOTHING
            """, ct);
        cmd.Parameters.Add(new NpgsqlParameter("id", id));
        cmd.Parameters.Add(new NpgsqlParameter("now", now));
        return await cmd.ExecuteNonQueryAsync(ct) > 0;
    }

    public async Task<bool> RevokeOwnedAsync(string ownerSub, Guid id, DateTimeOffset now, CancellationToken ct = default)
    {
        await using var cmd = await Command(
            """
            WITH d AS (DELETE FROM secrets WHERE "Id" = @id AND "OwnerSub" = @owner RETURNING "Id", "OwnerSub", "Label", "CreatedAt", "ExpiresAt")
            INSERT INTO secret_tombstones ("Id", "Outcome", "At", "OwnerSub", "Label", "CreatedAt", "ExpiresAt") SELECT "Id", 4, @now, "OwnerSub", "Label", "CreatedAt", "ExpiresAt" FROM d ON CONFLICT ("Id") DO NOTHING
            """, ct);
        cmd.Parameters.Add(new NpgsqlParameter("id", id));
        cmd.Parameters.Add(new NpgsqlParameter("owner", ownerSub));
        cmd.Parameters.Add(new NpgsqlParameter("now", now));
        return await cmd.ExecuteNonQueryAsync(ct) > 0;
    }

    private sealed class Row
    {
        public Guid Id { get; set; }
        public string? Label { get; set; }
        public short Outcome { get; set; } // 0 = Link besteht noch
        public DateTimeOffset CreatedAt { get; set; }
        public DateTimeOffset ExpiresAt { get; set; }
    }

    public async Task<Page<SentSummary>> ListOwnedAsync(string ownerSub, int page, int pageSize, DateTimeOffset now, CancellationToken ct = default)
    {
        var live = db.Secrets.AsNoTracking().Where(s => s.OwnerSub == ownerSub)
            .Select(s => new Row { Id = s.Id, Label = s.Label, Outcome = 0, CreatedAt = s.CreatedAt, ExpiresAt = s.ExpiresAt });
        var gone = db.Tombstones.AsNoTracking().Where(t => t.OwnerSub == ownerSub)
            .Select(t => new Row { Id = t.Id, Label = t.Label, Outcome = (short)t.Outcome, CreatedAt = t.CreatedAt ?? t.At, ExpiresAt = t.ExpiresAt ?? t.At });
        var all = live.Concat(gone);
        var total = await all.CountAsync(ct);
        var rows = await all.OrderByDescending(r => r.CreatedAt).ThenBy(r => r.Id).Skip((page - 1) * pageSize).Take(pageSize).ToListAsync(ct);
        return new Page<SentSummary>(rows.Select(r => new SentSummary(r.Id, r.Label, StateOf(r, now), r.CreatedAt, r.ExpiresAt)).ToList(), total, page, pageSize);
    }

    private static SentState StateOf(Row r, DateTimeOffset now) => r.Outcome switch
    {
        0 => r.ExpiresAt <= now ? SentState.Expired : SentState.Available,
        1 => SentState.Opened,
        2 => SentState.Expired,
        3 => SentState.Reported,
        _ => SentState.Revoked,
    };

    public async Task<SecretOutcome?> GetOutcomeAsync(Guid id, DateTimeOffset now, CancellationToken ct = default)
    {
        var t = await db.Tombstones.AsNoTracking().Where(x => x.Id == id).Select(x => (SecretOutcome?)x.Outcome).FirstOrDefaultAsync(ct);
        if (t is not null) return t;
        // Abgelaufen, aber vom Aufräum-Job noch nicht entfernt.
        return await db.Secrets.AsNoTracking().AnyAsync(s => s.Id == id && s.ExpiresAt <= now, ct) ? SecretOutcome.Expired : null;
    }

    private async Task<System.Data.Common.DbCommand> Command(string sql, CancellationToken ct)
    {
        var conn = db.Database.GetDbConnection();
        if (conn.State != System.Data.ConnectionState.Open) await conn.OpenAsync(ct);
        var cmd = conn.CreateCommand();
        cmd.CommandText = sql;
        return cmd;
    }
}
