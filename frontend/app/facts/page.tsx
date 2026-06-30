"use client";

import { useEffect, useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { Suspense } from "react";

const API = "http://localhost:8000";

interface Fact {
  id: number;
  subject: string;
  predicate: string;
  object: string;
  source: string;
  commit_id: number;
  status: string;
  created_at: string;
}

interface Commit {
  id: number;
  message: string;
  created_at: string;
}

function FactsContent() {
  const searchParams = useSearchParams();
  const router = useRouter();
  const [commits, setCommits] = useState<Commit[]>([]);
  const [facts, setFacts] = useState<Fact[]>([]);
  const [loading, setLoading] = useState(true);
  const [selectedCommit, setSelectedCommit] = useState<number | null>(null);

  useEffect(() => {
    fetch(`${API}/commits`)
      .then((r) => r.json())
      .then((data: Commit[]) => {
        setCommits(data);
        const paramCommit = searchParams.get("commit");
        const commit = paramCommit
          ? parseInt(paramCommit)
          : data.length > 0
          ? data[data.length - 1].id
          : 1;
        setSelectedCommit(commit);
      });
  }, []);

  useEffect(() => {
    if (selectedCommit === null) return;
    setLoading(true);
    fetch(`${API}/facts?commit=${selectedCommit}`)
      .then((r) => r.json())
      .then((data: Fact[]) => {
        setFacts(data);
        setLoading(false);
      });
  }, [selectedCommit]);

  function handleCommitChange(e: React.ChangeEvent<HTMLSelectElement>) {
    const val = parseInt(e.target.value);
    setSelectedCommit(val);
    router.replace(`/facts?commit=${val}`);
  }

  return (
    <div className="p-8">
      <div className="mb-6 flex items-center justify-between">
        <div>
          <h1 className="text-lg font-semibold text-gray-900">Facts</h1>
          <p className="text-sm text-gray-500 mt-0.5">
            {loading ? "Loading..." : `${facts.length} active facts`}
          </p>
        </div>
        {commits.length > 0 && selectedCommit !== null && (
          <div className="flex items-center gap-2">
            <label className="text-sm text-gray-500">Commit</label>
            <select
              value={selectedCommit}
              onChange={handleCommitChange}
              className="text-sm border rounded-md px-2 py-1.5 bg-white text-gray-700 focus:outline-none"
              style={{ borderColor: "#e5e7eb" }}
            >
              {commits.map((c) => (
                <option key={c.id} value={c.id}>
                  #{c.id} — {c.message}
                </option>
              ))}
            </select>
          </div>
        )}
      </div>

      <div
        className="bg-white rounded-lg overflow-hidden"
        style={{ border: "1px solid #e5e7eb" }}
      >
        <table className="w-full text-sm">
          <thead>
            <tr style={{ borderBottom: "1px solid #e5e7eb" }}>
              <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wide">
                Subject
              </th>
              <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wide">
                Predicate
              </th>
              <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wide">
                Object
              </th>
              <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wide">
                Source
              </th>
            </tr>
          </thead>
          <tbody>
            {!loading &&
              facts.map((fact, i) => (
                <tr
                  key={fact.id}
                  style={{
                    borderBottom:
                      i < facts.length - 1 ? "1px solid #f3f4f6" : "none",
                  }}
                  className="hover:bg-gray-50 transition-colors"
                >
                  <td className="px-4 py-3 text-gray-900 font-medium">
                    {fact.subject}
                  </td>
                  <td className="px-4 py-3 text-gray-500">{fact.predicate}</td>
                  <td className="px-4 py-3 text-gray-700">{fact.object}</td>
                  <td className="px-4 py-3">
                    <span className="text-xs text-gray-400 bg-gray-100 px-2 py-0.5 rounded-full">
                      {fact.source || "—"}
                    </span>
                  </td>
                </tr>
              ))}
            {!loading && facts.length === 0 && (
              <tr>
                <td
                  colSpan={4}
                  className="px-4 py-8 text-center text-gray-400 text-sm"
                >
                  No facts found for this commit.
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
}

export default function FactsPage() {
  return (
    <Suspense fallback={<div className="p-8 text-sm text-gray-400">Loading...</div>}>
      <FactsContent />
    </Suspense>
  );
}
