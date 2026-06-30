"use client";

import { useEffect, useState } from "react";

const API = "http://localhost:8000";

interface Commit {
  id: number;
  message: string;
  created_at: string;
}

export default function CommitsPage() {
  const [commits, setCommits] = useState<Commit[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetch(`${API}/commits`)
      .then((r) => r.json())
      .then((data: Commit[]) => {
        setCommits(data.slice().reverse());
        setLoading(false);
      });
  }, []);

  return (
    <div className="p-8">
      <div className="mb-6">
        <h1 className="text-lg font-semibold text-gray-900">Commits</h1>
        <p className="text-sm text-gray-500 mt-0.5">
          {loading ? "Loading..." : `${commits.length} commit${commits.length !== 1 ? "s" : ""}`}
        </p>
      </div>

      <div className="flex flex-col gap-2">
        {!loading &&
          commits.map((commit) => (
            <div
              key={commit.id}
              className="bg-white rounded-lg px-5 py-4 flex items-center justify-between"
              style={{ border: "1px solid #e5e7eb" }}
            >
              <div className="flex items-center gap-3">
                <span
                  className="text-xs font-mono text-gray-400 bg-gray-100 px-2 py-0.5 rounded"
                >
                  #{commit.id}
                </span>
                <span className="text-sm text-gray-800 font-medium">
                  {commit.message}
                </span>
              </div>
              <span className="text-xs text-gray-400">
                {new Date(commit.created_at).toLocaleString()}
              </span>
            </div>
          ))}
        {!loading && commits.length === 0 && (
          <div className="text-sm text-gray-400 text-center py-12">
            No commits yet.
          </div>
        )}
      </div>
    </div>
  );
}
