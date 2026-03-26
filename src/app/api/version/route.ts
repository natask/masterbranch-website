import { NextResponse } from "next/server";

export async function GET() {
  return NextResponse.json({
    sha: process.env.GIT_SHA || "unknown",
    deployedAt: process.env.DEPLOY_TIME || "unknown",
  });
}
