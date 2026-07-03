import { NextResponse } from "next/server";
import { callIdentityApi } from "@/lib/backend-fetch";
import { extractRefreshTokenValue, setSessionCookies } from "@/lib/session";

const REFRESH_TOKEN_MAX_AGE_SECONDS = 60 * 60 * 24 * 14;

export async function POST(request: Request) {
  const body = await request.json();

  const response = await callIdentityApi("/api/identity/auth/login", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(body),
  });

  const data = await response.json();

  if (!response.ok) {
    return NextResponse.json(data, { status: response.status });
  }

  const refreshToken = extractRefreshTokenValue(response.headers.get("set-cookie"));
  if (!refreshToken) {
    return NextResponse.json(
      { error: { code: "SESSION_SETUP_FAILED", message: "Identity.Api did not return a refresh token." } },
      { status: 502 },
    );
  }

  await setSessionCookies({
    accessToken: data.accessToken,
    accessTokenExpiresInSeconds: data.expiresInSeconds,
    refreshToken,
    refreshTokenMaxAgeSeconds: REFRESH_TOKEN_MAX_AGE_SECONDS,
  });

  // The access token never leaves the server — the browser only gets the user profile.
  return NextResponse.json({ user: data.user });
}
