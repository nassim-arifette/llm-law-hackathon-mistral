// Fingerprints shared by the server and the browser (app/public/app.js computes the same values).
// Header: public, sealed. Body: private, committed to with a random salt so a short text cannot be guessed.
import { createHash, randomBytes } from "node:crypto";

export const GENESIS = "0".repeat(64);
export const sha256 = s => createHash("sha256").update(s, "utf8").digest("hex");
export const newSalt = () => randomBytes(16).toString("hex");

// Array form, so key order can never differ between implementations.
export const canonicalHeader = h => JSON.stringify([h.v, h.case_tag, h.type, h.actor, h.at, h.links, h.commitment, h.sources]);
export const fingerprintOf = h => sha256(canonicalHeader(h));
export const commitmentOf = (salt, body) => sha256(salt + "|" + body);
export const entryHashOf = (prev, fingerprint) => sha256(prev + fingerprint);
