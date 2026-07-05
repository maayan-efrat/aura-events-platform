import { NextResponse } from "next/server";
import { callEventsApiAuthenticated, toErrorPayload } from "@/lib/backend-fetch";

export async function POST(request: Request, ctx: RouteContext<"/api/events/[eventId]/umbraco-content">) {
  const { eventId } = await ctx.params;
  const body = await request.json();

  try {
    const response = await callEventsApiAuthenticated(`/api/events/${eventId}/umbraco-content`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(body),
    });
    const data = await response.json();
    return NextResponse.json(data, { status: response.status });
  } catch (error) {
    const { body: errorBody, status } = toErrorPayload(error);
    return NextResponse.json(errorBody, { status });
  }
}
