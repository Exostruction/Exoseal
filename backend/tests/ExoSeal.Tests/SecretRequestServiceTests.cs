using ExoSeal.Application;
using ExoSeal.Domain;

namespace ExoSeal.Tests;

public class SecretRequestServiceTests
{
    private static (SecretRequestService Svc, CapturingRequestStore Store) Make()
    {
        var store = new CapturingRequestStore();
        return (new SecretRequestService(store, new FakeClock(Req.Now)), store);
    }

    private static CreateRequestCommand Cmd(string q = "Staging password?", byte[]? pub = null, byte[]? wrapped = null, int days = 7) =>
        new("owner", "o@example.org", "Owner", "en", q, pub ?? Req.PublicKey(), wrapped ?? Req.Wrapped(), days);

    [Fact]
    public async Task Create_stores_trimmed_question_and_expiry()
    {
        var (svc, store) = Make();
        var r = await svc.CreateAsync(Cmd("  Wert?  "));
        Assert.Null(r.Error);
        var saved = Assert.Single(store.Added);
        Assert.Equal("Wert?", saved.Question);
        Assert.Equal(Req.Now.AddDays(7), saved.ExpiresAt);
        Assert.Equal(r.Id, saved.Id);
    }

    [Fact]
    public async Task Quota_stops_creating_more_requests_at_the_limit()
    {
        var (svc, _) = Make();
        for (var i = 0; i < SecretRequestService.MaxActivePerUser; i++) Assert.Null((await svc.CreateAsync(Cmd())).Error);
        Assert.Equal(RequestError.QuotaReached, (await svc.CreateAsync(Cmd())).Error);
    }

    [Theory]
    [InlineData("", RequestError.QuestionInvalid)]
    [InlineData("   ", RequestError.QuestionInvalid)]
    public async Task Rejects_empty_question(string q, RequestError e) => Assert.Equal(e, (await Make().Svc.CreateAsync(Cmd(q))).Error);

    [Fact]
    public async Task Question_length_limit()
    {
        Assert.Null((await Make().Svc.CreateAsync(Cmd(new string('a', 200)))).Error);
        Assert.Equal(RequestError.QuestionInvalid, (await Make().Svc.CreateAsync(Cmd(new string('a', 201)))).Error);
    }

    [Fact]
    public async Task Validates_keys_and_ttl()
    {
        var (svc, store) = Make();
        Assert.Equal(RequestError.PublicKeyInvalid, (await svc.CreateAsync(Cmd(pub: new byte[64]))).Error);          // falsche Länge
        Assert.Equal(RequestError.PublicKeyInvalid, (await svc.CreateAsync(Cmd(pub: [0x02, .. new byte[64]]))).Error); // nicht unkomprimiert
        Assert.Equal(RequestError.WrappedKeyInvalid, (await svc.CreateAsync(Cmd(wrapped: new byte[10]))).Error);
        Assert.Equal(RequestError.WrappedKeyInvalid, (await svc.CreateAsync(Cmd(wrapped: new byte[2000]))).Error);
        Assert.Equal(RequestError.TtlInvalid, (await svc.CreateAsync(Cmd(days: 0))).Error);
        Assert.Equal(RequestError.TtlInvalid, (await svc.CreateAsync(Cmd(days: 31))).Error);
        Assert.Empty(store.Added); // bei Fehlern wird nichts gespeichert
        Assert.Null((await svc.CreateAsync(Cmd(days: 30))).Error);
    }

    [Theory]
    [InlineData(SecretRequestService.MinAnswerBytes - 1, AnswerResult.Invalid)]
    [InlineData(SecretRequestService.MaxAnswerBytes + 1, AnswerResult.TooLarge)]
    [InlineData(SecretRequestService.MinAnswerBytes, AnswerResult.Ok)]
    [InlineData(SecretRequestService.MaxAnswerBytes, AnswerResult.Ok)]
    public async Task Answer_size_limits(int size, AnswerResult expected) =>
        Assert.Equal(expected, await Make().Svc.AnswerAsync(Guid.NewGuid(), Req.Answer(size)));

    [Fact]
    public async Task Answer_maps_closed_request_to_NotOpen()
    {
        var (svc, store) = Make();
        store.AnswerResult = false;
        Assert.Equal(AnswerResult.NotOpen, await svc.AnswerAsync(Guid.NewGuid(), Req.Answer()));
    }

    [Fact]
    public async Task List_clamps_paging()
    {
        var (svc, store) = Make();
        await svc.ListAsync("o", new RequestQuery(null, RequestSort.CreatedDesc, 0, 10_000));
        Assert.Equal(1, store.LastQuery!.Page);
        Assert.Equal(SecretRequestService.MaxPageSize, store.LastQuery.PageSize);
    }

    [Theory]
    [InlineData(false, false, false, 1, RequestStatus.Open)]        // nichts passiert, noch gültig
    [InlineData(false, false, false, -1, RequestStatus.Expired)]    // nicht beantwortet, abgelaufen
    [InlineData(true, false, true, 1, RequestStatus.Answered)]      // Antwort wartet
    [InlineData(true, false, false, 1, RequestStatus.Expired)]      // Antwort wurde nach der Frist gelöscht
    [InlineData(true, true, false, -1, RequestStatus.Consumed)]     // geöffnet
    public void Status_is_derived_consistently(bool answered, bool consumed, bool hasResponse, int expiresInDays, RequestStatus expected)
    {
        var now = Req.Now;
        Assert.Equal(expected, SecretRequest.StatusOf(consumed ? now : null, answered ? now : null, hasResponse, now.AddDays(expiresInDays), now));
    }
}
