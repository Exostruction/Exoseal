using ExoSeal.Application;
using ExoSeal.Domain;
using ExoSeal.Infrastructure;

namespace ExoSeal.Tests;

/// <summary>Gegen echte Postgres: Einmaligkeit und Filter hängen am SQL.</summary>
[Collection("notification-queue")] // die Warteschlangen-Tests hier dürfen nicht parallel zu NotificationServiceTests laufen
public class SecretRequestStoreTests
{
    private static readonly DateTimeOffset Now = Req.Now;

    // ---- Antworten: genau eine ------------------------------------------------------------------

    [DbFact]
    public async Task Parallel_answers_have_exactly_one_winner()
    {
        var r = await Req.Seed(Req.NewOwner());
        var results = await Task.WhenAll(Enumerable.Range(0, 30).Select(_ => Task.Run(() => Req.With(s => s.TryAnswerAsync(r.Id, Req.Answer(), Now, default)))));
        Assert.Equal(1, results.Count(x => x));
        Assert.NotNull((await Req.Reload(r.Id)).ResponseCiphertext);
    }

    [DbFact]
    public async Task Answer_is_refused_when_expired_or_already_answered()
    {
        var expired = await Req.Seed(Req.NewOwner(), x => x.ExpiresAt = Now.AddMinutes(-1));
        var answered = await Req.Seed(Req.NewOwner(), x => { x.AnsweredAt = Now; x.ResponseCiphertext = Req.Answer(); });
        Assert.False(await Req.With(s => s.TryAnswerAsync(expired.Id, Req.Answer(), Now, default)));
        Assert.False(await Req.With(s => s.TryAnswerAsync(answered.Id, Req.Answer(), Now, default)));
        Assert.False(await Req.With(s => s.TryAnswerAsync(Guid.NewGuid(), Req.Answer(), Now, default)));
    }

    [DbFact]
    public async Task Public_info_only_while_open()
    {
        var open = await Req.Seed(Req.NewOwner());
        var answered = await Req.Seed(Req.NewOwner(), x => { x.AnsweredAt = Now; x.ResponseCiphertext = Req.Answer(); });
        var expired = await Req.Seed(Req.NewOwner(), x => x.ExpiresAt = Now.AddMinutes(-1));

        var info = await Req.With(s => s.GetOpenAsync(open.Id, Now, default));
        Assert.Equal(open.Question, info!.Question);
        Assert.Equal(open.PublicKey, info.PublicKey);
        Assert.Null(await Req.With(s => s.GetOpenAsync(answered.Id, Now, default)));
        Assert.Null(await Req.With(s => s.GetOpenAsync(expired.Id, Now, default)));
    }

    // ---- Öffnen: genau einmal, nur der Besitzer, danach nichts mehr da -----------------------------

    [DbFact]
    public async Task Parallel_opens_have_exactly_one_winner_and_wipe_everything()
    {
        var owner = Req.NewOwner();
        var blob = Req.Answer(500);
        var r = await Req.Seed(owner, x => { x.AnsweredAt = Now; x.ResponseCiphertext = blob; });

        var results = await Task.WhenAll(Enumerable.Range(0, 30).Select(_ => Task.Run(() => Req.With(s => s.TakeResponseAsync(owner, r.Id, Now, default)))));
        Assert.Equal(1, results.Count(x => x is not null));
        Assert.Equal(blob, results.Single(x => x is not null));

        var after = await Req.Reload(r.Id);
        Assert.Null(after.ResponseCiphertext);
        Assert.Null(after.WrappedPrivateKey);
        Assert.NotNull(after.ConsumedAt);
        Assert.Null(await Req.With(s => s.GetWrappedKeyAsync(owner, r.Id, default)));
    }

    [DbFact]
    public async Task Other_users_cannot_read_or_open_or_delete()
    {
        var owner = Req.NewOwner();
        var other = Req.NewOwner();
        var r = await Req.Seed(owner, x => { x.AnsweredAt = Now; x.ResponseCiphertext = Req.Answer(); });

        Assert.Null(await Req.With(s => s.GetWrappedKeyAsync(other, r.Id, default)));
        Assert.Null(await Req.With(s => s.TakeResponseAsync(other, r.Id, Now, default)));
        Assert.Null(await Req.With(s => s.GetOwnedAsync(other, r.Id, Now, default)));
        Assert.False(await Req.With(s => s.DeleteOwnedAsync(other, r.Id, default)));
        Assert.NotNull((await Req.Reload(r.Id)).ResponseCiphertext); // unberührt, der Besitzer kann noch öffnen
        Assert.NotNull(await Req.With(s => s.TakeResponseAsync(owner, r.Id, Now, default)));
    }

    [DbFact]
    public async Task Wrapped_key_is_only_available_while_an_answer_waits()
    {
        var owner = Req.NewOwner();
        var open = await Req.Seed(owner);
        var answered = await Req.Seed(owner, x => { x.AnsweredAt = Now; x.ResponseCiphertext = Req.Answer(); });
        Assert.Null(await Req.With(s => s.GetWrappedKeyAsync(owner, open.Id, default)));
        Assert.Equal(answered.WrappedPrivateKey, await Req.With(s => s.GetWrappedKeyAsync(owner, answered.Id, default)));
    }

    [DbFact]
    public async Task Owner_can_delete_own_request()
    {
        var owner = Req.NewOwner();
        var r = await Req.Seed(owner);
        Assert.True(await Req.With(s => s.DeleteOwnedAsync(owner, r.Id, default)));
        Assert.False(await Req.With(s => s.DeleteOwnedAsync(owner, r.Id, default)));
    }

    // ---- Übersicht: Filter, Sortierung, Pagination in der Datenbank --------------------------------

    private static async Task<(string Owner, Dictionary<RequestStatus, Guid[]> Ids)> SeedOverview()
    {
        var o = Req.NewOwner();
        async Task<Guid> Add(int ageHours, Action<SecretRequest> t) => (await Req.Seed(o, x => { x.CreatedAt = Now.AddHours(-ageHours); t(x); })).Id;
        var open = new[] { await Add(1, _ => { }), await Add(2, _ => { }) };
        var answered = new[] { await Add(3, x => { x.AnsweredAt = Now; x.ResponseCiphertext = Req.Answer(); }) };
        var consumed = new[] { await Add(4, x => { x.AnsweredAt = Now; x.ConsumedAt = Now; x.WrappedPrivateKey = null; }) };
        var expiredA = await Add(5, x => x.ExpiresAt = Now.AddMinutes(-5));                                            // nie beantwortet
        var expiredB = await Add(6, x => { x.AnsweredAt = Now.AddDays(-8); x.WrappedPrivateKey = null; });            // Antwort verfallen
        return (o, new() { [RequestStatus.Open] = open, [RequestStatus.Answered] = answered, [RequestStatus.Consumed] = consumed, [RequestStatus.Expired] = [expiredA, expiredB] });
    }

    [DbFact]
    public async Task Status_filters_partition_the_list_exactly()
    {
        var (owner, ids) = await SeedOverview();
        var all = await Req.With(s => s.ListAsync(owner, new(null, RequestSort.CreatedDesc, 1, 50), Now, default));
        Assert.Equal(6, all.Total);

        foreach (var (status, expected) in ids)
        {
            var page = await Req.With(s => s.ListAsync(owner, new(status, RequestSort.CreatedDesc, 1, 50), Now, default));
            Assert.Equal(expected.Order(), page.Items.Select(x => x.Id).Order());
            Assert.All(page.Items, x => Assert.Equal(status, x.Status)); // abgeleiteter Status passt zum Filter
        }
    }

    [DbFact]
    public async Task Pagination_and_sorting_are_stable_and_complete()
    {
        var (owner, _) = await SeedOverview();
        var seen = new List<Guid>();
        for (var p = 1; p <= 3; p++)
        {
            var page = await Req.With(s => s.ListAsync(owner, new(null, RequestSort.CreatedDesc, p, 2), Now, default));
            Assert.Equal(6, page.Total);
            Assert.Equal(2, page.Items.Count);
            seen.AddRange(page.Items.Select(x => x.Id));
        }
        Assert.Equal(6, seen.Distinct().Count());                                  // keine Doppelten, keine Lücken
        Assert.Empty((await Req.With(s => s.ListAsync(owner, new(null, RequestSort.CreatedDesc, 4, 2), Now, default))).Items);

        var desc = (await Req.With(s => s.ListAsync(owner, new(null, RequestSort.CreatedDesc, 1, 50), Now, default))).Items.Select(x => x.CreatedAt).ToList();
        var asc = (await Req.With(s => s.ListAsync(owner, new(null, RequestSort.CreatedAsc, 1, 50), Now, default))).Items.Select(x => x.CreatedAt).ToList();
        Assert.Equal(desc.OrderByDescending(x => x), desc);
        Assert.Equal(asc.OrderBy(x => x), asc);
    }

    [DbFact]
    public async Task List_only_shows_own_requests()
    {
        var (owner, _) = await SeedOverview();
        var other = await Req.With(s => s.ListAsync(Req.NewOwner(), new(null, RequestSort.CreatedDesc, 1, 50), Now, default));
        Assert.Equal(0, other.Total);
        Assert.NotEqual(0, (await Req.With(s => s.ListAsync(owner, new(null, RequestSort.CreatedDesc, 1, 50), Now, default))).Total);
    }

    // ---- Aufräumen ---------------------------------------------------------------------------------

    [DbFact]
    public async Task Cleanup_wipes_useless_blobs_and_old_rows_but_keeps_live_ones()
    {
        var o = Req.NewOwner();
        var unansweredExpired = await Req.Seed(o, x => x.ExpiresAt = Now.AddMinutes(-1));
        var staleAnswer = await Req.Seed(o, x => { x.AnsweredAt = Now.AddDays(-8); x.ResponseCiphertext = Req.Answer(); });
        var freshAnswer = await Req.Seed(o, x => { x.AnsweredAt = Now.AddDays(-1); x.ResponseCiphertext = Req.Answer(); });
        var live = await Req.Seed(o);
        var ancient = await Req.Seed(o, x => { x.CreatedAt = Now.AddDays(-60); x.ExpiresAt = Now.AddDays(-31); });

        await Req.With(s => s.CleanupAsync(Now, default));

        var a = await Req.Reload(unansweredExpired.Id);
        Assert.Null(a.WrappedPrivateKey);
        var b = await Req.Reload(staleAnswer.Id);
        Assert.Null(b.ResponseCiphertext);
        Assert.Null(b.WrappedPrivateKey);
        var c = await Req.Reload(freshAnswer.Id);
        Assert.NotNull(c.ResponseCiphertext);                  // noch abholbar
        Assert.NotNull(c.WrappedPrivateKey);
        Assert.NotNull((await Req.Reload(live.Id)).WrappedPrivateKey);
        await Assert.ThrowsAsync<InvalidOperationException>(() => Req.Reload(ancient.Id)); // Zeile gelöscht
    }

    // ---- Warteschlange der Benachrichtigungen -------------------------------------------------------

    [DbFact]
    public async Task Notification_queue_tracks_channels_separately()
    {
        var owner = Req.NewOwner();
        var r = await Req.Seed(owner, x => { x.AnsweredAt = Now; x.ResponseCiphertext = Req.Answer(); });
        Task<PendingNotification?> Find(bool mail, bool hook) => Req.With(async s =>
            (await s.GetPendingNotificationsAsync(mail, hook, 5, 100_000, Now, default)).FirstOrDefault(x => x.Id == r.Id));

        var p = await Find(true, true);
        Assert.True(p!.NeedsMail && p.NeedsWebhook);
        Assert.Equal("en", p.Locale);

        await Req.With(async s => { await s.MarkNotifiedAsync(r.Id, mailSent: true, webhookSent: false, retryAt: null, Now, default); return 0; });
        p = await Find(true, true);
        Assert.False(p!.NeedsMail);   // Mail ist raus
        Assert.True(p.NeedsWebhook);  // Webhook noch offen: ein Retry schickt keine zweite Mail
        Assert.Null(await Find(true, false)); // nur Mail aktiv: nichts mehr zu tun

        await Req.With(async s => { await s.MarkNotifiedAsync(r.Id, false, false, retryAt: Now.AddMinutes(1), Now, default); return 0; });
        var failed = await Req.Reload(r.Id);
        Assert.Equal(1, failed.NotifyAttempts);
        Assert.Null(await Find(true, true));                       // wartet auf den nächsten Versuch ...
        Assert.NotNull(await Req.With(async s =>                   // ... und ist danach wieder dran
            (await s.GetPendingNotificationsAsync(true, true, 5, 100_000, Now.AddMinutes(2), default)).FirstOrDefault(x => x.Id == r.Id)));

        await Req.With(async s => { await s.MarkNotifiedAsync(r.Id, false, true, null, Now, default); return 0; });
        Assert.Null(await Find(true, true)); // alles erledigt
    }

    [DbFact]
    public async Task Notification_queue_skips_opened_and_exhausted()
    {
        var consumed = await Req.Seed(Req.NewOwner(), x => { x.AnsweredAt = Now; x.ConsumedAt = Now; });
        var exhausted = await Req.Seed(Req.NewOwner(), x => { x.AnsweredAt = Now; x.ResponseCiphertext = Req.Answer(); x.NotifyAttempts = 5; });
        var ids = (await Req.With(s => s.GetPendingNotificationsAsync(true, true, 5, 100_000, Now, default))).Select(x => x.Id).ToList();
        Assert.DoesNotContain(consumed.Id, ids);
        Assert.DoesNotContain(exhausted.Id, ids);
    }

    [DbFact]
    public async Task Entries_waiting_for_retry_do_not_crowd_out_new_ones()
    {
        await Req.DrainNotificationQueue();
        // 25 Einträge im Backoff dürfen weder ausgeliefert werden noch die 20 Plätze eines Batches belegen.
        var waiting = new List<Guid>();
        for (var i = 0; i < 25; i++)
            waiting.Add((await Req.Seed(Req.NewOwner(), x => { x.AnsweredAt = Now.AddDays(-1); x.ResponseCiphertext = Req.Answer(); x.NotifyAttempts = 1; x.NotifyNextAt = Now.AddHours(1); })).Id);
        var fresh = await Req.Seed(Req.NewOwner(), x => { x.AnsweredAt = Now; x.ResponseCiphertext = Req.Answer(); });

        var batch = await Req.With(s => s.GetPendingNotificationsAsync(true, true, 5, 20, Now, default));
        Assert.DoesNotContain(batch, x => waiting.Contains(x.Id));
        Assert.Contains(batch, x => x.Id == fresh.Id); // nach dem Aufräumen ist nur der frische übrig
    }
}
