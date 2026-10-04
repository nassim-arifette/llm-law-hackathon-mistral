// Counsel: one case, three sections (Assistant, Agenda, Traceability), three account types. English by default, French on request.
// Verification runs here, in the browser, with the same formulas as app/lib/crypto.mjs:
// anyone holding the export can redo it without trusting the server.

const $ = id => document.getElementById(id);
const esc = s => String(s ?? "").replace(/[&<>"']/g, c => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c]));
const store = {
  get(k, d) { try { const v = localStorage.getItem(k); return v ? JSON.parse(v) : d; } catch { return d; } },
  set(k, v) { try { localStorage.setItem(k, JSON.stringify(v)); } catch { /* private mode: keep in memory */ } }
};

/* ---------- fingerprints (same as the server) ---------- */
const GENESIS = "0".repeat(64);
const sha = async s => [...new Uint8Array(await crypto.subtle.digest("SHA-256", new TextEncoder().encode(s)))].map(b => b.toString(16).padStart(2, "0")).join("");
const canon = h => JSON.stringify([h.v, h.case_tag, h.type, h.actor, h.at, h.links, h.commitment, h.sources]);
const VERIFY_URL = id => `https://www.recognitium.com/verify/${id}`;

/* ---------- words ---------- */
const STR = {
  en: {
    newChat: "New chat", assistant: "Assistant", agenda: "Agenda", trace: "Traceability", caseLabel: "Case", chats: "Chats", noChats: "No chats yet.",
    stage: "Stage", switchAccount: "Switch account (demo)", reset: "Reset the demo", language: "Language",
    rulesMode: "rules mode · Mistral not connected", juslibOn: v => `JUSLIB ${v}`, juslibOff: "JUSLIB offline · local glossary",
    fine: "The Assistant is an AI. It gives information about the case, not legal advice. Every exchange is sealed.",
    phInd: "Ask a question about your case", phOther: "Ask a question about the case", send: "Send", message: "Message",
    greet: { individual: "Hello Karim, what would you like to understand?", lawyer: "Hello Counsel, what would you like to check?", company: "What would you like to check in this case?" },
    suggest: {
      individual: [["What is the conciliation panel?", "The word in my summons"], ["What is my next deadline?", "Dates and time limits"], ["Why was I dismissed?", "What the documents say"], ["How much will I get?", "What the Assistant can say, or not"]],
      lawyer: [["Summarize the case", "Every document, in order"], ["What is the limitation period?", "And where it stands in this case"], ["What does article L1235-3 say?", "Explanation and official link"], ["Which employer documents are disclosed?", "And which are not"]],
      company: [["What are our next deadlines?", "Hearing and documents to hand over"], ["What is human oversight?", "EU AI Act"], ["Which employer documents are disclosed?", "What the parties see"], ["How do we prove the letter was not changed?", "Fingerprints and receipts"]]
    },
    plain: (a, m) => `Plain language, ISO 24495-1 · ${a} words per sentence on average, longest ${m}`, plainWarn: (a, m) => `Plain-language check: ${a} words per sentence on average, longest ${m}`,
    rules: "Rules", sealed: n => `Sealed · entry no. ${n}`, aiWarn: "AI-generated · not validated by a lawyer", noSource: x => `Figure without a source: ${x}`,
    kTerm: "JUSLIB", kDoc: "Document", receipt: "receipt", cantAnswer: e => `The Assistant could not answer: ${e}`,
    agendaLede: "Every date comes from a sealed event in the case, a rule and its source. Nobody types it by hand.",
    met: "Time limit met", passed: "Passed", today: "Today", inDays: n => `In ${n} day${n > 1 ? "s" : ""}`, confirm: "To confirm with your lawyer",
    ask: "Ask the Assistant", why: "Why", rule: "Rule", status: "Status", setBy: w => `set by ${w}`, pending: "anchoring pending", noDates: "No date in this case.",
    explainQ: t => `Explain: ${t.charAt(0).toLowerCase() + t.slice(1)}`, at: "at",
    traceLede: "Every change in the case, from every party, in the order it was sealed. Only the fingerprint leaves Counsel: the content stays private. A receipt proves when a record existed and that it has not changed since, not that it is true.",
    verifyAll: "Verify the whole case", export: "Export the evidence file", sendEvent: "Send an event", loading: "Loading…",
    intact: "The case is intact.", intactBody: (n, d, a) => `${n} events recomputed in this browser: every fingerprint, every link to an earlier event and the whole chain match. ${d} contents disclosed to your account checked word for word; ${a} events anchored on Recognitium.`,
    broken: n => `${n} event${n > 1 ? "s no longer match" : " no longer matches"} what was sealed.`,
    tabs: [["all", "All"], ["case", "Case"], ["ai", "Assistant"]], nothing: "No event here yet.", head: (h, n) => `Chain head ${h} · ${n} entries`,
    verify: "Verify", simulate: "Simulate an edit", undo: "Undo the edit", publicReceipt: "Public receipt", fingerprint: "Fingerprint", commitment: "Commitment",
    linked: "Linked to", receiptK: "Receipt", sequence: "sequence", chained: "Chained · anchoring pending", receiptTag: id => `Receipt ${id}`,
    hidden: "Content not disclosed to your account. Its existence, date and fingerprint are sealed: it cannot be changed or backdated without it showing.",
    edited: "Edited after the fact, for the demonstration.", notDisclosed: t => `${t}, not disclosed`,
    okLine: undiscl => `Intact: fingerprint, content${undiscl ? " (not disclosed, not checkable)" : ""}, chaining and links verified in this browser.`,
    pBody: "The content shown is not the one that was sealed.", pHeader: "The header no longer matches its fingerprint.", pChain: "The chain is broken at this point.", pLinks: "Linked to a missing or later event.",
    translated: "Unofficial English translation. The sealed original is French.", showOriginal: "Show the sealed original", hideOriginal: "Hide the original",
    exchange: "Exchange with the Assistant", nEvents: n => `${n} sealed events`, nCalls: n => `${n} tool call${n > 1 ? "s" : ""}`, withheld: "1 answer withheld",
    verifyExchange: "Verify this exchange", privateN: n => `${n} private Assistant events of another member`, headersOnly: "Headers only",
    intakeTitle: "New event, sealed on sending", type: "Type", linkTo: "Linked to", none: "None", title: "Title", content: "Content",
    titlePh: "For example: PerfScore v2 technical documentation", contentPh: "The content stays private; only its fingerprint is sealed.",
    share: "Disclose the content to the parties of the case", sealSend: "Seal and send", cancel: "Cancel",
    types: { "document.sent": "Document", "company.ai_decision": "AI system decision", "company.human_review": "Human review", "company.transaction": "Transaction", "notification.sent": "Notification", "company.internal_note": "Internal note" },
    library: "JUSLIB library", officialSource: "Official source", noArticle: "Article to be identified.", certainty: "Certainty", unverified: "Unverified",
    production: "Production", prodAi: "AI-generated, to be validated by a lawyer", prodCore: "JUSLIB core glossary, rule-based",
    explainedBy: "Explained by", libOn: (v, id, ok) => `JUSLIB ${v} plain-language engine · document ${id}${ok ? " · integrity checked by hash" : ""}`, libOff: "Counsel glossary file (JUSLIB not running)",
    coreDef: "JUSLIB core definition", juslibId: "JUSLIB identifier", entryHash: "Fingerprint of the cited explanation",
    caseDoc: "Case document", recReceipt: "Recognitium receipt", seqSealed: (n, d) => `Sequence ${n} · sealed on ${d}`, localOnly: "Chained locally; anchoring pending.",
    position: "Position in the chain", seeInTrace: "See in Traceability",
    sealedExchange: "Sealed exchange", recorded: "This exchange is recorded",
    recordedBody: "The question, each tool call and the answer are separate events, linked by their fingerprints and chained to the rest of the case. You can prove later what was said, when, and on which sources.",
    intactShort: "Intact", citedSources: "Sources cited in the answer header", nExpl: n => `${n} JUSLIB explanation${n > 1 ? "s" : ""}, by fingerprint`,
    localWarn: "These events are chained locally. They are anchored on Recognitium by sealing the chain head.",
    TYPE: { "company.ai_decision": "AI system decision", "company.human_review": "Human review", "company.internal_note": "Internal note", "company.transaction": "Transaction",
      "notification.sent": "Notification sent", "notification.received": "Notification received", "meeting.held": "Meeting", "document.sent": "Document sent",
      "document.filed": "Document filed", "deadline.set": "Deadline", "ai.question": "Question to the Assistant", "ai.tool_call": "Tool call", "ai.answer": "Assistant answer", "ai.answer.refused": "Answer withheld" }
  },
  fr: {
    newChat: "Nouvelle conversation", assistant: "Assistant", agenda: "Agenda", trace: "Traçabilité", caseLabel: "Dossier", chats: "Conversations", noChats: "Aucune conversation pour l'instant.",
    stage: "Étape", switchAccount: "Changer de compte (démo)", reset: "Réinitialiser la démo", language: "Langue",
    rulesMode: "mode règles · Mistral non connecté", juslibOn: v => `JUSLIB ${v}`, juslibOff: "JUSLIB hors ligne · glossaire local",
    fine: "L'Assistant est une IA. Il donne des informations sur le dossier, pas de conseil juridique. Chaque échange est scellé.",
    phInd: "Posez une question sur votre dossier", phOther: "Posez une question sur le dossier", send: "Envoyer", message: "Message",
    greet: { individual: "Bonjour Karim, que voulez-vous comprendre ?", lawyer: "Bonjour Maître, que voulez-vous vérifier ?", company: "Que voulez-vous vérifier dans ce dossier ?" },
    suggest: {
      individual: [["C'est quoi le bureau de conciliation ?", "Le mot de ma convocation"], ["Quelle est ma prochaine échéance ?", "Dates et délais du dossier"], ["Pourquoi ai-je été licencié ?", "Ce que disent les documents"], ["Combien je vais toucher ?", "Ce que l'Assistant peut dire, ou pas"]],
      lawyer: [["Résume le dossier", "Toutes les pièces, dans l'ordre"], ["C'est quoi le délai de prescription ?", "Et son état dans ce dossier"], ["Que dit l'article L1235-3 ?", "Explication et lien officiel"], ["Quelles pièces de l'employeur sont divulguées ?", "Et celles qui ne le sont pas"]],
      company: [["Quelles sont nos prochaines échéances ?", "Audience et pièces à transmettre"], ["C'est quoi le contrôle humain ?", "Règlement européen sur l'IA"], ["Quelles pièces de l'employeur sont divulguées ?", "Ce que voient les parties"], ["Comment prouver que la lettre n'a pas été modifiée ?", "Empreintes et reçus"]]
    },
    plain: (a, m) => `Langage clair, ISO 24495-1 · ${a} mots par phrase en moyenne, la plus longue ${m}`, plainWarn: (a, m) => `Contrôle langage clair : ${a} mots par phrase en moyenne, la plus longue ${m}`,
    rules: "Règles", sealed: n => `Scellé · entrée n° ${n}`, aiWarn: "Généré par IA · non validé par un juriste", noSource: x => `Chiffre sans source : ${x}`,
    kTerm: "JUSLIB", kDoc: "Pièce", receipt: "reçu", cantAnswer: e => `L'Assistant n'a pas pu répondre : ${e}`,
    agendaLede: "Chaque date vient d'un événement scellé du dossier, d'une règle et de sa source. Personne ne la saisit à la main.",
    met: "Délai respecté", passed: "Passé", today: "Aujourd'hui", inDays: n => `Dans ${n} jour${n > 1 ? "s" : ""}`, confirm: "À confirmer avec votre avocate",
    ask: "Demander à l'Assistant", why: "Pourquoi", rule: "Règle", status: "État", setBy: w => `fixée par ${w}`, pending: "ancrage en attente", noDates: "Aucune date dans ce dossier.",
    explainQ: t => `Explique-moi : ${t.charAt(0).toLowerCase() + t.slice(1)}`, at: "à",
    traceLede: "Chaque changement du dossier, de chaque partie, dans l'ordre où il a été scellé. Seule l'empreinte quitte Counsel : le contenu reste privé. Un reçu prouve quand un enregistrement existait et qu'il n'a pas changé depuis, pas qu'il dit vrai.",
    verifyAll: "Vérifier tout le dossier", export: "Exporter le dossier de preuves", sendEvent: "Envoyer un événement", loading: "Chargement…",
    intact: "Le dossier est intact.", intactBody: (n, d, a) => `${n} événements recalculés dans ce navigateur : chaque empreinte, chaque lien vers un événement antérieur et la chaîne entière correspondent. ${d} contenus divulgués à votre compte vérifiés mot pour mot ; ${a} événements ancrés sur Recognitium.`,
    broken: n => `${n} événement${n > 1 ? "s ne correspondent" : " ne correspond"} plus à ce qui a été scellé.`,
    tabs: [["all", "Tout"], ["case", "Dossier"], ["ai", "Assistant"]], nothing: "Aucun événement ici pour l'instant.", head: (h, n) => `Tête de chaîne ${h} · ${n} entrées`,
    verify: "Vérifier", simulate: "Simuler une modification", undo: "Annuler la modification", publicReceipt: "Reçu public", fingerprint: "Empreinte", commitment: "Engagement",
    linked: "Relié à", receiptK: "Reçu", sequence: "séquence", chained: "Chaîné · ancrage en attente", receiptTag: id => `Reçu ${id}`,
    hidden: "Contenu non divulgué à votre compte. Son existence, sa date et son empreinte sont scellées : il ne peut pas être modifié ni antidaté sans que cela se voie.",
    edited: "Version modifiée après coup, pour la démonstration.", notDisclosed: t => `${t}, non divulgué`,
    okLine: undiscl => `Intact : empreinte, contenu${undiscl ? " (non divulgué, non vérifiable)" : ""}, chaînage et liens vérifiés dans ce navigateur.`,
    pBody: "Le contenu présenté n'est pas celui qui a été scellé.", pHeader: "L'en-tête ne correspond plus à son empreinte.", pChain: "La chaîne est rompue à cet endroit.", pLinks: "Relié à un événement absent ou postérieur.",
    translated: "", showOriginal: "", hideOriginal: "",
    exchange: "Échange avec l'Assistant", nEvents: n => `${n} événements scellés`, nCalls: n => `${n} appel${n > 1 ? "s" : ""} d'outil`, withheld: "1 réponse retenue",
    verifyExchange: "Vérifier cet échange", privateN: n => `${n} événements privés de l'Assistant, d'un autre membre`, headersOnly: "En-têtes seulement",
    intakeTitle: "Nouvel événement, scellé dès l'envoi", type: "Type", linkTo: "Relié à", none: "Aucun", title: "Titre", content: "Contenu",
    titlePh: "Par exemple : Documentation technique de PerfScore v2", contentPh: "Le contenu reste privé ; seule son empreinte est scellée.",
    share: "Divulguer le contenu aux parties du dossier", sealSend: "Sceller et envoyer", cancel: "Annuler",
    types: { "document.sent": "Document", "company.ai_decision": "Décision d'un système d'IA", "company.human_review": "Revue humaine", "company.transaction": "Transaction", "notification.sent": "Notification", "company.internal_note": "Note interne" },
    library: "Bibliothèque JUSLIB", officialSource: "Source officielle", noArticle: "Article à identifier.", certainty: "Certitude", unverified: "Non vérifié",
    production: "Production", prodAi: "Générée par IA, à valider par un juriste", prodCore: "Glossaire de base JUSLIB, par règles",
    explainedBy: "Expliqué par", libOn: (v, id, ok) => `Moteur de vulgarisation JUSLIB ${v} · document ${id}${ok ? " · intégrité vérifiée par empreinte" : ""}`, libOff: "Fichier glossaire de Counsel (JUSLIB non démarré)",
    coreDef: "Définition de base JUSLIB", juslibId: "Identifiant JUSLIB", entryHash: "Empreinte de l'explication citée",
    caseDoc: "Pièce du dossier", recReceipt: "Reçu Recognitium", seqSealed: (n, d) => `Séquence ${n} · scellé le ${d}`, localOnly: "Chaîné localement ; ancrage en attente.",
    position: "Position dans la chaîne", seeInTrace: "Voir dans Traçabilité",
    sealedExchange: "Échange scellé", recorded: "Cet échange est enregistré",
    recordedBody: "La question, chaque appel d'outil et la réponse sont des événements distincts, reliés par leurs empreintes et chaînés au reste du dossier. On peut prouver plus tard ce qui a été dit, quand, et sur quelles sources.",
    intactShort: "Intact", citedSources: "Sources citées dans l'en-tête de la réponse", nExpl: n => `${n} explication${n > 1 ? "s" : ""} JUSLIB, par empreinte`,
    localWarn: "Ces événements sont chaînés localement. Leur ancrage sur Recognitium se fait en scellant la tête de chaîne.",
    TYPE: { "company.ai_decision": "Décision d'un système d'IA", "company.human_review": "Revue humaine", "company.internal_note": "Note interne", "company.transaction": "Transaction",
      "notification.sent": "Notification envoyée", "notification.received": "Notification reçue", "meeting.held": "Entretien", "document.sent": "Document envoyé",
      "document.filed": "Document déposé", "deadline.set": "Échéance", "ai.question": "Question à l'Assistant", "ai.tool_call": "Appel d'outil", "ai.answer": "Réponse de l'Assistant", "ai.answer.refused": "Réponse retenue" }
  }
};
const MONTHS = { en: ["January", "February", "March", "April", "May", "June", "July", "August", "September", "October", "November", "December"],
  fr: ["janvier", "février", "mars", "avril", "mai", "juin", "juillet", "août", "septembre", "octobre", "novembre", "décembre"] };
const MON = { en: ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"], fr: ["janv.", "févr.", "mars", "avr.", "mai", "juin", "juil.", "août", "sept.", "oct.", "nov.", "déc."] };

/* ---------- state ---------- */
const S = {
  boot: null, profile: store.get("counsel.profile", "individual"), lang: store.get("counsel.lang", "en"), view: "assistant",
  events: null, ledger: null, agenda: [], convs: store.get("counsel.convs", {}), current: store.get("counsel.current", {}),
  verify: {}, edits: {}, caseCheck: null, filter: "all", open: new Set(), originals: new Set(), intake: false, busy: false
};
const t = () => STR[S.lang];
const pick = v => (v && typeof v === "object" ? v[S.lang] || v.en : v);

/* ---------- dates ---------- */
const pad = n => String(n).padStart(2, "0");
const today = () => { const d = new Date(); return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`; };
const ymd = iso => iso.slice(0, 10).split("-").map(Number);
const fmtDate = iso => { const [y, m, d] = ymd(iso); return `${d} ${MONTHS[S.lang][m - 1]} ${y}`; };
const fmtTime = iso => { const x = iso.slice(11, 16); if (!x || x === "00:00") return ""; const h = Number(x.slice(0, 2)); return S.lang === "en" ? `${h}:${x.slice(3)}` : `${h} h ${x.slice(3)}`; };
const stamp = iso => {
  const f = new Intl.DateTimeFormat(S.lang === "en" ? "en-GB" : "fr-FR", { day: "numeric", month: "long", year: "numeric", hour: "numeric", minute: "2-digit", timeZone: "Europe/Paris" }).format(new Date(iso));
  return S.lang === "fr" ? f.replace(":", " h ") : f;
};
const daysTo = iso => Math.round((Date.parse(iso.slice(0, 10) + "T12:00:00Z") - Date.parse(today() + "T12:00:00Z")) / 864e5);

/* ---------- api ---------- */
const api = async (path, opts = {}) => {
  const r = await fetch(path, { ...opts, headers: { "content-type": "application/json", "x-profile": S.profile, "x-lang": S.lang, ...(opts.headers || {}) } });
  const data = await r.json().catch(() => ({}));
  if (!r.ok) throw new Error(data.error || `Error ${r.status}`);
  return data;
};
const me = () => S.boot.profiles[S.profile];
const saveConvs = () => { store.set("counsel.convs", S.convs); store.set("counsel.current", S.current); };
const convs = () => (S.convs[S.profile] ||= []);
const conv = () => convs().find(c => c.id === S.current[S.profile]);
const icon = d => `<svg class="i" viewBox="0 0 24 24">${d}</svg>`;
const I = {
  check: icon('<path d="M20 6L9 17l-5-5"/>'), shield: icon('<path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z"/>'),
  book: icon('<path d="M4 19.5A2.5 2.5 0 016.5 17H20V3H6.5A2.5 2.5 0 004 5.5z"/><path d="M4 19.5V21h16"/>'),
  doc: icon('<path d="M14 2H6a2 2 0 00-2 2v16a2 2 0 002 2h12a2 2 0 002-2V8z"/><path d="M14 2v6h6"/>'),
  out: icon('<path d="M18 13v6a2 2 0 01-2 2H5a2 2 0 01-2-2V8a2 2 0 012-2h6M15 3h6v6M10 14L21 3"/>'),
  down: icon('<path d="M21 15v4a2 2 0 01-2 2H5a2 2 0 01-2-2v-4M7 10l5 5 5-5M12 15V3"/>'),
  plus: icon('<path d="M12 5v14M5 12h14"/>'), reset: icon('<path d="M3 12a9 9 0 109-9 9.75 9.75 0 00-6.74 2.74L3 8"/><path d="M3 3v5h5"/>'),
  globe: icon('<circle cx="12" cy="12" r="10"/><path d="M2 12h20M12 2a15.3 15.3 0 014 10 15.3 15.3 0 01-4 10 15.3 15.3 0 01-4-10 15.3 15.3 0 014-10z"/>'),
  lib: icon('<path d="M4 4h4v16H4zM10 4h4v16h-4zM16 5l3.5-1 3 15-3.5 1z"/>')
};

/* ---------- data ---------- */
async function loadEvents() { const r = await api("/api/events"); S.events = r.events; S.ledger = r.ledger; }
async function loadAgenda() { S.agenda = (await api("/api/agenda")).items; }
const bodyOf = ev => ev.body ? JSON.parse(ev.body) : null;
const titleOf = ev => ev.translation?.title || bodyOf(ev)?.title || t().notDisclosed(t().TYPE[ev.header.type] || ev.header.type);
const isAi = ev => ev.header.type.startsWith("ai.");

/* ---------- verification ---------- */
// A simulated edit changes the sealed original (and, for display, its translation the same way).
const bump = s => /\b6 (erreurs|picking errors)\b/.test(s) ? s.replace(/\b6 (erreurs|picking errors)\b/, "16 $1") : /\d/.test(s) ? s.replace(/(\d+)/, n => String(Number(n) + 10)) : s + " (modified)";
function editedBody(ev) {
  if (!(ev.id in S.edits)) return ev.body;
  const b = JSON.parse(ev.body); b.text = S.edits[ev.id].original; return JSON.stringify(b);
}
async function verifyOne(ev) {
  const i = S.events.findIndex(e => e.id === ev.id), prev = i > 0 ? S.events[i - 1].entry_hash : GENESIS;
  const header_ok = await sha(canon(ev.header)) === ev.fingerprint;
  const chain_ok = ev.prev === prev && await sha(ev.prev + ev.fingerprint) === ev.entry_hash;
  const links_ok = ev.header.links.every(fp => { const x = S.events.find(e => e.fingerprint === fp); return x && x.seq < ev.seq; });
  const body_ok = ev.body ? await sha(ev.salt + "|" + editedBody(ev)) === ev.header.commitment : null;
  const problems = [];
  if (body_ok === false) problems.push("pBody");
  if (!header_ok) problems.push("pHeader");
  if (!chain_ok) problems.push("pChain");
  if (!links_ok) problems.push("pLinks");
  return { ok: !problems.length, header_ok, chain_ok, links_ok, body_ok, problems };
}
async function verifyCase() {
  const bad = [];
  for (const ev of S.events) { const r = await verifyOne(ev); S.verify[ev.id] = r; if (!r.ok) bad.push({ ev, r }); }
  S.caseCheck = { ok: !bad.length, bad, n: S.events.length, disclosed: S.events.filter(e => e.body).length, anchored: S.events.filter(e => e.receipt).length };
}
const problemText = r => r.problems.map(p => t()[p]).join(" ");

/* ---------- markdown, lite ---------- */
function md(text) {
  const inline = s => esc(s).replace(/\*\*(.+?)\*\*/g, "<b>$1</b>").replace(/^#{1,4}\s*(.+)$/, "<b>$1</b>");
  return text.trim().split(/\n{2,}/).map(block => {
    let html = "", list = [], para = [];
    const flush = () => {
      if (para.length) { html += `<p>${para.map(inline).join("<br>")}</p>`; para = []; }
      if (list.length) { html += `<ul>${list.map(l => `<li>${inline(l)}</li>`).join("")}</ul>`; list = []; }
    };
    for (const line of block.split("\n")) {
      const m = line.match(/^\s*(?:[-*•]|\d+\.)\s+(.*)$/);
      if (m) { if (para.length) flush(); list.push(m[1]); } else { if (list.length) flush(); para.push(line); }
    }
    flush();
    return html;
  }).join("");
}

/* ---------- shell ---------- */
function renderShell() {
  document.documentElement.lang = S.lang;
  document.querySelectorAll("[data-i18n]").forEach(el => { el.textContent = t()[el.dataset.i18n]; });
  document.querySelectorAll("[data-view]").forEach(a => a.classList.toggle("on", a.dataset.view === S.view));
  for (const v of ["assistant", "agenda", "tracabilite"]) $("view-" + v).hidden = v !== S.view;
  const c = S.boot.case, p = me();
  $("caseCard").innerHTML = `<b>${esc(c.title)}</b><span>${esc(c.court)}</span><br><span>${t().stage}: ${esc(c.stage)} · ${esc(c.reference)}</span>`;
  $("me").innerHTML = `<span class="avatar ${p.id}">${esc(p.initials)}</span><span class="who"><b>${esc(p.name)}</b><span>${esc(pick(p.role))}</span></span>`;
  const next = S.agenda.find(it => !it.met && daysTo(it.date) >= 0), d = next ? daysTo(next.date) : null;
  $("agendaBadge").textContent = next ? (d === 0 ? t().today : `D-${d}`) : "";
  $("agendaBadge").className = "badge" + (next && d <= 30 ? " hot" : "");
  $("ledgerBadge").textContent = S.boot.ledger ? S.boot.ledger.length : "";
  const m = S.boot.mistral, j = S.boot.juslib;
  $("model").innerHTML = S.view === "assistant"
    ? `<span class="dot ${m.on ? "on" : ""}"></span>${t().assistant} <small>${m.on ? "Mistral · " + esc(m.model) : t().rulesMode}</small>`
    : S.view === "agenda" ? t().agenda : t().trace;
  $("topRight").innerHTML = `<span class="pill" title="${esc(j.url || "")}"><span class="dot ${j.on ? "on" : ""}"></span>${j.on ? t().juslibOn(esc(j.version)) : t().juslibOff}</span><span class="pill case">${I.doc}${esc(c.title)}</span>`;
  $("fine").textContent = t().fine;
  $("input").placeholder = S.profile === "individual" ? t().phInd : t().phOther;
  const list = convs().filter(c => c.messages.length);
  $("history").innerHTML = list.length
    ? list.slice().reverse().map(c => `<button class="nav-item${c.id === S.current[S.profile] && S.view === "assistant" ? " on" : ""}" data-act="open-conv" data-id="${c.id}" title="${esc(c.title)}">${esc(c.title)}</button>`).join("")
    : `<div class="empty">${t().noChats}</div>`;
}

function renderMenu() {
  const items = Object.values(S.boot.profiles).map(p => `<button class="nav-item" data-act="profile" data-id="${p.id}">
    <span class="avatar ${p.id}" style="width:26px;height:26px;font-size:11px">${esc(p.initials)}</span><span>${esc(p.name)}<br><span style="font-size:12px;color:var(--ink-3)">${esc(pick(p.role))}</span></span>
    ${p.id === S.profile ? `<span class="check">${I.check}</span>` : ""}</button>`).join("");
  const langs = [["en", "English"], ["fr", "Français"]].map(([k, l]) => `<button class="nav-item" data-act="lang" data-k="${k}">${I.globe}${l}${k === S.lang ? `<span class="check">${I.check}</span>` : ""}</button>`).join("");
  $("menu").innerHTML = `<div class="menu-label">${t().switchAccount}</div>${items}<div class="sep"></div>
    <div class="menu-label">${t().language}</div>${langs}<div class="sep"></div>
    <button class="nav-item" data-act="reset">${I.reset}${t().reset}</button>
    <div class="menu-label">${esc(S.boot.case.fictional)}</div>`;
}

/* ---------- assistant ---------- */
function renderThread() {
  const c = conv(), col = $("threadCol");
  if (!c || !c.messages.length) {
    col.innerHTML = `<div class="hello"><h1>${esc(t().greet[S.profile])}</h1><div class="suggest">${t().suggest[S.profile].map(([q, s]) =>
      `<button data-act="ask" data-q="${esc(q)}">${esc(q)}<span>${esc(s)}</span></button>`).join("")}</div></div>`;
    return;
  }
  col.innerHTML = `<div class="msgs">${c.messages.map(renderMsg).join("")}</div>`;
  $("thread").scrollTop = $("thread").scrollHeight;
}
function renderMsg(m, i) {
  if (m.role === "user") return `<div class="msg user"><div class="bubble">${esc(m.text)}</div></div>`;
  if (m.pending) return `<div class="msg ai"><div class="mark">C</div><div class="body"><div class="typing"><i></i><i></i><i></i></div></div></div>`;
  if (m.error) return `<div class="msg ai"><div class="mark">C</div><div class="body"><div class="note">${esc(m.error)}</div></div></div>`;
  const r = m.meta, tags = [];
  tags.push(r.by === "mistral" ? `<span class="tag">Mistral · ${esc(r.model)}</span>` : `<span class="tag">${t().rules}</span>`);
  tags.push(`<button class="tag ok" data-act="turn" data-i="${i}">${I.shield}${t().sealed(r.sealed.seq)}</button>`);
  tags.push(`<span class="tag warn">${t().aiWarn}</span>`);
  if (r.plain) tags.push(`<span class="tag${r.plain.ok ? "" : " warn"}" title="${esc(r.plain.sentences + " sentences")}">${esc((r.plain.ok ? t().plain : t().plainWarn)(r.plain.avg_words, r.plain.longest))}</span>`);
  if (!r.check.ok) tags.push(`<span class="tag bad">${esc(t().noSource(r.check.missing.join(", ")))}</span>`);
  const src = [
    ...r.sources.terms.map((x, j) => `<button class="src" data-act="term" data-i="${i}" data-j="${j}">${I.book}<span><span class="k">${t().kTerm}</span><br><span class="t">${esc(x.term)}</span></span></button>`),
    ...r.sources.events.map(e => `<button class="src" data-act="event" data-id="${e.id}">${I.doc}<span><span class="k">${t().kDoc}${e.receipt ? " · " + t().receipt + " " + esc(e.receipt.receipt_id.slice(0, 11)) : ""}</span><br><span class="t">${esc(e.title)}</span></span></button>`)
  ];
  return `<div class="msg ai"><div class="mark">C</div><div class="body"><div class="answer">${md(m.text)}</div>
    ${r.note ? `<div class="note">${esc(r.note)}</div>` : ""}
    ${src.length ? `<div class="sources">${src.join("")}</div>` : ""}
    <div class="meta" style="margin-top:12px">${tags.join("")}</div></div></div>`;
}
async function send(text) {
  text = text.trim();
  if (!text || S.busy) return;
  if (!conv()) newConv();
  const c = conv();
  if (!c.title) c.title = text.length > 48 ? text.slice(0, 47) + "…" : text;
  const history = c.messages.filter(m => !m.pending && !m.error).map(m => ({ role: m.role === "user" ? "user" : "assistant", text: m.text }));
  c.messages.push({ role: "user", text }, { role: "ai", pending: true });
  S.busy = true; $("input").value = ""; autosize(); $("send").disabled = true;
  renderThread(); renderShell();
  try {
    const r = await api("/api/chat", { method: "POST", body: JSON.stringify({ message: text, history }) });
    c.messages[c.messages.length - 1] = { role: "ai", text: r.text, meta: r };
    S.boot.ledger = { ...S.boot.ledger, length: r.sealed.seq };
    S.events = null;
  } catch (e) {
    c.messages[c.messages.length - 1] = { role: "ai", error: t().cantAnswer(e.message) };
  }
  S.busy = false; saveConvs(); renderThread(); renderShell();
}
function newConv() {
  const c = { id: "c" + Date.now().toString(36), title: "", messages: [] };
  convs().push(c); S.current[S.profile] = c.id; saveConvs();
  return c;
}
const autosize = () => { const x = $("input"); x.style.height = "auto"; x.style.height = Math.min(x.scrollHeight, 200) + "px"; };

/* ---------- agenda ---------- */
function renderAgenda() {
  const w = t();
  let html = `<h1>${w.agenda}</h1><p class="lede">${w.agendaLede}</p>`, month = "";
  for (const it of S.agenda) {
    const [y, m, d] = ymd(it.date), key = `${MONTHS[S.lang][m - 1]} ${y}`, left = daysTo(it.date), time = fmtTime(it.date);
    if (key !== month) { html += `<div class="month">${key}</div>`; month = key; }
    const status = it.met ? `<span class="tag ok">${I.check}${w.met}</span>`
      : left < 0 ? `<span class="tag">${w.passed}</span>` : `<span class="tag${left <= 30 ? " warn" : ""}">${left === 0 ? w.today : w.inDays(left)}</span>`;
    const receipt = it.started_by.receipt ? ` · <a href="${VERIFY_URL(it.started_by.receipt.receipt_id)}" target="_blank" rel="noopener">${w.receipt} ${esc(it.started_by.receipt.receipt_id.slice(0, 11))}</a>` : ` · ${w.pending}`;
    html += `<div class="item"><div class="date-tile"><b>${d}</b><span>${MON[S.lang][m - 1]}</span></div>
      <div class="main-col">
        <h3>${esc(it.title)}</h3>
        <div class="when">${esc(fmtDate(it.date))}${time ? ` ${w.at} ${time}` : ""}${it.place ? " · " + esc(it.place) : ""}${it.set_by ? " · " + esc(w.setBy(it.set_by)) : ""}</div>
        ${it.term ? `<div class="explain">${esc(it.term.explained_text)}</div>` : it.reason ? `<div class="explain">${esc(it.reason)}</div>` : ""}
        <dl class="why">
          <dt>${w.why}</dt><dd><button class="link" data-act="event" data-id="${it.started_by.id}">${esc(it.started_by.title)}</button>, ${esc(stamp(it.started_by.at))}${receipt}</dd>
          <dt>${w.rule}</dt><dd>${esc(it.rule.label)}${it.rule.source ? ` · <a href="${esc(it.rule.source.url)}" target="_blank" rel="noopener">${esc(it.rule.source.label)}</a> <span style="color:var(--ink-3)">(${esc(it.rule.source.status)})</span>` : ""}</dd>
          ${it.met ? `<dt>${w.status}</dt><dd>${esc(it.met.label)}: <button class="link" data-act="event" data-id="${it.met.by.id}">${esc(it.met.by.title)}</button></dd>` : ""}
        </dl>
      </div>
      <div class="side-col">${status}${it.to_confirm ? `<span class="tag">${w.confirm}</span>` : ""}
        <button class="btn" data-act="ask" data-q="${esc(w.explainQ(it.title))}">${w.ask}</button></div></div>`;
  }
  if (!S.agenda.length) html += `<p class="lede">${w.noDates}</p>`;
  $("agendaCol").innerHTML = html;
}

/* ---------- traceability ---------- */
function groups() {
  const out = [];
  for (const ev of S.events) {
    if (!isAi(ev)) { out.push({ kind: "event", ev }); continue; }
    const last = out.at(-1);
    if (!ev.body) { if (last && last.kind === "private") last.evs.push(ev); else out.push({ kind: "private", evs: [ev] }); }
    else if (ev.header.type === "ai.question" || !last || last.kind !== "turn") out.push({ kind: "turn", evs: [ev] });
    else last.evs.push(ev);
  }
  return out;
}
function pinClass(evs) { const rs = evs.map(e => S.verify[e.id]).filter(Boolean); return rs.some(r => !r.ok) ? " bad" : rs.length === evs.length ? " ok" : ""; }
const receiptTag = ev => ev.receipt
  ? `<a class="tag ok" href="${VERIFY_URL(ev.receipt.receipt_id)}" target="_blank" rel="noopener">${I.shield}${t().receiptTag(esc(ev.receipt.receipt_id.slice(0, 11)))}</a>`
  : `<span class="tag">${t().chained}</span>`;
const resultLine = r => r ? (r.ok ? `<div class="result ok">${I.check} ${t().okLine(r.body_ok === null)}</div>` : `<div class="result bad">${esc(problemText(r))}</div>`) : "";

function renderEvent(ev) {
  const w = t(), b = bodyOf(ev), open = S.open.has(ev.id), edited = ev.id in S.edits, orig = S.originals.has(ev.id);
  const links = ev.header.links.map(fp => S.events.find(e => e.fingerprint === fp)).filter(Boolean);
  const text = edited ? (ev.translation && !orig ? S.edits[ev.id].shown : S.edits[ev.id].original) : ev.translation && !orig ? ev.translation.text : b?.text;
  return `<div class="ev${pinClass([ev])}"><div class="rail"><span class="pin"></span></div><div>
    <div class="ev-head" data-act="toggle" data-id="${ev.id}"><span class="t${b ? "" : " muted"}">${esc(titleOf(ev))}</span><span class="d">${esc(stamp(ev.header.at))}</span></div>
    <div class="ev-sub"><span class="tag">${esc(S.boot.actors[ev.header.actor] || ev.header.actor)}</span><span class="tag">${esc(w.TYPE[ev.header.type] || ev.header.type)}</span>${receiptTag(ev)}<span class="fp">#${ev.seq} · ${ev.fingerprint.slice(0, 12)}…</span></div>
    ${open ? `<div class="ev-body">
      ${b ? `<div class="txt${edited ? " edited" : ""}">${esc(text)}</div>${edited ? `<div class="result bad">${w.edited}</div>` : ""}
        ${ev.translation ? `<div class="result" style="color:var(--ink-3)">${orig ? "" : w.translated + " "}<button class="link" data-act="original" data-id="${ev.id}">${orig ? w.hideOriginal : w.showOriginal}</button></div>` : ""}`
          : `<div class="txt" style="color:var(--ink-2)">${w.hidden}</div>`}
      <dl class="kv"><dt>${w.fingerprint}</dt><dd>${ev.fingerprint}</dd><dt>${w.commitment}</dt><dd>${ev.header.commitment}</dd>
        ${links.length ? `<dt>${w.linked}</dt><dd>${links.map(l => `#${l.seq} ${esc(titleOf(l))}`).join("<br>")}</dd>` : ""}
        ${ev.receipt ? `<dt>${w.receiptK}</dt><dd>${esc(ev.receipt.receipt_id)} · ${w.sequence} ${ev.receipt.sequence}</dd>` : ""}</dl>
      <div class="ev-actions"><button class="btn" data-act="verify" data-id="${ev.id}">${I.check}${w.verify}</button>
        ${b ? `<button class="btn" data-act="tamper" data-id="${ev.id}">${edited ? w.undo : w.simulate}</button>` : ""}
        ${ev.receipt ? `<a class="btn" href="${VERIFY_URL(ev.receipt.receipt_id)}" target="_blank" rel="noopener">${I.out}${w.publicReceipt}</a>` : ""}</div>
      ${resultLine(S.verify[ev.id])}
    </div>` : resultLine(S.verify[ev.id] && !S.verify[ev.id].ok ? S.verify[ev.id] : null)}
  </div></div>`;
}
function renderTurn(g) {
  const w = t(), q = g.evs.find(e => e.header.type === "ai.question"), a = g.evs.find(e => e.header.type === "ai.answer");
  const calls = g.evs.filter(e => e.header.type === "ai.tool_call"), refused = g.evs.find(e => e.header.type === "ai.answer.refused");
  const key = "turn-" + g.evs[0].id, open = S.open.has(key), first = g.evs[0], qt = q ? bodyOf(q).text : "";
  return `<div class="ev${pinClass(g.evs)}"><div class="rail"><span class="pin"></span></div><div>
    <div class="ev-head" data-act="toggle" data-id="${key}"><span class="t">${w.exchange}${qt ? ` · “${esc(qt.length > 60 ? qt.slice(0, 59) + "…" : qt)}”` : ""}</span><span class="d">${esc(stamp(first.header.at))}</span></div>
    <div class="ev-sub"><span class="tag">${w.nEvents(g.evs.length)}</span><span class="tag">${w.nCalls(calls.length)}</span>${refused ? `<span class="tag bad">${w.withheld}</span>` : ""}<span class="fp">#${first.seq} – #${g.evs.at(-1).seq}</span></div>
    ${open ? `<div class="ev-body">${a ? `<div class="txt">${esc(bodyOf(a).text)}</div>` : ""}
      <dl class="kv">${g.evs.map(e => `<dt>#${e.seq} ${esc(w.TYPE[e.header.type])}</dt><dd>${e.header.type === "ai.tool_call" ? esc(bodyOf(e).data.tool) + " · " : ""}${e.fingerprint.slice(0, 24)}…${S.verify[e.id] ? (S.verify[e.id].ok ? " ✓" : " ✗") : ""}</dd>`).join("")}</dl>
      <div class="ev-actions"><button class="btn" data-act="verify-group" data-key="${key}">${I.check}${w.verifyExchange}</button></div>
      ${S.verify[key] ? resultLine(S.verify[key]) : ""}</div>` : ""}
  </div></div>`;
}
const renderPrivate = g => `<div class="ev${pinClass(g.evs)}"><div class="rail"><span class="pin"></span></div><div>
  <div class="ev-head"><span class="t muted">${t().privateN(g.evs.length)}</span><span class="d">${esc(stamp(g.evs[0].header.at))}</span></div>
  <div class="ev-sub"><span class="tag">${t().headersOnly}</span><span class="fp">#${g.evs[0].seq} – #${g.evs.at(-1).seq}</span></div></div></div>`;

function renderLedger() {
  const w = t();
  if (!S.events) { $("ledgerCol").innerHTML = `<h1>${w.trace}</h1><p class="lede">${w.loading}</p>`; return; }
  const c = S.caseCheck, gs = groups();
  const shown = gs.filter(g => S.filter === "all" || (S.filter === "case" ? g.kind === "event" : g.kind !== "event"));
  let html = `<h1>${w.trace}</h1><p class="lede">${w.traceLede}</p>
    <div class="toolbar"><button class="btn primary" data-act="verify-all">${I.check}${w.verifyAll}</button>
      <a class="btn" href="/api/export" data-act="export">${I.down}${w.export}</a>
      ${S.profile !== "individual" ? `<button class="btn" data-act="intake">${I.plus}${w.sendEvent}</button>` : ""}</div>`;
  if (c) html += c.ok
    ? `<div class="banner ok"><b>${w.intact}</b><p>${w.intactBody(c.n, c.disclosed, c.anchored)}</p></div>`
    : `<div class="banner bad"><b>${w.broken(c.bad.length)}</b><p>${c.bad.map(x => `#${x.ev.seq} ${esc(titleOf(x.ev))}: ${esc(problemText(x.r))}`).join("<br>")}</p></div>`;
  if (S.intake) html += intakeForm();
  html += `<div class="tabs">${w.tabs.map(([k, l]) => `<button class="${S.filter === k ? "on" : ""}" data-act="filter" data-k="${k}">${l}</button>`).join("")}</div>
    <div class="tl">${shown.map(g => g.kind === "event" ? renderEvent(g.ev) : g.kind === "turn" ? renderTurn(g) : renderPrivate(g)).join("") || `<p class="lede" style="margin-top:16px">${w.nothing}</p>`}</div>
    <p class="fp" style="margin-top:20px">${w.head(S.ledger.head, S.ledger.length)}</p>`;
  $("ledgerCol").innerHTML = html;
}
function intakeForm() {
  const w = t();
  const opts = S.events.filter(e => !isAi(e) && e.body).map(e => `<option value="${e.id}">#${e.seq} ${esc(titleOf(e))}</option>`).join("");
  const types = S.profile === "company" ? Object.keys(w.types) : ["document.sent", "notification.sent"];
  return `<form class="intake" id="intake"><b>${w.intakeTitle}</b>
    <div class="row"><label style="flex:1">${w.type}<select name="type">${types.map(v => `<option value="${v}">${w.types[v]}</option>`).join("")}</select></label>
      <label style="flex:2">${w.linkTo}<select name="link"><option value="">${w.none}</option>${opts}</select></label></div>
    <label>${w.title}<input name="title" required maxlength="200" placeholder="${esc(w.titlePh)}"></label>
    <label>${w.content}<textarea name="text" required rows="3" maxlength="4000" placeholder="${esc(w.contentPh)}"></textarea></label>
    <label class="check"><input type="checkbox" name="share" checked>${w.share}</label>
    <div class="row"><button class="btn primary" type="submit">${w.sealSend}</button><button class="btn" type="button" data-act="intake">${w.cancel}</button></div></form>`;
}

/* ---------- drawer ---------- */
function openDrawer(title, html) { $("drawerTitle").textContent = title; $("drawerBody").innerHTML = html; $("drawer").hidden = false; }
function termDrawer(x) {
  const w = t(), lib = x.library || {};
  openDrawer(w.library, `<h2>${esc(x.term)}</h2><p>${esc(x.explained_text)}</p>
    ${x.core_definition ? `<div class="k">${w.coreDef}</div><p style="margin:4px 0">${esc(x.core_definition)}</p>` : ""}
    <div class="k">${w.officialSource}</div>${x.sources.length ? x.sources.map(s => `<p style="margin:4px 0"><a href="${esc(s.url)}" target="_blank" rel="noopener">${esc(s.label)}</a><br><span style="color:var(--ink-3);font-size:13px">${esc(s.status)}</span></p>`).join("") : `<p style="margin:4px 0;color:var(--ink-2)">${w.noArticle}</p>`}
    <div class="k">${w.explainedBy}</div><p style="margin:4px 0">${lib.version ? esc(w.libOn(lib.version, lib.document_id, lib.canonical_hash_verified)) : x.core ? w.prodCore : w.libOff}</p>
    <div class="k">${w.certainty}</div><p style="margin:4px 0">${w.unverified}</p>
    <div class="k">${w.production}</div><p style="margin:4px 0">${x.core ? w.prodCore : w.prodAi}</p>
    ${x.ai_generated_warning ? `<div class="warnbox">${esc(x.ai_generated_warning)}</div>` : ""}
    <div class="k">${w.juslibId}</div><div class="mono">${esc(x.juslib_id)}</div>
    <div class="k">${w.entryHash}</div><div class="mono">${esc(x.entry_hash)}</div>`);
}
async function eventDrawer(id) {
  if (!S.events) await loadEvents();
  const ev = S.events.find(e => e.id === id);
  if (!ev) return;
  const w = t(), b = bodyOf(ev), r = await verifyOne(ev);
  openDrawer(w.caseDoc, `<h2>${esc(titleOf(ev))}</h2><p style="color:var(--ink-2);margin:0">${esc(S.boot.actors[ev.header.actor])} · ${esc(stamp(ev.header.at))}</p>
    ${b ? `<p>${esc(ev.translation ? ev.translation.text : b.text)}</p>${ev.translation ? `<p style="font-size:13px;color:var(--ink-3)">${w.translated}</p><p style="font-size:13px;color:var(--ink-2)"><i>${esc(b.text)}</i></p>` : ""}` : `<p style="color:var(--ink-2)">${w.hidden}</p>`}
    ${resultLine(r)}
    <div class="k">${w.recReceipt}</div>${ev.receipt ? `<p style="margin:4px 0"><a href="${VERIFY_URL(ev.receipt.receipt_id)}" target="_blank" rel="noopener">${esc(ev.receipt.receipt_id)}</a><br><span style="color:var(--ink-3);font-size:13px">${esc(w.seqSealed(ev.receipt.sequence, stamp(ev.receipt.sealed_at)))}</span></p>` : `<p style="margin:4px 0;color:var(--ink-2)">${w.localOnly}</p>`}
    <div class="k">${w.fingerprint}</div><div class="mono">${ev.fingerprint}</div>
    <div class="k">${w.position}</div><div class="mono">#${ev.seq} · ${ev.entry_hash}</div>
    <p style="margin-top:20px"><a href="#/tracabilite" data-act="goto-event" data-id="${ev.id}">${w.seeInTrace}</a></p>`);
}
async function turnDrawer(m) {
  await loadEvents();
  const w = t(), s = m.meta.sealed;
  const evs = [s.question, ...s.calls, ...(s.refused ? [s.refused] : []), s.answer].map(id => S.events.find(e => e.id === id)).filter(Boolean);
  const rs = await Promise.all(evs.map(verifyOne)), n = evs.at(-1).header.sources.length;
  openDrawer(w.sealedExchange, `<h2>${w.recorded}</h2><p>${w.recordedBody}</p>
    ${evs.map((e, i) => `<div class="k">#${e.seq} · ${esc(w.TYPE[e.header.type])}${e.header.type === "ai.tool_call" ? " · " + esc(bodyOf(e).data.tool) : ""}</div><div class="mono">${e.fingerprint}</div>${rs[i].ok ? `<div class="result ok">${I.check} ${w.intactShort}</div>` : resultLine(rs[i])}`).join("")}
    <div class="k">${w.citedSources}</div><p style="margin:4px 0">${w.nExpl(n)}</p>
    <div class="warnbox">${w.localWarn}</div>`);
}

/* ---------- routing and events ---------- */
async function route() {
  const v = (location.hash.match(/^#\/(\w+)/) || [])[1];
  S.view = ["assistant", "agenda", "tracabilite"].includes(v) ? v : "assistant";
  $("app").classList.remove("side-open");
  renderShell();
  if (S.view === "assistant") { renderThread(); setTimeout(() => $("input").focus(), 0); }
  if (S.view === "agenda") { await loadAgenda(); renderAgenda(); renderShell(); }
  if (S.view === "tracabilite") { renderLedger(); if (!S.events) await loadEvents(); renderLedger(); }
}
async function reload() { S.boot = await api("/api/bootstrap"); S.events = null; S.caseCheck = null; S.verify = {}; S.edits = {}; await loadAgenda(); return route(); }

document.addEventListener("click", async e => {
  const el = e.target.closest("[data-act]");
  if (!el) { if (!e.target.closest("#menu") && !$("menu").hidden) $("menu").hidden = true; return; }
  const act = el.dataset.act;
  switch (act) {
    case "menu": renderMenu(); $("menu").hidden = !$("menu").hidden; return;
    case "profile":
      S.profile = el.dataset.id; store.set("counsel.profile", S.profile); $("menu").hidden = true;
      S.open.clear(); S.intake = false; $("drawer").hidden = true; return reload();
    case "lang": S.lang = el.dataset.k; store.set("counsel.lang", S.lang); $("menu").hidden = true; $("drawer").hidden = true; return reload();
    case "reset":
      $("menu").hidden = true;
      await api("/api/reset", { method: "POST" });
      S.convs = {}; S.current = {}; saveConvs(); S.open.clear(); location.hash = "#/assistant"; return reload();
    case "new-chat": e.preventDefault(); newConv(); location.hash = "#/assistant"; return route();
    case "open-conv": S.current[S.profile] = el.dataset.id; saveConvs(); location.hash = "#/assistant"; return route();
    case "ask": location.hash = "#/assistant"; await route(); if (conv() && conv().messages.length && el.closest(".item")) newConv(); return send(el.dataset.q);
    case "term": { const m = conv().messages[+el.dataset.i]; return termDrawer(m.meta.sources.terms[+el.dataset.j]); }
    case "event": e.preventDefault(); return eventDrawer(el.dataset.id);
    case "turn": return turnDrawer(conv().messages[+el.dataset.i]);
    case "goto-event": S.open.add(el.dataset.id); S.filter = "all"; $("drawer").hidden = true; if (S.view === "tracabilite") renderLedger(); return;
    case "close-drawer": $("drawer").hidden = true; return;
    case "open-side": $("app").classList.add("side-open"); return;
    case "close-side": $("app").classList.remove("side-open"); return;
    case "toggle": { const k = el.dataset.id; S.open.has(k) ? S.open.delete(k) : S.open.add(k); return renderLedger(); }
    case "original": { const k = el.dataset.id; S.originals.has(k) ? S.originals.delete(k) : S.originals.add(k); return renderLedger(); }
    case "filter": S.filter = el.dataset.k; return renderLedger();
    case "verify": { const ev = S.events.find(x => x.id === el.dataset.id); S.verify[ev.id] = await verifyOne(ev); return renderLedger(); }
    case "verify-group": {
      const g = groups().find(g => "turn-" + g.evs[0].id === el.dataset.key);
      const rs = await Promise.all(g.evs.map(async ev => (S.verify[ev.id] = await verifyOne(ev))));
      S.verify[el.dataset.key] = { ok: rs.every(r => r.ok), body_ok: true, problems: [...new Set(rs.flatMap(r => r.problems))] };
      return renderLedger();
    }
    case "verify-all": await verifyCase(); return renderLedger();
    case "tamper": {
      const ev = S.events.find(x => x.id === el.dataset.id);
      if (ev.id in S.edits) delete S.edits[ev.id];
      else { const b = bodyOf(ev); S.edits[ev.id] = { original: bump(b.text), shown: bump(ev.translation ? ev.translation.text : b.text) }; }
      S.verify[ev.id] = await verifyOne(ev);
      if (S.caseCheck) await verifyCase();
      return renderLedger();
    }
    case "intake": S.intake = !S.intake; return renderLedger();
    case "export": return;
  }
});

document.addEventListener("submit", async e => {
  if (e.target.id === "composer") { e.preventDefault(); return send($("input").value); }
  if (e.target.id === "intake") {
    e.preventDefault();
    const f = new FormData(e.target);
    try {
      const r = await api("/api/events", { method: "POST", body: JSON.stringify({ type: f.get("type"), title: f.get("title"), text: f.get("text"), links: f.get("link") ? [f.get("link")] : [], share: f.get("share") === "on" }) });
      S.intake = false; await loadEvents(); S.boot.ledger = S.ledger; S.open.add(r.event.id); S.caseCheck = null;
      renderLedger(); renderShell();
    } catch (err) { alert(err.message); }
  }
});
$("input").addEventListener("input", () => { autosize(); $("send").disabled = !$("input").value.trim() || S.busy; });
$("input").addEventListener("keydown", e => { if (e.key === "Enter" && !e.shiftKey && !e.isComposing) { e.preventDefault(); send($("input").value); } });
document.addEventListener("keydown", e => { if (e.key === "Escape") { $("drawer").hidden = true; $("menu").hidden = true; } });
// The export link must carry the profile and language headers, so it is fetched rather than followed.
document.addEventListener("click", async e => {
  const a = e.target.closest("a[data-act=export]");
  if (!a) return;
  e.preventDefault();
  const r = await fetch("/api/export", { headers: { "x-profile": S.profile, "x-lang": S.lang } });
  const blob = await r.blob(), url = URL.createObjectURL(blob), link = document.createElement("a");
  link.href = url; link.download = `counsel-${S.boot.case.id}-${S.profile}.json`; link.click(); URL.revokeObjectURL(url);
}, true);
window.addEventListener("hashchange", route);

(async function start() {
  S.boot = await api("/api/bootstrap");
  if (!S.boot.profiles[S.profile]) S.profile = "individual";
  await loadAgenda();
  route();
  // JUSLIB may come up after the app: refresh its status once.
  if (!S.boot.juslib.on) setTimeout(async () => { const b = await api("/api/bootstrap"); if (b.juslib.on) { S.boot = b; renderShell(); } }, 35000);
})();
