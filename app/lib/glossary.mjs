// Counsel's glossary, in JUSLIB's field names (data/glossary.json), plus JUSLIB's own core glossary when the library runs.
// Each entry gets an entry_hash: the Assistant's sealed answers cite it, so the record shows which explanation was used.
import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { sha256 } from "./crypto.mjs";

const raw = JSON.parse(readFileSync(fileURLToPath(new URL("../data/glossary.json", import.meta.url)), "utf8"));
export const SOURCES = raw.sources;
export const CORPUS_VERSION = raw.corpus_version;
export const AI_WARNING = {
  en: "AI-generated, not validated by a lawyer. Always check the official text.",
  fr: "Généré par IA, non validé par un juriste. Consultez toujours le texte officiel."
};

export const norm = s => String(s).toLowerCase().normalize("NFD").replace(/[̀-ͯ]/g, "").replace(/[’`]/g, "'");
const cap = s => s.charAt(0).toUpperCase() + s.slice(1);

export const ENTRIES = raw.entries.map(e => ({
  ...e,
  cites: e.cited_dispositions.map(d => ({ ...d, label: `${raw.sources[d.source].label}, art. ${d.article}`, url: raw.sources[d.source].url,
    checkOn: d.source === "ai-act" ? "EUR-Lex" : "Légifrance" })),
  certainty_level: "unverified", production_type: "ai_generated", source_hash: null,
  entry_hash: sha256(JSON.stringify(e))
}));

// JUSLIB's core glossary terms that Counsel does not define itself, with English names for detection.
const CORE_EN = {
  "abrogation": ["repeal", "repealed"], "recours": ["legal remedy", "remedy"], "préjudice": ["harm suffered", "harm"],
  "nullité": ["nullity", "null and void"], "détention provisoire": ["pre-trial detention"], "contrat synallagmatique": ["bilateral contract"]
};
export function addCore(core) {
  for (const { term, definition } of core) {
    const mine = ENTRIES.find(e => norm(e.term) === norm(term));
    if (mine) { mine.core_definition = definition; continue; }
    if (!definition.en && !definition.fr) continue;
    const en = CORE_EN[term] || [term];
    ENTRIES.push({ juslib_id: `JUSLIB-CORE-${norm(term).replace(/[^a-z]+/g, "-").toUpperCase()}`, term, aliases: [], term_en: en[0], aliases_en: en.slice(1),
      explained_text: { en: definition.en || definition.fr, fr: definition.fr || definition.en }, cited_dispositions: [], cites: [], core: true,
      certainty_level: "unverified", production_type: "rule_based", source_hash: null, entry_hash: sha256(JSON.stringify({ term, definition })) });
  }
  index();
}

let NEEDLES = [];
const esc = s => s.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
function index() {
  NEEDLES = ENTRIES.flatMap(e => [e.term, ...e.aliases, e.term_en, ...(e.aliases_en || [])].filter(Boolean).map(n => ({ e, n: norm(n) })))
    .sort((a, b) => b.n.length - a.n.length);
}
index();

export const byId = id => ENTRIES.find(e => e.juslib_id === id);
export const byHash = h => ENTRIES.find(e => e.entry_hash === h);

// The entry for a term the model or the user names, in French or English, or null.
export function find(term) {
  const t = norm(term).trim();
  return (NEEDLES.find(x => x.n === t) || NEEDLES.find(x => x.n.length > 3 && (t.includes(x.n) || x.n.includes(t))) || {}).e || null;
}

// Every glossary term mentioned in a text, longest match first, no overlaps.
export function detect(text) {
  const t = norm(text), taken = [], found = [];
  for (const { e, n } of NEEDLES) {
    const re = new RegExp(`(^|[^a-z0-9])${esc(n)}(?=$|[^a-z0-9])`, "g");
    for (let m; (m = re.exec(t));) {
      const s = m.index + m[1].length, end = s + n.length;
      if (taken.some(([a, b]) => s < b && end > a)) continue;
      taken.push([s, end]);
      if (!found.includes(e)) found.push(e);
    }
  }
  return found;
}

// Entries whose cited article matches, e.g. "L1235-3" or "538".
export function byArticle(article) {
  const a = norm(article).replace(/^art(icle)?\.?\s*/, "").replace(/\s+/g, "");
  return ENTRIES.filter(e => e.cites.some(c => norm(c.article).replace(/\s+/g, "") === a));
}

// The name shown for a term: the English name with the French original, or the French term.
export const nameOf = (e, lang) => lang === "en" && e.term_en ? (norm(e.term_en) === norm(e.term) ? cap(e.term_en) : `${cap(e.term_en)} (${e.term})`) : cap(e.term);

// What a tool returns to the model and what the interface shows. `lib` is JUSLIB's own explanation when it ran.
export const card = (e, lang = "en", lib = null) => ({
  juslib_id: e.juslib_id, term: nameOf(e, lang), term_fr: e.term,
  explained_text: lib ? lib.explained_text : e.explained_text[lang] || e.explained_text.fr,
  core_definition: e.core_definition ? e.core_definition[lang] || e.core_definition.fr : null,
  sources: e.cites.map(c => ({ label: c.label, url: c.url, status: lang === "en" ? `candidate article, to check on ${c.checkOn}` : `article candidat, à vérifier sur ${c.checkOn}` })),
  library: lib ? { name: "JUSLIB", version: lib.version, document_id: lib.document_id, production_type: lib.production_type, confidence: lib.confidence,
    canonical_hash_verified: lib.canonical_hash_verified, translation: lib.translation || null } : { name: e.core ? "JUSLIB core glossary" : "Counsel glossary file (JUSLIB not running)" },
  core: !!e.core, certainty_level: e.certainty_level, production_type: e.production_type,
  ai_generated_warning: e.core ? null : AI_WARNING[lang] || AI_WARNING.en, entry_hash: e.entry_hash
});
