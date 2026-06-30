#!/usr/bin/env bash
# Runs once before the agent's first turn. Install whatever your agent needs - here the
# `cowsay` package - and it persists with the workspace, available on every later turn.
set -e
pip install cowsay
