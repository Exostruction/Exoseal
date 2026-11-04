namespace ExoSeal.Application;

/// <summary>Wer sich einloggen darf: ganze E-Mail-Domains und/oder einzelne Adressen (Komma-getrennt).</summary>
public sealed class Allowlist(string? domains, string? emails)
{
    private readonly HashSet<string> _domains = Split(domains);
    private readonly HashSet<string> _emails = Split(emails);

    public bool IsEmpty => _domains.Count == 0 && _emails.Count == 0;

    public bool IsAllowed(string? email, bool emailVerified)
    {
        if (!emailVerified || string.IsNullOrWhiteSpace(email)) return false;
        email = email.Trim().ToLowerInvariant();
        var at = email.LastIndexOf('@');
        return _emails.Contains(email) || (at > 0 && _domains.Contains(email[(at + 1)..]));
    }

    private static HashSet<string> Split(string? s) =>
        (s ?? "").Split(',', StringSplitOptions.RemoveEmptyEntries | StringSplitOptions.TrimEntries)
            .Select(x => x.TrimStart('@').ToLowerInvariant()).ToHashSet();
}
