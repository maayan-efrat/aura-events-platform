/**
 * Derives a URL-safe (ASCII) slug from a title, for auto-filling the create-event form's slug
 * field. Titles are Hebrew almost every time in this app, and Hebrew letters aren't a-z0-9, so the
 * ASCII-only sanitizing below collapses them to nothing — always appending a short random suffix
 * means every event still gets a unique slug regardless of the title's script, instead of every
 * Hebrew-titled event falling back to the same literal "event" and colliding on the second create.
 */
export function slugify(title: string): string {
  const base = title
    .normalize("NFKD")
    .replace(/[̀-ͯ]/g, "") // strip diacritics
    .toLowerCase()
    .trim()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "");

  const uniqueSuffix = crypto.randomUUID().replace(/-/g, "").slice(0, 8);
  return base ? `${base}-${uniqueSuffix}` : uniqueSuffix;
}
