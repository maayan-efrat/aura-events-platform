import "server-only";
import {
  clearSessionCookies,
  extractRefreshTokenValue,
  getAccessToken,
  getRefreshToken,
  setSessionCookies,
} from "@/lib/session";

const IDENTITY_API_URL = process.env.IDENTITY_API_URL ?? "http://localhost:5001";
const EVENTS_API_URL = process.env.EVENTS_API_URL ?? "http://localhost:5002";

/** The cookie name Identity.Api itself expects — see AuthController.RefreshCookieName. */
const IDENTITY_REFRESH_COOKIE_NAME = "refreshToken";

export class BackendApiError extends Error {
  constructor(
    public status: number,
    public code: string,
    message: string,
  ) {
    super(message);
  }
}

/** Converts a BackendApiError (or anything else) into a JSON body + status for a Route Handler response. */
export function toErrorPayload(error: unknown): { body: { error: { code: string; message: string } }; status: number } {
  if (error instanceof BackendApiError) {
    return { body: { error: { code: error.code, message: error.message } }, status: error.status };
  }
  return { body: { error: { code: "INTERNAL_ERROR", message: "Something went wrong." } }, status: 500 };
}

async function parseErrorAndThrow(response: Response): Promise<never> {
  let code = "UNKNOWN_ERROR";
  let message = `Backend request failed with status ${response.status}`;
  try {
    const body = await response.json();
    if (body?.error?.code) code = body.error.code;
    if (body?.error?.message) message = body.error.message;
  } catch {
    // response wasn't JSON — keep the defaults above
  }
  throw new BackendApiError(response.status, code, message);
}

/** Plain server-to-server call, no auth attached. Used for register/login/refresh themselves. */
export async function callIdentityApi(path: string, init?: RequestInit): Promise<Response> {
  return fetch(`${IDENTITY_API_URL}${path}`, init);
}

/**
 * Uses the refresh token cookie to obtain a fresh access token from Identity.Api, and
 * rotates both session cookies. Only callable from Route Handlers (cookies() is writable there).
 * Returns the new access token, or null if the refresh token is missing/invalid.
 */
export async function refreshSession(): Promise<string | null> {
  const refreshToken = await getRefreshToken();
  if (!refreshToken) return null;

  const response = await callIdentityApi("/api/identity/auth/refresh", {
    method: "POST",
    headers: { Cookie: `${IDENTITY_REFRESH_COOKIE_NAME}=${refreshToken}` },
  });

  if (!response.ok) {
    await clearSessionCookies();
    return null;
  }

  const data = (await response.json()) as { accessToken: string; expiresInSeconds: number };
  const rotatedRefreshToken = extractRefreshTokenValue(response.headers.get("set-cookie")) ?? refreshToken;

  await setSessionCookies({
    accessToken: data.accessToken,
    accessTokenExpiresInSeconds: data.expiresInSeconds,
    refreshToken: rotatedRefreshToken,
    refreshTokenMaxAgeSeconds: 60 * 60 * 24 * 14,
  });

  return data.accessToken;
}

/**
 * Authenticated call to Events.Api. Only usable from Route Handlers / Server Functions —
 * on a 401 it transparently refreshes the session and retries once. Server Components should
 * use `requireAccessToken` instead, since they cannot write cookies mid-render.
 */
export async function callEventsApiAuthenticated(path: string, init: RequestInit = {}): Promise<Response> {
  let accessToken = await getAccessToken();
  if (!accessToken) {
    accessToken = (await refreshSession()) ?? undefined;
  }
  if (!accessToken) {
    throw new BackendApiError(401, "UNAUTHENTICATED", "No active session.");
  }

  const doFetch = (token: string) =>
    fetch(`${EVENTS_API_URL}${path}`, {
      ...init,
      headers: { ...init.headers, Authorization: `Bearer ${token}` },
    });

  let response = await doFetch(accessToken);

  if (response.status === 401) {
    const refreshed = await refreshSession();
    if (!refreshed) throw new BackendApiError(401, "UNAUTHENTICATED", "Session expired.");
    response = await doFetch(refreshed);
  }

  if (!response.ok) await parseErrorAndThrow(response);
  return response;
}

/** Authenticated call to Identity.Api (e.g. updating the current user's profile). Same refresh-on-401 behavior as callEventsApiAuthenticated. */
export async function callIdentityApiAuthenticated(path: string, init: RequestInit = {}): Promise<Response> {
  let accessToken = await getAccessToken();
  if (!accessToken) {
    accessToken = (await refreshSession()) ?? undefined;
  }
  if (!accessToken) {
    throw new BackendApiError(401, "UNAUTHENTICATED", "No active session.");
  }

  const doFetch = (token: string) =>
    fetch(`${IDENTITY_API_URL}${path}`, {
      ...init,
      headers: { ...init.headers, Authorization: `Bearer ${token}` },
    });

  let response = await doFetch(accessToken);

  if (response.status === 401) {
    const refreshed = await refreshSession();
    if (!refreshed) throw new BackendApiError(401, "UNAUTHENTICATED", "Session expired.");
    response = await doFetch(refreshed);
  }

  if (!response.ok) await parseErrorAndThrow(response);
  return response;
}

/** Public (unauthenticated) call to Events.Api — availability, etc. */
export async function callEventsApiPublic(path: string, init?: RequestInit): Promise<Response> {
  const response = await fetch(`${EVENTS_API_URL}${path}`, init);
  if (!response.ok) await parseErrorAndThrow(response);
  return response;
}

export async function getEventAvailability(eventId: string) {
  // Registration counts change the instant a user registers/cancels — no caching, unlike the
  // mostly-static event metadata below.
  const response = await callEventsApiPublic(`/api/events/${eventId}/availability`, {
    cache: "no-store",
  });
  return response.json() as Promise<import("@/lib/types").EventAvailability>;
}

export async function getEventById(eventId: string) {
  const response = await callEventsApiPublic(`/api/events/${eventId}`, {
    next: { revalidate: 30 },
  });
  return response.json() as Promise<import("@/lib/types").EventDetail>;
}

/** Flat category list (Umbraco's tree, reconstructed client-side via parentId) — used by the event-creation picker and the listing filter. */
export async function getCategories() {
  const response = await callEventsApiPublic("/api/categories", { next: { revalidate: 60 } });
  return response.json() as Promise<import("@/lib/types").Category[]>;
}

/** Event ids matching a category, via Events.Api's fast Postgres join — no per-category Umbraco calls. */
export async function getEventsByCategory(categoryId: string) {
  const response = await callEventsApiPublic(`/api/events?categoryId=${encodeURIComponent(categoryId)}`, {
    cache: "no-store",
  });
  return response.json() as Promise<import("@/lib/types").EventDetail[]>;
}

/**
 * Server Component-safe authenticated GET from Events.Api — no refresh-on-401 (Server
 * Components can't write cookies mid-render). Returns null on missing/expired session so the
 * page can redirect to /login instead of throwing.
 */
export async function callEventsApiAsCurrentUser(path: string): Promise<Response | null> {
  const accessToken = await getAccessToken();
  if (!accessToken) return null;

  const response = await fetch(`${EVENTS_API_URL}${path}`, {
    headers: { Authorization: `Bearer ${accessToken}` },
  });

  return response.status === 401 ? null : response;
}

/**
 * Server Component-safe read of the current user via Identity.Api. Server Components can only
 * read cookies, not refresh them, so an expired access token here just means "not logged in" —
 * the page should redirect to /login rather than attempt a refresh mid-render.
 */
export async function getCurrentUser() {
  const accessToken = await getAccessToken();
  if (!accessToken) return null;

  const response = await callIdentityApi("/api/identity/users/me", {
    headers: { Authorization: `Bearer ${accessToken}` },
  });

  if (!response.ok) return null;
  return response.json() as Promise<{
    userId: string;
    email: string;
    firstName: string;
    lastName: string;
    phoneNumber: string | null;
    roles: string[];
  }>;
}
