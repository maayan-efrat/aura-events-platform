import { NextResponse } from "next/server";
import { refreshSession } from "@/lib/backend-fetch";

export async function POST() {
  const accessToken = await refreshSession();

  if (!accessToken) {
    return NextResponse.json(
      { error: { code: "INVALID_OR_EXPIRED_REFRESH_TOKEN", message: "Please log in again." } },
      { status: 401 },
    );
  }

  return NextResponse.json({ ok: true });
}
