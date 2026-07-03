import { NextResponse } from "next/server";
import { callIdentityApi } from "@/lib/backend-fetch";
import { clearSessionCookies, getRefreshToken } from "@/lib/session";

export async function POST() {
  const refreshToken = await getRefreshToken();

  if (refreshToken) {
    await callIdentityApi("/api/identity/auth/logout", {
      method: "POST",
      headers: { Cookie: `refreshToken=${refreshToken}` },
    }).catch(() => {
      // best-effort — we clear our own cookies regardless
    });
  }

  await clearSessionCookies();
  return NextResponse.json({ ok: true });
}
