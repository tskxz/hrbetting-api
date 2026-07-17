import { put } from "@vercel/blob";
import { NextRequest, NextResponse } from "next/server";

type SignalPayload = {
  day: string;
  secret: string;
  intervals: Record<string, string>;
};

export async function POST(req: NextRequest) {
  const body = (await req.json()) as SignalPayload;

  if (body.secret !== process.env.HRBETTING_SECRET) {
    return NextResponse.json(
      { ok: false, error: "Unauthorized" },
      { status: 401 }
    );
  }

  if (!body.day || !body.intervals || typeof body.intervals !== "object") {
    return NextResponse.json(
      { ok: false, error: "Invalid payload" },
      { status: 400 }
    );
  }

  const filename = `signals/${body.day}.json`;

  const blob = await put(filename, JSON.stringify(body.intervals, null, 2), {
    access: "public",
    contentType: "application/json",
    allowOverwrite: true,
  });

  return NextResponse.json({
    ok: true,
    day: body.day,
    saved: Object.keys(body.intervals).length,
    url: blob.url,
  });
}
