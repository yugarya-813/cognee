"""Cognee integration — the node/relationship (vector + graph) memory layer.

SQLite stays the system of record (versioned facts). Cognee is the system of
intelligence: we feed it the active facts at a commit, it builds a knowledge
graph (nodes + relationships) backed by a vector store, and we can then ask it
questions or read the graph back out.

Everything here is wrapped so the rest of the app keeps working even if Cognee
is slow, rate-limited, or unavailable — callers get a clear error string instead
of a crash. Cognee is imported lazily inside each function so importing this
module (and booting the API) stays fast.
"""
from __future__ import annotations

# Tracks whether a Cognee memory has been built in this process, and for which
# commit, so the UI can show status without re-running the (slow) cognify step.
_STATE: dict = {"built": False, "commit": None, "nodes": 0, "edges": 0}


def status() -> dict:
    return dict(_STATE)


async def build_memory(facts_text: str, commit_id: int) -> dict:
    """Reset Cognee, feed it the facts for this commit, and build the graph.

    Returns {"ok": bool, "message": str, "nodes": int, "edges": int}.
    """
    try:
        import cognee
        from cognee.modules.search.types import SearchType  # noqa: F401  (validates install)

        # Start from a clean slate so the graph reflects exactly this commit.
        await cognee.prune.prune_data()
        await cognee.prune.prune_system(metadata=True)

        await cognee.add(facts_text)
        await cognee.cognify()

        nodes, edges = await _read_graph()
        _STATE.update(built=True, commit=commit_id, nodes=len(nodes), edges=len(edges))
        return {
            "ok": True,
            "message": f"Cognee built a knowledge graph for commit {commit_id}.",
            "nodes": len(nodes),
            "edges": len(edges),
        }
    except Exception as e:  # noqa: BLE001 — surface any failure to the UI
        return {
            "ok": False,
            "message": _explain(e),
            "nodes": 0,
            "edges": 0,
        }


async def extract(text: str) -> tuple[list[str] | None, str | None]:
    """Run Cognee's extraction over a raw document.

    We add the document text and cognify it, letting Cognee pull out the
    entities and relationships. We then read those relationships back as simple
    "subject -predicate-> object" strings so the caller can reconcile them
    against our versioned facts. Returns (triples, error).
    """
    try:
        import cognee

        # Clean slate so the graph reflects only this document.
        await cognee.prune.prune_data()
        await cognee.prune.prune_system(metadata=True)

        await cognee.add(text)
        await cognee.cognify()

        nodes, edges = await _read_graph()
        label_by_id = {n["id"]: n["label"] for n in nodes}

        triples: list[str] = []
        for e in edges:
            subj = label_by_id.get(e["source"], e["source"])
            obj = label_by_id.get(e["target"], e["target"])
            rel = e.get("label") or "related to"
            if subj and obj:
                triples.append(f"{subj} -{rel}-> {obj}")

        _STATE.update(built=True, commit=None, nodes=len(nodes), edges=len(edges))
        return triples, None
    except Exception as e:  # noqa: BLE001
        return None, _explain(e)


async def graph() -> dict:
    """Return the graph Cognee currently holds: {nodes:[...], edges:[...]}."""
    try:
        nodes, edges = await _read_graph()
        return {"ok": True, "nodes": nodes, "edges": edges}
    except Exception as e:  # noqa: BLE001
        return {"ok": False, "message": _explain(e), "nodes": [], "edges": []}


async def ask(question: str) -> tuple[str | None, str | None]:
    """Ask Cognee using graph-aware retrieval. Returns (answer, error)."""
    try:
        import cognee
        from cognee.modules.search.types import SearchType

        results = await cognee.search(
            query_text=question,
            query_type=SearchType.GRAPH_COMPLETION,
        )
        answer = _flatten_search(results)
        if not answer:
            return None, "Cognee returned no answer. Build the memory first."
        return answer, None
    except Exception as e:  # noqa: BLE001
        return None, _explain(e)


# ---------------------------------------------------------------------------
# Internals
# ---------------------------------------------------------------------------

async def _read_graph() -> tuple[list[dict], list[dict]]:
    """Pull nodes + relationships out of Cognee's graph store, normalized to a
    simple JSON shape the frontend can render."""
    from cognee.infrastructure.databases.graph import get_graph_engine

    engine = await get_graph_engine()
    raw_nodes, raw_edges = await engine.get_graph_data()

    nodes: list[dict] = []
    for node in raw_nodes:
        node_id, props = _split_pair(node)
        label = ""
        if isinstance(props, dict):
            label = props.get("name") or props.get("text") or props.get("type") or ""
        nodes.append({"id": str(node_id), "label": str(label)[:60] or str(node_id)[:12]})

    edges: list[dict] = []
    for edge in raw_edges:
        src, dst, rel = _edge_parts(edge)
        edges.append({"source": str(src), "target": str(dst), "label": str(rel)})

    return nodes, edges


def _split_pair(node):
    if isinstance(node, (list, tuple)) and len(node) >= 2:
        return node[0], node[1]
    return node, {}


def _edge_parts(edge):
    if isinstance(edge, (list, tuple)):
        if len(edge) >= 3:
            label = edge[2]
            if isinstance(label, dict):
                label = label.get("relationship_name") or label.get("name") or "related"
            return edge[0], edge[1], label
        if len(edge) == 2:
            return edge[0], edge[1], "related"
    return "?", "?", "related"


def _flatten_search(results) -> str:
    """Pull the human-readable answer out of whatever shape cognee.search returns.

    Cognee 1.x wraps results as a list of dicts like
        {"dataset_name": ..., "search_result": ["the actual answer"]}
    so we unwrap `search_result` first, then fall back to other shapes.
    """
    return "\n".join(_collect(results)).strip()


def _collect(obj) -> list[str]:
    if obj is None:
        return []
    if isinstance(obj, str):
        return [obj]
    if isinstance(obj, dict):
        if "search_result" in obj:
            return _collect(obj["search_result"])
        for key in ("text", "answer", "content"):
            if key in obj and obj[key]:
                return _collect(obj[key])
        return [str(obj)]
    if isinstance(obj, (list, tuple)):
        out: list[str] = []
        for item in obj:
            out.extend(_collect(item))
        return out
    return [str(obj)]


def _explain(e: Exception) -> str:
    msg = str(e)
    name = type(e).__name__
    if any(x in msg for x in ("429", "quota", "RESOURCE_EXHAUSTED", "rate")):
        return ("Cognee hit the Gemini free-tier quota while building/searching. "
                "Wait a minute and try again.")
    return f"Cognee error ({name}): {msg[:300]}"
