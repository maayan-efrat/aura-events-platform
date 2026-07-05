import { NextResponse } from "next/server";
import { callIdentityApiAuthenticated, toErrorPayload } from "@/lib/backend-fetch";

export async function PUT(request: Request) {
  const body = await request.json();

  try {
    const response = await callIdentityApiAuthenticated("/api/identity/users/me", {
      method: "PUT",
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
