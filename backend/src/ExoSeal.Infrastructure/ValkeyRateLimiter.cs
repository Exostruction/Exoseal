using System.Security.Cryptography;
using System.Text;
using ExoSeal.Application;
using Microsoft.Extensions.Logging;
using StackExchange.Redis;

namespace ExoSeal.Infrastructure;

public sealed class ValkeyRateLimiter(IConnectionMultiplexer mux, ILogger<ValkeyRateLimiter> log) : IRateLimiter
{
    // Pro Prozessstart neu: Zähler-Schlüssel enthalten nie die IP, und ein Dump ließe sich nicht zurückrechnen.
    private readonly byte[] _pepper = RandomNumberGenerator.GetBytes(32);

    // Bewusst einfach: festes Zeitfenster (Bursts an der Fenstergrenze möglich), Fail-open wenn Valkey weg ist.
    public async Task<bool> AllowAsync(string bucket, string clientId, int limit, TimeSpan window, CancellationToken ct = default)
    {
        try
        {
            var id = Convert.ToHexString(HMACSHA256.HashData(_pepper, Encoding.UTF8.GetBytes(clientId)))[..32];
            var key = $"rl:{bucket}:{id}";
            var db = mux.GetDatabase();
            var n = await db.StringIncrementAsync(key);
            await db.KeyExpireAsync(key, window, ExpireWhen.HasNoExpiry);
            return n <= limit;
        }
        catch (RedisException ex)
        {
            log.LogWarning("Rate-Limit nicht verfügbar: {Type}", ex.GetType().Name);
            return true;
        }
    }
}
