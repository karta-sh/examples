// Vendored from @karta/widget — renderMarkdown/escapeHtml (the XSS boundary:
// HTML-escape first, then inject only a strict whitelist of safe tags; links
// are scheme-allowlisted to http/https/mailto). Source: sdks/widget/src/markdown.ts
// @ karta monorepo 169ef7c (@karta/widget@0.1.0). esbuild ESM, 2026-06-13. DO NOT EDIT.
// src/markdown.ts
function escapeHtml(input) {
  return input.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/"/g, "&quot;").replace(/'/g, "&#39;");
}
var SAFE_LINK_SCHEME = /^(https?:|mailto:)/i;
function isSafeUrl(escapedUrl) {
  const decoded = escapedUrl.replace(/&amp;/g, "&").replace(/&#39;/g, "'").replace(/&quot;/g, '"').replace(/[\u0000-\u0020]/g, "").trim();
  if (SAFE_LINK_SCHEME.test(decoded)) return true;
  return /^[a-z][a-z0-9+.-]*:/i.test(decoded) === false;
}
function stash(map, html) {
  const key = `\0PH${map.size}\0`;
  map.set(key, html);
  return key;
}
function restore(html, ph) {
  let out = html;
  for (const [key, val] of ph) out = out.split(key).join(val);
  return out;
}
function renderInline(text, ph) {
  let out = text.replace(
    /`([^`]+)`/g,
    (_m, code) => stash(ph, `<code>${escapeHtml(code)}</code>`)
  );
  out = out.replace(
    /\[([^\]]+)\]\(([^)\s]+)\)/g,
    (_m, label, url) => {
      const safeLabel = escapeHtml(label);
      const safeUrl = escapeHtml(url);
      if (!isSafeUrl(safeUrl)) return stash(ph, `${safeLabel} (${safeUrl})`);
      return stash(
        ph,
        `<a href="${safeUrl}" target="_blank" rel="noopener noreferrer">${safeLabel}</a>`
      );
    }
  );
  out = escapeHtml(out);
  out = out.replace(/\*\*([^*]+)\*\*/g, "<strong>$1</strong>");
  out = out.replace(/(?<![*\w])\*([^*\n]+)\*(?!\w)/g, "<em>$1</em>");
  return restore(out, ph);
}
function renderMarkdown(source) {
  if (!source) return "";
  const ph = /* @__PURE__ */ new Map();
  const withoutFences = source.replace(
    /```[^\n]*\n?([\s\S]*?)```/g,
    (_m, code) => {
      const body = code.replace(/\n$/, "");
      const tag = stash(ph, `<pre><code>${escapeHtml(body)}</code></pre>`);
      return `

${tag}

`;
    }
  );
  const blocks = withoutFences.split(/\n{2,}/);
  const htmlBlocks = [];
  for (const rawBlock of blocks) {
    const block = rawBlock.trim();
    if (!block) continue;
    if (ph.has(block)) {
      htmlBlocks.push(restore(block, ph));
      continue;
    }
    const lines = block.split("\n");
    const isUnordered = lines.every((l) => /^\s*[-*]\s+/.test(l));
    const isOrdered = lines.every((l) => /^\s*\d+\.\s+/.test(l));
    if (isUnordered) {
      const items = lines.map((l) => `<li>${renderInline(l.replace(/^\s*[-*]\s+/, ""), ph)}</li>`).join("");
      htmlBlocks.push(`<ul>${items}</ul>`);
      continue;
    }
    if (isOrdered) {
      const items = lines.map((l) => `<li>${renderInline(l.replace(/^\s*\d+\.\s+/, ""), ph)}</li>`).join("");
      htmlBlocks.push(`<ol>${items}</ol>`);
      continue;
    }
    const inner = lines.map((l) => renderInline(l, ph)).join("<br>");
    htmlBlocks.push(`<p>${inner}</p>`);
  }
  return htmlBlocks.join("\n");
}
export {
  escapeHtml,
  renderMarkdown
};
