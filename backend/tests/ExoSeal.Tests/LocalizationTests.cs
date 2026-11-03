using System.Collections;
using System.Globalization;
using System.Resources;
using ExoSeal.Api;
using ExoSeal.Api.Resources;
using ExoSeal.Infrastructure.Resources;

namespace ExoSeal.Tests;

public class LocalizationTests
{
    private static HashSet<string> Keys(Type resources, string culture) =>
        new ResourceManager(resources).GetResourceSet(
            culture == Locales.Default ? CultureInfo.InvariantCulture : CultureInfo.GetCultureInfo(culture), true, false)!
            .Cast<DictionaryEntry>().Select(e => (string)e.Key).ToHashSet();

    // Jede unterstützte Sprache muss exakt dieselben Schlüssel haben wie die Fallback-Sprache.
    [Theory]
    [InlineData(typeof(Messages))]
    [InlineData(typeof(MailMessages))]
    public void All_locales_have_same_keys(Type resources)
    {
        var reference = Keys(resources, Locales.Default);
        foreach (var l in Locales.Supported)
            Assert.True(reference.SetEquals(Keys(resources, l)), $"Schlüssel in '{l}' weichen ab ({resources.Name})");
    }
}
