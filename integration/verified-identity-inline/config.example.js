// Copy this to `config.js` (gitignored) and fill it in. These are PUBLISHABLE
// values — safe to ship in page source. The identity SECRET is NOT here: it lives
// only on your backend (server.js reads it from KARTA_IDENTITY_SECRET).
window.KARTA_CONFIG = {
  // "{org}/{agent}" — your agent's reference (dashboard → your agent).
  agentRef: "org-xxxxxxxx/your-agent",
  // The Karta agent endpoint origin.
  baseUrl: "https://agent.karta.sh",
  // Your publishable, origin-gated pk_live_ embed key (dashboard → your agent → Embed).
  embedKey: "pk_live_xxxxxxxxxxxxxxxxxxxx",
};
