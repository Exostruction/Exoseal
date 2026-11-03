using System;
using Microsoft.EntityFrameworkCore.Migrations;

#nullable disable

namespace ExoSeal.Infrastructure.Migrations
{
    /// <inheritdoc />
    public partial class SecretOwners : Migration
    {
        /// <inheritdoc />
        protected override void Up(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.AddColumn<string>(
                name: "Label",
                table: "secrets",
                type: "character varying(80)",
                maxLength: 80,
                nullable: true);

            migrationBuilder.AddColumn<string>(
                name: "OwnerSub",
                table: "secrets",
                type: "character varying(255)",
                maxLength: 255,
                nullable: true);

            migrationBuilder.AddColumn<DateTimeOffset>(
                name: "CreatedAt",
                table: "secret_tombstones",
                type: "timestamp with time zone",
                nullable: true);

            migrationBuilder.AddColumn<DateTimeOffset>(
                name: "ExpiresAt",
                table: "secret_tombstones",
                type: "timestamp with time zone",
                nullable: true);

            migrationBuilder.AddColumn<string>(
                name: "Label",
                table: "secret_tombstones",
                type: "character varying(80)",
                maxLength: 80,
                nullable: true);

            migrationBuilder.AddColumn<string>(
                name: "OwnerSub",
                table: "secret_tombstones",
                type: "character varying(255)",
                maxLength: 255,
                nullable: true);

            migrationBuilder.CreateIndex(
                name: "IX_secrets_OwnerSub_CreatedAt",
                table: "secrets",
                columns: new[] { "OwnerSub", "CreatedAt" });

            migrationBuilder.CreateIndex(
                name: "IX_secret_tombstones_OwnerSub_CreatedAt",
                table: "secret_tombstones",
                columns: new[] { "OwnerSub", "CreatedAt" });
        }

        /// <inheritdoc />
        protected override void Down(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.DropIndex(
                name: "IX_secrets_OwnerSub_CreatedAt",
                table: "secrets");

            migrationBuilder.DropIndex(
                name: "IX_secret_tombstones_OwnerSub_CreatedAt",
                table: "secret_tombstones");

            migrationBuilder.DropColumn(
                name: "Label",
                table: "secrets");

            migrationBuilder.DropColumn(
                name: "OwnerSub",
                table: "secrets");

            migrationBuilder.DropColumn(
                name: "CreatedAt",
                table: "secret_tombstones");

            migrationBuilder.DropColumn(
                name: "ExpiresAt",
                table: "secret_tombstones");

            migrationBuilder.DropColumn(
                name: "Label",
                table: "secret_tombstones");

            migrationBuilder.DropColumn(
                name: "OwnerSub",
                table: "secret_tombstones");
        }
    }
}
