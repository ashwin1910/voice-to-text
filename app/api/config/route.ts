import { NextResponse } from "next/server";

export const runtime = "edge";

export async function POST() {
  const key = process.env.OPENAI_API_KEY;
  if (!key) {
    return NextResponse.json(
      { error: "OPENAI_API_KEY not set on the server." },
      { status: 500 },
    );
  }
  return NextResponse.json({ key });
}
