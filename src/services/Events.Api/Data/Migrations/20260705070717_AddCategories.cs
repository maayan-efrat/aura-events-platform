using System;
using Microsoft.EntityFrameworkCore.Migrations;

#nullable disable

namespace Events.Api.Data.Migrations
{
    /// <inheritdoc />
    public partial class AddCategories : Migration
    {
        /// <inheritdoc />
        protected override void Up(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.CreateTable(
                name: "categories",
                columns: table => new
                {
                    category_id = table.Column<Guid>(type: "uuid", nullable: false),
                    name = table.Column<string>(type: "character varying(200)", maxLength: 200, nullable: false),
                    parent_id = table.Column<Guid>(type: "uuid", nullable: true),
                    is_active = table.Column<bool>(type: "boolean", nullable: false),
                    updated_at_utc = table.Column<DateTimeOffset>(type: "timestamp with time zone", nullable: false, defaultValueSql: "now()")
                },
                constraints: table =>
                {
                    table.PrimaryKey("pk_categories", x => x.category_id);
                    table.ForeignKey(
                        name: "fk_categories_categories_parent_id",
                        column: x => x.parent_id,
                        principalTable: "categories",
                        principalColumn: "category_id");
                });

            // Deferred so a batch upsert that inserts a child row before its parent (out-of-order
            // Umbraco publish notifications) still succeeds within one transaction — the FK is
            // only checked at commit, not per-statement. See CategorySyncNotificationHandler for
            // the primary defense (sorting by tree depth before syncing); this is the DB-level
            // safety net for whatever that ordering misses.
            migrationBuilder.Sql(
                "ALTER TABLE categories ALTER CONSTRAINT fk_categories_categories_parent_id DEFERRABLE INITIALLY DEFERRED;");

            migrationBuilder.CreateTable(
                name: "event_categories",
                columns: table => new
                {
                    event_id = table.Column<Guid>(type: "uuid", nullable: false),
                    category_id = table.Column<Guid>(type: "uuid", nullable: false)
                },
                constraints: table =>
                {
                    table.PrimaryKey("pk_event_categories", x => new { x.event_id, x.category_id });
                    table.ForeignKey(
                        name: "fk_event_categories_categories_category_id",
                        column: x => x.category_id,
                        principalTable: "categories",
                        principalColumn: "category_id",
                        onDelete: ReferentialAction.Cascade);
                    table.ForeignKey(
                        name: "fk_event_categories_events_event_id",
                        column: x => x.event_id,
                        principalTable: "events",
                        principalColumn: "event_id",
                        onDelete: ReferentialAction.Cascade);
                });

            migrationBuilder.CreateIndex(
                name: "ix_categories_parent_id",
                table: "categories",
                column: "parent_id");

            migrationBuilder.CreateIndex(
                name: "ix_event_categories_category_id",
                table: "event_categories",
                column: "category_id");
        }

        /// <inheritdoc />
        protected override void Down(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.DropTable(
                name: "event_categories");

            migrationBuilder.DropTable(
                name: "categories");
        }
    }
}
