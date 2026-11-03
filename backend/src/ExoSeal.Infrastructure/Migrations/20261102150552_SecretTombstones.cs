using System;
using Microsoft.EntityFrameworkCore.Migrations;

#nullable disable

namespace ExoSeal.Infrastructure.Migrations
{
    /// <inheritdoc />
    public partial class SecretTombstones : Migration
    {
        /// <inheritdoc />
        protected override void Up(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.CreateTable(
                name: "secret_tombstones",
                columns: table => new
                {
                    Id = table.Column<Guid>(type: "uuid", nullable: false),
                    Outcome = table.Column<short>(type: "smallint", nullable: false),
                    At = table.Column<DateTimeOffset>(type: "timestamp with time zone", nullable: false)
                },
                constraints: table =>
                {
                    table.PrimaryKey("PK_secret_tombstones", x => x.Id);
                });

            migrationBuilder.CreateIndex(
                name: "IX_secret_tombstones_At",
                table: "secret_tombstones",
                column: "At");
        }

        /// <inheritdoc />
        protected override void Down(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.DropTable(
                name: "secret_tombstones");
        }
    }
}
