using System;
using Microsoft.EntityFrameworkCore.Migrations;

#nullable disable

namespace ExoSeal.Infrastructure.Migrations
{
    /// <inheritdoc />
    public partial class SecretRequests : Migration
    {
        /// <inheritdoc />
        protected override void Up(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.CreateTable(
                name: "secret_requests",
                columns: table => new
                {
                    Id = table.Column<Guid>(type: "uuid", nullable: false),
                    OwnerSub = table.Column<string>(type: "character varying(255)", maxLength: 255, nullable: false),
                    OwnerEmail = table.Column<string>(type: "character varying(320)", maxLength: 320, nullable: true),
                    OwnerName = table.Column<string>(type: "character varying(255)", maxLength: 255, nullable: true),
                    Locale = table.Column<string>(type: "character varying(10)", maxLength: 10, nullable: false),
                    Question = table.Column<string>(type: "character varying(200)", maxLength: 200, nullable: false),
                    PublicKey = table.Column<byte[]>(type: "bytea", nullable: false),
                    WrappedPrivateKey = table.Column<byte[]>(type: "bytea", nullable: true),
                    ResponseCiphertext = table.Column<byte[]>(type: "bytea", nullable: true),
                    CreatedAt = table.Column<DateTimeOffset>(type: "timestamp with time zone", nullable: false),
                    ExpiresAt = table.Column<DateTimeOffset>(type: "timestamp with time zone", nullable: false),
                    AnsweredAt = table.Column<DateTimeOffset>(type: "timestamp with time zone", nullable: true),
                    ConsumedAt = table.Column<DateTimeOffset>(type: "timestamp with time zone", nullable: true),
                    MailSentAt = table.Column<DateTimeOffset>(type: "timestamp with time zone", nullable: true),
                    WebhookSentAt = table.Column<DateTimeOffset>(type: "timestamp with time zone", nullable: true),
                    NotifyAttempts = table.Column<int>(type: "integer", nullable: false),
                    NotifyNextAt = table.Column<DateTimeOffset>(type: "timestamp with time zone", nullable: true)
                },
                constraints: table =>
                {
                    table.PrimaryKey("PK_secret_requests", x => x.Id);
                });

            migrationBuilder.CreateIndex(
                name: "IX_secret_requests_ExpiresAt",
                table: "secret_requests",
                column: "ExpiresAt");

            migrationBuilder.CreateIndex(
                name: "IX_secret_requests_OwnerSub_CreatedAt",
                table: "secret_requests",
                columns: new[] { "OwnerSub", "CreatedAt" });
        }

        /// <inheritdoc />
        protected override void Down(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.DropTable(
                name: "secret_requests");
        }
    }
}
