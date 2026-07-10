// mount-inline-agent.js
// ---------------------------------------------------------------------------
// Bind a Karta-hosted agent to a web page you already own.
//
// This is the "bring-your-own-DOM" integration. Instead of dropping in the
// floating chat widget, you keep YOUR page's own text input and content area,
// and the agent's replies stream into elements you control. It is the same
// module that powers the live chat on karta.sh's home page.
//
// It talks to the agent through the published headless client
// (KartaAgentClient, vendored here as ./karta-agent-client.js). Auth is a
// publishable, origin-gated `pk_live_` embed key, which is safe to ship in
// page source (the origin allowlist + a per-project credit cap are the gate,
// not the key).
//
// The final answer is text-only by design: a front-door chat shows the agent's
// words, not a log of its tool calls or reasoning. While the turn is in flight
// we do show a transient, friendly status line (e.g. "Searching the docs…")
// that keeps a wait indicator, so a real agent turn never reads as a stall; the
// reply text replaces it as soon as it streams. Agent text uses REPLACE
// semantics — each `message` event carries the full text-so-far, so we replace
// the reply rather than append. Agent text is rendered through renderMarkdown — a vendored,
// escape-first renderer (the XSS boundary: it HTML-escapes the whole string,
// then injects only a safe tag whitelist; links are scheme-allowlisted to
// http/https/mailto) — so a reply can show clickable links and emphasis without
// being able to inject markup into your page.
// ---------------------------------------------------------------------------

import { KartaAgentClient } from "./karta-agent-client.js";
import { renderMarkdown } from "./karta-markdown.js";

// Re-exported so a host supplying its own `createReply` can render agent text
// the same safe way.
export { renderMarkdown };

/**
 * @typedef {Object} InlineAgentOptions
 * @property {Element|string} input      Your text input (textarea/input) or a selector for it.
 * @property {Element|string} output     Your content/transcript area or a selector for it.
 * @property {Element|string} [submit]   Optional send button. Form-submit and Enter also send.
 * @property {string} [agentRef]       "{org}/{agent}", e.g. "org-8z06atvr/karta".
 * @property {string} [baseUrl]          Agent endpoint origin, e.g. "https://agent.karta.sh".
 * @property {string} [embedKey]         Publishable pk_live_ embed key (origin-gated).
 * @property {string} [agentName]        Label shown on agent turns. Default "Agent".
 * @property {string} [escalateHref]     "Talk to a human" target (mailto:/url), shown on error.
 * @property {{userId?:string, identityToken?:string, attributes?:object}} [identity]  Verified end-user identity (host-vouched HMAC); upgrades the session token's `sub`.
 * @property {() => (string|Promise<string>)} [contextFn]  Per-turn context the client wraps in <session-context> on the wire.
 * @property {(text:string, output:Element) => void} [renderUser]   Override the user-bubble markup.
 * @property {(output:Element, agentName:string) => ReplyHandle} [createReply]  Override the reply markup.
 * @property {(cfg:object) => AgentClient} [createClient]  Inject a client (tests/advanced auth).
 */

/**
 * @typedef {Object} ReplyHandle
 * @property {Element} element            The reply container (escalation link is appended here).
 * @property {(text:string) => void} setText   Replace the reply text (REPLACE semantics).
 * @property {(text:string) => void} [setStatus]  Optional: a transient progress status (cold-start "warming" or a "what the agent is doing" line) that keeps a wait indicator below the text; falls back to setText.
 * @property {(msg:string) => void} setError   Show an error in the reply.
 */

/**
 * Mount the inline agent onto an existing input + content area.
 * @param {InlineAgentOptions} options
 * @returns {{ send: (text:string) => Promise<void>, destroy: () => void }}
 */
export function mountInlineAgent(options) {
  const inputEl = resolveEl(options.input, "input");
  const outputEl = resolveEl(options.output, "output");
  const submitEl = options.submit ? resolveEl(options.submit, "submit") : null;
  const agentName = options.agentName || "Agent";
  const escalateHref = options.escalateHref || null;

  // The agent client. Injectable so tests can drive the UI with a fake stream
  // and so a host can supply a client built a different way (e.g. server-minted
  // tokens via `tokenFn`). By default we construct the published client from
  // the embed config.
  const createClient = options.createClient || ((cfg) => new KartaAgentClient(cfg));
  const client = createClient({
    baseUrl: options.baseUrl,
    agentRef: options.agentRef,
    embedKey: options.embedKey,
    // Verified identity (host-vouched) and per-turn context. Both are optional;
    // an anonymous page omits them and behaves exactly as before. The client
    // wraps context in a <session-context> envelope on the wire (the agent is
    // told everything inside is DATA), so account data is never an instruction.
    identity: options.identity,
    contextFn: options.contextFn,
  });

  // Rendering is injectable. The standalone example uses the defaults below; a
  // host (e.g. karta.sh) passes hooks that build DOM in its own classes so the
  // live replies look identical to the rest of the page.
  const renderUser = options.renderUser || defaultRenderUser;
  const createReply = options.createReply || defaultCreateReply;

  let busy = false;
  const teardown = [];
  const listen = (el, type, fn) => {
    el.addEventListener(type, fn);
    teardown.push(() => el.removeEventListener(type, fn));
  };

  // Send paths. If the input is inside a <form>, bind the form's submit event
  // only: a submit-type button and a programmatic requestSubmit() both fire it,
  // so also binding the button's click would double-send. Without a form, bind
  // the explicit button instead. Either way, handle Enter on the input, since a
  // <textarea> does not submit on Enter by default (Shift+Enter = newline).
  const form = inputEl.closest ? inputEl.closest("form") : null;
  if (form) {
    listen(form, "submit", (e) => { e.preventDefault(); send(readInput()); });
  } else if (submitEl) {
    listen(submitEl, "click", (e) => { e.preventDefault(); send(readInput()); });
  }
  listen(inputEl, "keydown", (e) => {
    if (e.key === "Enter" && !e.shiftKey) {
      e.preventDefault();
      send(readInput());
    }
  });

  function readInput() {
    return ("value" in inputEl ? inputEl.value : inputEl.textContent) || "";
  }
  function clearInput() {
    if ("value" in inputEl) inputEl.value = "";
    else inputEl.textContent = "";
  }
  function setBusy(state) {
    busy = state;
    inputEl.disabled = state;
    if (submitEl) submitEl.disabled = state;
    outputEl.setAttribute("aria-busy", state ? "true" : "false");
  }

  /**
   * Send one user turn and stream the reply into the page.
   * @param {string} text
   */
  async function send(text) {
    text = (text || "").trim();
    if (!text || busy) return;
    setBusy(true);
    clearInput();
    renderUser(text, outputEl);
    const reply = createReply(outputEl, agentName);

    // Cold-start statuses. An idle agent is asleep, so the first turn wakes its
    // private computer (a cold miss is ~15-20s). The server's `warming` signal
    // is a single opaque event — the microVM boot + image pull expose NO real
    // progress — so this drip is SIMULATED. To avoid the tells of a fake
    // progress bar, each line advances on a delay that GROWS (quick early
    // feedback, then spaced out like real progress) with random jitter, so it
    // never reads as a metronome; and once the scripted journey is done a small
    // "still waiting" pool keeps gently cycling so a long boot never freezes on
    // one line. The first real `message` clears the timer and replaces the text.
    const warmingSteps = [
      "Getting ready…",
      "Waking up your agent…",
      "Spinning up a private microVM…",
      "Loading your agent…",
      "Almost there…",
    ];
    const warmingTail = ["Still working…", "Hang tight…", "Almost ready…"];
    let warmTimer = null;
    let warmStep = 0;
    // Show the warming status WITH the wait indicator kept: the host's setStatus
    // renders the text + its typing dots; fall back to plain setText otherwise.
    const showStatus = (t) => (reply.setStatus ? reply.setStatus(t) : reply.setText(t));
    // Delay BEFORE the next line: grows with each step (capped), then ±40% jitter
    // so the cadence never looks mechanical. random==0.5 => exactly the base.
    const nextWarmDelay = () => {
      const base = Math.min(3200 + warmStep * 1400, 11000);
      const jitter = 0.4 * base;
      return base - jitter + Math.random() * 2 * jitter;
    };
    const scheduleWarm = () => {
      warmTimer = setTimeout(() => {
        warmStep += 1;
        if (warmStep < warmingSteps.length) {
          showStatus(warmingSteps[warmStep]);
        } else {
          // Past the scripted journey — cycle gentle "still waiting" lines at
          // long jittered intervals so a rare slow boot keeps changing.
          showStatus(warmingTail[(warmStep - warmingSteps.length) % warmingTail.length]);
        }
        scheduleWarm();
      }, nextWarmDelay());
    };
    const stopWarming = () => {
      if (warmTimer) {
        clearTimeout(warmTimer);
        warmTimer = null;
      }
    };
    const startWarming = () => {
      if (warmTimer) return; // idempotent — repeated warming events don't restart it
      warmStep = 0;
      showStatus(warmingSteps[0]);
      scheduleWarm();
    };

    try {
      let gotText = false;
      for await (const ev of client.sendMessage(text)) {
        if (ev.type === "warming") {
          startWarming(); // rotates until the agent starts responding
        } else if (ev.type === "message") {
          stopWarming();
          gotText = true;
          reply.setText(ev.text || ""); // REPLACE, not append
        } else if (
          ev.type === "thinking" ||
          ev.type === "tool_use" ||
          ev.type === "tool_result"
        ) {
          // Live progress. A front-door chat still shows the final answer as
          // words, but while the agent works we surface WHAT it's doing as a
          // transient status that keeps the wait indicator — so a real agent
          // turn (reasoning, searching the docs) never reads as a stall. The
          // next real `message` replaces it. Raw reasoning text and tool
          // payloads are never rendered, only a friendly activity label.
          stopWarming();
          showStatus(activityLabel(ev));
        } else if (ev.type === "error") {
          reply.setError(ev.message || "The agent hit an error.");
          appendEscalation(reply);
          return;
        }
        // input_required / done / status: nothing to render here.
      }
      if (!gotText) reply.setText("…");
    } catch (err) {
      reply.setError((err && err.message) || "Couldn't reach the agent.");
      appendEscalation(reply);
    } finally {
      stopWarming();
      setBusy(false);
      if (typeof inputEl.focus === "function") inputEl.focus();
    }
  }

  function appendEscalation(reply) {
    if (!escalateHref || !reply.element) return;
    // A <br> (not CSS) puts the link on its own line in any host, with no
    // dependency on host styles or any CSP-governed inline style attribute.
    reply.element.appendChild(document.createElement("br"));
    const a = document.createElement("a");
    a.className = "karta-escalate";
    a.href = escalateHref;
    a.textContent = "Talk to a human →";
    reply.element.appendChild(a);
  }

  return {
    send,
    destroy() {
      teardown.forEach((fn) => fn());
      if (typeof client.shutdown === "function") client.shutdown();
    },
  };
}

// --- helpers ----------------------------------------------------------------

// A friendly, ephemeral label for what the agent is doing right now. This is a
// progress line, not a tool-call log: raw reasoning and tool payloads are never
// shown. Kept generic (this module can drive any agent); a few well-known tool
// names get a nicer verb, everything else falls back to a neutral "Working…".
function activityLabel(ev) {
  if (ev.type === "thinking" || ev.type === "tool_result") return "Thinking…";
  switch (ev.tool) {
    case "WebFetch":
    case "WebSearch":
      return "Searching the docs…";
    case "get_account":
      return "Checking your account…";
    case "get_capabilities":
      return "Checking what's possible…";
    case "propose_action":
      return "Preparing that for your approval…";
    default:
      return "Working…";
  }
}

function resolveEl(ref, label) {
  const el = typeof ref === "string" ? document.querySelector(ref) : ref;
  if (!el) throw new Error(`mountInlineAgent: \`${label}\` element not found (${ref}).`);
  return el;
}

// Default rendering: generic, lightly-classed markup that styles.css dresses
// up. Hosts override renderUser / createReply to match their own design.
function defaultRenderUser(text, outputEl) {
  const turn = document.createElement("div");
  turn.className = "karta-turn karta-turn--user";
  const bubble = document.createElement("div");
  bubble.className = "karta-msg karta-msg--user";
  bubble.textContent = text; // safe: no markup injection
  turn.appendChild(bubble);
  outputEl.appendChild(turn);
  scrollToEnd(outputEl);
}

function defaultCreateReply(outputEl, agentName) {
  const turn = document.createElement("div");
  turn.className = "karta-turn karta-turn--agent";
  const name = document.createElement("div");
  name.className = "karta-name";
  name.textContent = agentName;
  const body = document.createElement("div");
  body.className = "karta-msg karta-msg--agent";
  body.textContent = "…";
  turn.appendChild(name);
  turn.appendChild(body);
  outputEl.appendChild(turn);
  scrollToEnd(outputEl);
  return {
    element: body,
    setText(t) {
      body.classList.remove("is-error");
      body.innerHTML = renderMarkdown(t); // REPLACE; renderMarkdown is the XSS boundary
      scrollToEnd(outputEl);
    },
    setStatus(t) {
      // Transient status (cold-start warming): keep the typing dots below the
      // text — we're still waiting. setText replaces it all with the real reply.
      body.classList.remove("is-error");
      body.innerHTML =
        '<span class="karta-typing" aria-label="working"><span></span><span></span><span></span></span>';
      const line = document.createElement("div");
      line.textContent = t; // safe
      body.insertBefore(line, body.firstChild);
      scrollToEnd(outputEl);
    },
    setError(msg) {
      body.classList.add("is-error");
      body.textContent = msg;
      scrollToEnd(outputEl);
    },
  };
}

function scrollToEnd(outputEl) {
  // Cosmetic only — keep the latest turn in view. Guarded so headless test
  // environments (jsdom, no layout) never throw on an unimplemented scroll.
  try {
    if (outputEl.scrollHeight > outputEl.clientHeight) {
      outputEl.scrollTop = outputEl.scrollHeight;
    } else if (typeof window !== "undefined" && window.scrollTo) {
      window.scrollTo({ top: document.body.scrollHeight });
    }
  } catch (_) {
    /* no-op */
  }
}
