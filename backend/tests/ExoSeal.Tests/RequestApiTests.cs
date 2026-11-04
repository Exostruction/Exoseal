using System.Buffers.Text;
using System.Net;
using System.Net.Http.Json;
using ExoSeal.Api;
using ExoSeal.Application;

namespace ExoSeal.Tests;

/// <summary>Ganzer Ablauf über HTTP gegen echte Postgres. Der Login ist ein Test-Header, der OIDC-Flow selbst ist hier nicht Thema.</summary>
public class RequestApiTests : IClassFixture<ApiFactory>
{
    private readonly ApiFactory _f;
    public RequestApiTests(ApiFactory f) => _f = f;

    private static string B64(byte[] b) => Base64Url.EncodeToString(b);
    private static CreateRequestRequest NewReq(string q = "Staging password?", int days = 7) => new(q, B64(Req.PublicKey()), B64(Req.Wrapped()), days);

    private static async Task<Guid> Create(HttpClient owner, CreateRequestRequest? r = null)
    {
        var res = await owner.PostAsJsonAsync("/requests", r ?? NewReq());
        Assert.Equal(HttpStatusCode.Created, res.StatusCode);
        return (await res.Content.ReadFromJsonAsync<CreateRequestResponse>())!.Id;
    }

    [DbFact]
    public async Task Full_flow_create_answer_open_once()
    {
        var owner = _f.LoggedIn(user: Req.NewOwner());
        var customer = _f.CreateClient(); // ohne Login
        var id = await Create(owner);

        // Kunde sieht Frage, Name des Erstellers und Public Key, aber nie den Private Key
        var pub = await customer.GetFromJsonAsync<PublicRequestDto>($"/requests/{id}/public");
        Assert.Equal("Staging password?", pub!.Question);
        Assert.Equal("Tester", pub.OwnerName);
        Assert.Equal(B64(Req.PublicKey()), pub.PublicKey);

        // vor der Antwort gibt es nichts zu öffnen
        Assert.Equal(HttpStatusCode.NotFound, (await owner.GetAsync($"/requests/{id}/key")).StatusCode);
        Assert.Equal(HttpStatusCode.NotFound, (await owner.PostAsync($"/requests/{id}/open", null)).StatusCode);

        var blob = Req.Answer(300);
        Assert.Equal(HttpStatusCode.NoContent, (await customer.PostAsJsonAsync($"/requests/{id}/answer", new AnswerRequestBody(B64(blob)))).StatusCode);

        // nur eine Antwort; danach ist der Link für Kunden tot
        Assert.Equal(HttpStatusCode.NotFound, (await customer.PostAsJsonAsync($"/requests/{id}/answer", new AnswerRequestBody(B64(blob)))).StatusCode);
        Assert.Equal(HttpStatusCode.NotFound, (await customer.GetAsync($"/requests/{id}/public")).StatusCode);

        var summary = await owner.GetFromJsonAsync<RequestSummaryDto>($"/requests/{id}");
        Assert.Equal("answered", summary!.Status);

        // Schlüssel holen ist nicht destruktiv, Öffnen genau einmal
        var key = await owner.GetFromJsonAsync<WrappedKeyDto>($"/requests/{id}/key");
        Assert.Equal(B64(Req.Wrapped()), key!.WrappedPrivateKey);
        Assert.Equal(HttpStatusCode.OK, (await owner.GetAsync($"/requests/{id}/key")).StatusCode);

        var opened = await owner.PostAsync($"/requests/{id}/open", null);
        Assert.Equal(HttpStatusCode.OK, opened.StatusCode);
        Assert.Equal(B64(blob), (await opened.Content.ReadFromJsonAsync<OpenedResponseDto>())!.Ciphertext);
        Assert.Equal(HttpStatusCode.NotFound, (await owner.PostAsync($"/requests/{id}/open", null)).StatusCode);
        Assert.Equal(HttpStatusCode.NotFound, (await owner.GetAsync($"/requests/{id}/key")).StatusCode);
        Assert.Equal("consumed", (await owner.GetFromJsonAsync<RequestSummaryDto>($"/requests/{id}"))!.Status);
    }

    [DbFact]
    public async Task Owner_endpoints_need_login_and_ownership()
    {
        var alice = _f.LoggedIn(user: Req.NewOwner());
        var mallory = _f.LoggedIn(user: Req.NewOwner());
        var anon = _f.CreateClient();
        var id = await Create(alice);
        await anon.PostAsJsonAsync($"/requests/{id}/answer", new AnswerRequestBody(B64(Req.Answer())));

        Assert.Equal(HttpStatusCode.Unauthorized, (await anon.PostAsJsonAsync("/requests", NewReq())).StatusCode);
        Assert.Equal(HttpStatusCode.Unauthorized, (await anon.GetAsync("/requests")).StatusCode);
        Assert.Equal(HttpStatusCode.Unauthorized, (await anon.GetAsync($"/requests/{id}/key")).StatusCode);
        Assert.Equal(HttpStatusCode.Unauthorized, (await anon.PostAsync($"/requests/{id}/open", null)).StatusCode);
        Assert.Equal(HttpStatusCode.Unauthorized, (await anon.DeleteAsync($"/requests/{id}")).StatusCode);

        // ein anderer eingeloggter Nutzer sieht und öffnet nichts
        Assert.Equal(HttpStatusCode.NotFound, (await mallory.GetAsync($"/requests/{id}")).StatusCode);
        Assert.Equal(HttpStatusCode.NotFound, (await mallory.GetAsync($"/requests/{id}/key")).StatusCode);
        Assert.Equal(HttpStatusCode.NotFound, (await mallory.PostAsync($"/requests/{id}/open", null)).StatusCode);
        Assert.Equal(HttpStatusCode.NotFound, (await mallory.DeleteAsync($"/requests/{id}")).StatusCode);
        var list = await mallory.GetFromJsonAsync<PageDto<RequestSummaryDto>>("/requests");
        Assert.Equal(0, list!.Total);

        Assert.Equal(HttpStatusCode.OK, (await alice.PostAsync($"/requests/{id}/open", null)).StatusCode); // Alice schon
    }

    [DbFact]
    public async Task Create_validates_input()
    {
        var owner = _f.LoggedIn(user: Req.NewOwner());
        async Task<HttpStatusCode> Post(CreateRequestRequest r) => (await owner.PostAsJsonAsync("/requests", r)).StatusCode;

        Assert.Equal(HttpStatusCode.BadRequest, await Post(NewReq(q: "  ")));
        Assert.Equal(HttpStatusCode.BadRequest, await Post(NewReq(q: new string('x', 201))));
        Assert.Equal(HttpStatusCode.BadRequest, await Post(NewReq(days: 0)));
        Assert.Equal(HttpStatusCode.BadRequest, await Post(NewReq(days: 31)));
        Assert.Equal(HttpStatusCode.BadRequest, await Post(NewReq() with { PublicKey = "***" }));
        Assert.Equal(HttpStatusCode.BadRequest, await Post(NewReq() with { PublicKey = B64(new byte[65]) }));        // kein 0x04-Präfix
        Assert.Equal(HttpStatusCode.BadRequest, await Post(NewReq() with { WrappedPrivateKey = B64(new byte[5]) }));
        Assert.Equal(HttpStatusCode.BadRequest, await Post(NewReq() with { WrappedPrivateKey = new string('A', 5000) }));
    }

    [DbFact]
    public async Task Answer_validates_size_and_format()
    {
        var owner = _f.LoggedIn(user: Req.NewOwner());
        var customer = _f.CreateClient();
        var id = await Create(owner);

        Assert.Equal(HttpStatusCode.BadRequest, (await customer.PostAsJsonAsync($"/requests/{id}/answer", new AnswerRequestBody(B64(new byte[10])))).StatusCode);
        Assert.Equal(HttpStatusCode.RequestEntityTooLarge, (await customer.PostAsJsonAsync($"/requests/{id}/answer", new AnswerRequestBody(B64(new byte[SecretRequestService.MaxAnswerBytes + 1])))).StatusCode);
        Assert.Equal(HttpStatusCode.RequestEntityTooLarge, (await customer.PostAsJsonAsync($"/requests/{id}/answer", new AnswerRequestBody("***"))).StatusCode);
        // fehlerhafte Versuche verbrauchen die Anfrage nicht
        Assert.Equal(HttpStatusCode.NoContent, (await customer.PostAsJsonAsync($"/requests/{id}/answer", new AnswerRequestBody(B64(Req.Answer())))).StatusCode);
    }

    [DbFact]
    public async Task List_filters_sorts_and_pages_via_query_string()
    {
        var owner = _f.LoggedIn(user: Req.NewOwner());
        var customer = _f.CreateClient();
        var ids = new List<Guid>();
        for (var i = 0; i < 5; i++) ids.Add(await Create(owner, NewReq($"Frage {i}")));
        await customer.PostAsJsonAsync($"/requests/{ids[0]}/answer", new AnswerRequestBody(B64(Req.Answer())));

        var answered = await owner.GetFromJsonAsync<PageDto<RequestSummaryDto>>("/requests?status=answered");
        Assert.Equal([ids[0]], answered!.Items.Select(x => x.Id));
        Assert.Equal(4, (await owner.GetFromJsonAsync<PageDto<RequestSummaryDto>>("/requests?status=open"))!.Total);

        var p1 = await owner.GetFromJsonAsync<PageDto<RequestSummaryDto>>("/requests?pageSize=2&page=1&sort=created_asc");
        var p3 = await owner.GetFromJsonAsync<PageDto<RequestSummaryDto>>("/requests?pageSize=2&page=3&sort=created_asc");
        Assert.Equal(5, p1!.Total);
        Assert.Equal(["Frage 0", "Frage 1"], p1.Items.Select(x => x.Question));
        Assert.Equal(["Frage 4"], p3!.Items.Select(x => x.Question));

        Assert.Equal(HttpStatusCode.BadRequest, (await owner.GetAsync("/requests?status=quatsch")).StatusCode);
        Assert.Equal(HttpStatusCode.BadRequest, (await owner.GetAsync("/requests?sort=quatsch")).StatusCode);
    }

    [DbFact]
    public async Task Owner_can_delete_and_customer_link_dies()
    {
        var owner = _f.LoggedIn(user: Req.NewOwner());
        var id = await Create(owner);
        Assert.Equal(HttpStatusCode.NoContent, (await owner.DeleteAsync($"/requests/{id}")).StatusCode);
        Assert.Equal(HttpStatusCode.NotFound, (await _f.CreateClient().GetAsync($"/requests/{id}/public")).StatusCode);
    }

    [DbFact]
    public async Task Public_endpoints_are_rate_limited()
    {
        var id = await Create(_f.LoggedIn(user: Req.NewOwner()));
        _f.Limiter.Allow = false;
        try
        {
            Assert.Equal(HttpStatusCode.TooManyRequests, (await _f.CreateClient().GetAsync($"/requests/{id}/public")).StatusCode);
            Assert.Equal(HttpStatusCode.TooManyRequests, (await _f.CreateClient().PostAsJsonAsync($"/requests/{id}/answer", new AnswerRequestBody(B64(Req.Answer())))).StatusCode);
        }
        finally { _f.Limiter.Allow = true; }
    }
}
