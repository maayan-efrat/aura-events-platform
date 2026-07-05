import { NextResponse } from "next/server";
import { callEventsApiAuthenticated, toErrorPayload } from "@/lib/backend-fetch";

/** Streams the caller's own ticket QR PNG through from Events.Api — binary, not JSON. */
export async function GET(_request: Request, ctx: RouteContext<"/api/events/[eventId]/register/qr">) {
  const { eventId } = await ctx.params;

  try {
    const response = await callEventsApiAuthenticated(`/api/events/${eventId}/registrations/me/qr`);
    const bytes = await response.arrayBuffer();
    return new NextResponse(bytes, {
      status: response.status,
      headers: {
        "Content-Type": response.headers.get("content-type") ?? "image/png",
        "Cache-Control": response.headers.get("cache-control") ?? "private, no-store",
        ...(response.headers.get("etag") ? { ETag: response.headers.get("etag")! } : {}),
      },
    });
  } catch (error) {
    const { body, status } = toErrorPayload(error);
    return NextResponse.json(body, { status });
  }
}
