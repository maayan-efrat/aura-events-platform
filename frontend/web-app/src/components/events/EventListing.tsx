import { getCategories, getEventAvailability, getEventById, getEventsByCategory } from "@/lib/backend-fetch";
import { getPublishedEventContent } from "@/lib/umbraco";
import type { LiveEventListing } from "@/lib/types";
import { Card, CardContent, CardDescription, CardFooter, CardImage, CardTitle } from "@/components/ui/Card";
import { EventCardVisual } from "@/components/events/EventCardVisual";
import { CategoryFilter } from "@/components/events/CategoryFilter";

const dateFormatter = new Intl.DateTimeFormat("he-IL", { dateStyle: "long", timeStyle: "short" });
const priceFormatter = new Intl.NumberFormat("he-IL", { style: "currency", currency: "ILS", maximumFractionDigits: 0 });

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
        const [availability, event] = await Promise.all([
          getEventAvailability(item.systemEventId).catch(() => null),
          getEventById(item.systemEventId).catch(() => null),
        ]);
        return {
          slug: item.slug,
          title: item.title,
          summary: item.summary,
          eventId: item.systemEventId,
          startAtUtc: event?.startAtUtc ?? null,
          price: event?.price ?? null,
          availability,
          categories: event?.categories ?? [],
          heroImageUrl: item.heroImageUrl,
        };
      }),
    );

    return { listings, usingFallback: false };
  } catch {
    // Umbraco (or Events.Api) unreachable — most likely local dev without `docker compose up`.
    return { listings: [], usingFallback: true };
  }
}

export async function EventListing({ categoryId }: { categoryId?: string } = {}) {
  const [{ listings, usingFallback }, categories] = await Promise.all([
    loadLiveListings(),
    getCategories().catch(() => []),
  ]);

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

  let filteredListings = listings;
  if (categoryId) {
    const matchingEvents = await getEventsByCategory(categoryId).catch(() => []);
    const matchingEventIds = new Set(matchingEvents.map((event) => event.eventId));
    filteredListings = listings.filter((listing) => matchingEventIds.has(listing.eventId));
  }

  return (
    <div>
      {categories.length > 0 && <CategoryFilter categories={categories} selectedCategoryId={categoryId} />}

      {filteredListings.length === 0 ? (
        <div className="rounded-2xl border border-border bg-surface-muted p-10 text-center text-muted-foreground">
          אין אירועים פורסמים כרגע — חזרו לבדוק בקרוב.
        </div>
      ) : (
        <ul className="grid grid-cols-1 gap-6 sm:grid-cols-2 lg:grid-cols-3">
          {filteredListings.map((listing) => (
            <li key={listing.eventId} className="list-none">
              <Card className="h-full">
                <CardImage>
                  <EventCardVisual seed={listing.eventId} imageUrl={listing.heroImageUrl} className="h-full w-full" />
                </CardImage>
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
                  {listing.categories.length > 0 && (
                    <div className="flex flex-wrap gap-1.5">
                      {listing.categories.map((category) => (
                        <span
                          key={category.categoryId}
                          className="inline-flex w-fit items-center rounded-full bg-surface-muted px-2.5 py-0.5 text-xs text-muted-foreground"
                        >
                          {category.name}
                        </span>
                      ))}
                    </div>
                  )}
                  <div className="flex flex-wrap items-center gap-x-3 gap-y-1 text-sm text-muted-foreground">
                    {listing.startAtUtc && <span>{dateFormatter.format(new Date(listing.startAtUtc))}</span>}
                    <span className="font-semibold text-foreground">
                      {listing.price ? priceFormatter.format(listing.price) : "כניסה חופשית"}
                    </span>
                  </div>
                </CardContent>
                <CardFooter>
                  <span className="text-sm text-muted-foreground">
                    {listing.availability
                      ? `${listing.availability.registeredCount}${listing.availability.capacity ? ` / ${listing.availability.capacity}` : ""} נרשמו`
                      : "זמינות לא ידועה"}
                  </span>
                  <a
                    href={`/${listing.slug}`}
                    className="text-sm font-semibold text-primary transition-colors hover:text-primary-hover"
                  >
                    פרטים והרשמה ←
                  </a>
                </CardFooter>
              </Card>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
