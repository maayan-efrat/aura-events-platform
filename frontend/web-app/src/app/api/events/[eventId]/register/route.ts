import { NextResponse } from "next/server";
import { callEventsApiAuthenticated, toErrorPayload } from "@/lib/backend-fetch";

export async function POST(_request: Request, ctx: RouteContext<"/api/events/[eventId]/register">) {
  const { eventId } = await ctx.params;

  try {
    const response = await callEventsApiAuthenticated(`/api/events/${eventId}/registrations`, {
      method: "POST",
    });
    const data = await response.json();
    return NextResponse.json(data, { status: response.status });
  } catch (error) {
    const { body, status } = toErrorPayload(error);
    return NextResponse.json(body, { status });
  }
}

export async function DELETE(_request: Request, ctx: RouteContext<"/api/events/[eventId]/register">) {
  const { eventId } = await ctx.params;

  try {
    await callEventsApiAuthenticated(`/api/events/${eventId}/registrations/me`, {
      method: "DELETE",
    });
    return new NextResponse(null, { status: 204 });
  } catch (error) {
    const { body, status } = toErrorPayload(error);
    return NextResponse.json(body, { status });
  }
}
