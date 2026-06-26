# Karta examples

Runnable, copy-pasteable examples for [Karta](https://karta.sh), in two registers:

- **`apps/claude-code/`** - agents you publish on Karta (just a `CLAUDE.md`, deployed with `git push karta main`).
- **`integration/`** - Karta agents you embed in your own product (the widget, the headless client, and per-user history with verified identity).

Every example runs against the **public product only** (`cdn.karta.sh`, `agent.karta.sh`, and the published npm SDKs). None of them reference an internal service, so each one breaks only in ways a customer would also hit - and each one runs on a plain `git clone`.

## Status

Scaffolding. Examples are landing incrementally per [RFC 0020](https://github.com/karta-sh/karta). See the table below as it fills in.

## Which example do I want?

| You want to... | Example | Identity |
| --- | --- | --- |
| Ship your first agent in 60 seconds | `apps/claude-code/hello-world` | n/a |
| Add chat to a site with one `<script>` tag, themed to match | `integration/themed-widget` | anonymous |
| Build your own chat UI on the agent endpoint | `integration/headless-client` | anonymous / soft |
| Give logged-in users durable per-user history and memory | `integration/authenticated-memory` | verified |

## Secrets

The only credential that may ever be committed is an origin-gated, credit-capped publishable `pk_live_` embed key. Everything else (verified-identity HMAC secrets, session tokens, MCP credentials) goes through `.env.example` and env, never the tree. CI enforces this.

## License

[MIT](LICENSE).
