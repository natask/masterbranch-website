import { NextRequest, NextResponse } from "next/server";

// Luma sends webhook events for registrations, check-ins, etc.
// This endpoint receives them and can be extended to update local state.
export async function POST(request: NextRequest) {
  try {
    const body = await request.json();

    // Log for now — extend with actual handling as needed
    console.log("Luma webhook received:", body.type, body);

    return NextResponse.json({ ok: true });
  } catch {
    return NextResponse.json({ error: "Invalid payload" }, { status: 400 });
  }
}
