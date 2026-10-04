// The case ledger: every state change is an event with a public header (sealed) and a private body.
// Seed events live in data/case.json and are anchored on Recognitium (data/receipts.json): never edit them.
// Events added while the app runs (Assistant turns, company intake) go to data/runtime/ledger.json.
import { readFileSync, writeFileSync, existsSync, mkdirSync, rmSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { GENESIS, newSalt, fingerprintOf, commitmentOf, entryHashOf } from "./crypto.mjs";

const path = p => fileURLToPath(new URL("../data/" + p, import.meta.url));
const SEED = path("case.json"), RECEIPTS = path("receipts.json"), RUNTIME_DIR = path("runtime"), RUNTIME = path("runtime/ledger.json");
const readJson = (file, fallback) => existsSync(file) ? JSON.parse(readFileSync(file, "utf8")) : fallback;

export const PROFILES = {
  individual: { id: "individual", name: "Karim B.", first: "Karim", initials: "KB", level: "citizen", role: { en: "Employee, claimant", fr: "Salarié, demandeur" } },
  lawyer: { id: "lawyer", name: "Me Claire Laurent", first: { en: "Counsel", fr: "Maître" }, initials: "CL", level: "expert", role: { en: "Karim B.'s lawyer", fr: "Avocate de Karim B." } },
  company: { id: "company", name: "Horizon Logistique SAS", first: "Horizon Logistique", initials: "HL", level: "expert", role: { en: "Employer, respondent", fr: "Employeur, défendeur" } }
};
const ACTOR_NAMES = {
  en: { individual: "Karim B.", lawyer: "Me Claire Laurent", company: "Horizon Logistique SAS", court: "Paris tribunal registry", ai: "Counsel Assistant" },
  fr: { individual: "Karim B.", lawyer: "Me Claire Laurent", company: "Horizon Logistique SAS", court: "Greffe du CPH de Paris", ai: "Assistant Counsel" }
};
export const actors = (lang = "en") => ACTOR_NAMES[lang] || ACTOR_NAMES.en;
export const ACTORS = ACTOR_NAMES.fr;
export const pick = (v, lang) => (v && typeof v === "object" ? v[lang] || v.en : v);

let seed = readJson(SEED, null);
let runtime = readJson(RUNTIME, []);
const EN = readJson(path("translations.en.json"), { case: {}, events: {} });

export const hasSeed = () => !!seed;
// The case as shown: the sealed French fields, or their unofficial English translation.
export const caseInfo = (lang = "fr") => lang === "en" ? { ...seed.case, ...EN.case } : seed.case;

// Display text of an event: the sealed original, or its unofficial translation when one exists.
export function shown(ev, lang = "fr") {
  const b = parsed(ev), t = lang === "en" ? EN.events[ev.id] : null;
  return { title: t?.title || b.title, text: t?.text || b.text, label: t?.label || b.data?.label, translated: !!t, original: b };
}
export const all = () => [...seed.events, ...runtime];
export const byId = id => all().find(e => e.id === id);
export const byFingerprint = fp => all().find(e => e.fingerprint === fp);
export const receipts = () => readJson(RECEIPTS, {});
export const canSee = (ev, profile) => ev.visible_to.includes(profile);
export const parsed = ev => JSON.parse(ev.body);

// Builds one event chained after `prev`. Used by the seed script and at run time.
export function build({ seq, prev, caseTag, type, actor, at, body, links = [], sources = [], visible_to }) {
  const salt = newSalt(), bodyStr = JSON.stringify(body);
  const header = { v: 1, case_tag: caseTag, type, actor, at, links, commitment: commitmentOf(salt, bodyStr), sources };
  const fingerprint = fingerprintOf(header);
  return { id: "E" + seq, seq, header, fingerprint, prev, entry_hash: entryHashOf(prev, fingerprint), body: bodyStr, salt, visible_to };
}

export function append({ type, actor, body, links = [], sources = [], visible_to }) {
  const events = all(), last = events.at(-1);
  const ev = build({ seq: events.length + 1, prev: last ? last.entry_hash : GENESIS, caseTag: seed.case.case_tag, type, actor,
    at: new Date().toISOString(), body, links, sources, visible_to });
  runtime.push(ev);
  mkdirSync(RUNTIME_DIR, { recursive: true });
  writeFileSync(RUNTIME, JSON.stringify(runtime, null, 2));
  return ev;
}

export function reset() {
  runtime = [];
  rmSync(RUNTIME, { force: true });
}

// What a profile receives: every header (they are public), the body and salt only where it is entitled.
export function view(ev, profile, lang = "fr") {
  const r = receipts()[ev.fingerprint] || null;
  const out = { id: ev.id, seq: ev.seq, header: ev.header, fingerprint: ev.fingerprint, prev: ev.prev, entry_hash: ev.entry_hash, receipt: r };
  if (canSee(ev, profile)) {
    out.body = ev.body; out.salt = ev.salt;
    const t = lang === "en" && EN.events[ev.id];
    if (t) out.translation = { title: t.title, text: t.text, note: EN.note };
  }
  return out;
}
