# Counsel · pitch for the jury (2 minutes)

## 0:00 · Hook (15 s)

A bank's AI approves a loan in milliseconds, and the money moves a second later. No human can check that. From December 2027 the AI Act makes logging mandatory for this kind of AI, and when a customer contests, the question in court will be: show me what the machine did, and prove nobody changed it since.

## 0:15 · Product (10 s)

Article 12 makes logging mandatory. It doesn't say how to make logs trustworthy. We do. Recognitium is the evidence infrastructure: it seals every AI decision and every bank action where they happen, and binds them together. Counsel is the lawyer's application on top: it turns a dispute into verified evidence in seconds.

## 0:25 · Demo (75 s)

**The gate.** One day of a bank: 600 AI decisions, 438 payments. Every payment must cite a sealed decision. I run it: the whole day is checked in forty milliseconds. Eleven payments are blocked before the money moved: an approval used twice, an amount above the approval, a payment citing a refusal, a forged one. The whole day is one receipt, and any single payment proves itself with eleven hashes.

**The letter.** Now a refused applicant asks why. We drop his letter. Counsel reads the reference, the legal bases and the one-month deadline, and pulls his five AI actions, each with its own receipt. Everyone else stays a fingerprint. I change one word in a line: verification fails.

**The explanation.** The law gives him the right to a clear explanation. Mistral drafts it live, in plain language, from the sealed lines only. I change the score from 412 to 432: Counsel refuses, because the letter would contradict the evidence, whoever wrote it.

## 1:40 · Close (20 s)

Machines check every transition; people set the rules and review what is blocked. Mistral writes, Recognitium proves, and nothing Mistral writes can contradict the record.

We don't promise to win the case. A receipt proves when a record existed and that it hasn't changed, not that the AI was right. We make sure the evidence is believed.

Banks will spend the next ten years defending AI decisions. We give them, and their lawyers, logs nobody can argue about.

---

## Demo setup and clicks

Two browser tabs, full screen, prepared before going on stage:
- **Tab 1:** `binding.html`, tab "Live gate · machine speed".
- **Tab 2:** http://localhost:8787 (relay running with the Mistral key, see the README; the left menu must say "Mistral connected"), after "Reset the demo". If the wifi fails, double-click `index.html` instead: the draft falls back to rules and the page says so.

1. **Tab 1:** "Run the day's stream". Point at Blocked: 11, Verification: about 40 ms, and the green line "Matches receipt". Click the row "Cites a fingerprint that is not in the sealed chain", then "Verify inclusion".
2. **Tab 2:** Evidence, then "Use the sample letter". Search bar: `DG-b7b28343`, Enter, "Verify this line", "Simulate an edit", "Verify this line".
3. "Explain to the applicant": change 412 to 432, "Approve and seal" (refused). Pause one second. Back to 412, "Approve and seal".

If time is short, skip the inclusion proof in step 1 and the edit in step 2. Keep the 412 to 432 refusal: it is the moment the jury will remember.

## If the jury asks

- **Is this mandatory under Article 12?** The obligation is: providers of high-risk AI must build in automatic logging, and deployers such as banks must keep the logs (at least six months, Article 26). The method is not: Article 12 does not require cryptographic sealing, and its technical standards (prEN 18229-1, ISO/IEC 24970) are not finished. We are one strong way to meet it, because a log the bank itself could edit is weak evidence. Never say "our solution is mandatory".
- **So is it a legal app?** Two layers, two buyers. Recognitium is compliance and evidence infrastructure, bought by the bank's technology, risk or compliance teams, paid per receipt. Counsel is the legal application on top, bought by law firms and in-house legal teams. The legal value is why the infrastructure is worth paying for; the infrastructure is the product.
- **How fast, really?** About 25 000 to 30 000 records per second in a browser, with SHA-256 only. A native service inside the bank is far faster. High volume is batched into a Merkle tree: one receipt per batch, an 11-hash inclusion proof per record.
- **What does the gate check?** Five things, before the state change commits: the cited decision exists in the sealed chain, it approves, it matches the contract and the amount, it was sealed before the request, and it was never used before. One decision authorises one change. Refusals are sealed with their reason, so failed attempts are evidence too.
- **"Never used" needs a memory.** The gate keeps the set of used decisions, and every use is sealed, so a double use cannot be hidden afterwards.
- **Can you prove the money followed the decision?** "Decision to money", first tab: the AI approval, the analyst's confirmation and the disbursement each carry the fingerprint of the step before, sealed in order. Edit the AI decision and both later steps show a broken link. Second tab: a payment citing no decision after an AI refusal is flagged at once.
- **How do you link a transaction, a conversation and the AI's actions without seeing the content?** "Words and money". Each record is sealed as a public header plus a private body. The header carries a case tag (a fingerprint of the case key mixed with a secret only the bank holds: same tag for every record of the case, reveals nothing), the fingerprints of the records it refers to, and a commitment to its body. Counsel receives only headers and receipts, and proves without reading a word that the six records belong to the same case, that the assistant's lookup and answer point to the transfer, that the dispute points to the transfer and the request, and that each was sealed after what it refers to. Then the bank opens two bodies: each matches its commitment, and every fact in the answer (amount, payee, reference, channel, time) appears in the transfer. Change one word of the answer and both checks fail.
- **What can't it prove?** A decision or a payment that was never recorded. But every payment that went through the gate carries its proof, so a payment without one becomes visible instead of silent.
- **The lawyer's agenda?** Week view: "Add an urgent file", then "Delegate 2 hours to the associate". No other client's deadline moves.
- **Is a lawyer's tool itself high-risk under the AI Act?** No. We say "Article 12-ready", not "compliant": we apply the high-risk logging standard voluntarily.
- **Is the receipt legally binding?** It is evidence the judge weighs, admissible between businesses by any means (art. L110-3 Code de commerce). It is not a qualified timestamp under eIDAS.
- **Two identical log lines?** Same text, same fingerprint, so anyone can recheck it. But each seal is a single-use commitment: its own receipt, its own place in the chain, its own nanosecond. Each record is also sealed with a random value, so short records cannot be guessed from their fingerprint.
- **Does the lawyer see all the bank's logs?** No. Sealing runs in the background at the bank. In a dispute, the bank discloses only the contested lines in clear; everything else reaches the lawyer as fingerprints, enough to check the whole chain and nothing more.
- **And a chatbot?** "Chatbot dispute": a customer says the bank's assistant promised 30 days to cancel. The bank disclosed 3 of 12 messages; the sealed answer says 14 days, last day 16 September, clause 9. Here the log protects the bank; in another case it would not, and that is why a judge believes it.
- **Why now for banks?** Credit scoring of individuals is high-risk under the AI Act (Annex III). The new Consumer Credit Directive gives consumers the right to human intervention and to an explanation of automated creditworthiness decisions, applying from late November 2026 (check the article before quoting it).
- **Who pays?** The bank pays per receipt for the proof layer; the law firm pays for Counsel.
- **Where is the data?** At the bank and at the firm. Only fingerprints, 32 bytes each, ever leave.
- **What is real?** The bank, firm, customers and logs are fictional. The receipts are real, on the production chain: anyone can open them at recognitium.com/verify.
