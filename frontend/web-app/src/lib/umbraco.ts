import "server-only";

const UMBRACO_URL = process.env.UMBRACO_URL ?? "http://localhost:5003";

/** Minimal shape we read off Umbraco Delivery API content items — see docs §3.1 for the full eventPage schema. */
interface UmbracoContentItem {
  name: string;
  route: { path: string };
  properties: {
    systemEventId?: string;
    summary?: string;
    heroImage?: unknown;
  };
}

export interface UmbracoEventContent {
  slug: string;
  title: string;
  summary: string;
  systemEventId: string;
}

export interface UmbracoEventDetail extends UmbracoEventContent {
  description: string;
}

export async function getPublishedEventContent(): Promise<UmbracoEventContent[]> {
  const response = await fetch(
    `${UMBRACO_URL}/umbraco/delivery/api/v2/content?filter=contentType:eventPage`,
    { next: { revalidate: 60 } },
  );

  if (!response.ok) {
    throw new Error(`Umbraco Delivery API returned ${response.status}`);
  }

  const data = (await response.json()) as { items?: UmbracoContentItem[] };

  return (data.items ?? [])
    .filter((item) => Boolean(item.properties.systemEventId))
    .map((item) => ({
      slug: item.route.path,
      title: item.name,
      summary: item.properties.summary ?? "",
      systemEventId: item.properties.systemEventId!,
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
    slug: item.route.path,
    title: item.name,
    summary: item.properties.summary ?? "",
    description: item.properties.description ?? "",
    systemEventId: item.properties.systemEventId,
  };
}
