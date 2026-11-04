namespace ExoSeal.Domain;

public enum RequestStatus { Open, Answered, Consumed, Expired }

/// <summary>
/// Anfrage-Link: Ein eingeloggter Nutzer fragt bei einem Externen nach einem Wert.
/// Der Server hält nur den Public Key, den per Passphrase verschlüsselten Private Key und die verschlüsselte Antwort.
/// </summary>
public class SecretRequest
{
    public Guid Id { get; set; } = Guid.NewGuid(); // zufällig: die ID ist der Link-Token

    public required string OwnerSub { get; set; }
    public string? OwnerEmail { get; set; }          // nur für die Benachrichtigung
    public string? OwnerName { get; set; }           // wird dem Kunden angezeigt ("Angefragt von ...")
    public required string Locale { get; set; }      // Sprache der Benachrichtigung
    public required string Question { get; set; }    // Klartext, bewusst nicht geheim: der Kunde muss sie lesen können

    public required byte[] PublicKey { get; set; }
    public byte[]? WrappedPrivateKey { get; set; }   // null nach Abschluss/Ablauf
    public byte[]? ResponseCiphertext { get; set; }  // null vor der Antwort und nach Abschluss/Ablauf

    public DateTimeOffset CreatedAt { get; set; }
    public DateTimeOffset ExpiresAt { get; set; }    // bis hierhin kann geantwortet werden
    public DateTimeOffset? AnsweredAt { get; set; }
    public DateTimeOffset? ConsumedAt { get; set; }

    // Warteschlange für Benachrichtigungen (Mail und Webhook getrennt, damit ein Retry keine Doppel-Mails schickt)
    public DateTimeOffset? MailSentAt { get; set; }
    public DateTimeOffset? WebhookSentAt { get; set; }
    public int NotifyAttempts { get; set; }
    public DateTimeOffset? NotifyNextAt { get; set; }   // frühestens dann wieder versuchen (Backoff nach Fehlern)

    public RequestStatus StatusAt(DateTimeOffset now) => StatusOf(ConsumedAt, AnsweredAt, ResponseCiphertext is not null, ExpiresAt, now);

    /// <summary>Einzige Stelle, die den Status herleitet. Die Listen-Abfrage lädt keine Blobs und gibt deshalb nur <paramref name="hasResponse"/> weiter.</summary>
    public static RequestStatus StatusOf(DateTimeOffset? consumedAt, DateTimeOffset? answeredAt, bool hasResponse, DateTimeOffset expiresAt, DateTimeOffset now) =>
        consumedAt is not null ? RequestStatus.Consumed
        : answeredAt is not null ? (hasResponse ? RequestStatus.Answered : RequestStatus.Expired)
        : now >= expiresAt ? RequestStatus.Expired
        : RequestStatus.Open;
}
