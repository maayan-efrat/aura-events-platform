import { NextResponse } from "next/server";
import { callIdentityApi, refreshSession } from "@/lib/backend-fetch";
import { getAccessToken } from "@/lib/session";

export async function GET() {
  let accessToken = await getAccessToken();
  if (!accessToken) {
    accessToken = (await refreshSession()) ?? undefined;
  }

  if (!accessToken) {
    return NextResponse.json({ user: null }, { status: 200 });
  }

  const response = await callIdentityApi("/api/identity/users/me", {
    headers: { Authorization: `Bearer ${accessToken}` },
  });

  if (!response.ok) {
    return NextResponse.json({ user: null }, { status: 200 });
  }

  const user = await response.json();
  return NextResponse.json({ user });
}
