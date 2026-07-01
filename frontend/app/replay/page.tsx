"use client";

import { useEffect, useRef, useState } from "react";
import { API } from "../config";

const DEFAULT_QUESTION = "What is the remote work policy?";

interface Commit {
  id: number;
  message: string;
  created_at: string;
}

export default function ReplayPage() {
  const [commits, setCommits] = useState<Commit[]>([]);
  const [idx, setIdx] = useState(0); // slider position = index into commits
  const [question, setQuestion] = useState(DEFAULT_QUESTION);

  const [answer, setAnswer] = useState<string | null>(null);
  const [answering, setAnswering] = useState(false);

  // Cache answers per "commitId|question" so re-visiting a stop is instant and
  // we stay gentle on the LLM quota.
  const cache = useRef<Map<string, string>>(new Map());
  const debounce = useRef<ReturnType<typeof setTimeout> | null>(null);

  const current = commits[idx];

  useEffect(() => {
    fetch(`${API}/commits`)
      .then((r) => r.json())
      .then((data: Commit[]) => {
        setCommits(data);
        if (data.length > 0) setIdx(data.length - 1); // start at HEAD
      })
      .catch(() => {});
  }, []);

  // Fetch the answer for the current commit whenever the slider settles or the
  // question changes. Debounced so mid-drag stops don't each fire a call.
  useEffect(() => {
    if (!current) return;
    const key = `${current.id}|${question.trim()}`;

    if (cache.current.has(key)) {
      setAnswer(cache.current.get(key)!);
      setAnswering(false);
      return;
    }

    setAnswering(true);
    if (debounce.current) clearTimeout(debounce.current);
    debounce.current = setTimeout(async () => {
      try {
        const res = await fetch(
          `${API}/replay?commit=${current.id}&question=${encodeURIComponent(question.trim())}`
        );
        const data = await res.json();
        const text = res.ok
          ? (data.answers || []).join("\n")
          : data.detail || "The model is rate-limited — try again in a moment.";
        cache.current.set(key, text);
        setAnswer(text);
      } catch {
        setAnswer("Could not reach the backend on port 8000.");
      }
      setAnswering(false);
    }, 260);

    return () => {
      if (debounce.current) clearTimeout(debounce.current);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [current?.id, question]);

  // Reset cache when the question changes (answers are question-specific).
  function onQuestionChange(v: string) {
    setQuestion(v);
  }

  return (
    <div style={{ padding: "40px 48px", maxWidth: 960 }}>
      {/* Header */}
      <div style={{ marginBottom: 22 }}>
        <h1 style={{ fontSize: 20, fontWeight: 600, color: "#fff", letterSpacing: "-0.02em", margin: 0 }}>
          Replay
        </h1>
        <p style={{ fontSize: 13, color: "rgba(255,255,255,0.35)", marginTop: 5, maxWidth: 660, lineHeight: 1.6 }}>
          Scrub through the AI&apos;s memory over time. Drag the slider across commits and watch the
          same question get answered from whatever the memory knew at that moment.
        </p>
      </div>

      {/* Fixed question */}
      <div style={{
        background: "#10131D", border: "1px solid rgba(255,255,255,0.07)", borderRadius: 12,
        padding: "16px 18px", marginBottom: 22,
      }}>
        <label style={{ fontSize: 11, color: "rgba(255,255,255,0.35)", textTransform: "uppercase", letterSpacing: "0.04em" }}>
          Question
        </label>
        <input
          value={question}
          onChange={(e) => onQuestionChange(e.target.value)}
          style={{
            width: "100%", marginTop: 8, background: "#0C0F17", border: "1px solid rgba(255,255,255,0.1)",
            borderRadius: 9, padding: "11px 14px", fontSize: 14, color: "#fff", outline: "none", fontFamily: "inherit",
          }}
        />
      </div>

      {/* Answer for the current commit */}
      <div style={{
        background: "linear-gradient(180deg, #121826 0%, #0E1119 100%)",
        border: "1px solid rgba(59,130,246,0.22)", borderRadius: 14,
        padding: "22px 24px", marginBottom: 26, minHeight: 132,
      }}>
        {current && (
          <div style={{ display: "flex", alignItems: "center", gap: 10, marginBottom: 14 }}>
            <span style={{
              display: "inline-flex", alignItems: "center", gap: 7, fontSize: 12.5, fontWeight: 600,
              color: "#93b4fc", background: "rgba(59,130,246,0.12)", border: "1px solid rgba(59,130,246,0.3)",
              borderRadius: 20, padding: "3px 12px",
            }}>
              commit #{current.id}
            </span>
            <span style={{ fontSize: 13, color: "rgba(255,255,255,0.5)" }}>{current.message}</span>
          </div>
        )}
        {answering && answer === null ? (
          <div style={{ display: "flex", gap: 8, alignItems: "center", color: "rgba(255,255,255,0.35)", fontSize: 13 }}>
            <Spinner /> Recalling what the memory knew…
          </div>
        ) : (
          <p
            key={`${current?.id}-${answer}`}
            className="replay-answer"
            style={{ fontSize: 17, color: "#fff", lineHeight: 1.6, margin: 0, fontWeight: 450, whiteSpace: "pre-wrap" }}
          >
            {answer ?? "—"}
            {answering && <span style={{ color: "rgba(255,255,255,0.3)", fontSize: 13 }}>  ↻</span>}
          </p>
        )}
      </div>

      {/* The scrubber */}
      {commits.length > 0 && current && (
        <div style={{
          background: "#10131D", border: "1px solid rgba(255,255,255,0.07)", borderRadius: 12,
          padding: "22px 24px 16px",
        }}>
          <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 14 }}>
            <span style={{ fontSize: 12, color: "rgba(255,255,255,0.4)" }}>
              Timeline · {commits.length} commits
            </span>
            <span style={{ fontSize: 12, color: "rgba(255,255,255,0.4)" }}>
              Viewing <strong style={{ color: "#93b4fc" }}>#{current.id}</strong> of {commits[commits.length - 1].id}
            </span>
          </div>

          <input
            type="range"
            min={0}
            max={commits.length - 1}
            step={1}
            value={idx}
            onChange={(e) => setIdx(Number(e.target.value))}
            className="replay-slider"
            style={{ width: "100%" }}
          />

          {/* commit ticks */}
          <div style={{ display: "flex", justifyContent: "space-between", marginTop: 10 }}>
            {commits.map((c, i) => {
              const active = i === idx;
              return (
                <button
                  key={c.id}
                  onClick={() => setIdx(i)}
                  title={c.message}
                  style={{
                    display: "flex", flexDirection: "column", alignItems: "center", gap: 4,
                    background: "transparent", border: "none", cursor: "pointer", padding: 0, flex: 1,
                  }}
                >
                  <span style={{
                    width: active ? 11 : 8, height: active ? 11 : 8, borderRadius: "50%",
                    background: active ? "#3B82F6" : "rgba(255,255,255,0.18)",
                    boxShadow: active ? "0 0 0 4px rgba(59,130,246,0.18)" : "none",
                    transition: "all 160ms ease",
                  }} />
                  <span style={{
                    fontSize: 10.5, color: active ? "#93b4fc" : "rgba(255,255,255,0.3)",
                    fontWeight: active ? 600 : 400,
                  }}>
                    #{c.id}
                  </span>
                </button>
              );
            })}
          </div>
        </div>
      )}

      <style>{`
        .replay-answer { animation: replayIn 320ms cubic-bezier(.22,.61,.36,1) both; }
        @keyframes replayIn { from { opacity: 0; transform: translateY(6px); } to { opacity: 1; transform: none; } }
        .replay-slider {
          -webkit-appearance: none; appearance: none; height: 6px; border-radius: 6px;
          background: linear-gradient(90deg, rgba(59,130,246,0.55), rgba(99,102,241,0.35));
          outline: none;
        }
        .replay-slider::-webkit-slider-thumb {
          -webkit-appearance: none; appearance: none; width: 20px; height: 20px; border-radius: 50%;
          background: #fff; border: 3px solid #3B82F6; cursor: grab;
          box-shadow: 0 2px 10px rgba(59,130,246,0.5); transition: transform 120ms ease;
        }
        .replay-slider::-webkit-slider-thumb:active { cursor: grabbing; transform: scale(1.15); }
        .replay-slider::-moz-range-thumb {
          width: 20px; height: 20px; border-radius: 50%; background: #fff; border: 3px solid #3B82F6;
          cursor: grab; box-shadow: 0 2px 10px rgba(59,130,246,0.5);
        }
      `}</style>
    </div>
  );
}

function Spinner() {
  return (
    <>
      <span style={{
        width: 14, height: 14, borderRadius: "50%", border: "2px solid rgba(59,130,246,0.25)",
        borderTopColor: "#3B82F6", animation: "spin 0.8s linear infinite", display: "inline-block",
      }} />
      <style>{`@keyframes spin{to{transform:rotate(360deg)}}`}</style>
    </>
  );
}
