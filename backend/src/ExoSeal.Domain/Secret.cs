namespace ExoSeal.Domain;

/// <summary>Verschlüsselter Einmal-Inhalt. Der Server sieht nie Klartext.</summary>
public class Secret
{
    public Guid Id { get; set; } = Guid.NewGuid(); // zufällig (v4), nicht v7: v7 verriete den Erstellzeitpunkt
    public required byte[] Ciphertext { get; set; }
    public DateTimeOffset CreatedAt { get; set; }
    public DateTimeOffset ExpiresAt { get; set; }

    /// <summary>Anbieter-ID des Erstellers. Damit sieht der Ersteller seine gesendeten Links; der Empfänger und der Inhalt bleiben dem Server unbekannt.</summary>
    public string? OwnerSub { get; set; }

    /// <summary>Optionale Bezeichnung für die eigene Liste. Klartext, nichts Geheimes.</summary>
    public string? Label { get; set; }

    public bool IsExpired(DateTimeOffset now) => now >= ExpiresAt;
}
