namespace ExoSeal.Api;

/// <summary>Unterstützte Sprachen. Gegenstück im Frontend: frontend/i18n/routing.ts. Die Sprache kommt per Accept-Language.</summary>
public static class Locales
{
    public const string Default = "en";
    public static readonly string[] Supported = ["en", "de"];
}
