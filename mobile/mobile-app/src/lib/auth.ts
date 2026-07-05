import * as SecureStore from "./tokenStorage";
import { IDENTITY_API_URL } from "./config";

const ACCESS_TOKEN_KEY = "aura_access_token";
const REFRESH_TOKEN_KEY = "aura_refresh_token";

export interface AuraUser {
  userId: string;
  email: string;
  firstName: string;
  lastName: string;
  roles: string[];
}

function extractRefreshTokenValue(setCookieHeader: string | null): string | null {
  if (!setCookieHeader) return null;
  const match = setCookieHeader.match(/(?:^|;\s*)refreshToken=([^;]+)/);
  return match ? decodeURIComponent(match[1]) : null;
}

export async function login(email: string, password: string): Promise<AuraUser> {
  const response = await fetch(`${IDENTITY_API_URL}/api/identity/auth/login`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ email, password }),
  });

  const data = await response.json();
  if (!response.ok) {
    throw new Error(data.error?.message ?? "התחברות נכשלה.");
  }

  const refreshToken = extractRefreshTokenValue(response.headers.get("set-cookie"));
  await SecureStore.setItemAsync(ACCESS_TOKEN_KEY, data.accessToken);
  if (refreshToken) await SecureStore.setItemAsync(REFRESH_TOKEN_KEY, refreshToken);

  return data.user as AuraUser;
}

export async function logout(): Promise<void> {
  await SecureStore.deleteItemAsync(ACCESS_TOKEN_KEY);
  await SecureStore.deleteItemAsync(REFRESH_TOKEN_KEY);
}

async function refreshAccessToken(): Promise<string | null> {
  const refreshToken = await SecureStore.getItemAsync(REFRESH_TOKEN_KEY);
  if (!refreshToken) return null;

  const response = await fetch(`${IDENTITY_API_URL}/api/identity/auth/refresh`, {
    method: "POST",
    headers: { Cookie: `refreshToken=${refreshToken}` },
  });

  if (!response.ok) {
    await logout();
    return null;
  }

  const data = await response.json();
  const rotatedRefreshToken = extractRefreshTokenValue(response.headers.get("set-cookie")) ?? refreshToken;

  await SecureStore.setItemAsync(ACCESS_TOKEN_KEY, data.accessToken);
  await SecureStore.setItemAsync(REFRESH_TOKEN_KEY, rotatedRefreshToken);

  return data.accessToken as string;
}

/** Attaches the stored access token and retries once via refresh on a 401 — mirrors the web BFF's logic. */
export async function authedFetch(url: string, init: RequestInit = {}): Promise<Response> {
  let accessToken = await SecureStore.getItemAsync(ACCESS_TOKEN_KEY);

  const doFetch = (token: string) =>
    fetch(url, { ...init, headers: { ...init.headers, Authorization: `Bearer ${token}` } });

  if (!accessToken) {
    accessToken = await refreshAccessToken();
  }
  if (!accessToken) {
    throw new Error("לא מחוברים למערכת.");
  }

  let response = await doFetch(accessToken);

  if (response.status === 401) {
    const refreshed = await refreshAccessToken();
    if (!refreshed) throw new Error("תוקף ההתחברות פג — יש להתחבר מחדש.");
    response = await doFetch(refreshed);
  }

  return response;
}

export async function getStoredUser(): Promise<AuraUser | null> {
  const accessToken = await SecureStore.getItemAsync(ACCESS_TOKEN_KEY);
  if (!accessToken) return null;

  const response = await authedFetch(`${IDENTITY_API_URL}/api/identity/users/me`).catch(() => null);
  if (!response?.ok) return null;
  return response.json();
}
