namespace ExoSeal.Domain;

/// <summary>Warum ein Link nicht mehr funktioniert.</summary>
public enum SecretOutcome { Opened = 1, Expired = 2, Reported = 3, Revoked = 4 }

/// <summary>
/// Bleibt nach dem Löschen eines Secrets erhalten (30 Tage), damit ein Link sagen kann, was mit ihm passiert ist,
/// und der Ersteller seine Liste behält. Enthält nie Inhalt, Empfänger oder IP.
/// </summary>
public class SecretTombstone
{
    public Guid Id { get; set; }
    public SecretOutcome Outcome { get; set; }
    public DateTimeOffset At { get; set; }
    public string? OwnerSub { get; set; }
    public string? Label { get; set; }
    public DateTimeOffset? CreatedAt { get; set; }
    public DateTimeOffset? ExpiresAt { get; set; }
}
