// The Assistant: Mistral with function calling when a key is set, rules otherwise.
// Every turn is sealed: the question, each tool call, the answer (or its refusal), linked by fingerprint.
// Answers to individuals follow the plain-language principles of ISO 24495-1 (and Part 2, legal communication):
// the answer first, short sentences, everyday words, each legal term explained, the source named, who can help.
import * as L from "./ledger.mjs";
import * as G from "./glossary.mjs";
import * as J from "./juslib.mjs";
import { TOOLS, runTool } from "./tools.mjs";

const KEY = () => (process.env.MISTRAL_API_KEY || "").trim().replace(/^["']|["']$/g, "");
const MODEL = () => process.env.MISTRAL_MODEL || "mistral-large-latest";
const BASE = () => process.env.MISTRAL_BASE || "https://api.mistral.ai";
export const mistralStatus = () => ({ on: !!KEY(), model: MODEL() });

/* ---------- dates ---------- */
const MONTHS = {
  en: ["January", "February", "March", "April", "May", "June", "July", "August", "September", "October", "November", "December"],
  fr: ["janvier", "février", "mars", "avril", "mai", "juin", "juillet", "août", "septembre", "octobre", "novembre", "décembre"]
};
export const fmtDate = (iso, lang = "en") => { const [y, m, d] = iso.slice(0, 10).split("-").map(Number); return `${d} ${MONTHS[lang][m - 1]} ${y}`; };
const fmtTime = (iso, lang) => { const t = iso.slice(11, 16); if (!t || t === "00:00") return ""; const h = Number(t.slice(0, 2)), mn = t.slice(3); return lang === "en" ? ` at ${h}:${mn}` : ` à ${h} h ${mn}`; };
const lower = s => s.charAt(0).toLowerCase() + s.slice(1);

/* ---------- language of the question ---------- */
const FR = /[éèàùâêîôûç]|\b(est|quoi|le|la|les|je|mon|ma|mes|pourquoi|quand|combien|oui|non|bonjour|salut|c'est|dois|suis|quel|quelle|dossier|vas-y|merci)\b/i;
const EN = /\b(what|when|why|how|which|the|my|does|is|am|can|explain|yes|no|hello|hi|should|thanks|please|ok)\b/i;
export const langOf = (message, ui) => FR.test(message) && !EN.test(message) ? "fr" : EN.test(message) && !FR.test(message) ? "en" : ui;

/* ---------- figure check: every number in an answer must come from a source it read ---------- */
const numbers = s => (String(s).replace(/(\d)[\s  .,](?=\d{3}\b)/g, "$1").match(/\d+(?:[.,]\d+)?/g) || []).map(n => String(parseFloat(n.replace(",", "."))));
// Numbers written out in words would slip past the check, so they count as a failure.
const NUMBER_WORDS = /\b(thousand|hundred|twenty|thirty|forty|fifty|sixty|seventy|eighty|ninety|eleven|twelve|thirteen|fourteen|fifteen|sixteen|seventeen|eighteen|nineteen|mille|cent|vingt|trente|quarante|cinquante|soixante|quatorze|quinze|seize|douze|treize|onze)\b/i;
function figureCheck(answer, sourceTexts) {
  const allowed = new Set(sourceTexts.flatMap(numbers));
  const missing = [...new Set(numbers(answer).filter(n => parseFloat(n) > 3 && !allowed.has(n)))];
  const words = answer.match(NUMBER_WORDS);
  if (words) missing.push(`"${words[0]}" (a number written in words)`);
  return { ok: missing.length === 0, missing };
}

/* ---------- plain-language check (ISO 24495-1 guidance, measured, not certified) ---------- */
export function plainCheck(text) {
  // The source and contact lines are reference lists, not prose: they are not measured.
  const prose = text.replace(/\*\*(Where this comes from|Who can help|D'où vient cette information|Qui peut vous aider)[^\n]*/g, "").replace(/\*\*[^*]+\*\*:?/g, "").replace(/^\s*-\s+/gm, "").replace(/\b(art|Me|Mr|n°)\./g, "$1");
  const sentences = prose.split(/(?<=[.!?])\s+|\n+/).map(s => s.trim()).filter(s => /[a-zà-ÿ]/i.test(s));
  const lens = sentences.map(s => s.split(/\s+/).length);
  const avg = lens.length ? Math.round(lens.reduce((a, b) => a + b, 0) / lens.length) : 0, max = Math.max(0, ...lens);
  return { standard: "ISO 24495-1", sentences: lens.length, avg_words: avg, longest: max, ok: avg <= 20 && max <= 30,
    answer_first: /^\*\*(In short|En bref)/.test(text.trim()), source_named: /\*\*(Where this comes from|D'où vient cette information)/.test(text) };
}

/* ---------- system prompt ---------- */
function system(profile, lang) {
  const p = L.PROFILES[profile], c = L.caseInfo("en");
  const lawyer = profile === "individual" ? "the user's lawyer, Me Claire Laurent (a woman)" : "the lawyer in charge of the case";
  const helps = lang === "fr" ? "**Qui peut vous aider :** votre avocate, Me Claire Laurent." : "**Who can help:** your lawyer, Me Claire Laurent.";
  const level = p.level === "citizen"
    ? `The reader is not a lawyer. Write in plain language, following ISO 24495-1 and ISO 24495-2 (legal communication):
   - Start with "**In short:**" and the direct answer in one or two sentences.
   - Then the details under short bold labels (for example "**What it means for you:**", "**Your dates:**").
   - Sentences of 20 words or fewer on average, never more than 30. One idea per sentence. Active voice. Speak to the reader as "you".
   - Everyday words. When a legal term is needed, use the term once and explain it right away in everyday words, from explain_term.
   - When the question touches something with a date in the agenda (a hearing, a deadline), give the reader's own date and what it is for, as the agenda states it.
   - End with "**Where this comes from:**" naming the documents and the official sources used, then exactly this line: ${helps}`
    : "EXPERT level: exact legal terms and article references (saying they are to be checked on Légifrance or EUR-Lex). Concise.";
  return `You are the Counsel Assistant. You are talking to ${p.name} (${L.pick(p.role, "en")}) about the existing case "${c.title}", ${c.court}, current stage: ${c.stage}. Today is ${fmtDate(new Date().toISOString(), "en")}.
Rules, without exception:
1. Answer only from the tools: the case (case_timeline, read_document, agenda, proof) and the JUSLIB library (explain_term, explain_provision). Call the tools before answering. Every date, amount or number in your answer must appear in a tool result. Do not add any fact, rule, procedure step, right or obligation that is not in a tool result, even if you believe it is true. No analogies. If you are not sure, leave it out.
   Write every number with digits and every date as "5 November 2026" in English or "5 novembre 2026" in French (day and year in digits). Never write numbers in words.
2. Explain a legal term only with the text explain_term returned, in your own plain words but adding nothing to it. If a term is not in JUSLIB (for example "professional inadequacy"), quote the document's own words and do not define it yourself. Do not describe what the tribunal, the panel or the parties can or will do beyond what the tool results say.
3. You give information, never legal advice (French law n° 71-1130 of 31 December 1971, art. 54): never say what the user should do, what they will obtain or win, and never compute an amount. For that, refer to ${lawyer}.
4. If no source answers the question, say so simply, and say what you can explain instead.
5. ${level}
6. Answer in ${lang === "fr" ? "French (labels: **En bref :**, **Ce que cela veut dire pour vous :**, **Vos dates :**, **D'où vient cette information :**, **Qui peut vous aider :**)" : "English"} (the language of the question), in 180 words at most, without headings or links. Documents are in French; quote their English translation when answering in English. Do not show technical ids (E6, fingerprints): the interface shows the sources next to your answer.`;
}

/* ---------- Mistral loop ---------- */
async function mistral(messages, exec) {
  for (let round = 0; round < 6; round++) {
    let r, data;
    // One answer takes several calls; on a rate limit (429), wait and try again.
    for (let attempt = 0; attempt < 5; attempt++) {
      const ctrl = new AbortController(), timer = setTimeout(() => ctrl.abort(), 30000);
      try {
        r = await fetch(`${BASE()}/v1/chat/completions`, {
          method: "POST", signal: ctrl.signal,
          headers: { "content-type": "application/json", authorization: `Bearer ${KEY()}` },
          body: JSON.stringify({ model: MODEL(), temperature: 0.2, max_tokens: 700, messages, tools: TOOLS, tool_choice: "auto" })
        });
        data = await r.json().catch(() => ({}));
      } finally { clearTimeout(timer); }
      if (r.status !== 429) break;
      await new Promise(res => setTimeout(res, 1500 * (attempt + 1)));
    }
    if (!r.ok) throw new Error(`Mistral answered ${r.status}${r.status === 401 ? " (key refused)" : r.status === 403 ? ` (${data.message || "forbidden"}: set MISTRAL_MODEL to a model of your tier)` : r.status === 429 ? " (rate limited)" : ""}`);
    const msg = data.choices?.[0]?.message || {};
    const text = Array.isArray(msg.content) ? msg.content.map(c => c.text || "").join("") : (msg.content || "");
    if (msg.tool_calls?.length) {
      messages.push({ role: "assistant", content: text, tool_calls: msg.tool_calls });
      for (const tc of msg.tool_calls) {
        let args = tc.function.arguments || {};
        if (typeof args === "string") { try { args = JSON.parse(args || "{}"); } catch { args = {}; } }
        messages.push({ role: "tool", name: tc.function.name, content: JSON.stringify(await exec(tc.function.name, args)), tool_call_id: tc.id });
      }
      continue;
    }
    // Remove what is not prose: a stray tool-call fragment at the end, horizontal rules.
    const clean = text.replace(/\s*\{"[a-z_]+"\s*:[^{}]*\}\s*$/, "").replace(/^\s*-{3,}\s*$/gm, "")
      .replace(/\s*(\*\*(Where this comes from|Who can help|D'où vient cette information|D’où vient cette information|Qui peut vous aider))/g, "\n\n$1").trim();
    if (!clean) throw new Error("empty answer from Mistral");
    return { text: clean, model: data.model || MODEL() };
  }
  throw new Error("too many tool calls");
}

/* ---------- rules: the same tools, fixed wording, in both languages ---------- */
const RX = {
  yes: /^(yes|yeah|yep|sure|ok|okay|go on|go ahead|please|oui|ouais|d'accord|vas-y|allez|bien sur|volontiers)[\s.!]*$/,
  hello: /^(bonjour|salut|hello|hi|hey|bonsoir|good (morning|afternoon|evening))\b/,
  advice: /(que (dois|devrais|faut)|dois-je|devrais-je|faut-il|conseil|strateg|chances|vais-je gagner|should i|what do i do|what should|advice|will i win|my chances)/,
  money: /(combien|toucher|indemnit|argent|montant|gagner|somme|euros?|how much|money|compensation|amount|get paid)/,
  agenda: /(prochain|echeance|quand|date|agenda|delai|calendrier|next|deadline|when|schedule)/,
  reason: /(pourquoi|motif|raison|why|reason|(ai ete|suis|m'a|me|t'a|a ete|was|got|been) (licencie|dismissed|fired|sacked))/,
  proof: /(preuve|prouv|verifi|modifi|falsifi|authentique|scelle|recognitium|tracabilite|proof|prove|verif|tamper|changed|altered|authentic|sealed)/,
  summary: /(resume|ou en est|etat du dossier|synthese|summar|overview|status of (my|the) case|my case|mon dossier)/,
  disclosed: /(divulgu|pieces de l'employeur|documents de l'employeur|disclos)/,
  article: /\b([lr]\s?\d{4}(?:-\d+)*)\b|article\s+(\d+)/
};
const TIES = {
  "JUSLIB-GLOSSARY-FR-BCO-20261004-001": "hearing", "JUSLIB-GLOSSARY-FR-CONCILIATION-20261004-001": "hearing",
  "JUSLIB-GLOSSARY-FR-AUDIENCE-20261004-001": "hearing", "JUSLIB-GLOSSARY-FR-CONVOCATION-20261004-001": "hearing",
  "JUSLIB-GLOSSARY-FR-PRESCRIPTION-20261004-001": "prescription", "JUSLIB-GLOSSARY-FR-PIECES-20261004-001": "task",
  "JUSLIB-GLOSSARY-FR-LETTRE-LICENCIEMENT-20261004-001": "dismissal_letter", "JUSLIB-GLOSSARY-FR-ENTRETIEN-PREALABLE-20261004-001": "entretien_prealable",
  "JUSLIB-GLOSSARY-FR-REQUETE-20261004-001": "requete", "JUSLIB-GLOSSARY-EU-IA-HAUT-RISQUE-20261004-001": "ai_decision",
  "JUSLIB-GLOSSARY-EU-CONTROLE-HUMAIN-20261004-001": "human_review", "JUSLIB-GLOSSARY-EU-JOURNALISATION-20261004-001": "ai_decision"
};
const W = {
  en: {
    inShort: "In short:", forYou: "What it means for you:", yourDates: "Your dates:", rulesSay: "What the rules say:", docsSay: "What the documents say:",
    whyMatters: "Why it matters:", howWorks: "How it works:", whereFrom: "Where this comes from:", whoHelps: "Who can help:", inCase: "The case so far:",
    hello: (name, title) => `Hello ${name}. Your case "${title}" is open here. Every document and date in it is sealed. I can explain each step and each document, with its source. Would you like a summary of your case?`,
    helloExpert: (name, title) => `Hello ${name}. The case "${title}" is open, with every document and date sealed. Ask about any step, term, deadline or document; each answer cites its sources.`,
    lawyer: { individual: "your lawyer, Me Claire Laurent", other: "the lawyer in charge of the case" },
    leadAdvice: "I can't tell you what to do. That is legal advice, and your lawyer, Me Claire Laurent, gives it.",
    adviceExpert: "The Assistant does not suggest strategy. Here is what the case file sets out:",
    leadMoney: "I can't say how much you will get. Your lawyer, Me Claire Laurent, can work it out with you.",
    moneyExpert: "The Assistant computes no amount. Applicable rules:",
    moneyEnd: "The amount depends on how long you worked there and on your pay.",
    leadReason: "Your employer says your work results were not good enough. The legal term is professional inadequacy.",
    letter: d => `According to the dismissal letter of ${d}, the reason given is professional inadequacy.`,
    score: (d, t) => `On ${d}, an AI system scored your work: ${t}`,
    scoreExpert: (d, t) => `It relies on an automated evaluation of ${d}: ${t}`,
    review: (d, t) => `On ${d}, the warehouse manager reviewed this score. ${t}`,
    highRisk: "An AI system that rates employees' work may count as high-risk under the EU AI Act. Such systems must be documented, logged and overseen by a person.",
    highRiskExpert: "An AI system that evaluates employees' performance may fall within high-risk AI systems under the EU AI Act.",
    requete: "Your application to the tribunal asks for this system's documentation and logs.",
    leadSummary: (stage, next) => `Your case is at the ${lower(stage)} stage.${next ? ` Your next date is ${next}.` : ""}`,
    summary: c => `Case ${c.title}, ${c.court}. Current stage: ${lower(c.stage)}.`,
    undisclosed: n => n > 1 ? `${n} other events exist but are not shared with you. Only their fingerprint is visible.` : "1 other event exists but is not shared with you. Only its fingerprint is visible.",
    next: (t, d) => `Next step: ${lower(t)}, on ${d}.`,
    leadDisclosed: n => `Your employer has shared ${n} documents with you.`,
    disclosed: n => `The employer has disclosed ${n} documents to the parties:`,
    hidden: n => n > 1 ? `${n} other employer documents are not disclosed. Their existence and date are sealed, not their content.` : "1 other employer document is not disclosed. Its existence and date are sealed, not its content.",
    leadProof: "Nobody can change a document in your case without it showing.",
    proof: "Each event is sealed when it happens. Its fingerprint goes on Recognitium. Its content stays private.",
    proofOk: (t, id, d) => `For example, the ${lower(t)}: its fingerprint still matches, so it has not been changed. Receipt ${id}, sealed on ${d}.`,
    proofLocal: t => `For example, the ${lower(t)}: its fingerprint still matches. Its anchoring on Recognitium is pending.`,
    proofNote: "A receipt proves when a document existed and that it has not changed. It does not prove the document is true.",
    noArticle: a => `I have no explanation linked to article ${a} in the JUSLIB library.`,
    article: (a, t) => `Article ${a}: ${t}`,
    hearing: (d, t) => `Your hearing before this panel is on ${d}${t}. The tribunal's registry set this date in its summons.`,
    hearingExpert: (d, t) => `In this case: the hearing before the conciliation and orientation panel is set for ${d}${t}, according to the registry's summons.`,
    prescription: (d, met) => `In your case, the time limit runs until ${d}.${met ? " You are within it: your application has been filed." : ""}`,
    prescriptionExpert: (d, met) => `In this case, the time limit runs until ${d}.${met ? " It has been met: the application was filed." : ""}`,
    caseFile: n => `the sealed case file (${n} events)`,
    task: (t, d) => `${t}: by ${d}.`,
    doc: (t, d, x) => `${t} (${d}): ${x}`,
    leadDates: (d, t) => `Your next date is ${d}: ${lower(t)}.`,
    dates: "Here are the next dates in the case:", noDates: "There is no upcoming date in the case.",
    setBy: who => `set by ${who}`, from: w => `from the ${lower(w)}`, rule: (r, s) => `; rule: ${r}, ${s}`, confirm: " Check this date with your lawyer.",
    source: (labels, status) => ` Source: ${labels} (${status}).`,
    overview: (c, next) => `Your case ${c.title} is open, before the ${c.court}, at the ${lower(c.stage)} stage.${next ? ` Next date: ${next}.` : ""} I can explain any term or document in it, with its source. For example: what the conciliation panel is, why the employer took its decision, or how to prove a document has not been changed.`
  },
  fr: {
    inShort: "En bref :", forYou: "Ce que cela veut dire pour vous :", yourDates: "Vos dates :", rulesSay: "Ce que disent les règles :", docsSay: "Ce que disent les documents :",
    whyMatters: "Pourquoi c'est important :", howWorks: "Comment ça marche :", whereFrom: "D'où vient cette information :", whoHelps: "Qui peut vous aider :", inCase: "Le dossier jusqu'ici :",
    hello: (name, title) => `Bonjour ${name}. Votre dossier « ${title} » est ouvert ici. Chaque document et chaque date y sont scellés. Je peux vous expliquer chaque étape et chaque document, avec sa source. Voulez-vous un résumé de votre dossier ?`,
    helloExpert: (name, title) => `Bonjour ${name}. Le dossier « ${title} » est ouvert, chaque document et chaque date scellés. Interrogez-moi sur une étape, un terme, un délai ou un document ; chaque réponse cite ses sources.`,
    lawyer: { individual: "votre avocate, Me Claire Laurent", other: "l'avocat chargé du dossier" },
    leadAdvice: "Je ne peux pas vous dire quoi faire. C'est un conseil juridique, et c'est votre avocate, Me Claire Laurent, qui le donne.",
    adviceExpert: "L'Assistant ne formule pas de stratégie. Voici ce que prévoit le dossier :",
    leadMoney: "Je ne peux pas dire combien vous allez toucher. Votre avocate, Me Claire Laurent, peut faire ce calcul avec vous.",
    moneyExpert: "L'Assistant ne calcule aucun montant. Règles applicables :",
    moneyEnd: "Le montant dépend du temps passé dans l'entreprise et de votre salaire.",
    leadReason: "Votre employeur dit que vos résultats n'étaient pas suffisants. Le terme juridique est l'insuffisance professionnelle.",
    letter: d => `Selon la lettre de licenciement du ${d}, le motif est l'insuffisance professionnelle.`,
    score: (d, t) => `Le ${d}, un système d'IA a noté votre travail : ${t}`,
    scoreExpert: (d, t) => `Elle s'appuie sur une évaluation automatisée du ${d} : ${t}`,
    review: (d, t) => `Le ${d}, le responsable d'entrepôt a revu ce score. ${t}`,
    highRisk: "Un système d'IA qui note le travail des salariés peut être classé à haut risque par le règlement européen sur l'IA. Il doit alors être documenté, journalisé et surveillé par une personne.",
    highRiskExpert: "Un système d'IA qui évalue la performance de salariés peut relever des systèmes d'IA à haut risque au sens du règlement européen sur l'IA.",
    requete: "Votre requête au tribunal demande la documentation et les journaux de ce système.",
    leadSummary: (stage, next) => `Votre dossier est à l'étape de la ${lower(stage)}.${next ? ` Votre prochaine date est le ${next}.` : ""}`,
    summary: c => `Dossier ${c.title}, ${c.court}. Étape actuelle : ${lower(c.stage)}.`,
    undisclosed: n => n > 1 ? `${n} autres événements existent mais ne vous sont pas partagés. Seule leur empreinte est visible.` : "1 autre événement existe mais ne vous est pas partagé. Seule son empreinte est visible.",
    next: (t, d) => `Prochaine étape : ${lower(t)}, le ${d}.`,
    leadDisclosed: n => `Votre employeur vous a transmis ${n} documents.`,
    disclosed: n => `L'employeur a divulgué ${n} documents aux parties :`,
    hidden: n => n > 1 ? `${n} autres documents de l'employeur ne sont pas divulgués. Leur existence et leur date sont scellées, pas leur contenu.` : "1 autre document de l'employeur n'est pas divulgué. Son existence et sa date sont scellées, pas son contenu.",
    leadProof: "Personne ne peut modifier un document de votre dossier sans que cela se voie.",
    proof: "Chaque événement est scellé au moment où il se produit. Son empreinte est enregistrée sur Recognitium. Son contenu reste privé.",
    proofOk: (t, id, d) => `Par exemple, la ${lower(t)} : son empreinte correspond toujours, elle n'a donc pas été modifiée. Reçu ${id}, scellé le ${d}.`,
    proofLocal: t => `Par exemple, la ${lower(t)} : son empreinte correspond toujours. Son ancrage sur Recognitium est en attente.`,
    proofNote: "Un reçu prouve quand un document existait et qu'il n'a pas changé. Il ne prouve pas que le document dit vrai.",
    noArticle: a => `Je n'ai pas d'explication liée à l'article ${a} dans la bibliothèque JUSLIB.`,
    article: (a, t) => `Article ${a} : ${t}`,
    hearing: (d, t) => `Votre audience devant ce bureau a lieu le ${d}${t}. Le greffe du tribunal a fixé cette date dans sa convocation.`,
    hearingExpert: (d, t) => `Dans ce dossier : l'audience devant le bureau de conciliation et d'orientation est fixée au ${d}${t}, selon la convocation du greffe.`,
    prescription: (d, met) => `Dans votre dossier, le délai court jusqu'au ${d}.${met ? " Vous êtes dans les temps : votre requête a été déposée." : ""}`,
    prescriptionExpert: (d, met) => `Dans ce dossier, le délai court jusqu'au ${d}.${met ? " Il est respecté : la requête a été déposée." : ""}`,
    caseFile: n => `le dossier scellé (${n} événements)`,
    task: (t, d) => `${t} : au plus tard le ${d}.`,
    doc: (t, d, x) => `${t} (${d}) : ${x}`,
    leadDates: (d, t) => `Votre prochaine date est le ${d} : ${lower(t)}.`,
    dates: "Voici les prochaines dates du dossier :", noDates: "Aucune date à venir dans le dossier.",
    setBy: who => `fixée par ${who}`, from: w => `d'après : ${lower(w)}`, rule: (r, s) => ` ; règle : ${r}, ${s}`, confirm: " Vérifiez cette date avec votre avocate.",
    source: (labels, status) => ` Source : ${labels} (${status}).`,
    overview: (c, next) => `Votre dossier ${c.title} est ouvert, devant le ${c.court}, à l'étape de la ${lower(c.stage)}.${next ? ` Prochaine date : ${next}.` : ""} Je peux vous expliquer chaque terme ou document qu'il contient, avec sa source. Par exemple : ce qu'est le bureau de conciliation, pourquoi l'employeur a pris sa décision, ou comment prouver qu'un document n'a pas été modifié.`
  }
};

// Builds the answer as a lead, labelled blocks and sources, then renders it plain (individual) or expert (lawyer, company).
async function rules(profile, message, history, lang, exec) {
  const m = G.norm(message).trim(), w = W[lang], citizen = L.PROFILES[profile].level === "citizen", c = L.caseInfo(lang);
  const who = w.lawyer[profile === "individual" ? "individual" : "other"];
  const D = iso => fmtDate(iso, lang), colon = lang === "fr" ? " : " : ": ";
  const A = { lead: null, blocks: [], terms: [], docs: [] };
  const block = (label, ...lines) => { const body = lines.filter(Boolean); if (body.length) A.blocks.push({ label, lines: body }); };
  const eventOf = kind => L.all().find(ev => L.canSee(ev, profile) && (L.parsed(ev).data || {}).kind === kind);
  const read = async kind => { const ev = eventOf(kind); const d = ev ? await exec("read_document", { event_id: ev.id }) : null; if (d && !d.error) A.docs.push(`${d.title} (${D(d.date)})`); return d && !d.error ? d : null; };
  const term = async t => { const cd = await exec("explain_term", { term: t }); if (!cd.error) A.terms.push(cd); return cd; };
  const termLine = cd => `**${cd.term}**${colon}${cd.explained_text}` + (!citizen && cd.sources.length ? w.source(cd.sources.map(s => s.label).join(", "), cd.sources[0].status) : "");
  let items = null;
  const plan = async () => items || (items = await exec("agenda", {}));
  const upcoming = async () => (await plan()).filter(it => it.date.slice(0, 10) >= new Date().toISOString().slice(0, 10) && !it.met);
  const itemLine = it => `- ${D(it.date)}${fmtTime(it.date, lang)}${colon}${it.title} (${it.set_by ? w.setBy(it.set_by) : w.from(it.why)}${!citizen && it.source ? w.rule(it.rule, it.source) : ""}).${it.to_confirm_by_lawyer ? w.confirm : ""}`;
  let dated = [];
  const loadDated = async () => (dated = await upcoming());
  const nextLabel = () => dated[0] ? `${D(dated[0].date)}` : null;

  const tie = async kind => {
    if (kind === "hearing") { const h = (await plan()).find(it => it.date.includes("T")); return h && (citizen ? w.hearing : w.hearingExpert)(D(h.date), fmtTime(h.date, lang)); }
    if (kind === "prescription") { const p = (await plan()).find(it => it.source && it.date > "2027"); return p && (citizen ? w.prescription : w.prescriptionExpert)(D(p.date), !!p.met); }
    if (kind === "task") { const t = (await plan()).find(it => it.set_by); return t && w.task(t.title, D(t.date)); }
    const doc = await read(kind);
    return doc && w.doc(doc.title, D(doc.date), doc.text);
  };
  const summary = async () => {
    const t = await exec("case_timeline", {});
    await loadDated();
    A.docs.push(w.caseFile(t.events.length));
    A.lead = w.leadSummary(c.stage, nextLabel());
    block(citizen ? w.inCase : null, ...(citizen ? [] : [w.summary(c)]), t.events.map(e => `- ${D(e.date)}${colon}${e.title}`).join("\n"), t.undisclosed ? w.undisclosed(t.undisclosed) : null);
    if (!citizen && dated[0]) block(null, w.next(dated[0].title, D(dated[0].date)));
  };

  const terms = G.detect(message).slice(0, 3);
  const lastAi = [...history].reverse().find(h => h.role !== "user");
  if (RX.yes.test(m) && lastAi) {
    await summary();
  } else if (RX.hello.test(m) && m.length < 40) {
    return (citizen ? w.hello : w.helloExpert)(L.pick(L.PROFILES[profile].first, lang), c.title);
  } else if (RX.advice.test(m)) {
    A.lead = citizen ? w.leadAdvice : w.adviceExpert;
    await loadDated();
    block(w.yourDates, dated.slice(0, 3).map(itemLine).join("\n"));
  } else if (RX.money.test(m) && !terms.some(e => !["JUSLIB-GLOSSARY-FR-SANS-CAUSE-20261004-001", "JUSLIB-GLOSSARY-FR-INDEMNITE-LEGALE-20261004-001"].includes(e.juslib_id))) {
    A.lead = citizen ? w.leadMoney : w.moneyExpert;
    const a = await term("licenciement sans cause réelle et sérieuse"), b = await term("indemnité légale de licenciement");
    block(citizen ? w.rulesSay : null, termLine(a), termLine(b), citizen ? w.moneyEnd : null);
  } else if (RX.reason.test(m) && !terms.length) {
    const letter = await read("dismissal_letter"), score = await read("ai_decision"), review = await read("human_review");
    A.lead = citizen ? w.leadReason : (letter ? w.letter(D(letter.date)) : null);
    const after = s => s.slice(s.indexOf(":") + 1).trim();
    block(citizen ? w.docsSay : null,
      citizen && letter ? w.letter(D(letter.date)) : null,
      score ? (citizen ? w.score : w.scoreExpert)(D(score.date), after(score.text)) : null,
      review ? w.review(D(review.date), review.text.replace(/^[^.]*\.\s*/, "")) : null);
    const hr = await term("système d'IA à haut risque");
    if (citizen) { const rq = await read("requete"); block(w.whyMatters, w.highRisk, rq ? w.requete : null); }
    else block(null, w.highRiskExpert, termLine(hr));
  } else if (RX.summary.test(m) && !terms.length) {
    await summary();
  } else if (RX.disclosed.test(m)) {
    const t = await exec("case_timeline", {});
    const fromCo = t.events.filter(e => e.from === L.actors(lang).company), shared = fromCo.filter(e => e.shared_with_all);
    const hidden = profile === "company" ? fromCo.length - shared.length : t.undisclosed;
    A.lead = citizen ? w.leadDisclosed(shared.length) : w.disclosed(shared.length);
    block(null, shared.map(e => `- ${D(e.date)}${colon}${e.title}`).join("\n"), hidden ? w.hidden(hidden) : null);
  } else if (RX.proof.test(m) && !terms.length) {
    const ev = eventOf("dismissal_letter"), p = ev && await exec("proof", { event_id: ev.id });
    if (p && !p.error) A.docs.push(`${p.title}${p.receipt ? `, ${p.receipt.id}` : ""}`);
    A.lead = citizen ? w.leadProof : w.proof;
    block(citizen ? w.howWorks : null, citizen ? w.proof : null, p && !p.error ? (p.anchored ? w.proofOk(p.title, p.receipt.id, D(p.receipt.sealed_at)) : w.proofLocal(p.title)) : null, w.proofNote);
  } else if (RX.article.test(m)) {
    const [, a1, a2] = m.match(RX.article), art = (a1 || a2).toUpperCase().replace(/\s/g, "");
    const r = await exec("explain_provision", { article: art });
    if (r.error) A.lead = w.noArticle(art);
    else { A.lead = w.article(art, r.official_text); r.explanations.forEach(cd => A.terms.push(cd)); block(null, ...r.explanations.map(termLine)); }
  }

  if (!A.lead && terms.length) {
    for (const [i, e] of terms.entries()) {
      const cd = await term(e.term);
      const t = TIES[e.juslib_id] && await tie(TIES[e.juslib_id]);
      if (i === 0) { A.lead = citizen ? `${cd.term}${colon}${cd.explained_text}` : termLine(cd); block(citizen ? w.forYou : null, t); }
      else block(null, termLine(cd), t);
    }
  } else if (!A.lead && RX.agenda.test(m)) {
    await loadDated();
    A.lead = dated[0] ? (citizen ? w.leadDates(D(dated[0].date), dated[0].title) : w.dates) : w.noDates;
    if (dated.length) block(citizen ? w.yourDates : null, dated.slice(0, 3).map(itemLine).join("\n"));
  }
  if (!A.lead) await loadDated();
  if (!A.lead) return w.overview(c, dated[0] ? `${lower(dated[0].title)}, ${D(dated[0].date)}` : null);

  // Render.
  const out = [citizen ? `**${w.inShort}** ${A.lead}` : A.lead];
  for (const b of A.blocks) out.push(b.label ? `**${b.label}**\n${b.lines.join("\n")}` : b.lines.join("\n\n"));
  if (citizen) {
    const src = [...new Set([...A.docs, ...A.terms.flatMap(cd => cd.sources.map(s => s.label))])];
    if (src.length) out.push(`**${w.whereFrom}** ${src.join(" · ")}.`);
    out.push(`**${w.whoHelps}** ${who}.`);
  }
  return out.filter(Boolean).join("\n\n");
}

/* ---------- one turn ---------- */
export async function chat(profile, message, history = [], uiLang = "en") {
  const lang = langOf(message, uiLang), citizen = L.PROFILES[profile].level === "citizen";
  const lastAnswer = L.all().filter(ev => ev.header.type === "ai.answer" && L.canSee(ev, profile)).at(-1);
  const q = L.append({ type: "ai.question", actor: profile, body: { title: "Question to the Assistant", text: message },
    links: lastAnswer ? [lastAnswer.fingerprint] : [], visible_to: [profile] });

  const calls = [], touchedEvents = new Set(), touchedTerms = new Set(), weak = [], sourceTexts = [message, new Date().toISOString()];
  const exec = async (name, args) => {
    const r = await runTool(profile, name, args, lang);
    r.events.forEach(id => touchedEvents.add(id)); r.terms.forEach(h => touchedTerms.add(h)); weak.push(...r.weak);
    sourceTexts.push(JSON.stringify(r.result));
    const read = [...new Set([...r.events, ...r.weak.map(w => w.event)])];
    const ev = L.append({ type: "ai.tool_call", actor: "ai", visible_to: [profile],
      body: { title: `Tool call: ${name}`, text: JSON.stringify(args), data: { tool: name, args, result: r.result } },
      links: [q.fingerprint, ...read.map(id => L.byId(id).fingerprint)], sources: [...new Set([...r.terms, ...r.weak.map(w => w.term).filter(Boolean)])] });
    calls.push(ev);
    return r.result;
  };

  let text = null, by = "rules", model = "rules", note = null, refused = null;
  // Money and "what should I do" questions always get the fixed, checked refusal: a model's wording could slip into advice.
  const guarded = RX.money.test(G.norm(message)) || RX.advice.test(G.norm(message));
  if (KEY() && !guarded) {
    try {
      const prior = history.slice(-6).filter(h => h && h.text).map(h => ({ role: h.role === "user" ? "user" : "assistant", content: String(h.text).slice(0, 2000) }));
      // Retrieval first: the agenda, the timeline and the terms the question names are fetched (and sealed) before the model writes,
      // so a model that calls too few tools still answers from the case.
      const context = { agenda: await exec("agenda", {}), timeline: await exec("case_timeline", {}),
        terms: await Promise.all(G.detect(message).slice(0, 3).map(e => exec("explain_term", { term: e.term }))) };
      const sys = system(profile, lang) + `\n\nAlready retrieved for you from the tools (use them; call read_document or explain_term for anything else):\n${JSON.stringify(context)}`;
      const r = await mistral([{ role: "system", content: sys }, ...prior, { role: "user", content: message }], exec);
      const check = figureCheck(r.text, sourceTexts);
      if (check.ok) { text = r.text; by = "mistral"; model = r.model; }
      else {
        refused = L.append({ type: "ai.answer.refused", actor: "ai", visible_to: [profile],
          body: { title: "Mistral answer withheld", text: r.text, data: { model: r.model, missing: check.missing } },
          links: [q.fingerprint, ...calls.map(c => c.fingerprint)], sources: [...touchedTerms] });
        note = lang === "fr" ? `Réponse de Mistral retenue : ${check.missing.join(", ")} n'apparaît dans aucune source. Réponse produite par les règles.`
          : `Mistral's answer was withheld: ${check.missing.join(", ")} appears in no source. Answer produced by the rules.`;
      }
    } catch (e) { note = lang === "fr" ? `${e.message}. Réponse produite par les règles.` : `${e.message}. Answer produced by the rules.`; }
  }
  if (!text) text = await rules(profile, message, history, lang, exec);
  const check = figureCheck(text, sourceTexts);
  const plain = citizen ? plainCheck(text) : null;

  // Agenda items become sources only when the answer gives their date; their terms, only when the answer names them.
  const named = new Set(G.detect(text).map(e => e.entry_hash));
  for (const w of weak) {
    if (text.includes(fmtDate(w.date, lang))) touchedEvents.add(w.event);
    if (w.term && named.has(w.term)) touchedTerms.add(w.term);
  }

  const answer = L.append({ type: "ai.answer", actor: "ai", visible_to: [profile],
    body: { title: "Answer from the Assistant", text, data: { by, model, lang, check, plain } },
    links: [q.fingerprint, ...calls.map(c => c.fingerprint), ...(refused ? [refused.fingerprint] : [])], sources: [...touchedTerms] });

  const termCards = [...touchedTerms].map(h => G.byHash(h)).filter(Boolean).map(e => G.card(e, lang));
  // The cards the tools actually returned carry JUSLIB's own explanation; prefer them.
  for (const c of calls) { const res = L.parsed(c).data.result; for (const x of [res, ...(res.explanations || [])]) { const i = termCards.findIndex(t => t.entry_hash === x?.entry_hash); if (i >= 0 && x.library) termCards[i] = x; } }
  // Terms that came along with the agenda: ask JUSLIB for them too, so every card shows where its text comes from.
  for (const [i, tc] of termCards.entries()) if (!tc.library?.version && !tc.core) { const e = G.byHash(tc.entry_hash), lib = await J.explain(e.juslib_id, lang, L.PROFILES[profile].level); if (lib) termCards[i] = G.card(e, lang, lib); }
  const eventCards = [...touchedEvents].map(L.byId).filter(Boolean).map(ev => ({ id: ev.id, title: L.shown(ev, lang).title, at: ev.header.at,
    fingerprint: ev.fingerprint, receipt: L.receipts()[ev.fingerprint] || null }));
  return { text, by, model, note, check, plain, lang,
    sources: { terms: termCards, events: eventCards },
    sealed: { question: q.id, calls: calls.map(c => c.id), answer: answer.id, refused: refused && refused.id, seq: answer.seq, fingerprint: answer.fingerprint } };
}
