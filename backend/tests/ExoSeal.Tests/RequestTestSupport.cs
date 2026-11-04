using ExoSeal.Application;
using ExoSeal.Domain;
using ExoSeal.Infrastructure;
using Microsoft.EntityFrameworkCore;

namespace ExoSeal.Tests;

public static class Req
{
    public static readonly DateTimeOffset Now = DateTimeOffset.UtcNow;

    public static byte[] PublicKey() => [0x04, .. Enumerable.Range(0, 64).Select(i => (byte)i)];
    public static byte[] Wrapped() => TestDb.Blob(190);
    public static byte[] Answer(int size = 120) => TestDb.Blob(size);

    /// <summary>Direkt in die Datenbank, mit frei wählbarem Zustand. Jeder Test nimmt seinen eigenen Besitzer, damit Tests sich nicht stören.</summary>
    public static async Task<SecretRequest> Seed(string owner, Action<SecretRequest>? tweak = null)
    {
        var r = new SecretRequest
        {
            OwnerSub = owner, OwnerEmail = "owner@example.org", OwnerName = "Owner", Locale = "en", Question = "Staging password?",
            PublicKey = PublicKey(), WrappedPrivateKey = Wrapped(), CreatedAt = Now.AddHours(-1), ExpiresAt = Now.AddDays(7),
        };
        tweak?.Invoke(r);
        await using var db = TestDb.NewContext();
        db.SecretRequests.Add(r);
        await db.SaveChangesAsync();
        return r;
    }

    /// <summary>Die Benachrichtigungs-Warteschlange ist global. Tests, die sie benutzen, haken vorher Altlasten anderer Tests ab,
    /// sonst werden sie mit jedem Lauf langsamer und hängen von Reihenfolge und Datenmenge ab.</summary>
    public static async Task DrainNotificationQueue()
    {
        await using var db = TestDb.NewContext();
        await db.Database.ExecuteSqlRawAsync(
            "UPDATE secret_requests SET \"MailSentAt\" = now(), \"WebhookSentAt\" = now() WHERE \"AnsweredAt\" IS NOT NULL AND (\"MailSentAt\" IS NULL OR \"WebhookSentAt\" IS NULL)");
    }

    public static string NewOwner() => "owner-" + Guid.NewGuid().ToString("N");

    public static async Task<T> With<T>(Func<SecretRequestStore, Task<T>> f)
    {
        await using var db = TestDb.NewContext();
        return await f(new SecretRequestStore(db));
    }

    public static async Task<SecretRequest> Reload(Guid id)
    {
        await using var db = TestDb.NewContext();
        return db.SecretRequests.Single(x => x.Id == id);
    }
}

/// <summary>Store für reine Service-Tests: merkt sich nur, was gespeichert wurde.</summary>
public sealed class CapturingRequestStore : ISecretRequestStore
{
    public List<SecretRequest> Added { get; } = [];
    public bool AnswerResult { get; set; } = true;
    public Task AddAsync(SecretRequest r, CancellationToken ct = default) { Added.Add(r); return Task.CompletedTask; }
    public Task<int> CountActiveOwnedAsync(string ownerSub, DateTimeOffset now, CancellationToken ct = default) => Task.FromResult(Added.Count(x => x.OwnerSub == ownerSub && x.ExpiresAt > now));
    public Task<bool> TryAnswerAsync(Guid id, byte[] c, DateTimeOffset now, CancellationToken ct = default) => Task.FromResult(AnswerResult);
    public Task<PublicRequestInfo?> GetOpenAsync(Guid id, DateTimeOffset now, CancellationToken ct = default) => throw new NotImplementedException();
    public RequestQuery? LastQuery { get; private set; }
    public Task<Page<RequestSummary>> ListAsync(string o, RequestQuery q, DateTimeOffset now, CancellationToken ct = default)
    {
        LastQuery = q;
        return Task.FromResult(new Page<RequestSummary>([], 0, q.Page, q.PageSize));
    }
    public Task<RequestSummary?> GetOwnedAsync(string o, Guid id, DateTimeOffset now, CancellationToken ct = default) => throw new NotImplementedException();
    public Task<byte[]?> GetWrappedKeyAsync(string o, Guid id, CancellationToken ct = default) => throw new NotImplementedException();
    public Task<byte[]?> TakeResponseAsync(string o, Guid id, DateTimeOffset now, CancellationToken ct = default) => throw new NotImplementedException();
    public Task<bool> DeleteOwnedAsync(string o, Guid id, CancellationToken ct = default) => throw new NotImplementedException();
    public Task<int> CleanupAsync(DateTimeOffset now, CancellationToken ct = default) => throw new NotImplementedException();
    public Task<IReadOnlyList<PendingNotification>> GetPendingNotificationsAsync(bool m, bool w, int max, int take, DateTimeOffset now, CancellationToken ct = default) => throw new NotImplementedException();
    public Task MarkNotifiedAsync(Guid id, bool m, bool w, DateTimeOffset? retryAt, DateTimeOffset now, CancellationToken ct = default) => throw new NotImplementedException();
}
