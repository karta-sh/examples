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

**Karta:** Karta is a **managed agent harness platform**. I enables you to give each customer a long-running agent. - AI employees · AI tax consultants · AI life coaches - What will you deploy on Karta? 

Build your agent in Claude Code or any compatible harness, and Karta runs it in a secure, isolated sandbox behind a stable URL - deploy from a folder, a git push, or your CI. Every one of your users gets their own personalized agent with a durable workspace that's theirs and yours to own - one that remembers them, gets better the more they use it, and builds a real relationship over time.

**Visitor:** Why can't I just host it myself?

**Karta:** You can, but a production agent needs real infrastructure: a server to
run the harness, isolation for every session, streaming to the client, a public
endpoint, end-user authentication, spend caps, usage metering, an audit trail,
and secure storage for model keys. Karta does all nine for you, managed.

**Visitor:** Can each user get a personalized agent with own workspace?

**Karta:** Every user gets their own agent.
Not one shared assistant - a real agent per end user, that gets more useful the more they use it.

A workspace that's theirs. Each user gets a durable, isolated workspace. Their files, history, and half-finished work accumulate over time, so the agent picks up exactly where they left off.

Identity from anonymous to verified. A visitor can start instantly with no sign-in and keep the same workspace when they verify - anonymous, soft, or verified, your choice.

Yours to own. The agent runs inside your product, on a harness you control. You keep the user, the data, and the relationship, instead of handing them to someone else's chatbot.

**Visitor:** Okay, how do I deploy my agent?

**Karta:** karta deploy ships the current agent - upload a local folder, or push a git repo to its hosted karta remote. git push karta main is the same thing once wired, and you can drop it into CI so every git push deploys. Every path builds an immutable release, activates it with an atomic pointer flip, and serves it at a stable agent URL.

Example - 
coffeeco/support-bot — zsh
➜ git push karta main
·· Enumerating objects: 41, done. Compressing… pushing harness app (.claude/ + CLAUDE.md)
·· remote: CI packaging release… skills ✓ tools ✓ sub-agents ✓ runtime pinned ✓
·· remote: build → immutable release v1 · sha 7f3c9ad
·· remote: runtime → secure, isolated per-session microVM provisioned
·· remote: activate → atomic pointer flip → v1 live (zero-interruption cutover)
✓ live https://agent.karta.sh/coffeeco/support-bot

**Visitor:** What kind of agents can I run on Karta?

**Karta:** Any agent, any complexity - from a weekend support assistant to a
multi-team enterprise system. 

## Startup
Support assistant
answer in your brand voice
Tutor per student
tracks each learner's progress
Personal coach per user
remembers goals + history
Docs Q&A agent
grounded in your docs
Onboarding guide
walk new users through setup

## Scale-up
Internal ops copilot
runbooks + internal tools
Sales-research agent
enrich + summarize leads
SQL / data analyst
query, chart, explain
Content / marketing assistant
drafts on-brand
Customer-success agent
proactive account help

## Enterprise
Incident-response runbook agent
drive playbooks on call
Compliance / policy reviewer
flag against policy
Claims-processing agent
structured intake + decisions
Coding agent over a private repo
scoped, isolated
Multi-team agent platform
audit + BYOK + spend caps

Each session runs in its own secure, isolated microVM — the boundary for untrusted agent code. Streaming-first, with billing built in.

**Visitor:** Is it actually enterprise-ready?

**Karta:** Yes, built for enterprise-grade agentic workloads.
Everything a production agent product needs, included.

## Per-session microVM isolation
Every session runs in its own secure microVM; cross-org access is denied by default.

## Hard spend caps
Requests fail closed with 402 at the cap. No silent overage.

## Default-deny multi-tenancy
Every request is scoped to your org; a wrong-org lookup returns 404, enforced by tests.

## Exact, idempotent metering
Every turn metered by org, model and key; retries never double-bill.

## Billing built in
Subscriptions and prepaid credit, live.

## Immutable, versioned releases
Every push is an immutable release; activate atomically, roll back instantly.

## Roles & permissions
Owner, admin, developer, billing, viewer — per org.

## Enforced MFA
Passkeys or TOTP required before an API key exists; step-up on sensitive changes.

## Scoped API keys
Per-org, constant-time validation, revoke without rotation pain.

## Scoped session tokens
Browser widgets get short-lived, agent-scoped tokens, never a platform key.

## Zero-downtime cutover
In-flight sessions finish on their release; the next session gets the new code.

## Durable per-user workspace
Each user's files, artifacts, and half-finished work persist, accumulate, and survive deploys.

## Bring your own model
Your provider keys, encrypted at rest; route any model.

## Immutable audit log
Every material change recorded and unrewritable: who did what, when.

## Signed webhooks
HMAC-signed events with backoff retries and auto-disable on persistent failure.

## Standard streaming APIs
OpenAI- and Anthropic-compatible; point any chat widget at the agent URL.

**Visitor:** Alright. How do I start?

**Karta:** Write and test your agent locally, then push to karta - you get a live
agent behind a stable URL. The quickstart at docs.karta.sh walks you through your
first deploy in a few minutes.
