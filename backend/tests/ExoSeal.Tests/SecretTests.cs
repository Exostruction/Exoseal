using ExoSeal.Domain;

namespace ExoSeal.Tests;

public class SecretTests
{
    [Fact]
    public void IsExpired_flips_at_expiry()
    {
        var t = DateTimeOffset.UtcNow;
        var s = new Secret { Ciphertext = [1], ExpiresAt = t };
        Assert.False(s.IsExpired(t.AddSeconds(-1)));
        Assert.True(s.IsExpired(t));
    }
}
