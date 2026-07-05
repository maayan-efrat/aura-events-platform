using System;
using Microsoft.EntityFrameworkCore.Migrations;

#nullable disable

namespace Events.Api.Data.Migrations
{
    /// <inheritdoc />
    public partial class AddAiRecommendationHistory : Migration
    {
        /// <inheritdoc />
        protected override void Up(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.CreateTable(
                name: "ai_recommendation_requests",
                columns: table => new
                {
                    id = table.Column<Guid>(type: "uuid", nullable: false, defaultValueSql: "gen_random_uuid()"),
                    user_id = table.Column<Guid>(type: "uuid", nullable: false),
                    preferences = table.Column<string>(type: "text", nullable: true),
                    results = table.Column<string>(type: "jsonb", nullable: false),
                    created_at_utc = table.Column<DateTimeOffset>(type: "timestamp with time zone", nullable: false, defaultValueSql: "now()")
                },
                constraints: table =>
                {
                    table.PrimaryKey("pk_ai_recommendation_requests", x => x.id);
                });

            migrationBuilder.CreateIndex(
                name: "ix_ai_recommendation_requests_user_id_created_at_utc",
                table: "ai_recommendation_requests",
                columns: new[] { "user_id", "created_at_utc" });
        }

        /// <inheritdoc />
        protected override void Down(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.DropTable(
                name: "ai_recommendation_requests");
        }
    }
}
