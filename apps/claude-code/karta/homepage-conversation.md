# Home-page conversation (what the visitor has already seen)

This is the scripted introduction the visitor reads on the Karta home page
(`karta.sh`) before they can type. The page renders it as a conversation with
**Karta**. It is the single source of truth for that intro's *substance*: Karta
treats it as a conversation it has already had with the visitor (see
[`CLAUDE.md`](CLAUDE.md)), and the home page presents the same content.

> Watermark: mirrors the scripted turns in
> `apps/karta-web/app/views/preview/landing.html.erb` as of 2026-06-13. The home
> page renders these with its own rich visuals; this file is the plain-text
> equivalent for Karta's continuity. If the home-page copy changes materially,
> update this file too.

---

**Visitor:** What's Karta?

**Karta:** Karta is a **managed agent harness platform** - it runs your agents in
production. You build your agent in Claude Code or another compatible harness,
and Karta packages an immutable release and runs it in a secure, isolated sandbox
behind a stable URL. Ship your agent with a `git push`.

**Visitor:** Why can't I just host it myself?

**Karta:** You can, but a production agent needs real infrastructure: a server to
run the harness, isolation for every session, streaming to the client, a public
endpoint, end-user authentication, spend caps, usage metering, an audit trail,
and secure storage for model keys. Karta does all nine for you, managed.

**Visitor:** Okay, how do I deploy my agent?

**Karta:** One command: `git push karta`. CI packages the app, Karta creates an
immutable release, activates it with an atomic pointer flip, and assigns a stable
project URL. The same path every time.

**Visitor:** What kind of agents can I run on Karta?

**Karta:** Any agent, any complexity - from a weekend support assistant to a
multi-team enterprise system. Support and concierge bots, docs Q&A, internal ops
copilots, SQL analysts, incident-response runbooks, compliance reviewers, coding
agents over a private repo. The same `git push` ships all of them.

**Visitor:** Is it actually enterprise-ready?

**Karta:** Yes. Per-session microVM isolation, hard spend caps that fail closed,
default-deny multi-tenancy, exact and idempotent metering, billing built in,
immutable versioned releases, roles and permissions, enforced MFA, scoped API
keys and session tokens, zero-downtime cutover, durable state across releases,
bring-your-own-model, an immutable audit log, and signed webhooks. Standard
streaming APIs, so you can point any chat widget at the project URL.

**Visitor:** Alright. How do I start?

**Karta:** Write and test your agent locally, then push once - you get a live
agent behind a stable URL. The quickstart at docs.karta.sh walks you through your
first deploy in a few minutes.
