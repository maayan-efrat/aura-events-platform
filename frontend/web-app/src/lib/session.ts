import "server-only";
import { cookies } from "next/headers";

export const ACCESS_TOKEN_COOKIE = "aura_access_token";
export const REFRESH_TOKEN_COOKIE = "aura_refresh_token";

const isProduction = process.env.NODE_ENV === "production";

const baseCookieOptions = {
  httpOnly: true,
  secure: isProduction,
  sameSite: "lax" as const,
  path: "/",
};

/** Both tokens are httpOnly on the Next.js domain — browser JS never sees either one. */
export async function setSessionCookies(params: {
  accessToken: string;
  accessTokenExpiresInSeconds: number;
  refreshToken: string;
  refreshTokenMaxAgeSeconds: number;
}) {
  const cookieStore = await cookies();

  cookieStore.set(ACCESS_TOKEN_COOKIE, params.accessToken, {
    ...baseCookieOptions,
    maxAge: params.accessTokenExpiresInSeconds,
  });

  cookieStore.set(REFRESH_TOKEN_COOKIE, params.refreshToken, {
    ...baseCookieOptions,
    maxAge: params.refreshTokenMaxAgeSeconds,
  });
}

export async function clearSessionCookies() {
  const cookieStore = await cookies();
  cookieStore.delete(ACCESS_TOKEN_COOKIE);
  cookieStore.delete(REFRESH_TOKEN_COOKIE);
}

export async function getAccessToken(): Promise<string | undefined> {
  const cookieStore = await cookies();
  return cookieStore.get(ACCESS_TOKEN_COOKIE)?.value;
}

export async function getRefreshToken(): Promise<string | undefined> {
  const cookieStore = await cookies();
  return cookieStore.get(REFRESH_TOKEN_COOKIE)?.value;
}

/**
 * Identity.Api sets its own `refreshToken` cookie on ITS origin, which the browser never
 * talks to directly. We read that Set-Cookie header server-to-server and re-issue the same
 * raw value as our own httpOnly cookie on the Next.js origin instead of relaying it as-is.
 */
export function extractRefreshTokenValue(setCookieHeader: string | null): string | null {
  if (!setCookieHeader) return null;
  const match = setCookieHeader.match(/(?:^|;\s*)refreshToken=([^;]+)/);
  return match ? decodeURIComponent(match[1]) : null;
}
