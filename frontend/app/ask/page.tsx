"use client";

import { useEffect, useState } from "react";

const API = "http://localhost:8000";

interface Commit {
  id: number;
  message: string;
  created_at: string;
}

export default function AskPage() {
  const [commits, setCommits] = useState<Commit[]>([]);
  const [selectedCommit, setSelectedCommit] = useState<number>(1);
  const [question, setQuestion] = useState("");
  const [answer, setAnswer] = useState<string[] | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    fetch(`${API}/commits`)
      .then((r) => r.json())
      .then((data: Commit[]) => {
        setCommits(data);
        if (data.length > 0) setSelectedCommit(data[data.length - 1].id);
      });
  }, []);

  async function handleAsk(e: React.FormEvent) {
    e.preventDefault();
    if (!question.trim()) return;
    setLoading(true);
    setError(null);
    setAnswer(null);
    try {
      const res = await fetch(`${API}/ask`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ question: question.trim(), commit: selectedCommit }),
      });
      if (!res.ok) {
        const data = await res.json();
        setError(data.detail || "Request failed");
      } else {
        const data = await res.json();
        setAnswer(data.answers as string[]);
      }
    } catch {
      setError("Could not reach the backend. Is it running on port 8000?");
    }
    setLoading(false);
  }

  return (
    <div className="p-8 max-w-2xl">
      <div className="mb-6">
        <h1 className="text-lg font-semibold text-gray-900">Ask</h1>
        <p className="text-sm text-gray-500 mt-0.5">
          Query the AI&apos;s memory at a specific commit
        </p>
      </div>

      <form onSubmit={handleAsk} className="flex flex-col gap-4">
        <div className="flex gap-3">
          <input
            type="text"
            value={question}
            onChange={(e) => setQuestion(e.target.value)}
            placeholder="e.g. What is the remote work policy?"
            className="flex-1 text-sm border rounded-lg px-3 py-2.5 bg-white text-gray-800 placeholder-gray-400 focus:outline-none focus:ring-2 focus:ring-gray-200"
            style={{ borderColor: "#e5e7eb" }}
          />
          {commits.length > 0 && (
            <select
              value={selectedCommit}
              onChange={(e) => setSelectedCommit(parseInt(e.target.value))}
              className="text-sm border rounded-lg px-3 py-2.5 bg-white text-gray-700 focus:outline-none"
              style={{ borderColor: "#e5e7eb" }}
            >
              {commits.map((c) => (
                <option key={c.id} value={c.id}>
                  #{c.id} — {c.message}
                </option>
              ))}
            </select>
          )}
          <button
            type="submit"
            disabled={loading || !question.trim()}
            className="px-4 py-2.5 text-sm font-medium text-white bg-gray-900 rounded-lg hover:bg-gray-700 transition-colors disabled:opacity-40 disabled:cursor-not-allowed"
          >
            {loading ? "Thinking…" : "Ask"}
          </button>
        </div>
      </form>

      {error && (
        <div
          className="mt-4 rounded-lg px-4 py-3 text-sm text-red-700"
          style={{ backgroundColor: "#fef2f2", border: "1px solid #fecaca" }}
        >
          {error}
        </div>
      )}

      {answer !== null && (
        <div
          className="mt-4 rounded-lg px-5 py-4 bg-white"
          style={{ border: "1px solid #e5e7eb" }}
        >
          <p className="text-xs font-medium text-gray-400 uppercase tracking-wide mb-2">
            Answer (commit #{selectedCommit})
          </p>
          {answer.length === 0 ? (
            <p className="text-sm text-gray-500">
              No answer found. Try ingesting data first via POST /ingest.
            </p>
          ) : (
            <div className="flex flex-col gap-2">
              {answer.map((a, i) => (
                <p key={i} className="text-sm text-gray-800 leading-relaxed">
                  {a}
                </p>
              ))}
            </div>
          )}
        </div>
      )}
    </div>
  );
}
