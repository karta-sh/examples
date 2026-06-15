// Copy this file to `config.js` (gitignored) and fill in your values.
//
// `embedKey` is a PUBLISHABLE pk_live_ key. It is safe to ship in page source:
// it only works from origins you allowlist for the project, and every project
// carries a hard credit cap, so a copied key can't run up spend. It is NOT a
// secret — do not confuse it with a server-side API key.
//
// To run against your own agent, set projectRef to "{org}/{project}" and paste
// your project's origin-gated embed key (allowlist http://localhost for local
// runs). See the README.

export default {
  // Karta's own support agent. Replace with your own project to point the page
  // at your agent. (The live project slug is `kriya`; it becomes `karta` once
  // the agent is re-published under that name.)
  projectRef: "org-8z06atvr/kriya",
  baseUrl: "https://agent.karta.sh",

  // Placeholder — replace with a real origin-gated pk_live_ key that allowlists
  // your local origin. With this placeholder, the page loads and is interactive
  // but the agent call fails gracefully (you'll see an error + "Talk to a human").
  embedKey: "pk_live_REPLACE_WITH_YOUR_ORIGIN_GATED_KEY",

  // Where "Talk to a human" points when the agent errors.
  escalateHref: "mailto:support@karta.sh",
};
