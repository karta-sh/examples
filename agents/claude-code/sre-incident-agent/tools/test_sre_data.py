"""Stdlib-only tests for the SRE tool logic (no MCP client needed).

Run: `python3 tools/test_sre_data.py` (or under pytest). These lock the fixtures
and the tools into one coherent incident story so the agent's evidence stays
trustworthy.
"""
import sys
from pathlib import Path

sys.path.insert(0, str(Path(__file__).resolve().parent))
import sre_data as d  # noqa: E402


def test_recent_deploys_lists_root_cause_commit_first():
    out = d.get_recent_deploys()
    assert "a3f9c21" in out
    # Most recent first: the checkout deploy heads the list.
    body = [ln for ln in out.splitlines() if ln.strip().startswith("2026-")]
    assert body[0].split()[1] == "a3f9c21"
    assert "14:31:18" in body[0]


def test_metrics_show_latency_spike_after_deploy():
    out = d.get_metrics("checkout", "latency_p99_ms")
    assert "checkout.latency_p99_ms" in out
    # Healthy before the deploy minute, ~3.6s after.
    assert "14:30  65" in out
    assert "14:37  3600" in out


def test_error_rate_climbs_to_about_20pct():
    out = d.get_metrics("checkout", "error_rate_pct")
    assert "14:37  20.8" in out


def test_get_diff_matches_prefix_and_full_sha():
    for sha in ("a3f9c21", "a3f", "A3F9C21"):
        out = d.get_diff(sha)
        assert out.splitlines()[0] == "commit a3f9c21 (checkout)"
        assert "per_row" in out or "per row" in out.lower()


def test_unknown_lookups_are_explicit_not_silent():
    assert "Unknown service" in d.get_metrics("nope", "x")
    assert "Unknown metric" in d.get_metrics("checkout", "nope")
    assert "No diff on file" in d.get_diff("deadbeef")


if __name__ == "__main__":
    fns = [v for k, v in sorted(globals().items()) if k.startswith("test_")]
    for fn in fns:
        fn()
        print(f"ok  {fn.__name__}")
    print(f"\n{len(fns)} passed")
