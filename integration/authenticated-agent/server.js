// A minimal backend for the "authenticated agent" example. Node built-ins only —
// no dependencies. It does two things:
//
//   1. /api/karta-identity — vouch for the signed-in user. This is the whole
//      point of the example: your backend holds the secret AND has authenticated
//      the user, so it signs their id with HMAC-SHA256. Karta re-verifies it and
//      only then trusts the `sub`.
//   2. serve the static page + the vendored mount module + your config.js.

import { createServer } from "node:http";
import { createHmac } from "node:crypto";
import { readFile } from "node:fs/promises";
import { fileURLToPath } from "node:url";
import { dirname, join, extname, normalize, sep } from "node:path";

const HERE = dirname(fileURLToPath(import.meta.url));
const PORT = process.env.PORT || 8787;

// The Karta identity-verification secret FOR YOUR EMBED KEY. Provision it in the
// dashboard (your agent → Embed → the key → configure → Generate secret) and pass
// the revealed value in via env. It is SERVER-ONLY — never send it to the browser.
const KARTA_IDENTITY_SECRET = process.env.KARTA_IDENTITY_SECRET || "";

// Your real app derives the signed-in user from ITS OWN session/auth. This demo
// hard-codes one so you can run it with no login system. NEVER take the user id
// from the request — vouching for an id the caller supplied defeats the purpose.
const SIGNED_IN_USER = { id: "user-nina-42", name: "Nina" };

// The only file types this demo serves. An allowlist (vs. "serve anything")
// keeps README/dotfiles/manifests private without per-file rules.
const CONTENT_TYPES = {
  ".html": "text/html; charset=utf-8",
  ".js": "text/javascript; charset=utf-8",
  ".css": "text/css; charset=utf-8",
};

const server = createServer(async (req, res) => {
  const url = new URL(req.url, `http://${req.headers.host}`);

  if (url.pathname === "/api/karta-identity") {
    if (!KARTA_IDENTITY_SECRET) {
      return json(res, 500, { error: "KARTA_IDENTITY_SECRET is not set — see the README." });
    }
    const userId = SIGNED_IN_USER.id; // ← from your session in a real app
    const identityToken = createHmac("sha256", KARTA_IDENTITY_SECRET).update(userId).digest("hex");
    return json(res, 200, { userId, name: SIGNED_IN_USER.name, identityToken });
  }

  // Static files: only allowlisted web assets, resolved strictly under HERE.
  // The extension allowlist + the under-HERE check together mean no path
  // traversal and no serving of README/dotfiles/source you didn't intend. (The
  // identity SECRET is never a file — it's an env var — so it can't be served.)
  const rel = url.pathname === "/" ? "/index.html" : url.pathname;
  const filePath = normalize(join(HERE, rel));
  const type = CONTENT_TYPES[extname(filePath)];
  const underHere = filePath === HERE || filePath.startsWith(HERE + sep);
  if (!type || !underHere) {
    res.writeHead(404, { "content-type": "text/plain" });
    return res.end("Not found");
  }
  try {
    res.writeHead(200, { "content-type": type });
    res.end(await readFile(filePath));
  } catch {
    res.writeHead(404, { "content-type": "text/plain" });
    res.end("Not found");
  }
});

function json(res, status, body) {
  res.writeHead(status, { "content-type": "application/json; charset=utf-8" });
  res.end(JSON.stringify(body));
}

server.listen(PORT, () => {
  console.log(`authenticated-agent demo → http://localhost:${PORT}`);
  if (!KARTA_IDENTITY_SECRET) {
    console.log("⚠  KARTA_IDENTITY_SECRET is not set — the agent will run anonymous. See the README.");
  }
});
