import { NextRequest, NextResponse } from "next/server";
import OpenAI from "openai";

export const runtime = "nodejs";
export const maxDuration = 60;

export async function POST(req: NextRequest) {
  try {
    if (!process.env.OPENAI_API_KEY) {
      return NextResponse.json(
        { error: "OPENAI_API_KEY not set on the server." },
        { status: 500 },
      );
    }

    const openai = new OpenAI({ apiKey: process.env.OPENAI_API_KEY });
    const { transcript, instructions } = await req.json();

    if (!transcript || !instructions) {
      return NextResponse.json(
        { error: "transcript and instructions are required." },
        { status: 400 },
      );
    }

    const chat = await openai.chat.completions.create({
      model: "gpt-4o-mini",
      temperature: 0.3,
      messages: [
        {
          role: "system",
          content:
            "You transform raw voice-note transcripts into clean, well-formatted text. Follow the user's instructions exactly. Preserve factual content. If the transcript has filler words or false starts, clean them up unless the user asks otherwise. Output only the requested text, no preamble.",
        },
        {
          role: "user",
          content: `INSTRUCTIONS:\n${instructions}\n\nTRANSCRIPT:\n${transcript}`,
        },
      ],
    });

    const summary = chat.choices[0]?.message?.content?.trim() || "";
    return NextResponse.json({ summary });
  } catch (err: any) {
    console.error("Summarize error:", err);
    return NextResponse.json(
      { error: err?.message || "Summarization failed" },
      { status: 500 },
    );
  }
}
