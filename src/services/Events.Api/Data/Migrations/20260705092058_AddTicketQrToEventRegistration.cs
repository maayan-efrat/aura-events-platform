using System;
using Microsoft.EntityFrameworkCore.Migrations;

#nullable disable

namespace Events.Api.Data.Migrations
{
    /// <inheritdoc />
    public partial class AddTicketQrToEventRegistration : Migration
    {
        /// <inheritdoc />
        protected override void Up(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.AddColumn<Guid>(
                name: "qr_media_key",
                table: "event_registrations",
                type: "uuid",
                nullable: true);

            migrationBuilder.AddColumn<string>(
                name: "qr_sync_error",
                table: "event_registrations",
                type: "text",
                nullable: true);

            migrationBuilder.AddColumn<string>(
                name: "ticket_code",
                table: "event_registrations",
                type: "character varying(64)",
                maxLength: 64,
                nullable: false,
                defaultValue: "");

            // Backfill pre-existing rows with a unique value before the unique index below —
            // every row added with the "" default would otherwise collide with each other.
            migrationBuilder.Sql(
                "UPDATE event_registrations SET ticket_code = gen_random_uuid()::text WHERE ticket_code = '';");

            migrationBuilder.CreateIndex(
                name: "ix_event_registrations_ticket_code",
                table: "event_registrations",
                column: "ticket_code",
                unique: true);
        }

        /// <inheritdoc />
        protected override void Down(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.DropIndex(
                name: "ix_event_registrations_ticket_code",
                table: "event_registrations");

            migrationBuilder.DropColumn(
                name: "qr_media_key",
                table: "event_registrations");

            migrationBuilder.DropColumn(
                name: "qr_sync_error",
                table: "event_registrations");

            migrationBuilder.DropColumn(
                name: "ticket_code",
                table: "event_registrations");
        }
    }
}
