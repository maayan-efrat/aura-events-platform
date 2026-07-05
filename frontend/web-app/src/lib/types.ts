/** GET /api/events/{eventId}/availability response shape (Events.Api). */
export interface EventAvailability {
  eventId: string;
  capacity: number | null;
  registeredCount: number;
  waitlistCount: number;
  status: "Open" | "Full" | "Closed";
}

/** GET /api/categories item shape (Events.Api) — categoryId is the Umbraco categoryItem's key. */
export interface Category {
  categoryId: string;
  name: string;
  parentId: string | null;
}

/** Category reference embedded in EventDetail/EventResponse (Events.Api). */
export interface CategoryRef {
  categoryId: string;
  name: string;
}

/** GET /api/events/{eventId} response shape (Events.Api). */
export interface EventDetail {
  eventId: string;
  umbracoContentKey: string | null;
  slug: string;
  title: string;
  startAtUtc: string;
  endAtUtc: string;
  timezone: string;
  venueName: string | null;
  isVirtual: boolean;
  capacity: number | null;
  price: number | null;
  status: "Draft" | "Published" | "Cancelled" | "Completed";
  categories: CategoryRef[];
}

/** Umbraco eventPage content merged with its live Events.Api availability — the real listing. */
export interface LiveEventListing {
  slug: string;
  title: string;
  summary: string;
  eventId: string;
  startAtUtc: string | null;
  price: number | null;
  availability: EventAvailability | null;
  categories: CategoryRef[];
  heroImageUrl: string | null;
}

/** GET /api/users/me/registrations response item shape (Events.Api). */
export interface MyRegistration {
  registrationId: string;
  eventId: string;
  eventTitle: string;
  eventStartAtUtc: string;
  eventEndAtUtc: string;
  eventTimezone: string;
  status: "Registered" | "Waitlisted" | "Cancelled" | "CheckedIn";
  registeredAtUtc: string;
  ticketCode: string;
}

/**
 * POST /api/events/{eventId}/registrations response shape (Events.Api). qrSyncError is set when
 * the registration itself succeeded but archiving the ticket QR in Umbraco Media failed — the
 * ticket is still valid and displayable either way (GET .../registrations/me/qr regenerates the
 * PNG on demand, it doesn't depend on the Umbraco copy).
 */
export interface RegistrationResponse {
  registrationId: string;
  eventId: string;
  status: "Registered" | "Waitlisted" | "Cancelled" | "CheckedIn";
  qrSyncError: string | null;
}

/** POST /api/events/ai/generate-description response shape — also what gets published to Umbraco. */
export interface EventContentPayload {
  summary: string;
  description: string;
  seoTitle: string;
  seoDescription: string;
  heroImageBase64?: string | null;
  heroImageFileName?: string | null;
  heroImageContentType?: string | null;
}

/** POST /api/events request body (Events.Api). */
export interface CreateEventPayload {
  title: string;
  slug: string;
  startAtUtc: string;
  endAtUtc: string;
  timezone: string;
  venueName: string | null;
  isVirtual: boolean;
  capacity: number | null;
  price: number | null;
  status: "Draft" | "Published";
  umbracoContentKey: string | null;
  content: EventContentPayload | null;
  categoryIds: string[];
}

/** POST /api/events / POST /api/events/{eventId}/umbraco-content response shape (Events.Api). */
export interface CreateEventResponse extends EventDetail {
  umbracoSyncError: string | null;
}

/** PUT /api/events/{eventId} request body (Events.Api) — logistics only, not title/slug/content. */
export interface UpdateEventPayload {
  startAtUtc: string;
  endAtUtc: string;
  timezone: string;
  venueName: string | null;
  isVirtual: boolean;
  capacity: number | null;
  price: number | null;
  status: "Draft" | "Published" | "Cancelled" | "Completed";
  categoryIds: string[];
}
