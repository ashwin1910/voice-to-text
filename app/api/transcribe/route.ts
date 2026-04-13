import { NextRequest, NextResponse } from "next/server";
import OpenAI from "openai";

export const runtime = "nodejs";
export const maxDuration = 60;

function jsonError(message: string, status = 500) {
  return NextResponse.json({ error: message }, { status });
}

export async function POST(req: NextRequest) {
  try {
    if (!process.env.OPENAI_API_KEY) {
      return jsonError("OPENAI_API_KEY not set on the server.");
    }

    const openai = new OpenAI({ apiKey: process.env.OPENAI_API_KEY });

    let form: FormData;
    try {
      form = await req.formData();
    } catch (e: any) {
      return jsonError("Failed to parse upload: " + (e?.message || "unknown"), 400);
    }

    const file = form.get("file");
    const instructions = (form.get("instructions") as string) || "";

    if (!file || !(file instanceof File)) {
      return jsonError("No file uploaded.", 400);
    }
    if (file.size > 25 * 1024 * 1024) {
      return jsonError("File exceeds 25 MB Whisper API limit.", 400);
    }

    const transcription = await openai.audio.transcriptions.create({
      file: file,
      model: "whisper-1",
      response_format: "text",
    });

    const transcript =
      typeof transcription === "string"
        ? transcription
        : (transcription as any).text || "";

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
    const msg =
      err?.status === 413
        ? "File too large for the server. Try a shorter recording."
        : err?.message || "Transcription failed";
    return jsonError(msg);
  }
}
