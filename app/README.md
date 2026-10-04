# Counsel app

The application from the specification: one case shared by an individual, their lawyer and the company, in three sections. English by default; French from the account menu (bottom left).

- **Assistant** (the chat, in the middle): answers questions about the case from its sealed events and from the JUSLIB library, and from nothing else. Every answer shows its sources; every number in it must appear in a source, or the answer is withheld. Information, never legal advice.
- **Agenda**: hearings, deadlines and tasks, each computed from a sealed event, a rule and its official source.
- **Traceability**: every event of the case in sealed order. Verify one event, the whole case, simulate an edit, export the evidence file. The company and the lawyer can send new events, sealed on arrival.

The three sections are linked. Each answer in the chat has "Saved in Traceability", which opens its entry. Each date in the Agenda links to the document that set it. In Traceability, an entry that set a date shows "Added to the Agenda" and leads back to it. Traceability checks the whole case when it opens and says, first, whether anything has changed; the fingerprints and receipts stay under "Technical proof".

Every exchange with the Assistant is one entry in Traceability: the question, the answer, the tools used and the sources, recorded together and chained to the case. The tool calls are kept inside that entry, not as separate entries.

## Run it

Node 18 or later, nothing to install. From the repository root:

```powershell
node app/server.mjs
```

Then open http://localhost:8791. Switch between Karim B. (individual), Me Claire Laurent (lawyer) and Horizon Logistique SAS (company), and between English and French, from the account button at the bottom left. "Reset the demo" in the same menu clears the conversations and the events added since start.

## Mistral

Without a key, the Assistant answers by rules, using the same tools, and says "rules mode" in its header. To have Mistral answer, put your key in `app/.env` (this file is ignored by git and never leaves your machine), then restart the server:

```powershell
Set-Content -Path app\.env -Value "MISTRAL_API_KEY=<your key>" -Encoding ascii
```

The key stays on the server. Before Mistral writes, Counsel fetches the agenda, the timeline and the terms the question names (each a sealed tool call) and gives them to the model; Mistral can then call the six tools for anything else: `case_timeline`, `read_document`, `explain_term`, `explain_provision`, `agenda`, `proof`. If Mistral writes a number that no tool returned, or writes a number in words, the answer is withheld, sealed as withheld, and replaced by the rules answer. Questions about money or about what to do always get the fixed rules answer, so no model wording can slip into legal advice.

Choose the model with `MISTRAL_MODEL` in `app/.env`; the default is `mistral-large-latest`. Tested live on 4 October 2026 with `mistral-large-latest` (used for the demo: grounded answers, the user's own dates, about 4 seconds an answer), `mistral-medium-latest` (faster, but it left out the hearing date) and `ministral-14b-latest`. Large allows 15 requests a minute on the hackathon key; an answer takes one or two, and the app waits and retries on a rate limit.

## JUSLIB (github.com/vgactech/JUSBIB)

Counsel uses the JUSLIB library as a separate service. Clone it next to this repository and run its API with `uv` (no system Python needed):

```powershell
git clone https://github.com/vgactech/JUSBIB.git ..\JUSBIB
cd ..\JUSBIB
uv run --no-project --python 3.12 --with-requirements requirements.txt uvicorn juslib.api.main:app --app-dir src --port 8765
```

When Counsel starts (or as soon as JUSLIB answers, retried every 30 seconds), it:

- imports its 29 glossary entries, in English and French, through `/v1/corpus/import/unverified`. These texts are drafts, not fetched by an official connector, so JUSLIB stores them as `client_provided` and never serves them at expert level;
- explains each term through JUSLIB's plain-language engine (`/v1/explain`), which also checks the stored text against its canonical hash;
- adds JUSLIB's own core glossary (`/v1/glossary`), such as nullity or legal remedy;
- with JUSLIB 0.3.0 or later, records each French text as a version of a provision and its English text as a translation of that version (`/v1/translation`). JUSLIB links the translation to the version by hash and never treats it as a legal source; Counsel checks that link (`/v1/translation/{id}/integrity`) each time it shows an English explanation, and says so in the term panel.

The header shows the JUSLIB version when it is connected (0.3.0 at the time of writing). If JUSLIB is not running, Counsel uses the same texts from `data/glossary.json` (JUSLIB's field names) and each source card says so. `JUSLIB_URL` changes the address (default http://127.0.0.1:8765). JUSLIB is AGPL-3.0: Counsel calls it over HTTP and contains none of its code.

## Plain language for individuals

Answers to an individual follow the plain-language principles of ISO 24495-1 and ISO 24495-2 (legal communication): the answer first ("In short"), then the details under plain labels, short sentences, "you", each legal term explained where it appears, the sources named ("Where this comes from") and who can help. Mistral receives the same rules. Each answer to an individual is measured (average and longest sentence) and the measure is shown under it. This follows the standard's guidance; it is not a certification, which would need testing with readers. Lawyers and companies get the expert format.

## What is real

- The case, the people, the company and every document are **fictional**.
- The 11 case events are sealed on Recognitium's production chain (receipts in `data/receipts.json`, sequences 178 231 to 178 243, sealed on 4 October 2026). Only fingerprints were sent. Anyone can check one at `https://www.recognitium.com/verify/<receipt id>`. The events are dated June to October 2026 in the story; their receipts prove they existed on 4 October 2026, not earlier.
- The case documents are in French, as sealed. The English version shown (`data/translations.en.json`) is an unofficial translation and is not sealed; the interface says so and shows the original on request. Verification always uses the sealed original.
- Events added while the app runs (Assistant turns, company events) are chained locally in `data/runtime/ledger.json`. Anchoring them on Recognitium needs server-side Recognitium credentials, still to set up.
- Verification runs in the browser with SHA-256, the same formulas as `lib/crypto.mjs`, so the exported file can be checked without trusting the server.
- The glossary texts were drafted with AI and are marked unverified until a lawyer checks each article and validates the text. The Légifrance and EUR-Lex links were checked.

## Do not edit

`data/case.json` and `data/receipts.json` are sealed byte for byte. Running `scripts/seed.mjs` again draws new salts and breaks every receipt; it refuses to overwrite without `--force`.

## Files

- `server.mjs`: serves the interface and the API; reads `app/.env`.
- `lib/ledger.mjs`: events, headers and private bodies, chaining, visibility per account, translations.
- `lib/assistant.mjs`: Mistral loop, rules fallback, figure check, plain-language check, sealing of each turn.
- `lib/tools.mjs`: the six tools.
- `lib/juslib.mjs`: the JUSLIB client.
- `lib/agenda.mjs`: deadlines from events and rules.
- `lib/glossary.mjs`: term lookup in English and French.
- `public/`: the interface (`index.html`, `styles.css`, `app.js`).
