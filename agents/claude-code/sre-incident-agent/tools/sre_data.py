"""Data access for the SRE incident tools.

Pure stdlib, no MCP dependency, so the logic is unit-testable on its own and the
MCP server (``sre_tools.py``) stays a thin wrapper. Each function returns a
plain string — the same shape the agent sees as a tool result.

These read the same fixtures the incident dashboard shows: metrics.json,
deploys.json, diff.txt (under ../data/). They intentionally do NOT read app.log
— that is large and lives in the workspace for the agent to grep directly.
"""
from __future__ import annotations

import json
from pathlib import Path

DATA_DIR = Path(__file__).resolve().parent.parent / "data"


def _load(name: str):
    return json.loads((DATA_DIR / name).read_text(encoding="utf-8"))


def get_metrics(service: str, metric: str) -> str:
    """Return the timeseries for one service+metric over the incident window."""
    data = _load("metrics.json")
    series = data.get("series", {})
    svc = series.get(service)
    if svc is None:
        available = ", ".join(sorted(series)) or "(none)"
        return f"Unknown service {service!r}. Available services: {available}."
    points = svc.get(metric)
    if points is None:
        available = ", ".join(sorted(svc)) or "(none)"
        return (
            f"Unknown metric {metric!r} for service {service!r}. "
            f"Available metrics: {available}."
        )
    window = data.get("window", {})
    header = (
        f"{service}.{metric} "
        f"[{window.get('start', '?')} .. {window.get('end', '?')} UTC]"
    )
    rows = "\n".join(f"  {p['t']}  {p['v']}" for p in points)
    return f"{header}\n{rows}"


def get_recent_deploys() -> str:
    """Return deploys in the last 6 hours, most recent first."""
    data = _load("deploys.json")
    deploys = sorted(
        data.get("deploys", []),
        key=lambda d: d.get("deployed_at", ""),
        reverse=True,
    )
    if not deploys:
        return "No deploys in the last 6 hours."
    lines = [f"Deploys since {data.get('now', '?')} minus {data.get('window_hours', 6)}h:"]
    for d in deploys:
        lines.append(
            f"  {d.get('deployed_at', '?')}  {d.get('commit', '?'):<8} "
            f"{d.get('service', '?'):<9} {d.get('status', '?'):<10} "
            f"{d.get('author', '?')}  {d.get('message', '')}"
        )
    return "\n".join(lines)


def get_diff(commit: str) -> str:
    """Return the unified diff for a commit SHA."""
    text = (DATA_DIR / "diff.txt").read_text(encoding="utf-8")
    wanted = commit.strip().lower()
    # The fixture holds a single commit; match its short SHA (prefix-friendly).
    first = text.splitlines()[0] if text else ""
    known = first.split()[1].lower() if first.lower().startswith("commit ") else ""
    if known and (wanted == known or known.startswith(wanted) or wanted.startswith(known)):
        return text
    return (
        f"No diff on file for commit {commit!r}. "
        f"Known commit in this incident snapshot: {known or '(none)'}."
    )
