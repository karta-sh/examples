#!/usr/bin/env bash
# Runs once before the agent's first turn. Installs the MCP SDK the custom tools
# server (tools/sre_tools.py) imports; it persists with the workspace, so the
# tools are available on every later turn.
set -e
pip install "mcp>=1.2.0"
