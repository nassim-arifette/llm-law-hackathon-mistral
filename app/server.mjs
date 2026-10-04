// Counsel app server: serves the interface and the API, keeps the Mistral key, the private bodies and their salts.
//
//   node app/server.mjs            then open http://localhost:8791
//
// Settings, from the environment or from app/.env (never committed):
//   MISTRAL_API_KEY   the Assistant answers with Mistral when it is set, by rules otherwise
//   MISTRAL_MODEL     default mistral-large-latest
//   JUSLIB_URL        the JUSLIB library service (github.com/vgactech/JUSBIB), default http://127.0.0.1:8765
//   PORT or --port=N  default 8791
import { createServer } from "node:http";
import { readFile } from "node:fs/promises";
import { readFileSync, existsSync } from "node:fs";
import { extname, join, normalize, sep } from "node:path";
import { fileURLToPath } from "node:url";

const ENV_FILE = fileURLToPath(new URL("./.env", import.meta.url));
if (existsSync(ENV_FILE)) {
  for (const line of readFileSync(ENV_FILE, "utf8").split(/\r?\n/)) {
    const m = line.match(/^\s*([A-Z0-9_]+)\s*=\s*(.*?)\s*$/);
    if (m && !process.env[m[1]]) process.env[m[1]] = m[2].replace(/^["']|["']$/g, "");
  }
}

const L = await import("./lib/ledger.mjs");
const G = await import("./lib/glossary.mjs");
const J = await import("./lib/juslib.mjs");
const { agenda } = await import("./lib/agenda.mjs");
const { chat, mistralStatus } = await import("./lib/assistant.mjs");

if (!L.hasSeed()) { console.error("data/case.json is missing: run node app/scripts/seed.mjs once."); process.exit(1); }

const PUBLIC = fileURLToPath(new URL("./public/", import.meta.url));
const PORT = Number(process.env.PORT) || Number((process.argv.find(a => a.startsWith("--port=")) || "").slice(7)) || 8791;
const TYPES = { ".html": "text/html; charset=utf-8", ".css": "text/css; charset=utf-8", ".js": "text/javascript; charset=utf-8", ".json": "application/json; charset=utf-8", ".svg": "image/svg+xml" };

// JUSLIB: import the glossary once the library answers; retry until it does.
const glossaryEntries = G.ENTRIES.filter(e => !e.core);
async function connectJuslib() {
  const s = await J.connect(glossaryEntries, G.SOURCES, G.CORPUS_VERSION);
  if (s.on) { G.addCore(J.coreTerms()); console.log(`JUSLIB ${s.version} connected at ${s.url}: ${s.imported} explanations imported, ${s.core_terms} core terms`); }
  else setTimeout(connectJuslib, 30000);
}

const json = (res, code, body, extra = {}) => { res.writeHead(code, { "content-type": "application/json; charset=utf-8", "cache-control": "no-store", ...extra }); res.end(JSON.stringify(body)); };
async function readBody(req, limit = 64 * 1024) {
  let size = 0; const chunks = [];
  for await (const c of req) { size += c.length; if (size > limit) throw new Error("body too large"); chunks.push(c); }
  return JSON.parse(Buffer.concat(chunks).toString("utf8") || "{}");
}
const publicCase = lang => { const { case_salt, ...c } = L.caseInfo(lang); return c; };
const head = () => { const all = L.all(); return { length: all.length, head: all.at(-1).entry_hash }; };

async function api(req, res, url) {
  const profile = L.PROFILES[req.headers["x-profile"]] ? req.headers["x-profile"] : "individual";
  const lang = req.headers["x-lang"] === "fr" ? "fr" : "en";
  const route = `${req.method} ${url.pathname}`;

  if (route === "GET /api/bootstrap")
    return json(res, 200, { profiles: L.PROFILES, actors: L.actors(lang), case: publicCase(lang), mistral: mistralStatus(), juslib: J.status(),
      glossary: { corpus_version: G.CORPUS_VERSION, terms: G.ENTRIES.length }, ledger: head() });

  if (route === "GET /api/agenda") return json(res, 200, { items: agenda(profile, lang) });

  if (route === "GET /api/events")
    return json(res, 200, { events: L.all().map(ev => L.view(ev, profile, lang)), ledger: head() });

  if (route === "GET /api/glossary") return json(res, 200, { entries: G.ENTRIES.map(e => G.card(e, lang)) });

  if (route === "POST /api/chat") {
    let body;
    try { body = await readBody(req); } catch (e) { return json(res, 400, { error: String(e.message || e) }); }
    const message = String(body.message || "").trim().slice(0, 2000);
    if (!message) return json(res, 400, { error: "empty message" });
    return json(res, 200, await chat(profile, message, Array.isArray(body.history) ? body.history : [], lang));
  }

  if (route === "POST /api/events") {
    if (profile === "individual") return json(res, 403, { error: lang === "fr" ? "Seuls l'avocat et l'entreprise envoient des événements par ce canal." : "Only the lawyer and the company send events this way." });
    let body;
    try { body = await readBody(req); } catch (e) { return json(res, 400, { error: String(e.message || e) }); }
    const title = String(body.title || "").trim().slice(0, 200), text = String(body.text || "").trim().slice(0, 4000);
    if (!title || !text) return json(res, 400, { error: lang === "fr" ? "titre et contenu requis" : "title and content are required" });
    const OK = ["document.sent", "company.ai_decision", "company.human_review", "company.transaction", "notification.sent", "company.internal_note"];
    const type = OK.includes(body.type) ? body.type : "document.sent";
    const links = (Array.isArray(body.links) ? body.links : []).map(id => L.byId(id)).filter(Boolean).map(ev => ev.fingerprint);
    const visible_to = body.share ? ["individual", "lawyer", "company"] : [profile];
    const ev = L.append({ type, actor: profile, body: { title, text, data: { kind: "intake" } }, links, visible_to });
    return json(res, 201, { event: L.view(ev, profile, lang) });
  }

  if (route === "GET /api/export") {
    const file = { format: "counsel-evidence/1", exported_at: new Date().toISOString(), exported_by: L.PROFILES[profile].name, case: publicCase(lang),
      ledger: head(), events: L.all().map(ev => L.view(ev, profile, lang)),
      how_to_verify: [
        "fingerprint = SHA-256 of JSON.stringify([v, case_tag, type, actor, at, links, commitment, sources]) taken from the header.",
        "commitment = SHA-256 of salt + '|' + body, for each event whose body is disclosed. Translations are not sealed: verify the body.",
        "entry_hash = SHA-256 of prev + fingerprint; the first prev is 64 zeros.",
        "A receipt opens at https://www.recognitium.com/verify/<receipt id>; it proves when the fingerprint was sealed, not that the content is true."
      ] };
    return json(res, 200, file, { "content-disposition": `attachment; filename="counsel-${L.caseInfo().id}.json"` });
  }

  if (route === "POST /api/reset") { L.reset(); return json(res, 200, { ok: true, ledger: head() }); }

  return json(res, 404, { error: "not found" });
}

async function serveFile(req, res, url) {
  const rel = decodeURIComponent(url.pathname === "/" ? "/index.html" : url.pathname);
  const path = normalize(join(PUBLIC, rel));
  if (!path.startsWith(PUBLIC.endsWith(sep) ? PUBLIC : PUBLIC + sep)) { res.writeHead(403); return res.end(); }
  try {
    const data = await readFile(path);
    res.writeHead(200, { "content-type": TYPES[extname(path)] || "application/octet-stream", "cache-control": "no-store" });
    res.end(data);
  } catch { res.writeHead(404); res.end("not found"); }
}

createServer(async (req, res) => {
  const url = new URL(req.url, "http://localhost");
  try {
    if (url.pathname.startsWith("/api/")) return await api(req, res, url);
    if (req.method === "GET") return await serveFile(req, res, url);
    res.writeHead(405); res.end();
  } catch (e) { console.error(e); json(res, 500, { error: "internal error" }); }
}).listen(PORT, "127.0.0.1", () => {
  const m = mistralStatus();
  console.log(`Counsel app on http://localhost:${PORT}  ·  Mistral ${m.on ? "ready (" + m.model + ")" : "NOT configured: the Assistant answers by rules"}  ·  ${L.all().length} events, ${Object.keys(L.receipts()).length} anchored on Recognitium`);
  connectJuslib();
});
