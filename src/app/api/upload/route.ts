import { NextRequest, NextResponse } from "next/server";
import { getCloudflareContext } from "@opennextjs/cloudflare";
import { requireSession } from "@/lib/auth-server";

const MAX_SIZE_MB = 4;

export async function POST(request: NextRequest) {
  try {
    await requireSession();
  } catch {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const formData = await request.formData();
  const file = formData.get("file") as File | null;
  if (!file) return NextResponse.json({ error: "No file" }, { status: 400 });
  if (!file.type.startsWith("image/"))
    return NextResponse.json({ error: "File must be an image" }, { status: 400 });
  if (file.size > MAX_SIZE_MB * 1024 * 1024)
    return NextResponse.json({ error: `Max ${MAX_SIZE_MB}MB` }, { status: 400 });

  const { env } = await getCloudflareContext({ async: true });
  const bucket = env.IMAGES_BUCKET;
  if (!bucket)
    return NextResponse.json({ error: "Storage not configured" }, { status: 500 });

  const ext = file.name.split(".").pop()?.toLowerCase() ?? "jpg";
  const key = `projects/${Date.now()}-${Math.random().toString(36).slice(2)}.${ext}`;

  await bucket.put(key, await file.arrayBuffer(), {
    httpMetadata: { contentType: file.type },
  });

  const base = process.env.NEXT_PUBLIC_R2_PUBLIC_URL ?? "";
  return NextResponse.json({ url: `${base}/${key}` });
}
