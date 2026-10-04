// The six tools the Assistant may call. Each returns what the model reads, plus what it touched:
// the case events and the glossary entries, so the sealed answer can link to its sources.
import * as L from "./ledger.mjs";
import * as G from "./glossary.mjs";
import * as J from "./juslib.mjs";
import { agenda } from "./agenda.mjs";
import { fingerprintOf, commitmentOf, entryHashOf, GENESIS } from "./crypto.mjs";

export const VERIFY_URL = id => `https://www.recognitium.com/verify/${id}`;
const isAi = ev => ev.header.type.startsWith("ai.");

export const TOOLS = [
  ["case_timeline", "Lists the case events the user may see, in order: id, date, author, title, Recognitium receipt. Also says how many events are not disclosed to this user.", {}],
  ["read_document", "Reads one event or document of the case that the user may see. Returns the sealed original (French) and, when available, an unofficial English translation.", { event_id: { type: "string", description: "Event id, for example E6" } }],
  ["explain_term", "Explains a legal term in plain language from the JUSLIB library, with its official source and certainty level. Accepts French or English terms.", { term: { type: "string", description: "The term, for example 'conciliation and orientation panel' or 'bureau de conciliation'" } }],
  ["explain_provision", "Finds the JUSLIB explanations linked to an article of law, with the official link.", { article: { type: "string", description: "For example L1235-3 or 538" } }],
  ["agenda", "Lists the hearings, deadlines and tasks of the case, each with the event that set it and its rule.", {}],
  ["proof", "Verifies an event: fingerprint, chaining and Recognitium receipt.", { event_id: { type: "string", description: "Event id, for example E6" } }]
].map(([name, description, properties]) => ({ type: "function", function: { name, description, parameters: { type: "object", properties, required: Object.keys(properties) } } }));

export function proofOf(ev, profile) {
  const events = L.all(), i = events.indexOf(ev), prev = i > 0 ? events[i - 1].entry_hash : GENESIS;
  const r = L.receipts()[ev.fingerprint];
  return { event_id: ev.id, fingerprint: ev.fingerprint,
    header_ok: fingerprintOf(ev.header) === ev.fingerprint,
    chain_ok: ev.prev === prev && entryHashOf(ev.prev, ev.fingerprint) === ev.entry_hash,
    links_ok: ev.header.links.every(fp => { const t = L.byFingerprint(fp); return t && t.seq < ev.seq; }),
    body_ok: L.canSee(ev, profile) ? commitmentOf(ev.salt, ev.body) === ev.header.commitment : null,
    receipt: r ? { id: r.receipt_id, sequence: r.sequence, sealed_at: r.sealed_at, verify_url: VERIFY_URL(r.receipt_id) } : null,
    anchored: !!r, note: "A receipt proves when a record existed and that it has not changed since, not that it is true." };
}

// `events` and `terms` are what a tool read on purpose; `weak` is what came along with a list (the agenda),
// kept as a source only if the answer mentions it.
export async function runTool(profile, name, args = {}, lang = "en") {
  const events = new Set(), terms = new Set(), weak = [], level = L.PROFILES[profile].level;
  const visible = id => { const ev = L.byId(String(id || "").trim().toUpperCase()); return ev && L.canSee(ev, profile) ? ev : null; };
  const explain = async e => { terms.add(e.entry_hash); return G.card(e, lang, e.core ? null : await J.explain(e.juslib_id, lang, level)); };
  let result;
  switch (name) {
    case "case_timeline": {
      const all = L.all().filter(ev => !isAi(ev)), seen = all.filter(ev => L.canSee(ev, profile)), c = L.caseInfo(lang);
      result = { case: c.title, court: c.court, stage: c.stage,
        events: seen.map(ev => ({ event_id: ev.id, date: ev.header.at, from: L.actors(lang)[ev.header.actor], title: L.shown(ev, lang).title,
          receipt: (L.receipts()[ev.fingerprint] || {}).receipt_id || null, shared_with_all: ev.visible_to.length === 3 })),
        undisclosed: all.length - seen.length };
      break;
    }
    case "read_document": {
      const ev = visible(args.event_id);
      if (!ev) { result = { error: "Event not found, or not disclosed to this user." }; break; }
      events.add(ev.id);
      const s = L.shown(ev, lang);
      result = { event_id: ev.id, date: ev.header.at, from: L.actors(lang)[ev.header.actor], title: s.title, text: s.text,
        sealed_original: s.translated ? { title: s.original.title, text: s.original.text } : undefined,
        translation_note: s.translated ? "Unofficial English translation; the sealed original is the French text." : undefined,
        receipt: (L.receipts()[ev.fingerprint] || {}).receipt_id || null };
      break;
    }
    case "explain_term": {
      const e = G.find(args.term || "");
      result = e ? await explain(e) : { error: `"${args.term}" is not in the JUSLIB library. Do not explain it without a source.` };
      break;
    }
    case "explain_provision": {
      const found = G.byArticle(args.article || "");
      result = found.length
        ? { article: args.article, official_text: "The article's text is not yet imported in JUSLIB; official link provided.", explanations: await Promise.all(found.map(explain)) }
        : { error: `No JUSLIB explanation is linked to article ${args.article}.` };
      break;
    }
    case "agenda": {
      result = agenda(profile, lang).map(it => {
        const e = it.term && G.byId(it.term.juslib_id);
        weak.push({ event: it.started_by.id, term: e ? e.entry_hash : null, date: it.date });
        return { date: it.date, title: it.title, set_by: it.set_by || null, why: it.started_by.title, why_event_id: it.started_by.id, rule: it.rule.label,
          source: it.rule.source ? it.rule.source.label : null, met: it.met ? `${it.met.label} (${it.met.by.title})` : null,
          to_confirm_by_lawyer: !!it.to_confirm };
      });
      break;
    }
    case "proof": {
      const ev = visible(args.event_id);
      if (!ev) { result = { error: "Event not found, or not disclosed to this user." }; break; }
      events.add(ev.id);
      result = { title: L.shown(ev, lang).title, ...proofOf(ev, profile) };
      break;
    }
    default: result = { error: `Unknown tool: ${name}` };
  }
  return { result, events: [...events], terms: [...terms], weak };
}
