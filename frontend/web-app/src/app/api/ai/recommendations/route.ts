import { NextResponse } from "next/server";
import { callEventsApiAuthenticated, toErrorPayload } from "@/lib/backend-fetch";

export async function POST(request: Request) {
  const body = await request.json();

  try {
    const response = await callEventsApiAuthenticated("/api/events/ai/recommendations", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(body),
    });
    const data = await response.json();
    return NextResponse.json(data);
  } catch (error) {
    const { body: errorBody, status } = toErrorPayload(error);
    return NextResponse.json(errorBody, { status });
  }
}
