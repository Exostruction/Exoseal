using ExoSeal.Application;

namespace ExoSeal.Tests;

public class AllowlistTests
{
    private readonly Allowlist _a = new("exostruction.com", "gast@example.org");

    [Theory]
    [InlineData("a@exostruction.com", true, true)]
    [InlineData("A@Exostruction.COM", true, true)]
    [InlineData("gast@example.org", true, true)]
    [InlineData("a@evilexostruction.com", true, false)]   // Suffix-Trick
    [InlineData("a@exostruction.com.evil.io", true, false)]
    [InlineData("a@exostruction.com", false, false)]      // unverifizierte Mail
    [InlineData("andere@example.org", true, false)]
    [InlineData(null, true, false)]
    public void Decides(string? email, bool verified, bool expected) =>
        Assert.Equal(expected, _a.IsAllowed(email, verified));

    [Fact]
    public void Empty_denies_everyone() => Assert.False(new Allowlist(null, "").IsAllowed("a@b.c", true));
}
