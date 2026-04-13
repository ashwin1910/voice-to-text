import { NextRequest, NextResponse } from "next/server";
import OpenAI from "openai";

export const runtime = "nodejs";
export const maxDuration = 60; // seconds; bump on Vercel Pro if you need longer

const openai = new OpenAI({ apiKey: process.env.OPENAI_API_KEY });

export async function POST(req: NextRequest) {
  try {
    if (!process.env.OPENAI_API_KEY) {
      return NextResponse.json(
        { error: "OPENAI_API_KEY not set on the server." },
        { status: 500 }
      );
    }

    const form = await req.formData();
    const file = form.get("file");
    const instructions = (form.get("instructions") as string) || "";

    if (!file || !(file instanceof File)) {
      return NextResponse.json({ error: "No file uploaded." }, { status: 400 });
    }
    if (file.size > 25 * 1024 * 1024) {
      return NextResponse.json(
        { error: "File exceeds 25MB Whisper API limit." },
        { status: 400 }
      );
    }

    // Step 1 — Whisper transcription
    // The OpenAI SDK accepts the web File object directly.
    const transcription = await openai.audio.transcriptions.create({
      file: file,
      model: "whisper-1",
      response_format: "text",
    });

    const transcript =
      typeof transcription === "string"
        ? transcription
        : (transcription as any).text || "";

    // Step 2 — Optional GPT summarization (only if instructions provided)
    let summary = "";
    if (instructions.trim()) {
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
      summary = chat.choices[0]?.message?.content?.trim() || "";
    }

    return NextResponse.json({ transcript, summary });
  } catch (err: any) {
    console.error("Transcribe error:", err);
    return NextResponse.json(
      { error: err?.message || "Transcription failed" },
      { status: 500 }
    );
  }
}
