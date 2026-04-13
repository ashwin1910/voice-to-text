"use client";

import { useState, useRef, useEffect, useCallback, DragEvent, ChangeEvent } from "react";
import { FFmpeg } from "@ffmpeg/ffmpeg";
import { fetchFile, toBlobURL } from "@ffmpeg/util";

const MAX_SIZE = 25 * 1024 * 1024;

const ACCEPTED =
  "audio/*,video/mp4,.m4a,.mp3,.wav,.webm,.ogg,.opus,.mp4,.mov,.3gp,.amr,.aac,.flac";

const QUICK_PROMPTS = [
  { label: "📝 Clean transcript", text: "Clean up filler words and false starts. Keep the original voice and structure." },
  { label: "✅ Action items", text: "Extract clear action items as a bulleted list. Group by owner if mentioned." },
  { label: "✉️ Draft email", text: "Turn this into a concise, professional email draft." },
  { label: "📋 Meeting notes", text: "Summarize as meeting notes: key decisions, discussion points, next steps." },
];

export default function Home() {
  const [file, setFile] = useState<File | null>(null);
  const [instructions, setInstructions] = useState("");
  const [loading, setLoading] = useState(false);
  const [transcript, setTranscript] = useState("");
  const [summary, setSummary] = useState("");
  const [error, setError] = useState("");
  const [activeTab, setActiveTab] = useState<"summary" | "transcript">("summary");
  const [dragging, setDragging] = useState(false);
  const [copied, setCopied] = useState(false);
  const [elapsed, setElapsed] = useState(0);
  const [compressing, setCompressing] = useState(false);
  const [compressionProgress, setCompressionProgress] = useState(0);
  const [originalSize, setOriginalSize] = useState(0);
  const inputRef = useRef<HTMLInputElement>(null);
  const ffmpegRef = useRef<FFmpeg | null>(null);

  // elapsed timer during loading
  useEffect(() => {
    if (!loading) return;
    setElapsed(0);
    const t = setInterval(() => setElapsed((e) => e + 1), 1000);
    return () => clearInterval(t);
  }, [loading]);

  const loadFFmpeg = useCallback(async () => {
    if (ffmpegRef.current) return ffmpegRef.current;
    const ffmpeg = new FFmpeg();
    const baseURL = "https://cdn.jsdelivr.net/npm/@ffmpeg/core@0.12.10/dist/umd";
    ffmpeg.on("progress", ({ progress }) => {
      setCompressionProgress(Math.max(0, Math.min(100, Math.round(progress * 100))));
    });
    await ffmpeg.load({
      coreURL: await toBlobURL(`${baseURL}/ffmpeg-core.js`, "text/javascript"),
      wasmURL: await toBlobURL(`${baseURL}/ffmpeg-core.wasm`, "application/wasm"),
    });
    ffmpegRef.current = ffmpeg;
    return ffmpeg;
  }, []);

  const compressAudio = useCallback(async (inputFile: File): Promise<File> => {
    const ffmpeg = await loadFFmpeg();
    const ext = inputFile.name.split(".").pop()?.toLowerCase() || "m4a";
    await ffmpeg.writeFile(`input.${ext}`, await fetchFile(inputFile));
    await ffmpeg.exec([
      "-i", `input.${ext}`,
      "-ac", "1",
      "-ar", "16000",
      "-b:a", "48k",
      "-y",
      "output.mp3",
    ]);
    const raw = await ffmpeg.readFile("output.mp3") as Uint8Array;
    const blob = new Blob([raw.slice().buffer as ArrayBuffer], { type: "audio/mpeg" });
    return new File(
      [blob],
      inputFile.name.replace(/\.[^.]+$/, ".mp3"),
      { type: "audio/mpeg" },
    );
  }, [loadFFmpeg]);

  const handleFile = async (f: File | null) => {
    setError("");
    setTranscript("");
    setSummary("");
    setOriginalSize(0);
    if (!f) { setFile(null); return; }

    if (f.size > MAX_SIZE) {
      setOriginalSize(f.size);
      setFile(f);
      setCompressing(true);
      setCompressionProgress(0);
      try {
        const compressed = await compressAudio(f);
        if (compressed.size > MAX_SIZE) {
          setError("Still too large after compression. Try trimming the audio to a shorter clip.");
          setFile(null);
          return;
        }
        setFile(compressed);
      } catch (err: any) {
        setError("Compression failed: " + (err?.message || "Unknown error"));
        setFile(null);
      } finally {
        setCompressing(false);
      }
      return;
    }

    setFile(f);
  };

  const onDrop = (e: DragEvent<HTMLDivElement>) => {
    e.preventDefault();
    setDragging(false);
    const f = e.dataTransfer.files?.[0];
    if (f) handleFile(f);
  };

  const submit = async () => {
    if (!file) return;
    setLoading(true);
    setError("");
    setTranscript("");
    setSummary("");
    try {
      const fd = new FormData();
      fd.append("file", file);
      fd.append("instructions", instructions);
      const res = await fetch("/api/transcribe", { method: "POST", body: fd });
      const text = await res.text();
      let data: any;
      try { data = JSON.parse(text); } catch {
        throw new Error(text.slice(0, 120) || `Server error (${res.status})`);
      }
      if (!res.ok) throw new Error(data.error || "Failed to transcribe");
      setTranscript(data.transcript || "");
      setSummary(data.summary || "");
      setActiveTab(data.summary ? "summary" : "transcript");
    } catch (e: any) {
      setError(e.message || "Something went wrong");
    } finally {
      setLoading(false);
    }
  };

  const copy = (text: string) => {
    navigator.clipboard.writeText(text);
    setCopied(true);
    setTimeout(() => setCopied(false), 1800);
  };

  const wordCount = (t: string) => t.trim().split(/\s+/).filter(Boolean).length;

  return (
    <main className="container">
      <div className="brand">
        <span className="brand-dot" />
        <span>voice · to · text</span>
      </div>

      <h1>
        Turn voice notes into <em>clean text.</em>
      </h1>
      <p className="subtitle">
        Drop an audio file, tell us how you want it shaped, and Whisper takes care of the rest.
      </p>

      {/* Step 1 — file */}
      <div className="card">
        <div className="step">
          <span className="step-num">1</span>
          <span className="step-label">Upload audio</span>
          <span className="step-hint">iPhone · Android · mp3 · wav · any size</span>
        </div>
        <div
          className={`dropzone ${dragging ? "dragging" : ""} ${file ? "has-file" : ""}`}
          onClick={() => !file && inputRef.current?.click()}
          onDragOver={(e) => { e.preventDefault(); setDragging(true); }}
          onDragLeave={() => setDragging(false)}
          onDrop={onDrop}
        >
          {!file ? (
            <>
              <div className="dz-icon">
                <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.75" strokeLinecap="round" strokeLinejoin="round">
                  <rect x="9" y="2" width="6" height="12" rx="3" />
                  <path d="M5 10v2a7 7 0 0 0 14 0v-2" />
                  <line x1="12" y1="19" x2="12" y2="22" />
                </svg>
              </div>
              <div className="dz-main">Drop audio here, or click to browse</div>
              <div className="dz-sub">.m4a, .mp3, .wav, .ogg, .webm, .3gp, .amr, .opus</div>
            </>
          ) : (
            <div className="file-chip">
              <div className="file-icon">
                <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.75" strokeLinecap="round" strokeLinejoin="round">
                  <path d="M3 12h3l2-6 4 12 2-6 2 3h5" />
                </svg>
              </div>
              <div className="file-meta">
                <div className="file-name">{file.name}</div>
                <div className="file-size">
                  {compressing ? (
                    <>
                      {(file.size / 1024 / 1024).toFixed(1)} MB · compressing… {compressionProgress}%
                    </>
                  ) : originalSize ? (
                    <>
                      {(originalSize / 1024 / 1024).toFixed(1)} MB → {(file.size / 1024 / 1024).toFixed(1)} MB · compressed · ready
                    </>
                  ) : (
                    <>{(file.size / 1024 / 1024).toFixed(2)} MB · ready</>
                  )}
                </div>
                {compressing && (
                  <div className="compress-bar-track">
                    <div
                      className="compress-bar-fill"
                      style={{ width: `${compressionProgress}%` }}
                    />
                  </div>
                )}
              </div>
              {!compressing && (
                <button
                  className="file-remove"
                  onClick={(e) => { e.stopPropagation(); handleFile(null); }}
                  aria-label="Remove file"
                >
                  ✕
                </button>
              )}
            </div>
          )}
          <input
            ref={inputRef}
            type="file"
            accept={ACCEPTED}
            style={{ display: "none" }}
            onChange={(e: ChangeEvent<HTMLInputElement>) =>
              handleFile(e.target.files?.[0] || null)
            }
          />
        </div>
      </div>

      {/* Step 2 — instructions */}
      <div className="card">
        <div className="step">
          <span className="step-num">2</span>
          <span className="step-label">How should we shape it?</span>
          <span className="step-hint">Optional</span>
        </div>
        <textarea
          placeholder="e.g. Summarize as bullet points focused on action items. Or leave blank for a raw transcript."
          value={instructions}
          onChange={(e) => setInstructions(e.target.value)}
        />
        <div className="quick-prompts">
          {QUICK_PROMPTS.map((p) => (
            <button
              key={p.label}
              className="quick-prompt"
              onClick={() => setInstructions(p.text)}
              type="button"
            >
              {p.label}
            </button>
          ))}
        </div>
      </div>

      <button
        className="btn-primary accent"
        disabled={!file || loading || compressing}
        onClick={submit}
      >
        {loading ? (
          <>
            <span className="spinner" />
            Transcribing… {elapsed}s
          </>
        ) : (
          <>
            Transcribe
            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
              <line x1="5" y1="12" x2="19" y2="12" />
              <polyline points="12 5 19 12 12 19" />
            </svg>
          </>
        )}
      </button>

      {error && <div className="error">⚠ {error}</div>}

      {/* Processing placeholder */}
      {loading && (
        <div className="processing">
          <div className="processing-head">
            <div className="processing-bars">
              <span className="processing-bar" />
              <span className="processing-bar" />
              <span className="processing-bar" />
              <span className="processing-bar" />
              <span className="processing-bar" />
            </div>
            <span>
              {elapsed < 5
                ? "Uploading audio…"
                : elapsed < 20
                ? "Whisper is listening…"
                : "Cleaning up with GPT…"}
            </span>
          </div>
          <div className="shimmer-line" />
          <div className="shimmer-line" />
          <div className="shimmer-line" />
        </div>
      )}

      {/* Result */}
      {(transcript || summary) && !loading && (
        <div className="result">
          <div className="result-head">
            <div className="tabs">
              {summary && (
                <button
                  className={`tab ${activeTab === "summary" ? "active" : ""}`}
                  onClick={() => setActiveTab("summary")}
                >
                  Summary
                </button>
              )}
              <button
                className={`tab ${activeTab === "transcript" ? "active" : ""}`}
                onClick={() => setActiveTab("transcript")}
              >
                Raw transcript
              </button>
            </div>
            <button
              className={`copy-btn ${copied ? "copied" : ""}`}
              onClick={() => copy(activeTab === "summary" ? summary : transcript)}
            >
              {copied ? (
                <>
                  <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
                    <polyline points="20 6 9 17 4 12" />
                  </svg>
                  Copied
                </>
              ) : (
                <>
                  <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.75" strokeLinecap="round" strokeLinejoin="round">
                    <rect x="9" y="9" width="13" height="13" rx="2" />
                    <path d="M5 15H4a2 2 0 0 1-2-2V4a2 2 0 0 1 2-2h9a2 2 0 0 1 2 2v1" />
                  </svg>
                  Copy
                </>
              )}
            </button>
          </div>
          <div className={`output ${activeTab === "summary" ? "serif" : ""}`}>
            {activeTab === "summary" ? summary : transcript}
          </div>
          <div className="result-meta">
            <span><strong>{wordCount(activeTab === "summary" ? summary : transcript)}</strong> words</span>
            {summary && (
              <span><strong>{wordCount(transcript)}</strong> words in transcript</span>
            )}
          </div>
        </div>
      )}

      <div className="footer">
        Powered by OpenAI Whisper · Internal tool
      </div>
    </main>
  );
}
