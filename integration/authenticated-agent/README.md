# Authenticated agent (on behalf of your signed-in user)

Give every **logged-in** user their own agent that knows it's *them* — a verified
identity, a private durable memory, and answers (and, with an MCP, actions)
scoped to that one user. This is the wedge: not one shared chatbot, but a
per-customer agent.

It's the [`custom-webpage`](../custom-webpage) pattern (your page's own textbox +
content area, no widget, no iframe) **plus one ingredient: a tiny backend that
vouches for your signed-in user.** It's also exactly how karta.sh's own home-page
agent recognizes a signed-in visitor.

| | |
| --- | --- |
| **Identity** | **verified** (host-vouched HMAC, Intercom-style) |
| **Backend** | yes — it holds the secret and signs your user's id |
| **You provide** | a login (your app already has one) + the identity secret |
| **Karta provides** | a verified `sub`, a per-user durable workspace, metering |

## How it works

```
 your page                 your backend                     Karta
 ─────────                 ────────────                     ─────
 load page  ──fetch──▶  /api/karta-identity
                        (you've authenticated the user)
                        identityToken =
                          HMAC-SHA256(secret, user_id)   ◀── secret is server-only
            ◀──{userId, identityToken}──
 mountInlineAgent({ identity }) ──mint session token──▶  re-verify the HMAC
                                                          with the SAME secret
                                                          ✓ → sub = user_id (VERIFIED)
 chat turns ───────────────────────────────────────────▶  agent runs as that user:
                                                          per-user memory, scoped data
```

The secret lives **only on your backend**. The browser only ever sees a
per-user `identityToken`, which *proves* your backend vouched for that `user_id`.
Karta recomputes the HMAC at mint time and trusts the `sub` **only** on a match —
so a tampered browser can't claim to be another user (it can't forge the token
without the secret). A bare `user_id` with no valid token is treated as anonymous,
never as that user.

## Run it

1. **Have an agent on Karta** (e.g. follow [`../../apps/claude-code/hello-world`](../../apps/claude-code/hello-world)),
   and create a **publishable embed key** for it (dashboard → your agent → Embed).
2. **Turn on identity verification** for that key: expand the key's **configure**
   panel → **Verified identity (HMAC)** → **Generate secret**. Copy the revealed
   value — it's shown once.
3. **Wire it up:**
   ```sh
   cp config.example.js config.js          # then fill in agentRef + embedKey
   export KARTA_IDENTITY_SECRET=<the secret you just generated>
   npm start                               # → http://localhost:8787
   ```
   Add `http://localhost:8787` to the key's **Allowed origins** so the mint isn't
   origin-rejected.

Open the page: you're "signed in as Nina", and the agent's replies are for *her*.
Reload and it still knows her — the durable workspace is keyed on the verified id.

## Make it real

- **The signed-in user** is hard-coded in [`server.js`](server.js) so the demo
  runs with no login. In your app, derive `user_id` from your **session**, never
  from the request — the whole point is that *you* vouch for it.
- **Per-turn context** (`contextFn`) hands the agent data your page already knows
  about the user; the client wraps it in `<session-context>` (treated as data,
  never instructions).
- **Acting on their behalf (advanced).** To let the agent *do* things for the user
  — "show me *my* orders", "cancel *my* subscription" — expose your backend as an
  **MCP** the agent calls, scoped to the verified `sub` (RFC 0015). This example
  stops at verified identity + per-user memory + context, which is the solid,
  fully-supported base; the MCP step builds on top of it.

## Files

- [`server.js`](server.js) — the minimal backend: the `/api/karta-identity` mint + a static file server. Node built-ins only, no dependencies.
- [`index.html`](index.html) — your page: a signed-in shell + a bring-your-own-DOM chat, mounted with the verified identity.
- [`config.example.js`](config.example.js) — `agentRef` / `baseUrl` / `embedKey` (publishable; the secret is **not** here).
- `src/` — the vendored bring-your-own-DOM mount module (same as `custom-webpage`).
