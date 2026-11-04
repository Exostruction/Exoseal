using ExoSeal.Application;
using Microsoft.Extensions.DependencyInjection;
using Microsoft.Extensions.Hosting;
using Microsoft.Extensions.Logging;

namespace ExoSeal.Infrastructure;

/// <summary>Löscht abgelaufene Secrets. Abgelaufene sind schon vorher nicht mehr abrufbar (TakeAsync prüft ExpiresAt); das hier räumt nur auf.</summary>
public sealed class SecretCleanupService(IServiceScopeFactory scopes, TimeProvider clock, ILogger<SecretCleanupService> log) : BackgroundService
{
    private static readonly TimeSpan Interval = TimeSpan.FromMinutes(5); // Bewusst einfach: fester Takt, konfigurierbar machen falls nötig

    protected override async Task ExecuteAsync(CancellationToken stop)
    {
        using var timer = new PeriodicTimer(Interval);
        do
        {
            try
            {
                using var scope = scopes.CreateScope();
                var now = clock.GetUtcNow();
                var n = await scope.ServiceProvider.GetRequiredService<ISecretStore>().DeleteExpiredAsync(now, stop)
                      + await scope.ServiceProvider.GetRequiredService<ISecretRequestStore>().CleanupAsync(now, stop);
                if (n > 0) log.LogInformation("{Count} abgelaufene Einträge aufgeräumt", n);
            }
            catch (Exception ex) when (ex is not OperationCanceledException)
            {
                log.LogWarning("Cleanup fehlgeschlagen: {Type}", ex.GetType().Name); // keine Details/Inhalte loggen
            }
        } while (await timer.WaitForNextTickAsync(stop));
    }
}
