// Client for the JUSLIB library (github.com/vgactech/JUSBIB), run as its own service.
// At start, Counsel imports its glossary into JUSLIB through /v1/corpus/import/unverified: these texts are drafts,
// not fetched by an official connector, so JUSLIB marks them client_provided and never serves them at expert level.
// Each explanation is then produced by JUSLIB's plain-language engine (/v1/explain), which also checks the stored
// text against its canonical hash. JUSLIB's own core glossary (/v1/glossary) adds terms Counsel does not have.
// If JUSLIB is not running, Counsel uses the same texts from data/glossary.json and says so.
const BASE = (process.env.JUSLIB_URL || "http://127.0.0.1:8765").replace(/\/$/, "");
const state = { on: false, version: null, url: BASE, imported: 0, core: [], ids: new Map(), error: null };
export const status = () => ({ on: state.on, version: state.version, url: state.url, imported: state.imported, core_terms: state.core.length, error: state.error });

async function call(method, path, body) {
  const ctrl = new AbortController(), timer = setTimeout(() => ctrl.abort(), 4000);
  try {
    const r = await fetch(BASE + path, { method, signal: ctrl.signal, headers: { "content-type": "application/json" }, body: body ? JSON.stringify(body) : undefined });
    const data = await r.json().catch(() => ({}));
    return { ok: r.ok, status: r.status, data };
  } finally { clearTimeout(timer); }
}

// entries: the local glossary; sources: its source table (labels and URLs).
export async function connect(entries, sources, corpusVersion) {
  try {
    const h = await call("GET", "/v1/health");
    if (!h.ok) throw new Error(`health ${h.status}`);
    state.version = h.data.version;
    for (const e of entries) for (const lang of ["en", "fr"]) {
      const src = e.cited_dispositions[0] ? sources[e.cited_dispositions[0].source] : null;
      const r = await call("POST", "/v1/corpus/import/unverified", {
        title: e.term, document_type: "glossary_entry", jurisdiction: e.juslib_id.includes("-EU-") ? "EU" : "FR",
        source_url: src ? src.url : "https://www.legifrance.gouv.fr/", connector_id: "counsel_glossary",
        text_excerpt: e.explained_text[lang], language: lang, native_id: e.juslib_id, corpus_version: corpusVersion });
      if (!r.ok) throw new Error(`import ${r.status}`);
      state.ids.set(e.juslib_id + "|" + lang, r.data.juslib_id);
    }
    state.imported = state.ids.size;
    const g = await call("GET", "/v1/glossary");
    for (const term of g.ok ? g.data.terms : []) {
      const def = {};
      for (const lang of ["en", "fr"]) { const d = await call("GET", `/v1/glossary/${encodeURIComponent(term)}?language=${lang}`); if (d.ok) def[lang] = d.data.definition; }
      state.core.push({ term, definition: def });
    }
    state.on = true; state.error = null;
  } catch (e) {
    state.on = false; state.error = e.name === "AbortError" ? "no answer" : String(e.message || e);
  }
  return status();
}

export const coreTerms = () => state.core;

// JUSLIB's explanation of one of Counsel's entries, at citizen or intermediate level (expert is refused on imported texts).
export async function explain(juslibId, lang, level) {
  if (!state.on) return null;
  const id = state.ids.get(juslibId + "|" + lang) || state.ids.get(juslibId + "|en");
  if (!id) return null;
  try {
    const r = await call("POST", "/v1/explain", { source_entity_id: id, source_entity_type: "document", reading_level: level === "citizen" ? "citizen" : "intermediate", language: lang });
    if (!r.ok) return null;
    return { document_id: id, explained_text: r.data.explained_text, production_type: r.data.production_type, confidence: r.data.confidence,
      canonical_hash_verified: r.data.canonical_hash_verified, corpus_authenticated: r.data.corpus_authenticated, version: state.version };
  } catch { return null; }
}
