import "server-only";

const UMBRACO_URL = process.env.UMBRACO_URL ?? "http://localhost:5003";

/** Minimal shape we read off Umbraco Delivery API content items — see docs §3.1 for the full eventPage schema. */
interface UmbracoContentItem {
  name: string;
  // `route.path` collapses to "/" for content created directly under the content root when
  // there's no distinct "home" document type (Umbraco can't tell it apart from the home page) —
  // `route.startItem.path` is the item's own URL segment and is what we actually want as a slug.
  route: { path: string; startItem: { path: string } };
  properties: {
    systemEventId?: string;
    summary?: string;
    // MediaPicker3 delivered as an array (even for a single-image field) of resolved media items
    // — verified against this project's own running instance: each entry's `url` is relative to
    // the Umbraco origin (e.g. "/media/qkvnp54h/photo.png"), not the Next.js one.
    heroImage?: Array<{ url: string }>;
  };
}

function resolveHeroImageUrl(heroImage?: Array<{ url: string }>): string | null {
  const url = heroImage?.[0]?.url;
  return url ? `${UMBRACO_URL}${url}` : null;
}

export interface UmbracoEventContent {
  slug: string;
  title: string;
  summary: string;
  systemEventId: string;
  heroImageUrl: string | null;
}

export interface UmbracoEventDetail extends UmbracoEventContent {
  description: string;
}

export async function getPublishedEventContent(): Promise<UmbracoEventContent[]> {
  // No caching: a newly-created event must show its real title immediately (dashboard, homepage),
  // not a stale eventId fallback for up to a minute.
  const response = await fetch(
    `${UMBRACO_URL}/umbraco/delivery/api/v2/content?filter=contentType:eventPage`,
    { cache: "no-store" },
  );

  if (!response.ok) {
    throw new Error(`Umbraco Delivery API returned ${response.status}`);
  }

  const data = (await response.json()) as { items?: UmbracoContentItem[] };

  return (data.items ?? [])
    .filter((item) => Boolean(item.properties.systemEventId))
    .map((item) => ({
      slug: item.route.startItem.path,
      title: item.name,
      summary: item.properties.summary ?? "",
      systemEventId: item.properties.systemEventId!,
      heroImageUrl: resolveHeroImageUrl(item.properties.heroImage),
    }));
}

/** Looks up a single eventPage by its route slug (e.g. "auraevents-launch-night"). Returns null if not found/published. */
export async function getEventContentBySlug(slug: string): Promise<UmbracoEventDetail | null> {
  const path = slug.replace(/^\/|\/$/g, "");
  const response = await fetch(`${UMBRACO_URL}/umbraco/delivery/api/v2/content/item/${path}`, {
    next: { revalidate: 60 },
  });

  if (response.status === 404) return null;
  if (!response.ok) throw new Error(`Umbraco Delivery API returned ${response.status}`);

  const item = (await response.json()) as UmbracoContentItem & { properties: { description?: string } };
  if (!item.properties.systemEventId) return null;

  return {
    slug: item.route.startItem.path,
    title: item.name,
    summary: item.properties.summary ?? "",
    description: item.properties.description ?? "",
    systemEventId: item.properties.systemEventId,
    heroImageUrl: resolveHeroImageUrl(item.properties.heroImage),
  };
}
