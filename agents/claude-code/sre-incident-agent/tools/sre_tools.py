"""SRE incident tools, exposed to the agent as an MCP stdio server.

Karta's Claude Code harness natively loads the agent folder's `.mcp.json`
(setting_sources = project/local), so these three tools appear to the agent as
`mcp__sre-tools__get_metrics`, `mcp__sre-tools__get_recent_deploys`, and
`mcp__sre-tools__get_diff`. They query the same fixtures the incident dashboard
shows. Run standalone with `python3 tools/sre_tools.py` (speaks MCP over stdio).

This is a **zero-dependency** MCP server: it speaks the Model Context Protocol
stdio transport (newline-delimited JSON-RPC 2.0) using only the Python standard
library. No `mcp`/FastMCP package, no `pip install`, no network — so it runs
anywhere `python3` does: `karta dev` locally, a plain `git clone`, or in
production, with nothing to provision first.

The tool logic lives in `sre_data.py` (pure stdlib) so it stays unit-testable
without a running MCP client.
"""
from __future__ import annotations

import json
import sys
from pathlib import Path

# Allow `python3 tools/sre_tools.py` from the agent root to import the sibling.
sys.path.insert(0, str(Path(__file__).resolve().parent))

import sre_data  # noqa: E402

SERVER_NAME = "sre-tools"
SERVER_VERSION = "1.0.0"
# The stdio protocol version we implement. We echo the client's requested
# version back in `initialize` when present (the spec's compatibility path);
# this is only the fallback when the client sends none.
DEFAULT_PROTOCOL_VERSION = "2024-11-05"

# Tool declarations: name -> (handler, description, JSON-Schema for arguments).
TOOLS = {
    "get_metrics": (
        lambda a: sre_data.get_metrics(a["service"], a["metric"]),
        "Timeseries for a service and metric over the incident window. "
        'services: "checkout", "checkout-db", "cart", "payments"; '
        'metrics: "latency_p99_ms", "error_rate_pct", "connection_pool_in_use", '
        '"queries_per_min".',
        {
            "type": "object",
            "properties": {
                "service": {"type": "string", "description": "Service name."},
                "metric": {"type": "string", "description": "Metric name."},
            },
            "required": ["service", "metric"],
        },
    ),
    "get_recent_deploys": (
        lambda a: sre_data.get_recent_deploys(),
        "Deployments in the last 6 hours, most recent first.",
        {"type": "object", "properties": {}},
    ),
    "get_diff": (
        lambda a: sre_data.get_diff(a["commit"]),
        "Unified diff for a commit SHA (short or full, e.g. \"a3f9c21\").",
        {
            "type": "object",
            "properties": {
                "commit": {"type": "string", "description": "Commit SHA."},
            },
            "required": ["commit"],
        },
    ),
}


def _tools_list() -> list[dict]:
    return [
        {"name": name, "description": desc, "inputSchema": schema}
        for name, (_handler, desc, schema) in TOOLS.items()
    ]


def _call_tool(params: dict) -> dict:
    name = params.get("name")
    args = params.get("arguments") or {}
    entry = TOOLS.get(name)
    if entry is None:
        return {"content": [{"type": "text", "text": f"Unknown tool: {name!r}"}], "isError": True}
    handler = entry[0]
    try:
        text = handler(args)
    except KeyError as exc:  # a required argument was missing
        return {
            "content": [{"type": "text", "text": f"Missing required argument: {exc}"}],
            "isError": True,
        }
    except Exception as exc:  # never crash the server on a bad call
        return {"content": [{"type": "text", "text": f"Tool error: {exc}"}], "isError": True}
    return {"content": [{"type": "text", "text": text}], "isError": False}


def _handle(request: dict) -> dict | None:
    """Return a JSON-RPC response for a request, or None for a notification."""
    method = request.get("method")
    req_id = request.get("id")
    is_notification = "id" not in request

    if method == "initialize":
        params = request.get("params") or {}
        protocol = params.get("protocolVersion") or DEFAULT_PROTOCOL_VERSION
        result = {
            "protocolVersion": protocol,
            "capabilities": {"tools": {}},
            "serverInfo": {"name": SERVER_NAME, "version": SERVER_VERSION},
        }
    elif method == "tools/list":
        result = {"tools": _tools_list()}
    elif method == "tools/call":
        result = _call_tool(request.get("params") or {})
    elif method == "ping":
        result = {}
    elif is_notification:
        # notifications/initialized and any other notification: no reply.
        return None
    else:
        return {
            "jsonrpc": "2.0",
            "id": req_id,
            "error": {"code": -32601, "message": f"Method not found: {method}"},
        }

    if is_notification:
        return None
    return {"jsonrpc": "2.0", "id": req_id, "result": result}


def main() -> None:
    # One JSON-RPC message per line, over stdin/stdout (MCP stdio transport).
    out = sys.stdout
    for line in sys.stdin:
        line = line.strip()
        if not line:
            continue
        try:
            request = json.loads(line)
        except json.JSONDecodeError:
            continue
        response = _handle(request)
        if response is not None:
            out.write(json.dumps(response) + "\n")
            out.flush()


if __name__ == "__main__":
    main()
