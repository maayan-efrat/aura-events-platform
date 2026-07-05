/** GET /api/events/{eventId}/availability response shape (Events.Api). */
export interface EventAvailability {
  eventId: string;
  capacity: number | null;
  registeredCount: number;
  waitlistCount: number;
  status: "Open" | "Full" | "Closed";
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
  status: "Draft" | "Published" | "Cancelled" | "Completed";
}

/** Umbraco eventPage content merged with its live Events.Api availability — the real listing. */
export interface LiveEventListing {
  slug: string;
  title: string;
  summary: string;
  eventId: string;
  availability: EventAvailability | null;
}

/** GET /api/users/me/registrations response item shape (Events.Api). */
export interface MyRegistration {
  registrationId: string;
  eventId: string;
  status: "Registered" | "Waitlisted" | "Cancelled" | "CheckedIn";
  registeredAtUtc: string;
}

/** POST /api/events/ai/generate-description response shape — also what gets published to Umbraco. */
export interface EventContentPayload {
  summary: string;
  description: string;
  seoTitle: string;
  seoDescription: string;
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
  status: "Draft" | "Published";
  umbracoContentKey: string | null;
  content: EventContentPayload | null;
}

/** POST /api/events / POST /api/events/{eventId}/umbraco-content response shape (Events.Api). */
export interface CreateEventResponse extends EventDetail {
  umbracoSyncError: string | null;
}
