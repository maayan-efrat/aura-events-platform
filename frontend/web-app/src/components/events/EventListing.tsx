import { getEventAvailability } from "@/lib/backend-fetch";
import { getPublishedEventContent } from "@/lib/umbraco";
import type { LiveEventListing } from "@/lib/types";
import { Card, CardContent, CardDescription, CardFooter, CardTitle } from "@/components/ui/Card";

const STATUS_LABELS: Record<NonNullable<LiveEventListing["availability"]>["status"], string> = {
  Open: "מקומות פנויים",
  Full: "מלא — רשימת המתנה",
  Closed: "נסגר להרשמה",
};

const STATUS_STYLES: Record<NonNullable<LiveEventListing["availability"]>["status"], string> = {
  Open: "bg-success/15 text-success",
  Full: "bg-warning/15 text-warning",
  Closed: "bg-error/15 text-error",
};

async function loadLiveListings(): Promise<{ listings: LiveEventListing[]; usingFallback: boolean }> {
  try {
    const content = await getPublishedEventContent();

    const listings = await Promise.all(
      content.map(async (item): Promise<LiveEventListing> => {
        const availability = await getEventAvailability(item.systemEventId).catch(() => null);
        return {
          slug: item.slug,
          title: item.title,
          summary: item.summary,
          eventId: item.systemEventId,
          availability,
        };
      }),
    );

    return { listings, usingFallback: false };
  } catch {
    // Umbraco (or Events.Api) unreachable — most likely local dev without `docker compose up`.
    return { listings: [], usingFallback: true };
  }
}

export async function EventListing() {
  const { listings, usingFallback } = await loadLiveListings();

  if (usingFallback) {
    return (
      <div className="rounded-2xl border border-dashed border-border p-10 text-center">
        <p className="font-medium text-foreground">לא ניתן היה להתחבר ל-Umbraco / Events.Api</p>
        <p className="mt-2 text-sm text-muted-foreground">
          ודאו שההרצה של <code dir="ltr">docker compose up</code> פעילה, ושמשתני הסביבה{" "}
          <code dir="ltr">UMBRACO_URL</code> ו-<code dir="ltr">EVENTS_API_URL</code> מוגדרים נכון.
        </p>
      </div>
    );
  }

  if (listings.length === 0) {
    return (
      <div className="rounded-2xl border border-border bg-surface-muted p-10 text-center text-muted-foreground">
        אין אירועים פורסמים כרגע — חזרו לבדוק בקרוב.
      </div>
    );
  }

  return (
    <ul className="grid grid-cols-1 gap-6 sm:grid-cols-2 lg:grid-cols-3">
      {listings.map((listing) => (
        <li key={listing.eventId} className="list-none">
          <Card className="h-full">
            <CardContent>
              {listing.availability && (
                <span
                  className={`inline-flex w-fit items-center rounded-full px-3 py-1 text-xs font-semibold ${STATUS_STYLES[listing.availability.status]}`}
                >
                  {STATUS_LABELS[listing.availability.status]}
                </span>
              )}
              <CardTitle>{listing.title}</CardTitle>
              <CardDescription>{listing.summary}</CardDescription>
            </CardContent>
            <CardFooter>
              <span className="text-sm text-muted-foreground">
                {listing.availability
                  ? `${listing.availability.registeredCount}${listing.availability.capacity ? ` / ${listing.availability.capacity}` : ""} נרשמו`
                  : "זמינות לא ידועה"}
              </span>
              <a
                href={listing.slug}
                className="text-sm font-semibold text-primary transition-colors hover:text-primary-hover"
              >
                פרטים והרשמה ←
              </a>
            </CardFooter>
          </Card>
        </li>
      ))}
    </ul>
  );
}
