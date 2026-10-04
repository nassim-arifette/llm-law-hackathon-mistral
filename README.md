# Counsel

LLM x Law Hackathon Paris #2 (Mistral AI, Stanford CodeX, Sciences Po), 4 October 2026.

Counsel is the lawyer's application for disputes about AI decisions. Underneath, Recognitium seals every AI decision and every bank action where they happen, and binds them together. Article 12 of the AI Act makes logging mandatory for high-risk AI; it does not say how to make logs trustworthy. That is what this does.

## Open it

No server, no install, no internet needed (except to open the public receipt links). Double-click `index.html`, full screen, at least 1000 px wide.

| Page | What it shows |
|---|---|
| `index.html` | The lawyer's workspace. **Week**: planning that never moves a client's deadline. **Evidence**: drop a dispute letter, Counsel finds the contested AI actions, verifies each against its receipt, drafts the plain-language explanation and refuses any figure that contradicts the log, exports a self-verifying evidence file. **AI journal**: every AI action inside Counsel, append-only and chained. |
| `binding.html` | **Decision to money**. An AI approval, a human review and a disbursement bound by fingerprint, in sealed order; a payment with no decision behind it; and the **Live gate**: a day of 600 decisions and 438 payments checked before commit, 11 anomalies blocked, the whole day sealed as one Merkle root. |
| `conversation.html` | **Chatbot dispute**. A customer says the bank's assistant promised 30 days; the bank disclosed 3 of 12 messages; the sealed answer says 14 days. Undisclosed messages stay fingerprints, salted so they cannot be guessed. |
| `PITCH.md` | The 2-minute pitch, the demo clicks in order, and the answers to the jury's likely questions. |

Before going on stage: "Reset the demo" in the left menu of `index.html`.

## What is real, what is not

- The firm, the bank, the customers and every log are **fictional**.
- The receipts are **real**, sealed on Recognitium's production chain on 4 October 2026. Anyone can open them at `https://www.recognitium.com/verify/<receipt id>`. Only fingerprints (32 bytes) were ever sent.
- The letter reading and the plain-language draft are assembled by rules in this demo. In production, Mistral does both on the firm's own servers.
- A receipt proves when a record existed and that it has not changed since. It does not prove that the AI decision was right.

## Do not edit

The bank log in `index.html` (`LOG`), the messages and random values in `conversation.html` (`MSGS`, `SALTS`) and the events and stream in `binding.html` (`CASES`, `STREAM`) are sealed byte for byte. Change one character and the real receipts stop matching. Change the interface freely.

## Next steps for the team

- Wire one live Mistral call (the explanation draft is the natural one; Counsel's figure check still blocks anything Mistral invents). A browser page cannot call the Mistral API from a local file directly: it needs a small local relay.
- Evidence file export for the chatbot case.
