import { NextRequest, NextResponse } from "next/server";

// Vertex AI Imagen 3 — pure REST, no SDK (required for Cloudflare Workers edge)
// Required env vars:
//   VERTEX_PROJECT_ID   — GCP project ID
//   VERTEX_LOCATION     — e.g. "us-central1"
//   VERTEX_ACCESS_TOKEN — service account OAuth2 token (rotate via cron or use Workload Identity)

const MODEL = "imagen-3.0-generate-002";

export async function POST(req: NextRequest) {
  const { prompt, count = 1 } = (await req.json()) as {
    prompt: string;
    count?: number;
  };

  const projectId = process.env.VERTEX_PROJECT_ID;
  const location = process.env.VERTEX_LOCATION ?? "us-central1";
  const accessToken = process.env.VERTEX_ACCESS_TOKEN;

  if (!projectId || !accessToken) {
    return NextResponse.json(
      { error: "Vertex AI not configured. Set VERTEX_PROJECT_ID and VERTEX_ACCESS_TOKEN." },
      { status: 503 }
    );
  }

  if (!prompt?.trim()) {
    return NextResponse.json({ error: "prompt is required" }, { status: 400 });
  }

  const endpoint = `https://${location}-aiplatform.googleapis.com/v1/projects/${projectId}/locations/${location}/publishers/google/models/${MODEL}:predict`;

  const body = {
    instances: [{ prompt: prompt.trim() }],
    parameters: {
      sampleCount: Math.min(count, 5),
      aspectRatio: "2:1", // matches PROJECT_IMAGE_W:H (800x400)
      outputOptions: { mimeType: "image/jpeg" },
    },
  };

  const res = await fetch(endpoint, {
    method: "POST",
    headers: {
      Authorization: `Bearer ${accessToken}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify(body),
  });

  if (!res.ok) {
    const text = await res.text();
    console.error("Vertex AI error:", text);
    return NextResponse.json({ error: "Image generation failed" }, { status: 502 });
  }

  const data = (await res.json()) as {
    predictions: Array<{ bytesBase64Encoded: string; mimeType: string }>;
  };

  const images = data.predictions.map((p) => ({
    dataUrl: `data:${p.mimeType};base64,${p.bytesBase64Encoded}`,
  }));

  return NextResponse.json({ images });
}
