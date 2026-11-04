using ExoSeal.Application;
using ExoSeal.Domain;
using Microsoft.EntityFrameworkCore;
using Npgsql;

namespace ExoSeal.Infrastructure;

public sealed class SecretRequestStore(AppDbContext db) : ISecretRequestStore
{
    public async Task AddAsync(SecretRequest request, CancellationToken ct = default)
    {
        db.SecretRequests.Add(request);
        await db.SaveChangesAsync(ct);
    }

    public async Task<PublicRequestInfo?> GetOpenAsync(Guid id, DateTimeOffset now, CancellationToken ct = default)
    {
        var r = await db.SecretRequests
            .Where(x => x.Id == id && x.AnsweredAt == null && x.ExpiresAt > now)
            .Select(x => new { x.Question, x.OwnerName, x.PublicKey, x.ExpiresAt })
            .FirstOrDefaultAsync(ct);
        return r is null ? null : new PublicRequestInfo(r.Question, r.OwnerName, r.PublicKey, r.ExpiresAt);
    }

    // Ein Statement mit Bedingung im WHERE: bei zwei gleichzeitigen Antworten gewinnt genau eine.
    public async Task<bool> TryAnswerAsync(Guid id, byte[] ciphertext, DateTimeOffset now, CancellationToken ct = default) =>
        await db.SecretRequests
            .Where(x => x.Id == id && x.AnsweredAt == null && x.ExpiresAt > now)
            .ExecuteUpdateAsync(s => s.SetProperty(x => x.AnsweredAt, now).SetProperty(x => x.ResponseCiphertext, ciphertext), ct) == 1;

    public Task<int> CountActiveOwnedAsync(string ownerSub, DateTimeOffset now, CancellationToken ct = default) =>
        db.SecretRequests.CountAsync(x => x.OwnerSub == ownerSub && x.ConsumedAt == null && x.ExpiresAt > now, ct);

    public async Task<Page<RequestSummary>> ListAsync(string ownerSub, RequestQuery query, DateTimeOffset now, CancellationToken ct = default)
    {
        var q = db.SecretRequests.Where(x => x.OwnerSub == ownerSub);
        q = query.Status switch
        {
            RequestStatus.Open => q.Where(x => x.AnsweredAt == null && x.ExpiresAt > now),
            RequestStatus.Answered => q.Where(x => x.ConsumedAt == null && x.AnsweredAt != null && x.ResponseCiphertext != null),
            RequestStatus.Consumed => q.Where(x => x.ConsumedAt != null),
            RequestStatus.Expired => q.Where(x => x.ConsumedAt == null &&
                ((x.AnsweredAt == null && x.ExpiresAt <= now) || (x.AnsweredAt != null && x.ResponseCiphertext == null))),
            _ => q,
        };

        var total = await q.CountAsync(ct);
        var sorted = query.Sort switch
        {
            RequestSort.CreatedAsc => q.OrderBy(x => x.CreatedAt),
            RequestSort.ExpiresAsc => q.OrderBy(x => x.ExpiresAt),
            RequestSort.ExpiresDesc => q.OrderByDescending(x => x.ExpiresAt),
            _ => q.OrderByDescending(x => x.CreatedAt),
        };
        var rows = await sorted.ThenBy(x => x.Id) // stabile Reihenfolge, sonst wandern Einträge zwischen Seiten
            .Skip((query.Page - 1) * query.PageSize).Take(query.PageSize)
            .Select(x => new Row(x.Id, x.Question, x.CreatedAt, x.ExpiresAt, x.AnsweredAt, x.ConsumedAt, x.ResponseCiphertext != null))
            .ToListAsync(ct);
        return new Page<RequestSummary>(rows.Select(r => r.ToSummary(now)).ToList(), total, query.Page, query.PageSize);
    }

    public async Task<RequestSummary?> GetOwnedAsync(string ownerSub, Guid id, DateTimeOffset now, CancellationToken ct = default) =>
        (await db.SecretRequests.Where(x => x.OwnerSub == ownerSub && x.Id == id)
            .Select(x => new Row(x.Id, x.Question, x.CreatedAt, x.ExpiresAt, x.AnsweredAt, x.ConsumedAt, x.ResponseCiphertext != null))
            .FirstOrDefaultAsync(ct))?.ToSummary(now);

    public Task<byte[]?> GetWrappedKeyAsync(string ownerSub, Guid id, CancellationToken ct = default) =>
        db.SecretRequests
            .Where(x => x.OwnerSub == ownerSub && x.Id == id && x.ConsumedAt == null && x.ResponseCiphertext != null)
            .Select(x => x.WrappedPrivateKey).FirstOrDefaultAsync(ct);

    // Ein Statement: die Unterabfrage sperrt die Zeile (FOR UPDATE), der zweite Aufrufer prüft die Bedingung danach erneut und geht leer aus.
    // Roh über ADO, weil EF den Wert vor dem Überschreiben nicht zurückgeben kann.
    public async Task<byte[]?> TakeResponseAsync(string ownerSub, Guid id, DateTimeOffset now, CancellationToken ct = default)
    {
        var conn = db.Database.GetDbConnection();
        if (conn.State != System.Data.ConnectionState.Open) await conn.OpenAsync(ct);
        await using var cmd = conn.CreateCommand();
        cmd.CommandText = """
            UPDATE secret_requests r
            SET "ConsumedAt" = @now, "ResponseCiphertext" = NULL, "WrappedPrivateKey" = NULL
            FROM (SELECT "Id", "ResponseCiphertext" AS "Old" FROM secret_requests
                  WHERE "Id" = @id AND "OwnerSub" = @owner AND "ConsumedAt" IS NULL AND "ResponseCiphertext" IS NOT NULL
                  FOR UPDATE) o
            WHERE r."Id" = o."Id"
            RETURNING o."Old"
            """;
        cmd.Parameters.Add(new NpgsqlParameter("id", id));
        cmd.Parameters.Add(new NpgsqlParameter("owner", ownerSub));
        cmd.Parameters.Add(new NpgsqlParameter("now", now));
        return await cmd.ExecuteScalarAsync(ct) as byte[];
    }

    public async Task<bool> DeleteOwnedAsync(string ownerSub, Guid id, CancellationToken ct = default) =>
        await db.SecretRequests.Where(x => x.OwnerSub == ownerSub && x.Id == id).ExecuteDeleteAsync(ct) > 0;

    public async Task<int> CleanupAsync(DateTimeOffset now, CancellationToken ct = default)
    {
        var answerCutoff = now - SecretRequestService.AnswerRetention;
        var historyCutoff = now - SecretRequestService.HistoryRetention;

        // Blobs weg, sobald sie nutzlos sind: unbeantwortet und abgelaufen, oder Antwort zu lange nicht abgeholt.
        var wiped = await db.SecretRequests
            .Where(x => (x.WrappedPrivateKey != null || x.ResponseCiphertext != null) &&
                ((x.AnsweredAt == null && x.ExpiresAt <= now) || (x.AnsweredAt != null && x.AnsweredAt <= answerCutoff)))
            .ExecuteUpdateAsync(s => s.SetProperty(x => x.WrappedPrivateKey, (byte[]?)null).SetProperty(x => x.ResponseCiphertext, (byte[]?)null), ct);

        // Zeilen (nur Metadaten) verschwinden nach der Historien-Frist.
        var deleted = await db.SecretRequests
            .Where(x => x.ExpiresAt <= historyCutoff && (x.AnsweredAt == null || x.AnsweredAt <= historyCutoff))
            .ExecuteDeleteAsync(ct);
        return wiped + deleted;
    }

    public async Task<IReadOnlyList<PendingNotification>> GetPendingNotificationsAsync(bool mail, bool webhook, int maxAttempts, int take, DateTimeOffset now, CancellationToken ct = default)
    {
        var rows = await db.SecretRequests
            .Where(x => x.AnsweredAt != null && x.ConsumedAt == null && x.NotifyAttempts < maxAttempts &&
                (x.NotifyNextAt == null || x.NotifyNextAt <= now) &&
                ((mail && x.MailSentAt == null) || (webhook && x.WebhookSentAt == null)))
            .OrderBy(x => x.AnsweredAt).Take(take)
            .Select(x => new { x.Id, x.OwnerEmail, x.Locale, AnsweredAt = x.AnsweredAt!.Value, x.NotifyAttempts, MailOpen = x.MailSentAt == null, HookOpen = x.WebhookSentAt == null })
            .ToListAsync(ct);
        return rows.Select(r => new PendingNotification(r.Id, r.OwnerEmail, r.Locale, r.AnsweredAt, r.NotifyAttempts, mail && r.MailOpen, webhook && r.HookOpen)).ToList();
    }

    public async Task MarkNotifiedAsync(Guid id, bool mailSent, bool webhookSent, DateTimeOffset? retryAt, DateTimeOffset now, CancellationToken ct = default)
    {
        var q = db.SecretRequests.Where(x => x.Id == id);
        if (mailSent) await q.ExecuteUpdateAsync(s => s.SetProperty(x => x.MailSentAt, now), ct);
        if (webhookSent) await q.ExecuteUpdateAsync(s => s.SetProperty(x => x.WebhookSentAt, now), ct);
        if (retryAt is { } next)
            await q.ExecuteUpdateAsync(s => s.SetProperty(x => x.NotifyAttempts, x => x.NotifyAttempts + 1).SetProperty(x => x.NotifyNextAt, next), ct);
    }

    private sealed record Row(Guid Id, string Question, DateTimeOffset CreatedAt, DateTimeOffset ExpiresAt, DateTimeOffset? AnsweredAt, DateTimeOffset? ConsumedAt, bool HasResponse)
    {
        public RequestSummary ToSummary(DateTimeOffset now) =>
            new(Id, Question, SecretRequest.StatusOf(ConsumedAt, AnsweredAt, HasResponse, ExpiresAt, now), CreatedAt, ExpiresAt, AnsweredAt);
    }
}
