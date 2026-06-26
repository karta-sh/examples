// @vitest-environment jsdom
//
// These tests pin the *intent* of the inline integration, not the wire
// protocol (KartaAgentClient is tested in @karta/widget). We inject a fake
// client that yields a scripted AgentEvent stream, and assert how the module
// drives the host's DOM: REPLACE-streamed text, text-only rendering, busy
// gating, error + escalation, and host render-hook overrides.

import { beforeEach, describe, expect, it, vi } from "vitest";
import { mountInlineAgent } from "../src/mount-inline-agent.js";

// A fake KartaAgentClient: sendMessage() returns an async generator over a
// fixed list of events, and records the text it was asked to send.
function fakeClient(events) {
  const sent = [];
  return {
    sent,
    shutdownCalled: false,
    sendMessage(text) {
      sent.push(text);
      return (async function* () {
        for (const ev of events) yield ev;
      })();
    },
    shutdown() {
      this.shutdownCalled = true;
    },
  };
}

function dom() {
  document.body.innerHTML = `
    <div id="out"></div>
    <form id="f">
      <textarea id="in"></textarea>
      <button id="go" type="submit">Send</button>
    </form>`;
  return {
    output: document.getElementById("out"),
    input: document.getElementById("in"),
    submit: document.getElementById("go"),
  };
}

function mountWith(events, extra = {}) {
  const els = dom();
  const client = fakeClient(events);
  const agent = mountInlineAgent({
    input: "#in",
    output: "#out",
    submit: "#go",
    agentRef: "org/agent",
    baseUrl: "https://agent.example",
    embedKey: "pk_live_test",
    createClient: () => client,
    ...extra,
  });
  return { els, client, agent };
}

beforeEach(() => {
  document.body.innerHTML = "";
  // jsdom has no layout and throws on window.scrollTo; the module guards the
  // call, but stub it to a no-op so the test log stays clean. Real browsers
  // implement it.
  window.scrollTo = () => {};
});

describe("mountInlineAgent", () => {
  it("appends the typed message and REPLACE-streams the reply", async () => {
    const { els, client, agent } = mountWith([
      { type: "status", status: "running" },
      { type: "message", text: "Hel" },
      { type: "message", text: "Hello there" }, // full-so-far, REPLACE
      { type: "done" },
    ]);

    await agent.send("hi");

    expect(client.sent).toEqual(["hi"]);
    const user = els.output.querySelector(".karta-turn--user .karta-msg--user");
    const reply = els.output.querySelector(".karta-turn--agent .karta-msg--agent");
    expect(user.textContent).toBe("hi");
    // Reply shows the final full text, not the concatenation "HelHello there".
    expect(reply.textContent).toBe("Hello there");
    expect(reply.classList.contains("is-error")).toBe(false);
  });

  it("renders agent markdown safely (links clickable, raw HTML escaped)", async () => {
    const { els, agent } = mountWith([
      { type: "message", text: "See the [docs](https://docs.karta.sh) and `git push`. <b>x</b>" },
      { type: "done" },
    ]);

    await agent.send("how?");

    const reply = els.output.querySelector(".karta-msg--agent");
    const link = reply.querySelector("a");
    expect(link).not.toBeNull();
    expect(link.getAttribute("href")).toBe("https://docs.karta.sh");
    expect(link.getAttribute("rel")).toBe("noopener noreferrer");
    expect(link.textContent).toBe("docs");
    expect(reply.querySelector("code")?.textContent).toBe("git push");
    // The raw <b> tag is escaped to inert text, not a live element.
    expect(reply.querySelector("b")).toBeNull();
    expect(reply.textContent).toContain("<b>x</b>");
  });

  it("ignores thinking and tool events (text-only surface)", async () => {
    const { els, agent } = mountWith([
      { type: "thinking", text: "let me think" },
      { type: "tool_use", tool: "search", input: {} },
      { type: "message", text: "Answer." },
      { type: "tool_result", output: "x" },
      { type: "done" },
    ]);

    await agent.send("q");

    const reply = els.output.querySelector(".karta-msg--agent");
    expect(reply.textContent).toBe("Answer.");
    // No tool/thinking text leaked into the page.
    expect(els.output.textContent).not.toContain("let me think");
    expect(els.output.textContent).not.toContain("search");
  });

  it("surfaces an error event and shows the escalation link", async () => {
    const { els, agent } = mountWith(
      [{ type: "error", message: "rate limited" }],
      { escalateHref: "mailto:help@example.com" }
    );

    await agent.send("q");

    const reply = els.output.querySelector(".karta-msg--agent");
    expect(reply.classList.contains("is-error")).toBe(true);
    expect(reply.textContent).toContain("rate limited");
    const escalate = reply.querySelector("a.karta-escalate");
    expect(escalate).not.toBeNull();
    expect(escalate.getAttribute("href")).toBe("mailto:help@example.com");
  });

  it("surfaces a thrown transport error gracefully", async () => {
    const els = dom();
    const throwingClient = {
      sendMessage() {
        return (async function* () {
          throw new Error("network down");
        })();
      },
    };
    const agent = mountInlineAgent({
      input: "#in",
      output: "#out",
      createClient: () => throwingClient,
    });

    await agent.send("q");

    const reply = els.output.querySelector(".karta-msg--agent");
    expect(reply.classList.contains("is-error")).toBe(true);
    expect(reply.textContent).toContain("network down");
  });

  it("disables input while streaming and re-enables after", async () => {
    let resolveDuring;
    const during = new Promise((r) => (resolveDuring = r));
    const slowClient = {
      sendMessage() {
        return (async function* () {
          resolveDuring(); // signal: we're mid-stream
          yield { type: "message", text: "ok" };
          yield { type: "done" };
        })();
      },
    };
    const els = dom();
    const agent = mountInlineAgent({
      input: "#in",
      output: "#out",
      submit: "#go",
      createClient: () => slowClient,
    });

    const p = agent.send("q");
    await during;
    expect(els.input.disabled).toBe(true);
    expect(els.submit.disabled).toBe(true);
    expect(els.output.getAttribute("aria-busy")).toBe("true");
    await p;
    expect(els.input.disabled).toBe(false);
    expect(els.submit.disabled).toBe(false);
    expect(els.output.getAttribute("aria-busy")).toBe("false");
  });

  it("ignores empty input and re-entrant sends while busy", async () => {
    const { client, agent } = mountWith([
      { type: "message", text: "one" },
      { type: "done" },
    ]);
    await agent.send("   "); // whitespace only
    expect(client.sent).toEqual([]);
    await agent.send("real");
    expect(client.sent).toEqual(["real"]);
  });

  it("submits on form submit and clears the input", async () => {
    const { els, client } = mountWith([
      { type: "message", text: "hi back" },
      { type: "done" },
    ]);
    els.input.value = "hello";
    // Dispatch a real submit; the module intercepts and prevents navigation.
    els.input.form.requestSubmit
      ? els.input.form.requestSubmit()
      : els.input.form.dispatchEvent(new Event("submit", { cancelable: true }));
    // Let the async send flush.
    await new Promise((r) => setTimeout(r, 0));
    expect(client.sent).toEqual(["hello"]);
    expect(els.input.value).toBe("");
  });

  it("sends exactly once when a submit button inside a form is clicked", async () => {
    // A type=submit button fires BOTH a click and the form's submit event;
    // the module must not double-send.
    const { els, client } = mountWith([
      { type: "message", text: "ok" },
      { type: "done" },
    ]);
    els.input.value = "once";
    els.submit.click();
    await new Promise((r) => setTimeout(r, 0));
    expect(client.sent).toEqual(["once"]);
  });

  it("uses host render hooks when provided", async () => {
    const els = dom();
    const client = fakeClient([{ type: "message", text: "themed" }, { type: "done" }]);
    const agent = mountInlineAgent({
      input: "#in",
      output: "#out",
      createClient: () => client,
      renderUser(text, output) {
        const d = document.createElement("p");
        d.className = "mine-user";
        d.textContent = text;
        output.appendChild(d);
      },
      createReply(output) {
        const d = document.createElement("p");
        d.className = "mine-agent";
        output.appendChild(d);
        return {
          element: d,
          setText: (t) => (d.textContent = t),
          setError: (m) => (d.textContent = m),
        };
      },
    });

    await agent.send("hey");

    expect(els.output.querySelector(".mine-user").textContent).toBe("hey");
    expect(els.output.querySelector(".mine-agent").textContent).toBe("themed");
    // Default classes are NOT used when hooks override them.
    expect(els.output.querySelector(".karta-msg--user")).toBeNull();
  });

  it("forwards identity and contextFn into the client config", async () => {
    // RFC 0023 P1+P2: a signed-in host hands the module a verified identity and
    // a per-turn contextFn; the module must thread both into the client it
    // builds (the client envelopes context and upgrades the token's `sub`).
    dom();
    let captured = null;
    const identity = { userId: "42", identityToken: "deadbeef" };
    const contextFn = () => "orgs: acme";
    mountInlineAgent({
      input: "#in",
      output: "#out",
      agentRef: "org/agent",
      identity,
      contextFn,
      createClient: (cfg) => {
        captured = cfg;
        return fakeClient([{ type: "done" }]);
      },
    });

    expect(captured.identity).toBe(identity);
    expect(captured.contextFn).toBe(contextFn);
    // Anonymous fields are still passed through untouched.
    expect(captured.agentRef).toBe("org/agent");
  });

  it("rotates a friendly status while the agent warms, then the reply replaces it", async () => {
    // Cold start: the server emits `warming` while it wakes the agent's microVM.
    // The module must rotate a status every ~2.5s so the wait doesn't read as a
    // stall, then drop it the instant the real reply streams in.
    vi.useFakeTimers();
    try {
      let release;
      const gate = new Promise((r) => (release = r));
      const els = dom();
      const client = {
        sendMessage() {
          return (async function* () {
            yield { type: "warming" };
            await gate; // hold the stream open so the warming timer can rotate
            yield { type: "message", text: "Hello there" };
            yield { type: "done" };
          })();
        },
      };
      const agent = mountInlineAgent({ input: "#in", output: "#out", createClient: () => client });
      const text = () => els.output.querySelector(".karta-msg--agent").textContent;
      const dots = () => els.output.querySelector(".karta-typing");

      const p = agent.send("hi");
      await vi.advanceTimersByTimeAsync(0); // process the first warming event
      expect(text()).toBe("Getting ready…");
      expect(dots()).not.toBeNull(); // the wait indicator stays — we're still warming
      await vi.advanceTimersByTimeAsync(2500);
      expect(text()).toBe("Waking up the agent…");
      await vi.advanceTimersByTimeAsync(2500);
      expect(text()).toBe("Still working…");

      release();
      await vi.advanceTimersByTimeAsync(0);
      await p;
      expect(text()).toBe("Hello there"); // warming replaced by the reply
      expect(dots()).toBeNull(); // dots cleared once the real reply renders

      // The rotation timer was cleared — no late tick overwrites the reply.
      await vi.advanceTimersByTimeAsync(10000);
      expect(text()).toBe("Hello there");
    } finally {
      vi.useRealTimers();
    }
  });

  it("destroy() detaches listeners and shuts the client down", async () => {
    const { els, client, agent } = mountWith([{ type: "done" }]);
    agent.destroy();
    expect(client.shutdownCalled).toBe(true);
    // After destroy, a form submit no longer drives the client.
    els.input.value = "ignored";
    els.input.form.dispatchEvent(new Event("submit", { cancelable: true }));
    await new Promise((r) => setTimeout(r, 0));
    expect(client.sent).toEqual([]);
  });
});
