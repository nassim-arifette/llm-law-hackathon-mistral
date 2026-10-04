// Builds the fictional demo case once: node app/scripts/seed.mjs
// Its fingerprints are then sealed on Recognitium (data/receipts.json). Never rebuild it after sealing:
// the salts are random, so a rebuild changes every fingerprint and the receipts stop matching.
import { existsSync, writeFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { GENESIS, newSalt, sha256 } from "../lib/crypto.mjs";
import { build } from "../lib/ledger.mjs";

const out = fileURLToPath(new URL("../data/case.json", import.meta.url));
if (existsSync(out) && !process.argv.includes("--force")) { console.log("data/case.json exists; it is sealed, leave it. (--force to rebuild)"); process.exit(1); }

const ALL = ["individual", "lawyer", "company"], PARTIES = ["individual", "lawyer"], COMPANY = ["company"];
const caseSalt = newSalt(), id = "CPH-PARIS-F-26-04417";
const info = {
  id, title: "Karim B. c/ Horizon Logistique SAS", court: "Conseil de prud'hommes de Paris, section Commerce",
  reference: "RG F 26/04417 (fictif)", stage: "Conciliation", members: ["individual", "lawyer", "company"],
  case_tag: sha256("case|" + id + "|" + caseSalt), case_salt: caseSalt,
  fictional: "Toutes les personnes, entreprises, documents et journaux de ce dossier sont fictifs."
};

const defs = [
  { at: "2026-06-02T09:14:00+02:00", type: "company.ai_decision", actor: "company", visible_to: ALL, links: [],
    body: { title: "Score de performance calculé par l'IA (PerfScore v2)",
      text: "Évaluation automatisée de la performance de M. Karim B., préparateur de commandes, par le système PerfScore v2 : score de 41 sur 100, seuil d'alerte 50. Facteurs principaux : cadence de préparation inférieure de 18 % à l'objectif sur 3 mois, erreurs de préparation signalées.",
      data: { kind: "ai_decision", system: "PerfScore v2", score: 41, threshold: 50 } } },
  { at: "2026-06-05T16:40:00+02:00", type: "company.human_review", actor: "company", visible_to: ALL, links: [0],
    body: { title: "Compte rendu de la revue humaine du score",
      text: "Le responsable d'entrepôt a revu le score de 41 sur 100 lors d'un entretien d'évaluation. Il constate 6 erreurs de préparation sur le trimestre et propose d'engager une procédure pour insuffisance professionnelle.",
      data: { kind: "human_review", errors: 6 } } },
  { at: "2026-06-08T11:00:00+02:00", type: "company.internal_note", actor: "company", visible_to: COMPANY, links: [1],
    body: { title: "Note interne des ressources humaines",
      text: "Vérifier l'ancienneté et le calcul de l'indemnité légale avant l'envoi de la convocation à entretien préalable.",
      data: { kind: "internal_note" } } },
  { at: "2026-06-10T10:00:00+02:00", type: "notification.sent", actor: "company", visible_to: ALL, links: [1],
    body: { title: "Convocation à l'entretien préalable",
      text: "Lettre recommandée avec avis de réception convoquant M. Karim B. à un entretien préalable à un éventuel licenciement, le 18 juin 2026 à 14 h, au siège de l'entreprise.",
      data: { kind: "convocation_entretien", meeting_at: "2026-06-18T14:00:00+02:00" } } },
  { at: "2026-06-18T14:45:00+02:00", type: "meeting.held", actor: "company", visible_to: ALL, links: [3],
    body: { title: "Entretien préalable tenu",
      text: "Entretien préalable tenu le 18 juin 2026 en présence de M. Karim B., assisté d'un conseiller du salarié. Motif exposé par l'employeur : insuffisance professionnelle.",
      data: { kind: "entretien_prealable" } } },
  { at: "2026-06-25T09:30:00+02:00", type: "document.sent", actor: "company", visible_to: ALL, links: [1, 4],
    body: { title: "Lettre de licenciement",
      text: "Lettre de licenciement pour insuffisance professionnelle, envoyée en recommandé avec avis de réception. Motif : résultats insuffisants mesurés par l'évaluation automatisée du 2 juin 2026 et confirmés par la revue du 5 juin 2026. Préavis de 2 mois.",
      data: { kind: "dismissal_letter" } } },
  { at: "2026-06-27T10:12:00+02:00", type: "notification.received", actor: "individual", visible_to: ALL, links: [5],
    body: { title: "Lettre de licenciement reçue",
      text: "Avis de réception de la lettre de licenciement signé par M. Karim B. le 27 juin 2026.",
      data: { kind: "dismissal_notified", date: "2026-06-27" } } },
  { at: "2026-09-15T15:20:00+02:00", type: "document.filed", actor: "lawyer", visible_to: ALL, links: [6],
    body: { title: "Requête déposée au conseil de prud'hommes de Paris",
      text: "Requête de M. Karim B. contestant son licenciement. Demandes : dommages et intérêts pour licenciement sans cause réelle et sérieuse ; communication de la documentation et des journaux du système PerfScore v2 ayant servi à l'évaluation. 14 pièces jointes.",
      data: { kind: "requete", pieces: 14 } } },
  { at: "2026-09-29T09:00:00+02:00", type: "notification.received", actor: "court", visible_to: ALL, links: [7],
    body: { title: "Convocation devant le bureau de conciliation et d'orientation",
      text: "Le greffe du conseil de prud'hommes de Paris convoque les parties devant le bureau de conciliation et d'orientation le 5 novembre 2026 à 9 h 30, section Commerce. Les parties sont invitées à se communiquer leurs pièces avant l'audience.",
      data: { kind: "convocation_bco", hearing_at: "2026-11-05T09:30:00+01:00", place: "Conseil de prud'hommes de Paris, section Commerce" } } },
  { at: "2026-10-02T18:05:00+02:00", type: "deadline.set", actor: "lawyer", visible_to: PARTIES, links: [8],
    body: { title: "Échéance fixée : communiquer les pièces à l'employeur",
      text: "Communiquer le bordereau et les 14 pièces à l'avocat de l'employeur au plus tard le 29 octobre 2026, une semaine avant l'audience de conciliation.",
      data: { kind: "task", due: "2026-10-29", label: "Communiquer les 14 pièces à l'employeur", term: "pièces" } } },
  { at: "2026-10-02T18:30:00+02:00", type: "deadline.set", actor: "company", visible_to: COMPANY, links: [8],
    body: { title: "Échéance fixée : transmettre les pièces de l'employeur",
      text: "Transmettre à l'avocat de l'entreprise la documentation et les journaux de PerfScore v2 demandés dans la requête, au plus tard le 28 octobre 2026.",
      data: { kind: "task", due: "2026-10-28", label: "Transmettre la documentation de PerfScore v2 à l'avocat", term: "journalisation" } } }
];

const events = [];
defs.forEach((d, i) => {
  const prev = i ? events[i - 1].entry_hash : GENESIS;
  events.push(build({ seq: i + 1, prev, caseTag: info.case_tag, type: d.type, actor: d.actor, at: d.at, body: d.body,
    links: d.links.map(j => events[j].fingerprint), sources: [], visible_to: d.visible_to }));
});

writeFileSync(out, JSON.stringify({ case: info, events }, null, 2));
console.log(`${events.length} events written to data/case.json`);
for (const e of events) console.log(e.id, e.fingerprint, JSON.parse(e.body).title);
