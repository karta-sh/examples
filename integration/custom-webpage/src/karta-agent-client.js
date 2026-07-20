// Vendored from @karta/widget — KartaAgentClient (headless agent client).
// Source: sdks/widget/src/client.ts @ karta monorepo 0d16f9bc.
// Bundled with esbuild (--bundle --format=esm --target=es2020).
// Browser-safe: native fetch / ReadableStream / AbortController.
// DO NOT EDIT BY HAND — re-vendor per the example README ("Updating the vendored client").
var __defProp = Object.defineProperty;
var __defNormalProp = (obj, key, value) => key in obj ? __defProp(obj, key, { enumerable: true, configurable: true, writable: true, value }) : obj[key] = value;
var __publicField = (obj, key, value) => __defNormalProp(obj, typeof key !== "symbol" ? key + "" : key, value);

// sdks/widget/src/errors.ts
var KartaWidgetError = class extends Error {
  constructor(message, status, body) {
    super(message);
    __publicField(this, "status");
    __publicField(this, "body");
    this.name = "KartaWidgetError";
    this.status = status;
    this.body = body;
  }
};
var KartaWidgetAuthError = class extends KartaWidgetError {
  constructor(body, status = 401) {
    super("Unauthenticated \u2014 session token missing, invalid, or expired", status, body);
    this.name = "KartaWidgetAuthError";
  }
};
var KartaWidgetForbiddenError = class extends KartaWidgetError {
  constructor(body) {
    super("Forbidden \u2014 origin not allowed or caller lacks access", 403, body);
    this.name = "KartaWidgetForbiddenError";
  }
};
var KartaWidgetRateLimitedError = class extends KartaWidgetError {
  constructor(body, retryAfterSeconds = null) {
    super("Rate limited \u2014 too many requests", 429, body);
    // Surfaced from a 429 so a UI can show a "slow down" state. Retry-After
    // (seconds) is carried when the server sent it.
    __publicField(this, "retryAfterSeconds");
    this.name = "KartaWidgetRateLimitedError";
    this.retryAfterSeconds = retryAfterSeconds;
  }
};
var KartaWidgetLimitReachedError = class extends KartaWidgetError {
  // A plan / usage limit was hit. Distinct from a transient rate-limit so a
  // UI can show "upgrade / come back later" rather than "slow down". Carries
  // its own status because two server shapes map here: a raw 402, and the
  // public tier's anonymous spend cap which returns 429 with an explicit
  // `{error:"limit_reached"}` body (a HARD cap, not a transient throttle).
  constructor(body, status = 402) {
    super("Limit reached \u2014 plan or usage cap exceeded", status, body);
    this.name = "KartaWidgetLimitReachedError";
  }
};
var KartaWidgetNetworkError = class extends KartaWidgetError {
  // A transport-layer failure (fetch threw, body missing, connection
  // dropped). status is 0 because there is no HTTP status to report.
  constructor(message, cause) {
    super(message, 0, null);
    this.name = "KartaWidgetNetworkError";
    if (cause !== void 0) this.cause = cause;
  }
};
function errorForStatus(status, body, retryAfterSeconds = null) {
  if (status === 401) return new KartaWidgetAuthError(body);
  if (status === 403) return new KartaWidgetForbiddenError(body);
  if (status === 402) return new KartaWidgetLimitReachedError(body);
  if (status === 429) {
    const code = body && typeof body === "object" ? body.error : void 0;
    if (code === "limit_reached") return new KartaWidgetLimitReachedError(body, 429);
    return new KartaWidgetRateLimitedError(body, retryAfterSeconds);
  }
  const msg = body && typeof body === "object" && "message" in body && body.message ? body.message : `Karta widget API error ${status}`;
  return new KartaWidgetError(String(msg), status, body);
}

// sdks/widget/src/transport/internal.ts
async function safeJson(res) {
  const text = await res.text();
  if (text.length === 0) return null;
  try {
    return JSON.parse(text);
  } catch {
    return text;
  }
}
function parseRetryAfter(header) {
  if (!header) return null;
  const n = Number(header);
  return Number.isFinite(n) ? n : null;
}
function mapUsage(raw) {
  if (!raw || typeof raw !== "object") return void 0;
  const num = (v) => typeof v === "number" ? v : void 0;
  return {
    inputTokens: num(raw.input_tokens),
    outputTokens: num(raw.output_tokens),
    totalTokens: num(raw.total_tokens),
    raw
  };
}

// sdks/widget/src/auth.ts
var REFRESH_SKEW_MS = 3e4;
var TokenProvider = class {
  constructor(opts) {
    __publicField(this, "opts");
    __publicField(this, "cached", null);
    __publicField(this, "expiresAt", null);
    // epoch ms, or null = unknown
    __publicField(this, "inFlight", null);
    const sources = [opts.token, opts.tokenFn, opts.tokenEndpoint, opts.embedKey].filter(
      (s) => s !== void 0
    );
    if (sources.length === 0) {
      throw new KartaWidgetError(
        "KartaAgentClient: one of `token`, `tokenFn`, `tokenEndpoint`, or `embedKey` is required.",
        0,
        null
      );
    }
    this.opts = opts;
  }
  // Return a usable token. Reuses the cache unless it is missing, near
  // expiry, or `force` is set (used after a 401). Concurrent callers share
  // a single in-flight mint.
  async getToken(force = false) {
    if (!force && this.cached && !this.isExpiring()) {
      return this.cached;
    }
    if (this.inFlight) return this.inFlight;
    this.inFlight = this.mint(force).finally(() => {
      this.inFlight = null;
    });
    return this.inFlight;
  }
  // Drop the cached token so the next getToken() re-mints. Called by a
  // transport when the server rejects the current token with a 401.
  invalidate() {
    this.cached = null;
    this.expiresAt = null;
  }
  // Update the verified-identity carried on embed-key mints. Called when a
  // host changes identity via client.identify() after construction.
  setIdentity(identity) {
    this.opts.identity = identity;
  }
  isExpiring() {
    if (this.expiresAt === null) return false;
    return Date.now() >= this.expiresAt - REFRESH_SKEW_MS;
  }
  async mint(force) {
    const { token, tokenFn, tokenEndpoint, embedKey } = this.opts;
    if (token !== void 0) {
      this.cached = token;
      this.expiresAt = null;
      return token;
    }
    if (tokenFn !== void 0) {
      const t = await tokenFn({ force });
      this.cached = t;
      this.expiresAt = decodeExpiry(t);
      return t;
    }
    if (tokenEndpoint !== void 0) {
      const body2 = await this.fetchJson(tokenEndpoint, { method: "GET" });
      return this.adopt(body2);
    }
    const mintBody = { embed_key: embedKey };
    if (this.opts.identity?.userId) {
      mintBody.user_id = this.opts.identity.userId;
    }
    if (this.opts.identity?.identityToken) {
      mintBody.identity_token = this.opts.identity.identityToken;
    }
    const url = `${this.opts.baseUrl}/v1/embed/session-tokens`;
    const body = await this.fetchJson(url, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(mintBody)
    });
    return this.adopt(body);
  }
  // Pull `{ token, expires_in?, expires_at? }` out of a mint response and
  // cache it.
  adopt(body) {
    const t = body.token;
    if (typeof t !== "string" || t.length === 0) {
      throw new KartaWidgetAuthError(body ?? null);
    }
    this.cached = t;
    this.expiresAt = expiryFromBody(body) ?? decodeExpiry(t);
    return t;
  }
  async fetchJson(url, init) {
    let res;
    try {
      res = await this.opts.fetch(url, init);
    } catch (err) {
      throw new KartaWidgetNetworkError(`Token request to ${url} failed`, err);
    }
    const text = await res.text();
    let parsed = null;
    if (text.length > 0) {
      try {
        parsed = JSON.parse(text);
      } catch {
        parsed = text;
      }
    }
    if (!res.ok) {
      const retryAfter = parseRetryAfter(res.headers.get("retry-after"));
      throw errorForStatus(res.status, parsed, retryAfter);
    }
    return parsed && typeof parsed === "object" ? parsed : {};
  }
};
function expiryFromBody(body) {
  const expiresIn = body.expires_in;
  if (typeof expiresIn === "number" && expiresIn > 0) {
    return Date.now() + expiresIn * 1e3;
  }
  const expiresAt = body.expires_at;
  if (typeof expiresAt === "number" && expiresAt > 0) {
    return expiresAt < 1e12 ? expiresAt * 1e3 : expiresAt;
  }
  return null;
}
function decodeExpiry(token) {
  const parts = token.split(".");
  if (parts.length !== 3) return null;
  try {
    const json = base64UrlDecode(parts[1]);
    const claims = JSON.parse(json);
    if (typeof claims.exp === "number" && claims.exp > 0) {
      return claims.exp * 1e3;
    }
  } catch {
    return null;
  }
  return null;
}
function base64UrlDecode(input) {
  const b64 = input.replace(/-/g, "+").replace(/_/g, "/");
  const pad = b64.length % 4 === 0 ? "" : "=".repeat(4 - b64.length % 4);
  const normalized = b64 + pad;
  if (typeof atob !== "function") return "";
  return atob(normalized);
}

// sdks/widget/src/agentRef.ts
var SLUG = /^[a-z0-9](?:[a-z0-9-]{0,61}[a-z0-9])?$/;
function parseAgentRef(ref) {
  const parts = ref.split("/");
  if (parts.length === 2 && SLUG.test(parts[0]) && SLUG.test(parts[1])) {
    return { org: parts[0], agent: parts[1] };
  }
  throw new KartaWidgetError(
    `Invalid agent ref ${JSON.stringify(ref)} \u2014 expected the combined "org/agent" pair (two lowercase slug segments separated by one "/"), e.g. "coffeeco/support-bot".`,
    0,
    null
  );
}

// sdks/widget/src/sse.ts
async function* parseSSE(stream, signal) {
  if (!stream) {
    throw new Error("parseSSE: response has no body to read");
  }
  if (signal?.aborted) return;
  const reader = stream.getReader();
  const decoder = new TextDecoder();
  let buffer = "";
  const onAbort = () => {
    void reader.cancel().catch(() => void 0);
  };
  signal?.addEventListener("abort", onAbort, { once: true });
  try {
    for (; ; ) {
      let result;
      try {
        result = await reader.read();
      } catch {
        return;
      }
      if (result.done) break;
      if (signal?.aborted) return;
      buffer += decoder.decode(result.value, { stream: true });
      const blocks = buffer.split("\n\n");
      buffer = blocks.pop() ?? "";
      for (const block of blocks) {
        const msg = decodeBlock(block);
        if (msg) yield msg;
      }
    }
    const tail = decodeBlock(buffer);
    if (tail) yield tail;
  } finally {
    signal?.removeEventListener("abort", onAbort);
    reader.releaseLock();
  }
}
function decodeBlock(block) {
  let event = "message";
  const dataLines = [];
  for (const rawLine of block.split("\n")) {
    const line = rawLine.replace(/\r$/, "");
    if (line === "" || line.startsWith(":")) continue;
    const colon = line.indexOf(":");
    const field = colon === -1 ? line : line.slice(0, colon);
    let value = colon === -1 ? "" : line.slice(colon + 1);
    if (value.startsWith(" ")) value = value.slice(1);
    if (field === "event") event = value;
    else if (field === "data") dataLines.push(value);
  }
  if (dataLines.length === 0) return null;
  return { event, data: dataLines.join("\n") };
}
function decodeEvent(msg) {
  try {
    return JSON.parse(msg.data);
  } catch {
    return null;
  }
}

// sdks/widget/src/transport/managedAgents.ts
var ManagedAgentsTransport = class {
  constructor(opts) {
    this.opts = opts;
    // The highest `seq` observed across the session. Exposed so the client
    // can resume a stream via ?after=<lastSeq>.
    __publicField(this, "lastSeq", 0);
  }
  base() {
    const { org, agent } = parseAgentRef(this.opts.agentRef);
    return `${this.opts.baseUrl}/${org}/${agent}/v1/managed-agents/sessions`;
  }
  async createSession(metadata) {
    const body = await this.authedJson(this.base(), {
      method: "POST",
      // The server route ignores the body today (T9/T10 will read
      // metadata server-side), but we send it so soft identity travels
      // with session creation as designed.
      jsonBody: metadata ? { metadata } : void 0
    });
    const id = body.id;
    if (typeof id !== "string" || id.length === 0) {
      throw new KartaWidgetNetworkError(
        "createSession: server response missing session id"
      );
    }
    return id;
  }
  async postUserMessage(sessionId, text) {
    await this.postEvent(sessionId, { type: "user.message", text });
  }
  // RFC 0030 — `decision` is the harness's own option id (approve_once /
  // approve_session / deny), relayed verbatim; the data plane maps it to the
  // harness decision (and persists approve_session). Older callers' boolean is
  // gone, but the data plane still accepts "allow" as a back-compat alias.
  async confirmTool(sessionId, requestId, decision) {
    await this.postEvent(sessionId, {
      type: "user.tool_confirmation",
      request_id: requestId,
      result: decision
    });
  }
  async interrupt(sessionId) {
    await this.postEvent(sessionId, { type: "user.interrupt" });
  }
  // The end-user's past conversations for a sidebar (RFC 0015 Phase 2).
  // `endUser` scopes the list; the server treats it as authoritative only
  // for an anonymous caller (a verified token uses its signed subject).
  async listSessions(endUser) {
    const q = endUser ? `?end_user=${encodeURIComponent(endUser)}` : "";
    const body = await this.authedJson(`${this.base()}${q}`, { method: "GET" });
    const data = body.data;
    if (!Array.isArray(data)) return [];
    return data.map((s) => {
      const row = s;
      return {
        id: String(row.id ?? ""),
        title: typeof row.title === "string" ? row.title : "",
        createdAt: typeof row.created_at === "string" ? row.created_at : "",
        lastActivityAt: typeof row.last_activity_at === "string" ? row.last_activity_at : ""
      };
    });
  }
  // The compacted transcript for reopening a past conversation. The server
  // messages already carry the render-ready part shape, so they pass through.
  // `endUser` must match the session's owner (server enforces it against the
  // durable record); a verified token uses its signed subject instead.
  async getTranscript(sessionId, endUser) {
    const q = endUser ? `?end_user=${encodeURIComponent(endUser)}` : "";
    const url = `${this.base()}/${encodeURIComponent(sessionId)}/transcript${q}`;
    const body = await this.authedJson(url, { method: "GET" });
    const messages = body.messages;
    return Array.isArray(messages) ? messages : [];
  }
  // Rebuild the cursor from an existing session's full event history (used
  // by resume()). GETs the session object whose `events` array carries the
  // logged events; advances lastSeq to the max seq seen and returns the
  // history mapped to normalized AgentEvents so a UI can rebuild its
  // transcript after a reload.
  async loadSessionCursor(sessionId) {
    const url = `${this.base()}/${encodeURIComponent(sessionId)}`;
    const body = await this.authedJson(url, { method: "GET" });
    const events = body.events;
    const history = [];
    if (Array.isArray(events)) {
      for (const e of events) {
        const wire = e;
        const seq = wire.seq;
        if (typeof seq === "number" && seq > this.lastSeq) this.lastSeq = seq;
        const normalized = mapWireEvent(wire);
        if (normalized) history.push(normalized);
      }
    }
    return history;
  }
  // Stream a turn from the cursor, normalizing wire events to AgentEvents
  // and advancing lastSeq. The server stream closes at a terminal event,
  // so this generator ends naturally when the turn is done/errored.
  async *streamTurn(sessionId, fromSeq, signal) {
    const url = `${this.base()}/${encodeURIComponent(sessionId)}/events/stream?after=${encodeURIComponent(String(fromSeq))}`;
    const res = await this.authedStream(url, signal);
    for await (const msg of parseSSE(res.body, signal)) {
      const wire = decodeEvent(msg);
      if (!wire) continue;
      if (typeof wire.seq === "number" && wire.seq > this.lastSeq) {
        this.lastSeq = wire.seq;
      }
      const normalized = mapWireEvent(wire);
      if (normalized) yield normalized;
    }
  }
  async postEvent(sessionId, payload) {
    const url = `${this.base()}/${encodeURIComponent(sessionId)}/events`;
    await this.authedJson(url, { method: "POST", jsonBody: payload });
  }
  // RFC 0015 Phase 3: stage an end-user upload for the session. Returns the
  // workspace-relative path the server assigned (the bytes are injected into
  // the microVM workspace on the next turn). `contentBase64` is the file bytes.
  async uploadFile(sessionId, name, contentBase64) {
    const url = `${this.base()}/${encodeURIComponent(sessionId)}/files`;
    const body = await this.authedJson(url, {
      method: "POST",
      jsonBody: { name, content_base64: contentBase64 }
    });
    const path = body.path;
    return typeof path === "string" ? path : `uploads/${name}`;
  }
  // A JSON request that attaches a fresh bearer token and retries ONCE on
  // a 401 with a force-minted token (a session token can lapse between
  // calls). Non-401 failures map to typed errors.
  async authedJson(url, init) {
    return this.withTokenRetry(async (token) => {
      const headers = { Authorization: `Bearer ${token}` };
      let body;
      if (init.jsonBody !== void 0) {
        headers["Content-Type"] = "application/json";
        body = JSON.stringify(init.jsonBody);
      }
      let res;
      try {
        res = await this.opts.fetch(url, { method: init.method, headers, body });
      } catch (err) {
        throw new KartaWidgetNetworkError(`Request to ${url} failed`, err);
      }
      return res;
    }, async (res) => {
      const text = await res.text();
      let parsed = null;
      if (text.length > 0) {
        try {
          parsed = JSON.parse(text);
        } catch {
          parsed = text;
        }
      }
      return parsed;
    });
  }
  // A streaming request with the same single-401-retry policy. Returns the
  // raw Response so the caller reads `body` as a stream.
  async authedStream(url, signal) {
    const result = await this.withTokenRetry(async (token) => {
      let res;
      try {
        res = await this.opts.fetch(url, {
          method: "GET",
          headers: { Authorization: `Bearer ${token}`, Accept: "text/event-stream" },
          signal
        });
      } catch (err) {
        throw new KartaWidgetNetworkError(`Stream request to ${url} failed`, err);
      }
      return res;
    });
    return result;
  }
  // Shared retry harness: mint a token, run `send`, and if the response is
  // a 401, invalidate + re-mint once and retry. On a non-2xx that is not a
  // retryable 401, throw the typed error. When `readBody` is provided the
  // parsed JSON is returned; otherwise the raw ok Response is returned.
  async withTokenRetry(send, readBody) {
    for (let attempt = 0; attempt < 2; attempt++) {
      const force = attempt === 1;
      const token = await this.opts.tokens.getToken(force);
      const res = await send(token);
      if (res.status === 401 && attempt === 0) {
        this.opts.tokens.invalidate();
        continue;
      }
      if (!res.ok) {
        const errBody = readBody ? await readBody(res) : await safeJson(res);
        const retryAfter = parseRetryAfter(res.headers.get("retry-after"));
        throw errorForStatus(res.status, errBody, retryAfter);
      }
      return readBody ? readBody(res) : res;
    }
    throw new KartaWidgetNetworkError("Request failed after token refresh");
  }
};
function mapWireEvent(wire) {
  const seq = typeof wire.seq === "number" ? wire.seq : void 0;
  switch (wire.type) {
    case "session.status_running":
      return { type: "status", status: "running", seq };
    case "agent.message":
      return { type: "message", text: wire.text ?? "", partId: wire.part_id, delta: wire.delta === true, seq };
    case "agent.thinking":
      return { type: "thinking", text: wire.text ?? "", partId: wire.part_id, delta: wire.delta === true, seq };
    case "agent.tool_use":
      return { type: "tool_use", toolUseId: wire.tool_use_id, tool: wire.tool, input: wire.input, seq };
    case "agent.tool_result":
      return {
        type: "tool_result",
        toolUseId: wire.tool_use_id,
        output: wire.output,
        isError: wire.is_error,
        ...wire._meta !== void 0 ? { meta: wire._meta } : {},
        seq
      };
    case "session.status_idle": {
      if (wire.stop_reason === "requires_action") {
        return {
          type: "input_required",
          requestId: wire.request_id ?? "",
          tool: wire.tool,
          target: wire.target,
          options: wire.options,
          seq
        };
      }
      return { type: "done", usage: mapUsage(wire.usage), seq };
    }
    case "session.error":
      return { type: "error", message: wire.message ?? "error", code: wire.code, seq };
    default:
      return null;
  }
}

// sdks/widget/src/transport/responses.ts
var ResponsesTransport = class {
  constructor(opts) {
    this.opts = opts;
    // The previous_response_id continues the same server-side session on the
    // next turn. Updated when a response completes.
    __publicField(this, "previousResponseId", null);
  }
  // Adopt an existing conversation by id so subsequent turns continue it.
  setPreviousResponseId(id) {
    this.previousResponseId = id;
  }
  // Run a turn: POST the input with stream:true, then normalize the SSE
  // into AgentEvents (accumulated message text, then done/error).
  async *sendMessage(text, signal) {
    const { org, agent } = parseAgentRef(this.opts.agentRef);
    const url = `${this.opts.baseUrl}/${org}/${agent}/v1/responses`;
    const body = { input: text, stream: true, store: true };
    if (this.previousResponseId) body.previous_response_id = this.previousResponseId;
    if (this.opts.model) body.model = this.opts.model;
    const res = await this.authedStream(url, JSON.stringify(body), signal);
    let accumulated = "";
    for await (const msg of parseSSE(res.body, signal)) {
      const wire = decodeEvent(msg);
      if (!wire) continue;
      switch (wire.type) {
        case "response.output_text.delta": {
          accumulated += wire.delta ?? "";
          yield { type: "message", text: accumulated };
          break;
        }
        case "response.completed": {
          const id = wire.response?.id;
          if (typeof id === "string") this.previousResponseId = id;
          yield { type: "done", usage: mapUsage(wire.response?.usage) };
          return;
        }
        case "response.failed": {
          const err = wire.response?.error;
          yield { type: "error", message: err?.message ?? "response failed", code: err?.code };
          return;
        }
      }
    }
  }
  // POST a streaming turn with a bearer token, retrying ONCE on a 401 with
  // a force-minted token. Returns the raw Response so the caller streams
  // the body.
  async authedStream(url, jsonBody, signal) {
    for (let attempt = 0; attempt < 2; attempt++) {
      const force = attempt === 1;
      const token = await this.opts.tokens.getToken(force);
      let res;
      try {
        res = await this.opts.fetch(url, {
          method: "POST",
          headers: {
            Authorization: `Bearer ${token}`,
            "Content-Type": "application/json",
            Accept: "text/event-stream"
          },
          body: jsonBody,
          signal
        });
      } catch (err) {
        throw new KartaWidgetNetworkError(`Stream request to ${url} failed`, err);
      }
      if (res.status === 401 && attempt === 0) {
        this.opts.tokens.invalidate();
        continue;
      }
      if (!res.ok) {
        const errBody = await safeJson(res);
        throw errorForStatus(res.status, errBody);
      }
      return res;
    }
    throw new KartaWidgetNetworkError("Responses request failed after token refresh");
  }
};

// sdks/widget/src/client.ts
var KartaAgentClient = class {
  constructor(opts) {
    __publicField(this, "baseUrl");
    __publicField(this, "agentRef");
    __publicField(this, "transportKind");
    __publicField(this, "tokens");
    __publicField(this, "ma");
    __publicField(this, "responses");
    __publicField(this, "_sessionId", null);
    __publicField(this, "identity");
    __publicField(this, "contextFn");
    // One controller per client instance; shutdown() aborts everything in
    // flight. A fresh controller is minted after shutdown so the same
    // instance can be reused if desired (the spec only requires abort+close).
    __publicField(this, "controller", new AbortController());
    __publicField(this, "closed", false);
    if (!opts.baseUrl) throw new KartaWidgetError("KartaAgentClient: `baseUrl` is required.", 0, null);
    if (!opts.agentRef) {
      throw new KartaWidgetError("KartaAgentClient: `agentRef` is required.", 0, null);
    }
    parseAgentRef(opts.agentRef);
    this.baseUrl = opts.baseUrl.replace(/\/+$/, "");
    this.agentRef = opts.agentRef;
    this.transportKind = opts.transport ?? "managed-agents";
    this.identity = opts.identity ? { ...opts.identity } : {};
    this.contextFn = opts.contextFn;
    const fetchImpl = resolveFetch(opts.fetch);
    this.tokens = new TokenProvider({
      baseUrl: this.baseUrl,
      embedKey: opts.embedKey,
      token: opts.token,
      tokenFn: opts.tokenFn,
      tokenEndpoint: opts.tokenEndpoint,
      identity: this.identity,
      fetch: fetchImpl
    });
    const shared = {
      baseUrl: this.baseUrl,
      agentRef: this.agentRef,
      tokens: this.tokens,
      fetch: fetchImpl
    };
    if (this.transportKind === "responses") {
      this.responses = new ResponsesTransport({ ...shared, model: opts.model });
      this.ma = null;
    } else {
      this.ma = new ManagedAgentsTransport(shared);
      this.responses = null;
    }
  }
  // The active Managed-Agents session id, or null before the first
  // createSession()/resume(). PUBLIC so a UI can persist it for reload
  // continuity (the identity-keyed resume in the widget) without reaching
  // into a private field. Always null for the session-implicit Responses
  // transport.
  get sessionId() {
    return this._sessionId;
  }
  // Open a fresh session. Managed Agents only — the Responses transport is
  // session-implicit (the server opens/continues a session per turn), so
  // calling this on a Responses client is a no-op returning an empty id.
  async createSession() {
    this.assertOpen();
    if (!this.ma) {
      return { sessionId: "" };
    }
    const id = await this.ma.createSession(this.sessionMetadata());
    this._sessionId = id;
    return { sessionId: id };
  }
  // Send a user message and stream the turn until done/error. Ensures a
  // session exists first (Managed Agents), posts the message, then streams
  // from the current cursor — advancing it as events arrive so a later
  // resume() / stream() picks up where this left off.
  async *sendMessage(text) {
    this.assertOpen();
    const signal = this.controller.signal;
    const outgoing = await this.applyContext(text);
    if (this.responses) {
      yield* this.responses.sendMessage(outgoing, signal);
      return;
    }
    const ma = this.ma;
    if (!this._sessionId) {
      await this.createSession();
    }
    let sid = this._sessionId;
    let fromSeq = ma.lastSeq;
    try {
      await ma.postUserMessage(sid, outgoing);
    } catch (err) {
      if (err instanceof KartaWidgetError && err.status === 404) {
        this._sessionId = null;
        await this.createSession();
        sid = this._sessionId;
        fromSeq = ma.lastSeq;
        await ma.postUserMessage(sid, outgoing);
      } else {
        throw err;
      }
    }
    yield* ma.streamTurn(sid, fromSeq, signal);
  }
  // The RFC 0012 buffer extension: wrap the outgoing wire text with the
  // host's current context. Applied per turn (the host's state changes
  // between turns) and only on the wire — callers render `text` as the
  // user bubble. A throwing or empty contextFn degrades to plain text:
  // context is an enhancement, never a reason to drop a message.
  //
  // The envelope is the trust boundary: agents are instructed that
  // everything inside is DATA. Context content must therefore never be
  // able to FORGE the closing tag — pasted third-party text containing
  // `</session-context>` would otherwise break out and be read with
  // user-request trust. Neutralize the sentinel inside the payload.
  async applyContext(text) {
    if (!this.contextFn) return text;
    let ctx;
    try {
      ctx = await this.contextFn();
    } catch {
      return text;
    }
    if (!ctx) return text;
    const safe = ctx.replace(/<(\/?)session-context>/gi, "&lt;$1session-context&gt;");
    return `<session-context>
${safe}
</session-context>

${text}`;
  }
  // Low-level resume of an in-flight turn from a cursor (Managed Agents).
  // Defaults to the client's tracked lastSeq. Useful after a reload: call
  // resume(sessionId) then stream() to re-attach to a running turn.
  async *stream(fromSeq) {
    this.assertOpen();
    if (!this.ma) {
      throw new KartaWidgetError(
        "stream(): cursor-based resume is only supported by the managed-agents transport.",
        0,
        null
      );
    }
    if (!this._sessionId) {
      throw new KartaWidgetError("stream(): no active session \u2014 call createSession() or resume() first.", 0, null);
    }
    const from = fromSeq ?? this.ma.lastSeq;
    yield* this.ma.streamTurn(this._sessionId, from, this.controller.signal);
  }
  // Adopt an existing session (e.g. restored from storage after a reload)
  // and rebuild the cursor from its event history so a subsequent stream()
  // resumes from the right point. Returns the session's prior events as
  // normalized AgentEvents so a UI can rebuild its transcript.
  async resume(sessionId) {
    this.assertOpen();
    if (!this.ma) {
      throw new KartaWidgetError(
        "resume(): session resume is only supported by the managed-agents transport.",
        0,
        null
      );
    }
    this._sessionId = sessionId;
    return this.ma.loadSessionCursor(sessionId);
  }
  // The end-user's past conversations (RFC 0015 Phase 2), newest first, for a
  // session sidebar. Scoped by the client's identity (the anonymous visitor id
  // or the verified subject). Empty for the Responses transport.
  async listSessions() {
    this.assertOpen();
    if (!this.ma) return [];
    return this.ma.listSessions(this.identity.userId);
  }
  // Reopen a past conversation: load its compacted transcript for display and
  // adopt the session so the NEXT sendMessage continues it (the server resumes
  // the underlying harness session). The durable transcript is for display; the
  // cursor must be advanced to the server event log's HIGH-WATER seq — NOT reset
  // to 0. The live event log is process-global and accumulates every prior turn;
  // it outlives a browser reload, so streaming a new turn from after=0 would
  // replay every buffered turn one-per-send (one stale answer surfaces per new
  // message until the cursor catches up). loadSessionCursor reads the current
  // event log and sets lastSeq to its max seq; if the log was lost (server
  // restart) it stays 0, which is also correct — a fresh turn then streams from 0.
  async openSession(sessionId) {
    this.assertOpen();
    if (!this.ma) {
      throw new KartaWidgetError("openSession(): only the managed-agents transport.", 0, null);
    }
    const transcript = await this.ma.getTranscript(sessionId, this.identity.userId);
    this._sessionId = sessionId;
    this.ma.lastSeq = 0;
    try {
      await this.ma.loadSessionCursor(sessionId);
    } catch {
    }
    return transcript;
  }
  // Start a fresh conversation: drop the active session so the next
  // sendMessage opens a new one.
  newSession() {
    this.assertOpen();
    this._sessionId = null;
    if (this.ma) this.ma.lastSeq = 0;
  }
  // Respond to an `input_required` pause. The server resolves the pending
  // tool and continues the turn on the same session; a caller should
  // stream() afterward to read the continuation. `decision` is the harness
  // option id from the event's `options` (approve_once / approve_session /
  // deny), relayed verbatim — the harness owns persistence (RFC 0030).
  async confirmTool(requestId, decision) {
    this.assertOpen();
    if (!this.ma) {
      throw new KartaWidgetError(
        "confirmTool(): tool confirmation is only supported by the managed-agents transport.",
        0,
        null
      );
    }
    if (!this._sessionId) {
      throw new KartaWidgetError("confirmTool(): no active session.", 0, null);
    }
    await this.ma.confirmTool(this._sessionId, requestId, decision);
  }
  // Ask the server to stop the current turn (Managed Agents). The Responses
  // transport has no server-side interrupt; abort the stream instead.
  async interrupt() {
    this.assertOpen();
    if (!this.ma || !this._sessionId) return;
    await this.ma.interrupt(this._sessionId);
  }
  // RFC 0015 Phase 3: upload a file to the session. The bytes (`contentBase64`)
  // are staged server-side and injected into the agent's microVM working
  // directory on the next turn; returns the workspace-relative path. Creates a
  // session first if none exists. Managed Agents only.
  async uploadFile(name, contentBase64) {
    this.assertOpen();
    if (!this.ma) {
      throw new KartaWidgetError(
        "uploadFile(): file upload is only supported by the managed-agents transport.",
        0,
        null
      );
    }
    if (!this._sessionId) await this.createSession();
    return this.ma.uploadFile(this._sessionId, name, contentBase64);
  }
  // RFC 0015 Phase 5: per-request headers for the MCP App proxy host
  // (assistant-ui's McpAppsRemoteHost). The bearer token authenticates the
  // relay; `X-Karta-Session` scopes it to the active session's microVM (which
  // holds the MCP connection). Errors degrade to no auth header — the proxy
  // 401s and the renderer shows its error fallback, never throwing.
  async mcpHeaders() {
    const headers = {};
    if (this._sessionId) headers["X-Karta-Session"] = this._sessionId;
    try {
      const token = await this.tokens.getToken();
      if (token) headers["Authorization"] = `Bearer ${token}`;
    } catch {
    }
    return headers;
  }
  // Set SOFT identity (userId/attributes) and an optional VERIFIED
  // identityToken. Soft fields are advisory only — they travel as session
  // metadata on the NEXT createSession and MUST NEVER be used as an auth
  // credential server-side (a page can set any value). The verified
  // identityToken flows to the TokenProvider; its validation is T9/T10.
  identify(user) {
    this.identity = {
      userId: user.userId ?? this.identity.userId,
      attributes: user.attributes ?? this.identity.attributes,
      identityToken: user.identityToken ?? this.identity.identityToken
    };
    this.tokens.setIdentity(this.identity);
  }
  // Abort all in-flight requests/streams and mark the client closed.
  // In-flight generators stop because their fetch signal aborts.
  shutdown() {
    if (this.closed) return;
    this.closed = true;
    this.controller.abort();
  }
  // Build the metadata sent on createSession. `metadata.user_id` is the
  // EFFECTIVE end-user identity (PRD §3):
  //   - VERIFIED  → the userId the host HMAC-signed (== the token's `sub`).
  //                 It MUST equal `sub` or the server rejects the create
  //                 (T10 resolve_end_user: 403 identity_mismatch). The
  //                 caller passes the SAME userId via identify()/options as
  //                 it signed, so this binding holds.
  //   - SOFT      → the declared userId (advisory continuity only).
  //   - ANONYMOUS → the per-browser visitor id (the widget passes it as
  //                 userId; advisory continuity only).
  // In every soft/anonymous case the value is NON-authoritative server-side
  // (the verified `sub`, not metadata, gates per-user memory/credentials).
  sessionMetadata() {
    const meta = {};
    if (this.identity.userId !== void 0) meta.user_id = this.identity.userId;
    if (this.identity.attributes !== void 0) meta.attributes = this.identity.attributes;
    return Object.keys(meta).length > 0 ? meta : void 0;
  }
  assertOpen() {
    if (this.closed) {
      throw new KartaWidgetError("KartaAgentClient: client has been shut down.", 0, null);
    }
  }
};
function resolveFetch(injected) {
  const f = injected ?? globalThis.fetch;
  if (!f) {
    throw new KartaWidgetError(
      "KartaAgentClient: no `fetch` available. Pass one via the `fetch` option (Node <18 / SSR).",
      0,
      null
    );
  }
  return f.bind(globalThis);
}
export {
  KartaAgentClient
};
