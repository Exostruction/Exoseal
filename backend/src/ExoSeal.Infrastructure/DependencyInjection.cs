using ExoSeal.Application;
using Microsoft.AspNetCore.DataProtection;
using Microsoft.EntityFrameworkCore;
using Microsoft.Extensions.Configuration;
using Microsoft.Extensions.DependencyInjection;
using StackExchange.Redis;

namespace ExoSeal.Infrastructure;

public static class DependencyInjection
{
    public static IServiceCollection AddInfrastructure(this IServiceCollection s, IConfiguration c)
    {
        // Kein Kerberos/GSS: Das Alpine-Image hat die Bibliothek nicht, und Postgres im Compose-Netz braucht es nicht. Ohne diese Zeile steht beim Start eine irreführende Fehlermeldung im Log.
        var connection = new Npgsql.NpgsqlConnectionStringBuilder(c.GetConnectionString("Postgres")) { GssEncryptionMode = Npgsql.GssEncryptionMode.Disable };
        s.AddDbContext<AppDbContext>(o => o.UseNpgsql(connection.ConnectionString));
        // Cookie-Schlüssel überleben Neustarts (sonst wären alle Sessions weg).
        s.AddDataProtection().SetApplicationName("exoseal").PersistKeysToDbContext<AppDbContext>();

        s.AddSingleton(TimeProvider.System);
        s.AddScoped<ISecretStore, SecretStore>();
        s.AddScoped<ISecretRequestStore, SecretRequestStore>();
        s.AddHostedService<SecretCleanupService>();

        var notifications = c.GetSection("Notifications").Get<NotificationOptions>() ?? new();
        notifications.PublicUrl = c["App:PublicUrl"] ?? notifications.PublicUrl;
        notifications.Validate(); // falsch konfiguriert = Start bricht ab, statt still keine Benachrichtigungen zu senden
        s.AddSingleton(notifications);
        s.AddSingleton<MailSender>();
        s.AddSingleton<WebhookSender>();
        s.AddHostedService<NotificationService>();

        // Valkey nur für Rate-Limits, nie für Secrets. AbortOnConnectFail=false: Start klappt auch ohne Valkey.
        s.AddSingleton<IConnectionMultiplexer>(_ =>
        {
            var o = ConfigurationOptions.Parse(c.GetConnectionString("Valkey") ?? "valkey:6379");
            o.AbortOnConnectFail = false;
            return ConnectionMultiplexer.Connect(o);
        });
        s.AddSingleton<IRateLimiter, ValkeyRateLimiter>();
        return s;
    }
}
