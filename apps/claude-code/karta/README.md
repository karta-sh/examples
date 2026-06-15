# Karta - the karta.sh support agent

**Karta** is the agent that answers on the [karta.sh](https://karta.sh) home page.
It is a real production agent, authored here and dogfooded in public: its prompt
is committed, readable, and intended to be.

| | |
| --- | --- |
| **Role** | Karta's customer-support / front-door agent |
| **Lives on** | `karta.sh` home page (and `agent.karta.sh/org-8z06atvr/kriya`) |
| **Behavior** | [`CLAUDE.md`](CLAUDE.md) (the Claude Code harness reads it) |
| **Continuity** | [`homepage-conversation.md`](homepage-conversation.md) |

## Files

- **`CLAUDE.md`** - Karta's whole personality and rules. Treated as
  adversary-readable by design (no internal runbooks, endpoints, or secrets).
- **`homepage-conversation.md`** - the scripted intro the visitor reads on the
  home page before they type. Karta treats it as a conversation it has already
  had with the visitor and continues from there. It mirrors the scripted turns in
  the karta.sh home page; keep the two in step (watermark in the file).
- **`app.py`** - a thin wrapper exposing a `Karta()` instance, identical in shape
  to the `support-bot-demo`. Behavior is in `CLAUDE.md`, not here.
- **`karta.toml`** - the deploy manifest (`python` buildpack; see the note in the
  file about the not-yet-built one-file `claude-code` buildpack, RFC 0020 OQ5).

## How it reaches the home page

The home page does **not** embed the floating widget. It uses the
[`integration/custom-webpage`](../../../integration/custom-webpage) module to
stream Karta's replies into the page's own textbox and content area. The visitor
reads the scripted intro, and their first message is Karta's first *real* turn -
continuing the conversation above it.

## Deploy

```bash
karta create        # once, to register the project
git push karta main # ships an immutable release
```

The live deployment and its origin-gated, credit-capped `pk_live_` embed key are
managed by the Karta team - the key allowlists `karta.sh` and `localhost` (see
RFC 0020 EX-7). The project slug is currently `org-8z06atvr/kriya`; re-publishing
this folder under a `karta` project (and a vanity org slug, RFC 0020 OQ6) is a
follow-up.

## Run it locally

```bash
karta dev --dir apps/claude-code/karta --port 4747
```

(Requires the Karta CLI, `uv`, and an authenticated Claude Code CLI - same as the
`support-bot-demo`.)
