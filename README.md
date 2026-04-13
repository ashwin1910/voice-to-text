# Voice to Text

Simple internal tool: drop an audio file, get a cleaned-up transcript + optional AI summary.

- Frontend: Next.js 14 (App Router) + React
- Transcription: OpenAI Whisper (`whisper-1`)
- Summarization: OpenAI `gpt-4o-mini` (only runs if you provide instructions)
- Theme: Anthropic-inspired (warm cream + coral)

Supports iPhone `.m4a`, Android `.m4a/.3gp/.amr/.opus`, plus `.mp3 .wav .ogg .webm .mp4 .mov .flac .aac`. Files over 25 MB are **automatically compressed** in-browser using FFmpeg WASM (mono MP3, 48 kbps) before upload — no size limit from the user's perspective.

---

## Run locally

```bash
cd voice-to-text
npm install
cp .env.example .env.local
# edit .env.local and paste your OPENAI_API_KEY
npm run dev
```

Open http://localhost:3000

Get an OpenAI API key at https://platform.openai.com/api-keys.

Pricing reference (as of 2026): Whisper ~$0.006/min of audio, gpt-4o-mini summary ~$0.0001 per voice note. A 5-min voice note costs ~3¢.

---

## Deploy to Vercel

1. Push this folder to a GitHub repo.
2. Go to https://vercel.com → **New Project** → import the repo.
3. In **Environment Variables**, add:
   - `OPENAI_API_KEY` = `sk-...`
4. Deploy. Done.

Vercel free (Hobby) tier handles this fine. If you process long audio files (>60s of server time), upgrade to Pro or increase `maxDuration` in `app/api/transcribe/route.ts`.

---

## Do I need Supabase / a database?

**No, not for the current feature set.** This app is stateless — file in, text out, nothing stored. You'd only add Supabase if you want:

- **Transcript history** per user (save past transcripts)
- **Proper per-user auth** (magic links, Google login)
- **Shared library** where teammates can browse each other's transcripts

If you want any of that later, Supabase free tier is more than enough for internal use (500 MB DB, 1 GB storage).

---

## Adding auth later (if needed)

Since this is currently "no auth" (open), if you deploy it publicly you should add a minimal gate. Easiest option — a shared password via Vercel Password Protection (Pro plan) or a middleware check:

```ts
// middleware.ts
import { NextResponse } from "next/server";
export function middleware(req) {
  const auth = req.headers.get("authorization");
  const expected = "Basic " + btoa("team:" + process.env.SHARED_PASSWORD);
  if (auth !== expected) {
    return new NextResponse("Auth required", {
      status: 401,
      headers: { "WWW-Authenticate": 'Basic realm="Secure"' },
    });
  }
  return NextResponse.next();
}
```

Then set `SHARED_PASSWORD` in Vercel env vars.

---

## File structure

```
voice-to-text/
├── app/
│   ├── api/transcribe/route.ts   # Whisper + GPT summary endpoint
│   ├── globals.css               # Anthropic-themed styles
│   ├── layout.tsx
│   └── page.tsx                  # Main UI (drop zone + instructions + output)
├── .env.example
├── next.config.js
├── package.json
├── tsconfig.json
└── README.md
```
