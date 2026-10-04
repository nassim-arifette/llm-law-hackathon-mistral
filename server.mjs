// Counsel local relay: serves the pages and forwards the explanation draft to Mistral.
// The API key is read from the environment and never reaches the browser.
//
//   PowerShell:  $env:MISTRAL_API_KEY = "<your key>"; node server.mjs
//   then open    http://localhost:8787
//
// Optional: MISTRAL_MODEL (default mistral-large-latest), PORT (default 8787).

import { createServer } from "node:http";
import { readFile } from "node:fs/promises";
import { extname, join, normalize, sep } from "node:path";
import { fileURLToPath } from "node:url";

const ROOT = fileURLToPath(new URL(".", import.meta.url));
const PORT = Number(process.env.PORT) || Number((process.argv.find(a => a.startsWith("--port=")) || "").slice(7)) || 8787;
const KEY = (process.env.MISTRAL_API_KEY || "").trim().replace(/^["']|["']$/g, "");
const MODEL = process.env.MISTRAL_MODEL || "mistral-large-latest";
const BASE = process.env.MISTRAL_BASE || "https://api.mistral.ai";
const TYPES = { ".html": "text/html; charset=utf-8", ".css": "text/css; charset=utf-8", ".md": "text/markdown; charset=utf-8", ".js": "text/javascript; charset=utf-8", ".json": "application/json; charset=utf-8" };

const SYSTEM = `You write, on behalf of Banque Horizon, the answer to a customer who asked for an explanation of an automated credit decision (EU AI Act, Article 86: a clear and meaningful explanation of the role of the AI system and of the main elements of the decision).
Rules:
- Use ONLY the facts in the sealed log lines you are given. Never add a number, a date, a name or a fact that is not in them.
- Write every figure with digits, exactly as it appears in the lines (for example 412, 450, 41 %, 18 000).
- Plain, warm, precise English. No legal jargon, no article numbers, no legal advice.
- Address the customer exactly as "Dear Paul R.," with no title.
- Say what the system decided, the score and the threshold, the main factors, that a human analyst reviewed and confirmed it and when, and that the customer may ask for a new review if their situation has changed.
- At most 170 words. End with "Yours sincerely," then "Banque Horizon, Credit department" on the next line.
Return only the letter.`;

function json(res, code, body) {
  res.writeHead(code, { "content-type": "application/json; charset=utf-8", "cache-control": "no-store" });
  res.end(JSON.stringify(body));
}

async function readBody(req, limit = 64 * 1024) {
  let size = 0; const chunks = [];
  for await (const c of req) { size += c.length; if (size > limit) throw new Error("body too large"); chunks.push(c); }
  return JSON.parse(Buffer.concat(chunks).toString("utf8") || "{}");
}

async function explain(req, res) {
  if (!KEY) return json(res, 503, { error: "MISTRAL_API_KEY is not set on the relay" });
  let body;
  try { body = await readBody(req); } catch (e) { return json(res, 400, { error: String(e.message || e) }); }
  const lines = Array.isArray(body.lines) ? body.lines.filter(l => typeof l === "string").slice(0, 50) : [];
  const letter = typeof body.letter === "string" ? body.letter.slice(0, 4000) : "";
  if (!lines.length) return json(res, 400, { error: "no sealed lines" });
  const user = `The customer's letter:\n"""\n${letter}\n"""\n\nThe sealed log lines about this customer, in order:\n${lines.map(l => "- " + l).join("\n")}`;
  const ctrl = new AbortController(), timer = setTimeout(() => ctrl.abort(), 25000);
  try {
    const r = await fetch(`${BASE}/v1/chat/completions`, {
      method: "POST", signal: ctrl.signal,
      headers: { "content-type": "application/json", authorization: `Bearer ${KEY}` },
      body: JSON.stringify({ model: MODEL, temperature: 0.2, max_tokens: 500, messages: [{ role: "system", content: SYSTEM }, { role: "user", content: user }] })
    });
    const data = await r.json().catch(() => ({}));
    if (!r.ok) {
      const detail = data?.message || data?.detail || data?.error || null;
      console.log(`Mistral answered ${r.status}${detail ? ": " + JSON.stringify(detail) : ""}`);
      return json(res, 502, { error: `Mistral answered ${r.status}${r.status === 401 ? " (key not accepted: new keys can take a few minutes, and the key's workspace needs an active plan or credits)" : ""}`, detail });
    }
    const text = data?.choices?.[0]?.message?.content;
    if (typeof text !== "string" || !text.trim()) return json(res, 502, { error: "empty answer from Mistral" });
    return json(res, 200, { text: text.trim(), model: data.model || MODEL });
  } catch (e) {
    return json(res, 504, { error: e.name === "AbortError" ? "Mistral did not answer within 25 s" : String(e.message || e) });
  } finally { clearTimeout(timer); }
}

async function serveFile(req, res) {
  const url = new URL(req.url, "http://localhost");
  const rel = decodeURIComponent(url.pathname === "/" ? "/index.html" : url.pathname);
  const path = normalize(join(ROOT, rel));
  if (!path.startsWith(ROOT.endsWith(sep) ? ROOT : ROOT + sep)) { res.writeHead(403); return res.end(); }
  try {
    const data = await readFile(path);
    res.writeHead(200, { "content-type": TYPES[extname(path)] || "application/octet-stream", "cache-control": "no-store" });
    res.end(data);
  } catch { res.writeHead(404); res.end("not found"); }
}

createServer((req, res) => {
  if (req.url === "/api/health") return json(res, 200, { mistral: Boolean(KEY), model: MODEL, keyLength: KEY.length });
  if (req.url === "/api/explain" && req.method === "POST") return explain(req, res);
  if (req.method === "GET") return serveFile(req, res);
  res.writeHead(405); res.end();
}).listen(PORT, "127.0.0.1", () => {
  console.log(`Counsel on http://localhost:${PORT}  ·  Mistral ${KEY ? "ready (" + MODEL + ")" : "NOT configured: set MISTRAL_API_KEY"}`);
});
