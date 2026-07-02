"use client";

import { useEffect, useState, Suspense } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { API } from "../config";
import { PageShell, PageHeader, CommitPicker } from "../components/PageKit";

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
interface Commit { id: number; message: string; created_at: string }

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
        const p = searchParams.get("commit");
        setSelectedCommit(p ? parseInt(p) : data.length > 0 ? data[data.length - 1].id : 1);
      });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  useEffect(() => {
    if (selectedCommit === null) return;
    setLoading(true);
    fetch(`${API}/facts?commit=${selectedCommit}`)
      .then((r) => r.json())
      .then((data: Fact[]) => { setFacts(data); setLoading(false); });
  }, [selectedCommit]);

  function selectCommit(id: number) {
    setSelectedCommit(id);
    router.replace(`/facts?commit=${id}`);
  }

  // group facts by subject, preserving first-seen order
  const groups: { subject: string; facts: Fact[] }[] = [];
  const idx = new Map<string, number>();
  for (const f of facts) {
    if (!idx.has(f.subject)) { idx.set(f.subject, groups.length); groups.push({ subject: f.subject, facts: [] }); }
    groups[idx.get(f.subject)!].facts.push(f);
  }

  return (
    <PageShell width={1040}>
      <PageHeader
        title="Active"
        accent="facts"
        subtitle="Everything the AI currently knows at this commit — grouped by the entity it describes."
        right={
          !loading ? (
            <span className="eg-chip mono">{facts.length} facts · {groups.length} entities</span>
          ) : null
        }
      />

      {commits.length > 0 && selectedCommit !== null && (
        <div style={{ marginBottom: 22 }}>
          <CommitPicker commits={commits} value={selectedCommit} onChange={selectCommit} />
        </div>
      )}

      {loading && <div style={{ color: "var(--text-3)", fontSize: 13 }}>Loading…</div>}

      {!loading && facts.length === 0 && (
        <div className="eg-panel" style={{ padding: "48px 24px", textAlign: "center", color: "var(--text-3)", fontSize: 13 }}>
          No facts found for this commit.
        </div>
      )}

      {!loading && groups.length > 0 && (
        <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fill, minmax(460px, 1fr))", gap: 14 }}>
          {groups.map((g) => (
            <div key={g.subject} className="eg-panel" style={{ padding: "16px 18px" }}>
              <div style={{ display: "flex", alignItems: "center", gap: 9, marginBottom: 12 }}>
                <span style={{ width: 7, height: 7, borderRadius: 2, background: "var(--accent)" }} />
                <span style={{ fontSize: 14.5, fontWeight: 650, color: "var(--text)" }}>{g.subject}</span>
                <span className="mono" style={{ fontSize: 11, color: "var(--text-4)", marginLeft: "auto" }}>
                  {g.facts.length}
                </span>
              </div>
              <div style={{ display: "flex", flexDirection: "column", gap: 4 }}>
                {g.facts.map((f) => (
                  <div key={f.id} style={{ display: "flex", alignItems: "center", gap: 10, padding: "6px 0", borderTop: "1px solid var(--hairline)" }}>
                    <span style={{ fontSize: 12.5, color: "var(--text-3)", fontStyle: "italic", minWidth: 92, flexShrink: 0 }}>
                      {f.predicate}
                    </span>
                    <span style={{ fontSize: 13, color: "var(--text)", flex: 1 }}>{f.object}</span>
                    {f.source && (
                      <span className="mono" style={{
                        fontSize: 10.5, color: "var(--text-4)", background: "rgba(255,255,255,0.04)",
                        border: "1px solid var(--hairline)", padding: "1px 6px", borderRadius: 4, flexShrink: 0,
                      }}>
                        {f.source}
                      </span>
                    )}
                  </div>
                ))}
              </div>
            </div>
          ))}
        </div>
      )}
    </PageShell>
  );
}

export default function FactsPage() {
  return (
    <Suspense fallback={<div style={{ padding: 48, color: "var(--text-3)", fontSize: 13 }}>Loading…</div>}>
      <FactsContent />
    </Suspense>
  );
}
