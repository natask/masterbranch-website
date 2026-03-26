import { NextRequest, NextResponse } from "next/server";
import { acceptInvite } from "@/lib/actions/collaborators";

export async function GET(
  _req: NextRequest,
  { params }: { params: Promise<{ token: string }> }
) {
  const { token } = await params;
  try {
    const projectId = await acceptInvite(token);
    return NextResponse.redirect(new URL(`/?project=${projectId}`, _req.url));
  } catch (e) {
    const msg = e instanceof Error ? e.message : "Invalid invite";
    return NextResponse.redirect(new URL(`/?error=${encodeURIComponent(msg)}`, _req.url));
  }
}
