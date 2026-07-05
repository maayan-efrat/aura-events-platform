import { NextResponse } from "next/server";
import { callEventsApiAuthenticated, toErrorPayload } from "@/lib/backend-fetch";

export async function GET() {
  try {
    const response = await callEventsApiAuthenticated("/api/events/ai/recommendations/history");
    const data = await response.json();
    return NextResponse.json(data);
  } catch (error) {
    const { body: errorBody, status } = toErrorPayload(error);
    return NextResponse.json(errorBody, { status });
  }
}
