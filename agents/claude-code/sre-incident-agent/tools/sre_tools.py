"""SRE incident tools, exposed to the agent as an MCP stdio server.

Karta's Claude Code harness natively loads the agent folder's `.mcp.json`
(setting_sources = project/local), so these three tools appear to the agent as
`mcp__sre-tools__get_metrics`, `mcp__sre-tools__get_recent_deploys`, and
`mcp__sre-tools__get_diff`. They query the same fixtures the incident dashboard
shows. Run standalone with `python3 tools/sre_tools.py` (speaks MCP over stdio).

FastMCP comes from the `mcp` package, installed by the agent's setup.sh (declared
as `[environment] setup` in karta.toml) before the first turn.

The tool logic lives in `sre_data.py` (pure stdlib) so it stays unit-testable
without a running MCP client.
"""
from __future__ import annotations

import sys
from pathlib import Path

# Allow `python3 tools/sre_tools.py` from the agent root to import the sibling.
sys.path.insert(0, str(Path(__file__).resolve().parent))

from mcp.server.fastmcp import FastMCP  # noqa: E402  (import after sys.path shim)

import sre_data  # noqa: E402

mcp = FastMCP("sre-tools")


@mcp.tool()
def get_metrics(service: str, metric: str) -> str:
    """Timeseries for a service and metric over the incident window.

    Args:
        service: e.g. "checkout", "checkout-db", "cart", "payments".
        metric: e.g. "latency_p99_ms", "error_rate_pct",
            "connection_pool_in_use".
    """
    return sre_data.get_metrics(service, metric)


@mcp.tool()
def get_recent_deploys() -> str:
    """Deployments in the last 6 hours, most recent first."""
    return sre_data.get_recent_deploys()


@mcp.tool()
def get_diff(commit: str) -> str:
    """Unified diff for a commit SHA.

    Args:
        commit: short or full commit SHA, e.g. "a3f9c21".
    """
    return sre_data.get_diff(commit)


if __name__ == "__main__":
    mcp.run()
