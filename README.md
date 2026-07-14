# Karta examples

Runnable, copy-pasteable examples for [Karta](https://karta.sh), in two registers:

- **`agents/`** - agents you publish on Karta (a native harness instruction file plus `karta.toml`, deployed with `git push karta main`).
- **`artifacts/`** - Agent Apps that each produce one Artifact, ordered from a Markdown file to recursive child Agent Apps. These examples require an Artifact-capable Karta release.
- **`integration/`** - Karta agents you embed in your own product (the widget, the headless client, and per-user history with verified identity).

Every example runs against the **public product only** (`cdn.karta.sh`, `agent.karta.sh`, and the published npm SDKs). None of them reference an internal service, so each one breaks only in ways a customer would also hit - and each one runs on a plain `git clone`.

## Status

Scaffolding. Examples are landing incrementally per [RFC 0020](https://github.com/karta-sh/karta). See the table below as it fills in.

## Which example do I want?

| You want to... | Example | Identity |
| --- | --- | --- |
| Ship your first agent in 60 seconds | `agents/claude-code/hello-world` | n/a |
| Ship the same hello-world agent on Deep Agents Code | `agents/deepagents/hello-world` | n/a |
| Ship the same hello-world agent on Goose | `agents/goose/hello-world` | n/a |
| Ship the same hello-world agent on Codex CLI | `agents/codex-cli/hello-world` | n/a |
| Learn the Artifact flow with one Markdown file | `artifacts/01-hello-world-markdown` | n/a |
| Install the dependencies (pip/npm) your agent needs before it runs | `agents/claude-code/custom-environment` | n/a |
| Add chat to a site with one `<script>` tag, themed to match | `integration/themed-widget` | anonymous |
| Build your own chat UI on the agent endpoint | `integration/headless-client` | anonymous / soft |
| Stream an agent into your page's own textbox + content area | `integration/custom-webpage` | anonymous |
| Give every logged-in user their own agent inside your custom DOM | `integration/verified-identity-inline` | verified |
| Embed the hosted widget for signed-in users, including step-up refresh | `integration/verified-identity-widget` | verified + step-up |

## Secrets

The only credential that may ever be committed is an origin-gated, credit-capped publishable `pk_live_` embed key. Everything else (verified-identity HMAC secrets, session tokens, MCP credentials) goes through `.env.example` and env, never the tree. CI enforces this.

## License

[MIT](LICENSE).
