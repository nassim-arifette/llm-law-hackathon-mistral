// The Agenda is computed, never typed: each item comes from a sealed event, a rule and its source.
import * as L from "./ledger.mjs";
import * as G from "./glossary.mjs";

const addMonths = (iso, n) => { const d = new Date(iso.slice(0, 10) + "T12:00:00Z"); d.setUTCMonth(d.getUTCMonth() + n); return d.toISOString().slice(0, 10); };
const T = {
  en: { hearing: "Hearing before the conciliation and orientation panel", fixed: "Date set by the registry's summons",
    contest: "Last day to contest the dismissal", contestRule: "12 months from the notification of the termination", met: "Time limit met: the application was filed",
    appeal: "Last day to appeal the judgment", appealRule: "1 month from the notification of the judgment",
    after: t => `Set after: ${t}`, byMember: "Set by a member of the case" },
  fr: { hearing: "Audience devant le bureau de conciliation et d'orientation", fixed: "Date fixée par la convocation du greffe",
    contest: "Dernier jour pour contester le licenciement", contestRule: "12 mois à partir de la notification de la rupture", met: "Délai respecté : la requête a été déposée",
    appeal: "Dernier jour pour faire appel du jugement", appealRule: "1 mois à partir de la notification du jugement",
    after: t => `Fixée après : ${t}`, byMember: "Fixée par un membre du dossier" }
};

export function agenda(profile, lang = "en") {
  const t = T[lang] || T.en;
  const ref = ev => ({ id: ev.id, title: L.shown(ev, lang).title, at: ev.header.at, fingerprint: ev.fingerprint, receipt: L.receipts()[ev.fingerprint] || null });
  const term = name => { const e = G.find(name); return e ? G.card(e, lang) : null; };
  const seen = L.all().filter(ev => L.canSee(ev, profile));
  const kind = k => seen.filter(ev => (L.parsed(ev).data || {}).kind === k);
  const items = [];

  for (const ev of kind("convocation_bco")) {
    const d = L.parsed(ev).data;
    items.push({ id: "hearing-" + ev.id, type: "hearing", date: d.hearing_at, title: t.hearing,
      place: lang === "en" ? L.caseInfo("en").court : d.place, term: term("bureau de conciliation et d'orientation"), started_by: ref(ev),
      rule: { label: t.fixed, source: null } });
  }
  for (const ev of kind("dismissal_notified")) {
    const d = L.parsed(ev).data, filed = kind("requete")[0];
    items.push({ id: "prescription-" + ev.id, type: "deadline", date: addMonths(d.date, 12), title: t.contest,
      term: term("prescription"), started_by: ref(ev), rule: { label: t.contestRule, source: G.card(G.find("prescription"), lang).sources[0] },
      met: filed ? { by: ref(filed), label: t.met } : null, to_confirm: profile === "individual" });
  }
  for (const ev of kind("judgment_notified")) {
    const d = L.parsed(ev).data;
    items.push({ id: "appeal-" + ev.id, type: "deadline", date: addMonths(d.date, 1), title: t.appeal,
      term: term("appel"), started_by: ref(ev), rule: { label: t.appealRule, source: G.card(G.find("appel"), lang).sources[0] }, to_confirm: profile === "individual" });
  }
  for (const ev of seen.filter(ev => ev.header.type === "deadline.set")) {
    const d = L.parsed(ev).data, s = L.shown(ev, lang);
    const origin = ev.header.links.map(L.byFingerprint).find(Boolean);
    items.push({ id: "task-" + ev.id, type: "task", date: d.due, title: s.label || d.label, set_by: L.actors(lang)[ev.header.actor],
      started_by: ref(ev), reason: s.text, term: d.term ? term(d.term) : null,
      rule: { label: origin ? t.after(L.shown(origin, lang).title) : t.byMember, source: null } });
  }
  return items.sort((a, b) => a.date.localeCompare(b.date));
}
