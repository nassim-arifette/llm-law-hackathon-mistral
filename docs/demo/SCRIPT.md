# Demo script

Voice-over for [counsel-demo.mp4](counsel-demo.mp4) (55 s, about 125 words). Everything in the demo is fictional.

| Time | On screen | Voice |
| --- | --- | --- |
| 0:00 | Home | "This is Counsel: one legal case, shared by the employee, his lawyer and his employer." |
| 0:03 | "What is the conciliation panel?" | "Karim asks in his own words. Mistral answers from his case file and from JUSLIB, a legal library built on traceable sources. The answer comes first, then his own hearing date, then where it comes from." |
| 0:13 | Term panel | "Every legal term links to its explanation and to the official text." |
| 0:17 | "How much will I get?" | "Ask for an amount, and it stops. Information, never legal advice: that is his lawyer's job." |
| 0:23 | Traceability | "Every question and every answer is saved. Each visit re-checks the whole case. The case documents are sealed on Recognitium, a public register." |
| 0:32 | Agenda | "Every date comes from a sealed document and a legal rule. 'Why' opens that document." |
| 0:40 | A document is changed | "Someone edits a document after the fact. Counsel shows it at once." |
| 0:48 | End card | "Mistral answers. JUSLIB explains. Recognitium seals. The past cannot be rewritten." |

## What each scene shows

1. **The case.** One employment dispute before the Paris employment tribunal, seen by Karim (employee), Me Laurent (his lawyer) and Horizon Logistique (employer). Each account sees only what it is entitled to.
2. **The answer.** `mistral-large-latest` with six tools (timeline, documents, JUSLIB terms and articles, agenda, proof). The agenda, the timeline and the terms in the question are fetched before Mistral writes. A number that appears in no source, or a number written in words, withholds the answer. For non-lawyers, answers follow ISO 24495-1 and 24495-2 guidance and are measured; this is guidance, not certification.
3. **JUSLIB.** A verifiable legal corpus layer for AI: every item has its source URL and SHA-256 fingerprint, versions are never overwritten, what the AI writes stays apart from the legal source, and each statement has a certainty level. With 0.3.0, each English explanation is recorded as a translation of the French version, linked by fingerprint, never normative. Counsel's 29 explanations are AI drafts awaiting a lawyer's validation.
4. **The limit.** Money and "what should I do" questions always get the same fixed answer: legal advice is reserved to regulated professions in France (law 71-1130, art. 54).
5. **Traceability.** Each exchange is one entry (question, answer, sources). The browser recomputes every fingerprint on each visit and compares the 11 sealed documents with their Recognitium receipts. A receipt proves when a document existed and that it has not changed, not that it is true. Chat entries are chained in the case, not yet on Recognitium.
6. **Agenda.** No date is typed: the hearing comes from the registry's summons, the 12-month limit to contest the dismissal from the notification and the Code du travail, art. L1471-1.
7. **The change.** "6 errors" becomes "16": the fingerprint no longer matches what was sealed.

## Do not claim

- A larger corpus than commercial legal platforms.
- Certification (plain language, AI Act).
- That a receipt proves the content is true.
- That the case documents were sealed on their story dates: they were sealed on 4 October 2026, and the interface says so.
