using ExoSeal.Domain;
using Microsoft.AspNetCore.DataProtection.EntityFrameworkCore;
using Microsoft.EntityFrameworkCore;

namespace ExoSeal.Infrastructure;

public class AppDbContext(DbContextOptions<AppDbContext> options) : DbContext(options), IDataProtectionKeyContext
{
    public DbSet<Secret> Secrets => Set<Secret>();
    public DbSet<SecretTombstone> Tombstones => Set<SecretTombstone>();
    public DbSet<SecretRequest> SecretRequests => Set<SecretRequest>();
    public DbSet<DataProtectionKey> DataProtectionKeys => Set<DataProtectionKey>();

    protected override void OnModelCreating(ModelBuilder b)
    {
        b.Entity<Secret>(e =>
        {
            e.ToTable("secrets");
            e.HasKey(x => x.Id);
            e.Property(x => x.Id).ValueGeneratedNever();
            e.Property(x => x.Ciphertext).IsRequired();
            e.HasIndex(x => x.ExpiresAt); // für den Cleanup-Job
            e.Property(x => x.OwnerSub).HasMaxLength(255);
            e.Property(x => x.Label).HasMaxLength(80);
            e.HasIndex(x => new { x.OwnerSub, x.CreatedAt }); // Liste des Erstellers
        });

        b.Entity<SecretTombstone>(e =>
        {
            e.ToTable("secret_tombstones");
            e.HasKey(x => x.Id);
            e.Property(x => x.Id).ValueGeneratedNever();
            e.Property(x => x.Outcome).HasConversion<short>();
            e.HasIndex(x => x.At); // Aufräumen
            e.Property(x => x.OwnerSub).HasMaxLength(255);
            e.Property(x => x.Label).HasMaxLength(80);
            e.HasIndex(x => new { x.OwnerSub, x.CreatedAt });
        });

        b.Entity<SecretRequest>(e =>
        {
            e.ToTable("secret_requests");
            e.HasKey(x => x.Id);
            e.Property(x => x.Id).ValueGeneratedNever();
            e.Property(x => x.OwnerSub).HasMaxLength(255);
            e.Property(x => x.OwnerEmail).HasMaxLength(320);
            e.Property(x => x.OwnerName).HasMaxLength(255);
            e.Property(x => x.Locale).HasMaxLength(10);
            e.Property(x => x.Question).HasMaxLength(200);
            e.HasIndex(x => new { x.OwnerSub, x.CreatedAt }); // Übersicht eines Nutzers, neueste zuerst
            e.HasIndex(x => x.ExpiresAt);                     // Cleanup
        });
    }
}
