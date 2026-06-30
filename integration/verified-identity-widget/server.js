import crypto from "node:crypto";
import fs from "node:fs";
import http from "node:http";
import path from "node:path";
import { fileURLToPath } from "node:url";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const port = Number(process.env.PORT || 5051);
const publicDir = path.join(__dirname, "public");

const config = {
  embedKey: requiredEnv("KARTA_EMBED_KEY"),
  identitySecret: requiredEnv("KARTA_IDENTITY_SECRET"),
  agentRef: process.env.KARTA_AGENT_REF || "coffeeco/support-bot",
  baseUrl: process.env.KARTA_BASE_URL || "https://agent.karta.sh",
  widgetSrc: process.env.KARTA_WIDGET_SRC || "https://cdn.karta.sh/widget/v1/karta.js",
};

// Stand-in for your real authenticated user. In production this comes from
// your app's login session, never from a browser-supplied user id.
const signedInUser = {
  id: "user_123",
  email: "ada@example.com",
  plan: "pro",
};

http.createServer((req, res) => {
  const url = new URL(req.url || "/", `http://${req.headers.host || "localhost"}`);

  if (req.method === "GET" && url.pathname === "/") {
    sendHtml(res, renderIndex());
    return;
  }

  if (req.method === "GET" && url.pathname === "/api/karta-identity") {
    sendJson(res, identityResponse(identityToken(signedInUser.id)));
    return;
  }

  if (req.method === "POST" && url.pathname === "/api/karta-step-up") {
    // Replace this branch with your own MFA/passkey/password confirmation.
    sendJson(res, identityResponse(stepUpIdentityToken(signedInUser.id)));
    return;
  }

  sendJson(res, { error: "not_found" }, 404);
}).listen(port, () => {
  console.log(`Authenticated widget example listening on http://localhost:${port}`);
});

function renderIndex() {
  return fs.readFileSync(path.join(publicDir, "index.html"), "utf8")
    .replaceAll("__KARTA_BASE_URL__", jsString(config.baseUrl))
    .replaceAll("__KARTA_AGENT_REF__", jsString(config.agentRef))
    .replaceAll("__KARTA_EMBED_KEY__", jsString(config.embedKey))
    .replaceAll("__KARTA_WIDGET_SRC__", jsString(config.widgetSrc));
}

function identityResponse(token) {
  return {
    userId: signedInUser.id,
    identityToken: token,
    attributes: {
      email: signedInUser.email,
      plan: signedInUser.plan,
    },
  };
}

function identityToken(userId) {
  return crypto
    .createHmac("sha256", config.identitySecret)
    .update(userId)
    .digest("hex");
}

function stepUpIdentityToken(userId) {
  const payload = base64urlJson({
    user_id: userId,
    stepped_up_at: Math.floor(Date.now() / 1000),
    aal: "mfa",
  });
  const signature = crypto
    .createHmac("sha256", config.identitySecret)
    .update(payload)
    .digest("hex");
  return `v2.${payload}.${signature}`;
}

function base64urlJson(value) {
  return Buffer.from(JSON.stringify(value)).toString("base64url");
}

function sendHtml(res, html) {
  res.writeHead(200, { "Content-Type": "text/html; charset=utf-8" });
  res.end(html);
}

function sendJson(res, body, status = 200) {
  res.writeHead(status, { "Content-Type": "application/json; charset=utf-8" });
  res.end(JSON.stringify(body));
}

function jsString(value) {
  return JSON.stringify(value);
}

function requiredEnv(name) {
  const value = process.env[name];
  if (!value) {
    throw new Error(`Missing ${name}. See README.md for setup.`);
  }
  return value;
}
