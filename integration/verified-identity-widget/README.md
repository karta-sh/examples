# Verified identity widget

A worked example for embedding the Karta widget inside a signed-in product.
The browser gets a publishable embed key and a per-user identity token; the
identity-verification secret stays on the server.

This example demonstrates two tokens:

- regular verified identity: `HMAC-SHA256(identity_secret, user_id)` as lowercase hex;
- host-attested step-up: `v2.<base64url-json>.<hmac-hex>`, where the HMAC signs
  the encoded payload containing `user_id`, `stepped_up_at`, and `aal`.

## Files

| File | Role |
| --- | --- |
| `server.js` | Serves the demo page, mints identity tokens, and simulates a step-up endpoint. |
| `public/index.html` | Calls `karta("identify", ...)`, loads the hosted widget, and refreshes identity after step-up. |
| `package.json` | `npm start` script. No runtime dependencies are required. |

## Prerequisites

- A deployed Karta agent, referenced as `org-slug/agent-slug`.
- A publishable widget embed key (`pk_live_...`) allowlisting this page's origin
  such as `http://localhost:5051`.
- The identity-verification secret generated for that embed key.

## Run

```bash
cd integration/verified-identity-widget

export KARTA_EMBED_KEY="pk_live_..."
export KARTA_IDENTITY_SECRET="..."
export KARTA_AGENT_REF="coffeeco/support-bot"

npm start
```

Open <http://localhost:5051>.

Optional overrides:

```bash
export PORT=5051
export KARTA_BASE_URL="https://agent.karta.sh"
export KARTA_WIDGET_SRC="https://cdn.karta.sh/widget/v1/karta.js"
```

## What to verify

1. The page loads a signed identity from `/api/karta-identity`.
2. The page calls `karta("identify", { userId, identityToken, attributes })`
   before opening the widget.
3. Opening the widget mints a Karta session token with that verified subject.
4. Clicking **Simulate step-up** calls `/api/karta-step-up`, gets a structured
   `v2...` identity token, and calls `identify` again. The widget drops its
   cached session token, so the next request uses a freshly minted token with
   the signed step-up claims.

## Production notes

- Replace the hard-coded `signedInUser` in `server.js` with your real login
  session.
- Replace the simulated `/api/karta-step-up` branch with your own MFA, passkey,
  password confirmation, or equivalent step-up check.
- Do not accept a browser-supplied `userId` for signing. The server decides the
  user id from its authenticated session.
- Never render `KARTA_IDENTITY_SECRET` into HTML or client JavaScript.
