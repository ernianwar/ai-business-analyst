"use client";

import { useRef, useState } from "react";

const features = [
  {
    title: "Executive Summary",
    description: "Turn dense reports into sharp, decision-ready summaries in seconds.",
  },
  {
    title: "SWOT Analysis",
    description: "Identify strengths, weaknesses, opportunities and threats with clarity.",
  },
  {
    title: "Business Risk Detection",
    description: "Surface hidden risks before they become costly issues for your team.",
  },
  {
    title: "Proposal Improvement",
    description: "Refine proposals with stronger positioning, structure and messaging.",
  },
  {
    title: "AI Recommendations",
    description: "Receive strategic next steps tailored to your business context.",
  },
];

function formatFileSize(bytes: number) {
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
}

export default function Home() {
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [selectedFile, setSelectedFile] = useState<File | null>(null);
  const [dragActive, setDragActive] = useState(false);

  const handleFiles = (files: FileList | null) => {
    const file = files?.[0];
    if (!file) return;

    const lowerName = file.name.toLowerCase();
    const supported =
      lowerName.endsWith(".pdf") ||
      lowerName.endsWith(".docx") ||
      lowerName.endsWith(".pptx");

    if (supported) {
      setSelectedFile(file);
    }
  };

  return (
    <main className="min-h-screen bg-[radial-gradient(circle_at_top,_rgba(34,211,238,0.16),_transparent_40%),linear-gradient(135deg,_#030712_0%,_#0f172a_100%)] text-slate-100">
      <div className="mx-auto flex max-w-7xl flex-col px-6 py-8 sm:px-8 lg:px-12">
        <section className="rounded-[2rem] border border-white/10 bg-slate-950/70 px-6 py-10 shadow-2xl shadow-cyan-950/30 backdrop-blur sm:px-10 lg:px-16 lg:py-16">
          <div className="grid gap-12 lg:grid-cols-[1.2fr_0.8fr] lg:items-center">
            <div className="space-y-8">
              <div className="inline-flex items-center rounded-full border border-cyan-400/30 bg-cyan-400/10 px-3 py-1 text-sm font-medium text-cyan-200">
                AI-powered business analysis
              </div>

              <div className="space-y-4">
                <h1 className="text-4xl font-semibold tracking-tight text-white sm:text-5xl lg:text-7xl">
                  AnalytQ Business AI
                </h1>
                <p className="text-xl font-medium text-cyan-300 sm:text-2xl">
                  Analyze. Think. Recommend.
                </p>
                <p className="max-w-2xl text-lg leading-8 text-slate-300 sm:text-xl">
                  An AI-powered business analysis platform that helps consultants, executives and business owners analyze proposals, business plans, reports and pitch decks.
                </p>
              </div>

              <div className="flex flex-col gap-3 sm:flex-row">
                <a
                  href="#"
                  className="rounded-full bg-cyan-400 px-6 py-3 text-center font-semibold text-slate-950 transition hover:bg-cyan-300"
                >
                  Analyze Document
                </a>
                <a
                  href="#features"
                  className="rounded-full border border-white/15 bg-white/5 px-6 py-3 text-center font-semibold text-slate-100 transition hover:bg-white/10"
                >
                  View Demo
                </a>
              </div>
            </div>

            <div className="rounded-[1.5rem] border border-white/10 bg-slate-900/80 p-6 shadow-xl shadow-slate-950/50">
              <div className="rounded-[1.25rem] border border-cyan-400/20 bg-gradient-to-br from-cyan-500/15 to-slate-800 p-6">
                <div className="mb-5 flex items-center justify-between">
                  <span className="text-sm font-semibold uppercase tracking-[0.25em] text-cyan-300">
                    Live Insight
                  </span>
                  <span className="rounded-full bg-emerald-400/15 px-3 py-1 text-xs font-medium text-emerald-300">
                    Ready
                  </span>
                </div>
                <div className="space-y-3 text-sm text-slate-300">
                  <div className="rounded-xl border border-white/10 bg-slate-950/60 p-3">
                    <p className="font-medium text-white">Proposal Review</p>
                    <p className="mt-1">Clear executive summary with strategic recommendations.</p>
                  </div>
                  <div className="rounded-xl border border-white/10 bg-slate-950/60 p-3">
                    <p className="font-medium text-white">Risk Scan</p>
                    <p className="mt-1">Detected operational and financial risks early.</p>
                  </div>
                  <div className="rounded-xl border border-white/10 bg-slate-950/60 p-3">
                    <p className="font-medium text-white">Suggested Actions</p>
                    <p className="mt-1">Actionable guidance for executives and consultants.</p>
                  </div>
                </div>
              </div>
            </div>
          </div>
        </section>

        <section className="mt-8 rounded-[2rem] border border-white/10 bg-slate-950/70 p-6 shadow-2xl shadow-cyan-950/20 sm:p-8 lg:p-10">
          <div className="grid gap-8 lg:grid-cols-[0.9fr_1.1fr] lg:items-center">
            <div className="space-y-3">
              <p className="text-sm font-semibold uppercase tracking-[0.3em] text-cyan-300">
                Upload document
              </p>
              <h2 className="text-2xl font-semibold text-white sm:text-3xl">
                Drop your business document here
              </h2>
              <p className="max-w-xl text-base leading-7 text-slate-300">
                Bring in proposals, plans, reports or pitch decks and prepare them for analysis in a few clicks.
              </p>
            </div>

            <div
              className={`rounded-[1.5rem] border-2 border-dashed p-6 transition ${
                dragActive
                  ? "border-cyan-400 bg-cyan-400/10"
                  : "border-white/15 bg-slate-900/70"
              }`}
              onDragOver={(event) => {
                event.preventDefault();
                setDragActive(true);
              }}
              onDragLeave={() => setDragActive(false)}
              onDrop={(event) => {
                event.preventDefault();
                setDragActive(false);
                handleFiles(event.dataTransfer.files);
              }}
            >
              <input
                ref={fileInputRef}
                type="file"
                className="hidden"
                accept=".pdf,.docx,.pptx"
                onChange={(event) => handleFiles(event.target.files)}
              />

              <div className="flex flex-col items-center justify-center text-center">
                <div className="flex h-16 w-16 items-center justify-center rounded-full bg-cyan-400/10 text-cyan-300">
                  <svg viewBox="0 0 24 24" className="h-8 w-8" fill="none" stroke="currentColor" strokeWidth="1.8">
                    <path strokeLinecap="round" strokeLinejoin="round" d="M12 16V4m0 0l-4 4m4-4l4 4M4 16v2a2 2 0 002 2h12a2 2 0 002-2v-2" />
                  </svg>
                </div>
                <p className="mt-4 text-lg font-semibold text-white">
                  Drop your business document here
                </p>
                <p className="mt-2 text-sm text-slate-400">
                  Supported: PDF, Word, PowerPoint
                </p>
                <button
                  type="button"
                  onClick={() => fileInputRef.current?.click()}
                  className="mt-5 rounded-full border border-cyan-400/30 bg-cyan-400/10 px-5 py-2.5 text-sm font-semibold text-cyan-200 transition hover:bg-cyan-400/20"
                >
                  Browse files
                </button>
              </div>
            </div>
          </div>

          {selectedFile ? (
            <div className="mt-6 rounded-[1.25rem] border border-cyan-400/20 bg-cyan-400/10 p-5">
              <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
                <div className="space-y-2">
                  <div className="flex items-center gap-2 text-sm font-semibold text-cyan-200">
                    <span className="text-lg">✓</span>
                    <span>{selectedFile.name}</span>
                  </div>
                  <div className="flex items-center gap-2 text-sm text-slate-300">
                    <span className="text-lg">✓</span>
                    <span>{formatFileSize(selectedFile.size)}</span>
                  </div>
                  <div className="flex items-center gap-2 text-sm font-semibold text-emerald-300">
                    <span className="text-lg">✓</span>
                    <span>Ready to Analyze</span>
                  </div>
                </div>

                <button
                  type="button"
                  className="rounded-full bg-cyan-400 px-5 py-2.5 text-sm font-semibold text-slate-950 transition hover:bg-cyan-300"
                >
                  Analyze Document
                </button>
              </div>
            </div>
          ) : null}
        </section>

        <section id="features" className="mt-10">
          <div className="mb-6 flex items-end justify-between gap-4">
            <div>
              <p className="text-sm font-semibold uppercase tracking-[0.3em] text-cyan-300">
                Core capabilities
              </p>
              <h2 className="mt-2 text-2xl font-semibold text-white sm:text-3xl">
                Make faster, sharper decisions
              </h2>
            </div>
          </div>

          <div className="grid gap-5 md:grid-cols-2 xl:grid-cols-3">
            {features.map((feature) => (
              <article
                key={feature.title}
                className="rounded-[1.25rem] border border-white/10 bg-slate-900/70 p-6 shadow-lg shadow-slate-950/30"
              >
                <div className="mb-4 h-10 w-10 rounded-full bg-cyan-400/15" />
                <h3 className="text-lg font-semibold text-white">{feature.title}</h3>
                <p className="mt-2 text-sm leading-7 text-slate-300">{feature.description}</p>
              </article>
            ))}
          </div>
        </section>

        <footer className="mt-10 border-t border-white/10 py-6 text-center text-sm text-slate-400">
          Built with Next.js + OpenAI
        </footer>
      </div>
    </main>
  );
}
