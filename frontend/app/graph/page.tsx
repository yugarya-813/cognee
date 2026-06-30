"use client";

import { useEffect, useMemo, useRef, useState } from "react";

const API = "http://localhost:8000";

interface Commit {
  id: number;
  message: string;
  created_at: string;
}
interface GNode {
  id: string;
  label: string;
  kind: "entity" | "value";
  changed: boolean;
}
interface GEdge {
  source: string;
  target: string;
  label: string;
  changed: boolean;
}
interface GraphData {
  commit: number;
  nodes: GNode[];
  edges: GEdge[];
}

// A node with simulation state (position + velocity).
interface SimNode extends GNode {
  x: number;
  y: number;
  vx: number;
  vy: number;
}

const WIDTH = 760;
const HEIGHT = 480;

export default function GraphPage() {
  const [commits, setCommits] = useState<Commit[]>([]);
  const [selectedCommit, setSelectedCommit] = useState<number | null>(null);
  const [graph, setGraph] = useState<GraphData | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetch(`${API}/commits`)
      .then((r) => r.json())
      .then((data: Commit[]) => {
        setCommits(data);
        if (data.length > 0) setSelectedCommit(data[data.length - 1].id);
      })
      .catch(() => setLoading(false));
  }, []);

  useEffect(() => {
    if (selectedCommit === null) return;
    setLoading(true);
    fetch(`${API}/graph?commit=${selectedCommit}`)
      .then((r) => r.json())
      .then((data: GraphData) => {
        setGraph(data);
        setLoading(false);
      })
      .catch(() => setLoading(false));
  }, [selectedCommit]);

  return (
    <div style={{ padding: "40px 48px" }}>
      <div style={{ marginBottom: 24 }}>
        <div style={{ display: "flex", alignItems: "baseline", gap: 12, marginBottom: 6 }}>
          <h1 style={{ fontSize: 20, fontWeight: 600, color: "#fff", letterSpacing: "-0.02em", margin: 0 }}>
            Graph
          </h1>
          {graph && (
            <span style={{
              fontSize: 12, color: "rgba(255,255,255,0.3)", background: "rgba(255,255,255,0.06)",
              border: "1px solid rgba(255,255,255,0.08)", borderRadius: 20, padding: "1px 8px",
            }}>
              {graph.nodes.length} nodes · {graph.edges.length} relationships
            </span>
          )}
        </div>
        <p style={{ fontSize: 13, color: "rgba(255,255,255,0.35)", margin: "0 0 16px" }}>
          The memory as a network of nodes and relationships — entities, their values, and the
          facts that connect them.
        </p>

        {commits.length > 0 && selectedCommit !== null && (
          <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
            <span style={{ fontSize: 12, color: "rgba(255,255,255,0.28)", marginRight: 2 }}>Snapshot</span>
            {commits.map((c) => (
              <CommitPill
                key={c.id}
                label={`#${c.id} · ${c.message}`}
                active={c.id === selectedCommit}
                onClick={() => setSelectedCommit(c.id)}
              />
            ))}
          </div>
        )}
      </div>

      <div style={{
        background: "#10131D", border: "1px solid rgba(255,255,255,0.07)", borderRadius: 12,
        overflow: "hidden", position: "relative",
      }}>
        {loading && (
          <div style={{ height: HEIGHT, display: "flex", alignItems: "center", justifyContent: "center", color: "rgba(255,255,255,0.2)", fontSize: 13 }}>
            Loading graph…
          </div>
        )}
        {!loading && graph && <ForceGraph data={graph} />}
        {!loading && graph && (
          <div style={{
            position: "absolute", bottom: 14, left: 16, display: "flex", gap: 16,
            fontSize: 11, color: "rgba(255,255,255,0.4)",
          }}>
            <Legend color="#3B82F6" label="Entity" />
            <Legend color="#6366F1" label="Value" ring />
            <Legend color="#F59E0B" label="Changed at this commit" />
          </div>
        )}
      </div>

      <CogneePanel commit={selectedCommit} />
    </div>
  );
}

// ---------------------------------------------------------------------------
// Force-directed graph (no dependencies — a small spring/repulsion sim)
// ---------------------------------------------------------------------------

function ForceGraph({ data }: { data: GraphData }) {
  const [nodes, setNodes] = useState<SimNode[]>([]);
  const [hover, setHover] = useState<string | null>(null);
  const dragRef = useRef<{ id: string; ox: number; oy: number } | null>(null);
  const posRef = useRef<Map<string, SimNode>>(new Map());

  // (re)seed positions whenever the graph changes
  useEffect(() => {
    const seeded: SimNode[] = data.nodes.map((n, i) => {
      const angle = (i / Math.max(1, data.nodes.length)) * Math.PI * 2;
      const r = n.kind === "entity" ? 90 : 170;
      return {
        ...n,
        x: WIDTH / 2 + Math.cos(angle) * r,
        y: HEIGHT / 2 + Math.sin(angle) * r,
        vx: 0,
        vy: 0,
      };
    });
    posRef.current = new Map(seeded.map((n) => [n.id, n]));
    setNodes(seeded);
  }, [data]);

  // run the simulation
  useEffect(() => {
    if (nodes.length === 0) return;
    let frame = 0;
    let raf = 0;

    const tick = () => {
      const map = posRef.current;
      const arr = Array.from(map.values());

      // repulsion between every pair
      for (let i = 0; i < arr.length; i++) {
        for (let j = i + 1; j < arr.length; j++) {
          const a = arr[i], b = arr[j];
          let dx = a.x - b.x, dy = a.y - b.y;
          let dist2 = dx * dx + dy * dy || 0.01;
          const dist = Math.sqrt(dist2);
          const force = 5200 / dist2;
          const fx = (dx / dist) * force, fy = (dy / dist) * force;
          a.vx += fx; a.vy += fy; b.vx -= fx; b.vy -= fy;
        }
      }
      // spring along edges
      for (const e of data.edges) {
        const a = map.get(e.source), b = map.get(e.target);
        if (!a || !b) continue;
        const dx = b.x - a.x, dy = b.y - a.y;
        const dist = Math.sqrt(dx * dx + dy * dy) || 0.01;
        const force = (dist - 120) * 0.015;
        const fx = (dx / dist) * force, fy = (dy / dist) * force;
        a.vx += fx; a.vy += fy; b.vx -= fx; b.vy -= fy;
      }
      // centering + integrate
      for (const n of arr) {
        n.vx += (WIDTH / 2 - n.x) * 0.002;
        n.vy += (HEIGHT / 2 - n.y) * 0.002;
        const dragged = dragRef.current?.id === n.id;
        if (!dragged) {
          n.vx *= 0.86; n.vy *= 0.86;
          n.x += n.vx; n.y += n.vy;
          n.x = Math.max(30, Math.min(WIDTH - 30, n.x));
          n.y = Math.max(30, Math.min(HEIGHT - 30, n.y));
        }
      }
      setNodes(arr.map((n) => ({ ...n })));
      frame++;
      if (frame < 320) raf = requestAnimationFrame(tick);
    };
    raf = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(raf);
  }, [data, nodes.length]);

  const byId = useMemo(() => new Map(nodes.map((n) => [n.id, n])), [nodes]);

  function onPointerDown(id: string, e: React.PointerEvent) {
    const svg = (e.target as SVGElement).ownerSVGElement!;
    const pt = svgPoint(svg, e.clientX, e.clientY);
    const n = posRef.current.get(id)!;
    dragRef.current = { id, ox: n.x - pt.x, oy: n.y - pt.y };
    (e.target as Element).setPointerCapture(e.pointerId);
  }
  function onPointerMove(e: React.PointerEvent) {
    const d = dragRef.current;
    if (!d) return;
    const svg = (e.currentTarget as SVGSVGElement);
    const pt = svgPoint(svg, e.clientX, e.clientY);
    const n = posRef.current.get(d.id);
    if (!n) return;
    n.x = pt.x + d.ox; n.y = pt.y + d.oy; n.vx = 0; n.vy = 0;
    setNodes(Array.from(posRef.current.values()).map((m) => ({ ...m })));
  }
  function onPointerUp() { dragRef.current = null; }

  return (
    <svg
      width="100%" viewBox={`0 0 ${WIDTH} ${HEIGHT}`} style={{ display: "block", height: HEIGHT }}
      onPointerMove={onPointerMove} onPointerUp={onPointerUp} onPointerLeave={onPointerUp}
    >
      <defs>
        <marker id="arrow" viewBox="0 0 8 8" refX="7" refY="4" markerWidth="6" markerHeight="6" orient="auto-start-reverse">
          <path d="M0 0 L8 4 L0 8 z" fill="rgba(255,255,255,0.22)" />
        </marker>
      </defs>

      {/* edges */}
      {data.edges.map((e, i) => {
        const a = byId.get(e.source), b = byId.get(e.target);
        if (!a || !b) return null;
        const active = hover === e.source || hover === e.target;
        const mx = (a.x + b.x) / 2, my = (a.y + b.y) / 2;
        return (
          <g key={i} opacity={hover && !active ? 0.2 : 1}>
            <line
              x1={a.x} y1={a.y} x2={b.x} y2={b.y}
              stroke={e.changed ? "rgba(245,158,11,0.55)" : "rgba(255,255,255,0.14)"}
              strokeWidth={active ? 1.8 : 1.2} markerEnd="url(#arrow)"
            />
            {active && (
              <text x={mx} y={my - 4} textAnchor="middle" fontSize="10" fill="rgba(255,255,255,0.55)" fontStyle="italic">
                {e.label}
              </text>
            )}
          </g>
        );
      })}

      {/* nodes */}
      {nodes.map((n) => {
        const isEntity = n.kind === "entity";
        const fill = n.changed ? "#F59E0B" : isEntity ? "#3B82F6" : "#1B2030";
        const stroke = n.changed ? "#F59E0B" : isEntity ? "#3B82F6" : "#6366F1";
        const r = isEntity ? 9 : 6;
        return (
          <g
            key={n.id}
            transform={`translate(${n.x},${n.y})`}
            style={{ cursor: "grab" }}
            onPointerDown={(e) => onPointerDown(n.id, e)}
            onMouseEnter={() => setHover(n.id)}
            onMouseLeave={() => setHover(null)}
          >
            <circle r={r} fill={fill} stroke={stroke} strokeWidth={1.5} fillOpacity={isEntity || n.changed ? 1 : 0.9} />
            <text
              x={r + 5} y={4} fontSize="11"
              fill={hover === n.id ? "#fff" : "rgba(255,255,255,0.62)"}
              fontWeight={isEntity ? 600 : 400}
              style={{ pointerEvents: "none" }}
            >
              {n.label.length > 34 ? n.label.slice(0, 32) + "…" : n.label}
            </text>
          </g>
        );
      })}
    </svg>
  );
}

function svgPoint(svg: SVGSVGElement, clientX: number, clientY: number) {
  const pt = svg.createSVGPoint();
  pt.x = clientX; pt.y = clientY;
  return pt.matrixTransform(svg.getScreenCTM()!.inverse());
}

// ---------------------------------------------------------------------------
// Cognee panel — build the vector/graph memory and ask it semantically
// ---------------------------------------------------------------------------

function CogneePanel({ commit }: { commit: number | null }) {
  const [building, setBuilding] = useState(false);
  const [status, setStatus] = useState<string | null>(null);
  const [statusKind, setStatusKind] = useState<"ok" | "err" | null>(null);
  const [question, setQuestion] = useState("");
  const [answer, setAnswer] = useState<string | null>(null);
  const [engine, setEngine] = useState<string | null>(null);
  const [asking, setAsking] = useState(false);

  async function build() {
    if (commit === null) return;
    setBuilding(true); setStatus(null); setStatusKind(null);
    try {
      const res = await fetch(`${API}/cognee/build`, {
        method: "POST", headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ commit }),
      });
      const data = await res.json();
      if (res.ok) {
        setStatus(`${data.message} (${data.nodes} nodes, ${data.edges} edges)`);
        setStatusKind("ok");
      } else {
        setStatus(data.detail || "Build failed."); setStatusKind("err");
      }
    } catch {
      setStatus("Could not reach the backend on port 8000."); setStatusKind("err");
    }
    setBuilding(false);
  }

  async function ask(e: React.FormEvent) {
    e.preventDefault();
    if (!question.trim() || commit === null) return;
    setAsking(true); setAnswer(null); setEngine(null);
    try {
      const res = await fetch(`${API}/cognee/ask`, {
        method: "POST", headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ question: question.trim(), commit }),
      });
      const data = await res.json();
      if (res.ok) { setAnswer((data.answers || []).join("\n")); setEngine(data.engine); }
      else { setAnswer(data.detail || "Failed."); setEngine("error"); }
    } catch {
      setAnswer("Could not reach the backend on port 8000."); setEngine("error");
    }
    setAsking(false);
  }

  return (
    <div style={{
      marginTop: 20, background: "#10131D", border: "1px solid rgba(255,255,255,0.07)",
      borderRadius: 12, padding: "20px 24px", maxWidth: 760,
    }}>
      <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 6 }}>
        <div style={{ width: 6, height: 6, borderRadius: "50%", background: "#6366F1" }} />
        <span style={{ fontSize: 11, fontWeight: 500, color: "rgba(255,255,255,0.32)", letterSpacing: "0.08em", textTransform: "uppercase" }}>
          Cognee · vector + graph memory
        </span>
      </div>
      <p style={{ fontSize: 13, color: "rgba(255,255,255,0.4)", margin: "0 0 16px", lineHeight: 1.6 }}>
        Build a Cognee knowledge graph from the facts at this snapshot, then ask it questions —
        it reasons over the graph instead of plain text.
      </p>

      <div style={{ display: "flex", alignItems: "center", gap: 12, marginBottom: 14 }}>
        <button
          onClick={build}
          disabled={building || commit === null}
          style={{
            padding: "9px 16px", background: building ? "rgba(99,102,241,0.25)" : "#6366F1",
            border: "none", borderRadius: 9, fontSize: 13, fontWeight: 500,
            color: building ? "rgba(255,255,255,0.5)" : "#fff",
            cursor: building ? "wait" : "pointer", fontFamily: "inherit",
          }}
        >
          {building ? "Building memory…" : "Build memory with Cognee"}
        </button>
        {status && (
          <span style={{ fontSize: 12.5, color: statusKind === "ok" ? "#34D399" : "#f87171", lineHeight: 1.4 }}>
            {status}
          </span>
        )}
      </div>

      <form onSubmit={ask} style={{ display: "flex", gap: 10 }}>
        <input
          type="text" value={question} onChange={(e) => setQuestion(e.target.value)}
          placeholder="Ask the graph — e.g. Who owns the payroll rule?"
          style={{
            flex: 1, background: "#0A0B12", border: "1px solid rgba(255,255,255,0.09)",
            borderRadius: 9, padding: "10px 14px", fontSize: 13.5, color: "#fff",
            outline: "none", fontFamily: "inherit",
          }}
        />
        <button
          type="submit" disabled={asking || !question.trim()}
          style={{
            padding: "10px 18px",
            background: asking || !question.trim() ? "rgba(99,102,241,0.25)" : "#6366F1",
            border: "none", borderRadius: 9, fontSize: 13.5, fontWeight: 500,
            color: asking || !question.trim() ? "rgba(255,255,255,0.4)" : "#fff",
            cursor: asking || !question.trim() ? "not-allowed" : "pointer", fontFamily: "inherit",
          }}
        >
          {asking ? "Thinking…" : "Ask graph"}
        </button>
      </form>

      {answer !== null && (
        <div style={{
          marginTop: 14, padding: "14px 16px", background: "#0A0B12",
          border: "1px solid rgba(255,255,255,0.07)", borderRadius: 10,
        }}>
          {engine && engine !== "error" && (
            <div style={{ fontSize: 10.5, color: "rgba(255,255,255,0.3)", textTransform: "uppercase", letterSpacing: "0.08em", marginBottom: 8 }}>
              via {engine === "cognee" ? "Cognee graph" : "LLM fallback"}
            </div>
          )}
          <p style={{ fontSize: 14, color: engine === "error" ? "#f87171" : "rgba(255,255,255,0.85)", lineHeight: 1.65, margin: 0, whiteSpace: "pre-wrap" }}>
            {answer}
          </p>
        </div>
      )}
    </div>
  );
}

function Legend({ color, label, ring }: { color: string; label: string; ring?: boolean }) {
  return (
    <span style={{ display: "flex", alignItems: "center", gap: 6 }}>
      <span style={{
        width: 9, height: 9, borderRadius: "50%",
        background: ring ? "transparent" : color, border: `1.5px solid ${color}`,
      }} />
      {label}
    </span>
  );
}

function CommitPill({ label, active, onClick }: { label: string; active: boolean; onClick: () => void }) {
  const [hovered, setHovered] = useState(false);
  return (
    <button
      onClick={onClick}
      onMouseEnter={() => setHovered(true)}
      onMouseLeave={() => setHovered(false)}
      style={{
        padding: "4px 11px", borderRadius: 6, fontSize: 12, fontWeight: active ? 500 : 400,
        border: `1px solid ${active ? "rgba(59,130,246,0.55)" : hovered ? "rgba(255,255,255,0.15)" : "rgba(255,255,255,0.09)"}`,
        background: active ? "rgba(59,130,246,0.12)" : hovered ? "rgba(255,255,255,0.04)" : "transparent",
        color: active ? "#3B82F6" : hovered ? "rgba(255,255,255,0.65)" : "rgba(255,255,255,0.4)",
        cursor: "pointer", transition: "all 150ms", fontFamily: "inherit",
      }}
    >
      {label}
    </button>
  );
}
