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
interface SimNode extends GNode {
  x: number;
  y: number;
  vx: number;
  vy: number;
  deg: number;
}

const WIDTH = 900;
const HEIGHT = 540;

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
      <div style={{ marginBottom: 22 }}>
        <div style={{ display: "flex", alignItems: "baseline", gap: 12, marginBottom: 6 }}>
          <h1 style={{ fontSize: 20, fontWeight: 600, color: "#fff", letterSpacing: "-0.02em", margin: 0 }}>
            Knowledge Graph
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
          The memory as a living network — entities, their values, and the facts that connect them.
          Drag a node to give it a nudge.
        </p>

        {commits.length > 0 && selectedCommit !== null && (
          <div style={{ display: "flex", alignItems: "center", gap: 8, flexWrap: "wrap" }}>
            <span style={{ fontSize: 12, color: "rgba(255,255,255,0.28)", marginRight: 2 }}>Snapshot</span>
            {commits.map((c) => (
              <CommitPill
                key={c.id}
                label={`#${c.id}`}
                title={c.message}
                active={c.id === selectedCommit}
                onClick={() => setSelectedCommit(c.id)}
              />
            ))}
          </div>
        )}
      </div>

      <div style={{
        background: "radial-gradient(circle at 50% 35%, #131826 0%, #0D101A 70%)",
        border: "1px solid rgba(255,255,255,0.07)", borderRadius: 12,
        overflow: "hidden", position: "relative",
      }}>
        {loading && (
          <div style={{ height: HEIGHT, display: "flex", alignItems: "center", justifyContent: "center", color: "rgba(255,255,255,0.2)", fontSize: 13 }}>
            Loading graph…
          </div>
        )}
        {!loading && graph && <ForceGraph data={graph} key={graph.commit} />}
        {!loading && graph && (
          <div style={{
            position: "absolute", bottom: 14, left: 16, display: "flex", gap: 16,
            fontSize: 11, color: "rgba(255,255,255,0.4)",
          }}>
            <Legend color="#3B82F6" label="Entity" />
            <Legend color="#6366F1" label="Value" ring />
            <Legend color="#F59E0B" label="Changed here" />
          </div>
        )}
      </div>

      <AskPanel commit={selectedCommit} />
    </div>
  );
}

// ---------------------------------------------------------------------------
// Force-directed graph — runs continuously and stays gently alive
// ---------------------------------------------------------------------------

function ForceGraph({ data }: { data: GraphData }) {
  const [, setTick] = useState(0); // force re-render each frame
  const [hover, setHover] = useState<string | null>(null);
  const nodesRef = useRef<SimNode[]>([]);
  const mapRef = useRef<Map<string, SimNode>>(new Map());
  const energyRef = useRef(1); // 1 = lively, decays toward a floor so it never fully freezes
  const dragRef = useRef<{ id: string } | null>(null);

  // seed positions + degree once per dataset
  useEffect(() => {
    const deg = new Map<string, number>();
    for (const e of data.edges) {
      deg.set(e.source, (deg.get(e.source) || 0) + 1);
      deg.set(e.target, (deg.get(e.target) || 0) + 1);
    }
    const seeded: SimNode[] = data.nodes.map((n, i) => {
      const angle = (i / Math.max(1, data.nodes.length)) * Math.PI * 2;
      const r = (n.kind === "entity" ? 110 : 210) + (i % 5) * 14;
      return {
        ...n,
        x: WIDTH / 2 + Math.cos(angle) * r,
        y: HEIGHT / 2 + Math.sin(angle) * r,
        vx: 0, vy: 0,
        deg: deg.get(n.id) || 0,
      };
    });
    nodesRef.current = seeded;
    mapRef.current = new Map(seeded.map((n) => [n.id, n]));
    energyRef.current = 1;
  }, [data]);

  // continuous simulation loop
  useEffect(() => {
    let raf = 0;
    const tick = () => {
      const arr = nodesRef.current;
      const map = mapRef.current;
      const E = energyRef.current;

      for (let i = 0; i < arr.length; i++) {
        for (let j = i + 1; j < arr.length; j++) {
          const a = arr[i], b = arr[j];
          let dx = a.x - b.x, dy = a.y - b.y;
          let dist2 = dx * dx + dy * dy || 0.01;
          const dist = Math.sqrt(dist2);
          const force = 6000 / dist2;
          const fx = (dx / dist) * force, fy = (dy / dist) * force;
          a.vx += fx; a.vy += fy; b.vx -= fx; b.vy -= fy;
        }
      }
      for (const e of data.edges) {
        const a = map.get(e.source), b = map.get(e.target);
        if (!a || !b) continue;
        const dx = b.x - a.x, dy = b.y - a.y;
        const dist = Math.sqrt(dx * dx + dy * dy) || 0.01;
        const rest = 130;
        const force = (dist - rest) * 0.02;
        const fx = (dx / dist) * force, fy = (dy / dist) * force;
        a.vx += fx; a.vy += fy; b.vx -= fx; b.vy -= fy;
      }
      for (const n of arr) {
        // gravity toward center + a hair of perpetual jitter so it breathes
        n.vx += (WIDTH / 2 - n.x) * 0.0015 + (Math.random() - 0.5) * 0.18 * E;
        n.vy += (HEIGHT / 2 - n.y) * 0.0015 + (Math.random() - 0.5) * 0.18 * E;
        if (dragRef.current?.id === n.id) continue;
        n.vx *= 0.9; n.vy *= 0.9;
        n.x += n.vx; n.y += n.vy;
        n.x = Math.max(34, Math.min(WIDTH - 34, n.x));
        n.y = Math.max(30, Math.min(HEIGHT - 30, n.y));
      }
      // energy decays to a small floor (keeps a subtle life), never to zero
      energyRef.current = Math.max(0.18, E * 0.992);
      setTick((t) => (t + 1) % 1000000);
      raf = requestAnimationFrame(tick);
    };
    raf = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(raf);
  }, [data]);

  const nodes = nodesRef.current;
  const byId = useMemo(() => mapRef.current, [nodes.length]);

  function reheat() { energyRef.current = 1; }

  function onPointerDown(id: string, e: React.PointerEvent) {
    dragRef.current = { id };
    reheat();
    (e.target as Element).setPointerCapture(e.pointerId);
  }
  function onPointerMove(e: React.PointerEvent) {
    const d = dragRef.current;
    if (!d) return;
    const svg = e.currentTarget as SVGSVGElement;
    const pt = svgPoint(svg, e.clientX, e.clientY);
    const n = mapRef.current.get(d.id);
    if (!n) return;
    n.x = pt.x; n.y = pt.y; n.vx = 0; n.vy = 0;
  }
  function onPointerUp() { dragRef.current = null; }

  // show value labels only when relevant (hover/changed) so dense graphs stay readable
  const neighbors = useMemo(() => {
    const m = new Map<string, Set<string>>();
    for (const e of data.edges) {
      (m.get(e.source) ?? m.set(e.source, new Set()).get(e.source)!).add(e.target);
      (m.get(e.target) ?? m.set(e.target, new Set()).get(e.target)!).add(e.source);
    }
    return m;
  }, [data]);

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

      {data.edges.map((e, i) => {
        const a = byId.get(e.source), b = byId.get(e.target);
        if (!a || !b) return null;
        const active = hover === e.source || hover === e.target;
        const mx = (a.x + b.x) / 2, my = (a.y + b.y) / 2;
        return (
          <g key={i} opacity={hover && !active ? 0.12 : 1}>
            <line
              x1={a.x} y1={a.y} x2={b.x} y2={b.y}
              stroke={e.changed ? "rgba(245,158,11,0.6)" : "rgba(255,255,255,0.13)"}
              strokeWidth={active ? 1.9 : 1.1} markerEnd="url(#arrow)"
            />
            {active && (
              <text x={mx} y={my - 4} textAnchor="middle" fontSize="10.5" fill="rgba(255,255,255,0.6)" fontStyle="italic" style={{ pointerEvents: "none" }}>
                {e.label}
              </text>
            )}
          </g>
        );
      })}

      {nodes.map((n) => {
        const isEntity = n.kind === "entity";
        const fill = n.changed ? "#F59E0B" : isEntity ? "#3B82F6" : "#1B2030";
        const stroke = n.changed ? "#F59E0B" : isEntity ? "#3B82F6" : "#6366F1";
        const r = (isEntity ? 8 : 5) + Math.min(5, n.deg);
        const dim = hover && hover !== n.id && !neighbors.get(hover)?.has(n.id);
        const showLabel = isEntity || n.changed || hover === n.id;
        return (
          <g
            key={n.id}
            transform={`translate(${n.x},${n.y})`}
            style={{ cursor: "grab" }}
            opacity={dim ? 0.25 : 1}
            onPointerDown={(e) => onPointerDown(n.id, e)}
            onMouseEnter={() => setHover(n.id)}
            onMouseLeave={() => setHover(null)}
          >
            <circle r={r} fill={fill} stroke={stroke} strokeWidth={1.5} fillOpacity={isEntity || n.changed ? 1 : 0.9} />
            {showLabel && (
              <text
                x={r + 5} y={4} fontSize={isEntity ? 12 : 11}
                fill={hover === n.id ? "#fff" : isEntity ? "rgba(255,255,255,0.78)" : "rgba(255,255,255,0.5)"}
                fontWeight={isEntity ? 600 : 400}
                style={{ pointerEvents: "none" }}
              >
                {n.label.length > 32 ? n.label.slice(0, 30) + "…" : n.label}
              </text>
            )}
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
// Ask panel — fast by default; Cognee graph reasoning is an explicit opt-in
// ---------------------------------------------------------------------------

function AskPanel({ commit }: { commit: number | null }) {
  const [question, setQuestion] = useState("");
  const [answer, setAnswer] = useState<string | null>(null);
  const [engine, setEngine] = useState<string | null>(null);
  const [asking, setAsking] = useState(false);
  const [useCognee, setUseCognee] = useState(false);

  // Cognee build state
  const [building, setBuilding] = useState(false);
  const [buildMsg, setBuildMsg] = useState<string | null>(null);
  const [buildOk, setBuildOk] = useState(false);

  async function ask(e: React.FormEvent) {
    e.preventDefault();
    if (!question.trim() || commit === null) return;
    setAsking(true); setAnswer(null); setEngine(null);
    const endpoint = useCognee ? "/cognee/ask" : "/ask";
    try {
      const res = await fetch(`${API}${endpoint}`, {
        method: "POST", headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ question: question.trim(), commit }),
      });
      const data = await res.json();
      if (res.ok) { setAnswer((data.answers || []).join("\n")); setEngine(data.engine || "llm"); }
      else { setAnswer(data.detail || "Failed."); setEngine("error"); }
    } catch {
      setAnswer("Could not reach the backend on port 8000."); setEngine("error");
    }
    setAsking(false);
  }

  async function build() {
    if (commit === null) return;
    setBuilding(true); setBuildMsg(null); setBuildOk(false);
    try {
      const res = await fetch(`${API}/cognee/build`, {
        method: "POST", headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ commit }),
      });
      const data = await res.json();
      if (res.ok) { setBuildMsg(`${data.message} (${data.nodes} nodes, ${data.edges} edges)`); setBuildOk(true); setUseCognee(true); }
      else { setBuildMsg(data.detail || "Build failed."); setBuildOk(false); }
    } catch {
      setBuildMsg("Could not reach the backend."); setBuildOk(false);
    }
    setBuilding(false);
  }

  return (
    <div style={{
      marginTop: 18, background: "#10131D", border: "1px solid rgba(255,255,255,0.07)",
      borderRadius: 12, padding: "18px 22px", maxWidth: 900,
    }}>
      <form onSubmit={ask} style={{ display: "flex", gap: 10 }}>
        <input
          type="text" value={question} onChange={(e) => setQuestion(e.target.value)}
          placeholder="Ask this snapshot — e.g. Who manages payroll, and what does the bonus rule require?"
          style={{
            flex: 1, background: "#0A0B12", border: "1px solid rgba(255,255,255,0.09)",
            borderRadius: 9, padding: "11px 14px", fontSize: 13.5, color: "#fff",
            outline: "none", fontFamily: "inherit",
          }}
        />
        <button
          type="submit" disabled={asking || !question.trim()}
          style={{
            padding: "11px 20px",
            background: asking || !question.trim() ? "rgba(59,130,246,0.25)" : "#3B82F6",
            border: "none", borderRadius: 9, fontSize: 13.5, fontWeight: 500,
            color: asking || !question.trim() ? "rgba(255,255,255,0.4)" : "#fff",
            cursor: asking || !question.trim() ? "not-allowed" : "pointer", fontFamily: "inherit", flexShrink: 0,
          }}
        >
          {asking ? "Thinking…" : "Ask"}
        </button>
      </form>

      {/* engine controls */}
      <div style={{ display: "flex", alignItems: "center", gap: 14, marginTop: 12, flexWrap: "wrap" }}>
        <label style={{ display: "flex", alignItems: "center", gap: 7, fontSize: 12.5, color: "rgba(255,255,255,0.5)", cursor: "pointer" }}>
          <input type="checkbox" checked={useCognee} onChange={(e) => setUseCognee(e.target.checked)} style={{ accentColor: "#6366F1" }} />
          Use Cognee graph reasoning
          <span style={{ fontSize: 11, color: "rgba(255,255,255,0.28)" }}>(needs a build first)</span>
        </label>
        <button
          onClick={build} disabled={building || commit === null}
          style={{
            padding: "5px 12px", background: "transparent",
            border: "1px solid rgba(99,102,241,0.45)", borderRadius: 7, fontSize: 12,
            color: building ? "rgba(255,255,255,0.4)" : "#a5b4fc",
            cursor: building ? "wait" : "pointer", fontFamily: "inherit",
          }}
        >
          {building ? "Building graph… (~30s)" : "⚡ Build Cognee graph"}
        </button>
        {buildMsg && (
          <span style={{ fontSize: 12, color: buildOk ? "#34D399" : "#f87171" }}>{buildMsg}</span>
        )}
      </div>

      {answer !== null && (
        <div style={{
          marginTop: 14, padding: "14px 16px", background: "#0A0B12",
          border: "1px solid rgba(255,255,255,0.07)", borderRadius: 10,
        }}>
          {engine && engine !== "error" && (
            <div style={{ fontSize: 10.5, color: "rgba(255,255,255,0.3)", textTransform: "uppercase", letterSpacing: "0.08em", marginBottom: 8 }}>
              via {engine === "cognee" ? "Cognee graph" : engine === "llm-fallback" ? "LLM (Cognee unavailable)" : "fast LLM"}
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

function CommitPill({ label, title, active, onClick }: { label: string; title?: string; active: boolean; onClick: () => void }) {
  const [hovered, setHovered] = useState(false);
  return (
    <button
      onClick={onClick} title={title}
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
