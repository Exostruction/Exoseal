using ExoSeal.Domain;
using ExoSeal.Application;

namespace ExoSeal.Tests;

public class SecretServiceTests
{
    private static (SecretService Svc, MemoryStore Store, FakeClock Clock) Make()
    {
        var store = new MemoryStore();
        var clock = new FakeClock(DateTimeOffset.Parse("2026-01-01T00:00:00Z"));
        return (new SecretService(store, clock), store, clock);
    }

    [Fact]
    public async Task Create_then_reveal_works_exactly_once()
    {
        var (svc, _, _) = Make();
        var r = await svc.CreateAsync(TestDb.Blob(), TimeSpan.FromHours(1));
        Assert.Null(r.Error);
        Assert.Equal(TestDb.Blob(), await svc.RevealAsync(r.Id!.Value));
        Assert.Null(await svc.RevealAsync(r.Id.Value));
    }

    [Theory]
    [InlineData(SecretService.MaxCiphertextBytes + 1, 60, SecretError.TooLarge)]
    [InlineData(SecretService.MinCiphertextBytes - 1, 60, SecretError.TooSmall)]
    [InlineData(64, 0, SecretError.InvalidTtl)]
    [InlineData(64, 7 * 24 * 60 + 1, SecretError.InvalidTtl)]
    public async Task Rejects_out_of_range(int size, int minutes, SecretError expected)
    {
        var (svc, store, _) = Make();
        var r = await svc.CreateAsync(TestDb.Blob(size), TimeSpan.FromMinutes(minutes));
        Assert.Equal(expected, r.Error);
        Assert.Empty(store.Items); // nichts gespeichert
    }

    [Theory]
    [InlineData(SecretService.MaxCiphertextBytes, 7 * 24 * 60)]
    [InlineData(SecretService.MinCiphertextBytes, 1)]
    public async Task Accepts_limits(int size, int minutes) =>
        Assert.Null((await Make().Svc.CreateAsync(TestDb.Blob(size), TimeSpan.FromMinutes(minutes))).Error);

    [Fact]
    public async Task Expired_secret_cannot_be_revealed()
    {
        var (svc, _, clock) = Make();
        var id = (await svc.CreateAsync(TestDb.Blob(), TimeSpan.FromMinutes(5))).Id!.Value;
        clock.Now += TimeSpan.FromMinutes(5);
        Assert.Null(await svc.RevealAsync(id));
    }

    [Fact]
    public async Task Report_deletes_without_revealing()
    {
        var (svc, store, _) = Make();
        var id = (await svc.CreateAsync(TestDb.Blob(), TimeSpan.FromHours(1))).Id!.Value;
        Assert.True(await svc.ReportAsync(id));
        Assert.Empty(store.Items);
        Assert.Null(await svc.RevealAsync(id));
        Assert.False(await svc.ReportAsync(id)); // doppelt melden ist harmlos
    }

    [Fact]
    public async Task Quota_stops_a_user_at_the_limit_but_not_others()
    {
        var svc = new SecretService(new MemoryStore(), new FakeClock(DateTimeOffset.UtcNow));
        for (var i = 0; i < SecretService.MaxActivePerUser; i++) Assert.Null((await svc.CreateAsync(TestDb.Blob(), TimeSpan.FromHours(1), "quota-user")).Error);
        Assert.Equal(SecretError.QuotaReached, (await svc.CreateAsync(TestDb.Blob(), TimeSpan.FromHours(1), "quota-user")).Error);
        Assert.Null((await svc.CreateAsync(TestDb.Blob(), TimeSpan.FromHours(1), "someone-else")).Error);
    }

    [Fact]
    public async Task Outcome_tells_why_a_link_is_gone()
    {
        var store = new MemoryStore();
        var svc = new SecretService(store, new FakeClock(DateTimeOffset.UtcNow));
        var opened = (await svc.CreateAsync(TestDb.Blob(), TimeSpan.FromHours(1))).Id!.Value;
        var reported = (await svc.CreateAsync(TestDb.Blob(), TimeSpan.FromHours(1))).Id!.Value;
        await svc.RevealAsync(opened);
        await svc.ReportAsync(reported);
        Assert.Equal(SecretOutcome.Opened, await svc.OutcomeAsync(opened));
        Assert.Equal(SecretOutcome.Reported, await svc.OutcomeAsync(reported));
        Assert.Null(await svc.OutcomeAsync(Guid.NewGuid()));
    }

    [Fact]
    public async Task Owner_sees_own_links_and_can_revoke_only_own()
    {
        var store = new MemoryStore();
        var svc = new SecretService(store, new FakeClock(DateTimeOffset.UtcNow));
        var mine = (await svc.CreateAsync(TestDb.Blob(), TimeSpan.FromHours(1), "alice", "Server-Login")).Id!.Value;
        var other = (await svc.CreateAsync(TestDb.Blob(), TimeSpan.FromHours(1), "bob", null)).Id!.Value;

        var list = await svc.ListSentAsync("alice", 1, 20);
        Assert.Single(list.Items);
        Assert.Equal("Server-Login", list.Items[0].Label);
        Assert.Equal(SentState.Available, list.Items[0].State);

        Assert.False(await svc.RevokeAsync("alice", other));   // fremder Link
        Assert.True(await svc.RevokeAsync("alice", mine));
        Assert.False(await svc.RevokeAsync("alice", mine));    // schon weg
        Assert.Equal(SecretOutcome.Revoked, await svc.OutcomeAsync(mine));
        Assert.Equal(SentState.Revoked, (await svc.ListSentAsync("alice", 1, 20)).Items[0].State);
    }

    [Fact]
    public async Task Too_long_label_is_rejected_and_blank_label_becomes_null()
    {
        var svc = new SecretService(new MemoryStore(), new FakeClock(DateTimeOffset.UtcNow));
        Assert.Equal(SecretError.InvalidLabel, (await svc.CreateAsync(TestDb.Blob(), TimeSpan.FromHours(1), "a", new string('x', 81))).Error);
        var ok = await svc.CreateAsync(TestDb.Blob(), TimeSpan.FromHours(1), "a", "   ");
        Assert.Null((await svc.ListSentAsync("a", 1, 20)).Items.Single(x => x.Id == ok.Id).Label);
    }
}
