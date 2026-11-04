using ExoSeal.Application;
using ExoSeal.Domain;
using ExoSeal.Infrastructure;

namespace ExoSeal.Tests;

/// <summary>Gegen echte Postgres: die Garantien (atomar, einmalig) hängen am SQL, nicht an C#.</summary>
public class SecretStoreTests
{
    private static readonly DateTimeOffset Now = DateTimeOffset.UtcNow;

    private static async Task<Guid> Seed(DateTimeOffset expiresAt, string? owner = null, string? label = null)
    {
        await using var db = TestDb.NewContext();
        var s = new Secret { Ciphertext = TestDb.Blob(), CreatedAt = Now, ExpiresAt = expiresAt, OwnerSub = owner, Label = label };
        await new SecretStore(db).AddAsync(s);
        return s.Id;
    }

    private static async Task<byte[]?> Take(Guid id, DateTimeOffset at)
    {
        await using var db = TestDb.NewContext();
        return await new SecretStore(db).TakeAsync(id, at);
    }

    [DbFact]
    public async Task Take_returns_ciphertext_once_then_nothing()
    {
        var id = await Seed(Now.AddHours(1));
        Assert.Equal(TestDb.Blob(), await Take(id, Now));
        Assert.Null(await Take(id, Now));
    }

    [DbFact]
    public async Task Parallel_takes_have_exactly_one_winner()
    {
        var id = await Seed(Now.AddHours(1));
        var results = await Task.WhenAll(Enumerable.Range(0, 40).Select(_ => Task.Run(() => Take(id, Now))));
        Assert.Equal(1, results.Count(r => r is not null));
    }

    [DbFact]
    public async Task Expired_secret_is_not_returned()
    {
        var id = await Seed(Now.AddMinutes(1));
        Assert.Null(await Take(id, Now.AddMinutes(1)));
    }

    [DbFact]
    public async Task Cleanup_removes_only_expired()
    {
        var expired = await Seed(Now.AddMinutes(-10));
        var alive = await Seed(Now.AddHours(1));
        await using (var db = TestDb.NewContext())
            Assert.True(await new SecretStore(db).DeleteExpiredAsync(Now) >= 1);
        Assert.Null(await Take(expired, Now.AddMinutes(-20))); // weg, selbst wenn "noch gültig" gefragt wird
        Assert.NotNull(await Take(alive, Now));
    }

    private static async Task<SecretOutcome?> Outcome(Guid id, DateTimeOffset at)
    {
        await using var db = TestDb.NewContext();
        return await new SecretStore(db).GetOutcomeAsync(id, at);
    }

    [DbFact]
    public async Task Outcome_is_opened_after_take_and_stays_unknown_before()
    {
        var id = await Seed(Now.AddHours(1));
        Assert.Null(await Outcome(id, Now));
        await Take(id, Now);
        Assert.Equal(SecretOutcome.Opened, await Outcome(id, Now));
    }

    [DbFact]
    public async Task Outcome_is_reported_after_report_and_not_overwritten_by_later_report()
    {
        var id = await Seed(Now.AddHours(1));
        await using (var db = TestDb.NewContext()) Assert.True(await new SecretStore(db).DeleteAsync(id, Now));
        await using (var db = TestDb.NewContext()) Assert.False(await new SecretStore(db).DeleteAsync(id, Now));
        Assert.Equal(SecretOutcome.Reported, await Outcome(id, Now));
    }

    [DbFact]
    public async Task Outcome_is_expired_before_and_after_cleanup_and_old_tombstones_are_pruned()
    {
        var id = await Seed(Now.AddMinutes(-5));
        Assert.Equal(SecretOutcome.Expired, await Outcome(id, Now)); // noch nicht aufgeräumt
        await using (var db = TestDb.NewContext()) await new SecretStore(db).DeleteExpiredAsync(Now);
        Assert.Equal(SecretOutcome.Expired, await Outcome(id, Now)); // Vermerk
        await using (var db = TestDb.NewContext()) await new SecretStore(db).DeleteExpiredAsync(Now + SecretStore.TombstoneRetention + TimeSpan.FromMinutes(1));
        Assert.Null(await Outcome(id, Now));
    }

    [DbFact]
    public async Task Parallel_takes_leave_exactly_one_tombstone()
    {
        var id = await Seed(Now.AddHours(1));
        await Task.WhenAll(Enumerable.Range(0, 20).Select(_ => Task.Run(() => Take(id, Now))));
        Assert.Equal(SecretOutcome.Opened, await Outcome(id, Now));
    }

    private static async Task<Page<SentSummary>> Sent(string owner, DateTimeOffset at, int page = 1, int size = 20)
    {
        await using var db = TestDb.NewContext();
        return await new SecretStore(db).ListOwnedAsync(owner, page, size, at);
    }

    [DbFact]
    public async Task Owner_list_follows_the_link_through_all_states()
    {
        var owner = "owner-" + Guid.NewGuid();
        var opened = await Seed(Now.AddHours(1), owner, "geöffnet");
        var reported = await Seed(Now.AddHours(1), owner, "gemeldet");
        var revoked = await Seed(Now.AddHours(1), owner, "zurückgezogen");
        var expired = await Seed(Now.AddMinutes(-5), owner, "abgelaufen");
        var open = await Seed(Now.AddHours(1), owner, "offen");
        await Take(opened, Now);
        await using (var db = TestDb.NewContext()) await new SecretStore(db).DeleteAsync(reported, Now);
        await using (var db = TestDb.NewContext()) Assert.True(await new SecretStore(db).RevokeOwnedAsync(owner, revoked, Now));
        await using (var db = TestDb.NewContext()) await new SecretStore(db).DeleteExpiredAsync(Now);

        var list = await Sent(owner, Now);
        Assert.Equal(5, list.Total);
        SentState S(Guid id) => list.Items.Single(x => x.Id == id).State;
        Assert.Equal(SentState.Opened, S(opened));
        Assert.Equal(SentState.Reported, S(reported));
        Assert.Equal(SentState.Revoked, S(revoked));
        Assert.Equal(SentState.Expired, S(expired));
        Assert.Equal(SentState.Available, S(open));
        Assert.Equal("geöffnet", list.Items.Single(x => x.Id == opened).Label); // Bezeichnung bleibt nach dem Löschen
    }

    [DbFact]
    public async Task Owner_list_and_revoke_are_private_to_the_owner()
    {
        var a = "owner-" + Guid.NewGuid();
        var b = "owner-" + Guid.NewGuid();
        var id = await Seed(Now.AddHours(1), a);
        Assert.Empty((await Sent(b, Now)).Items);
        await using (var db = TestDb.NewContext()) Assert.False(await new SecretStore(db).RevokeOwnedAsync(b, id, Now)); // fremder Link
        Assert.NotNull(await Take(id, Now)); // blieb unberührt
    }

    [DbFact]
    public async Task Owner_list_is_paged_in_the_database_newest_first()
    {
        var owner = "owner-" + Guid.NewGuid();
        for (var i = 0; i < 5; i++) await Seed(Now.AddHours(1), owner);
        var p1 = await Sent(owner, Now, 1, 2);
        var p3 = await Sent(owner, Now, 3, 2);
        Assert.Equal(5, p1.Total);
        Assert.Equal(2, p1.Items.Count);
        Assert.Single(p3.Items);
    }

    [DbFact]
    public async Task Tombstones_of_owned_links_are_kept_30_days()
    {
        var owner = "owner-" + Guid.NewGuid();
        var id = await Seed(Now.AddMinutes(-5), owner);
        await using (var db = TestDb.NewContext()) await new SecretStore(db).DeleteExpiredAsync(Now);
        await using (var db = TestDb.NewContext()) await new SecretStore(db).DeleteExpiredAsync(Now + TimeSpan.FromDays(29));
        Assert.Single((await Sent(owner, Now)).Items);
        await using (var db = TestDb.NewContext()) await new SecretStore(db).DeleteExpiredAsync(Now + TimeSpan.FromDays(31));
        Assert.Empty((await Sent(owner, Now)).Items);
    }
}
