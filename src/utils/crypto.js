/**
 * SHA-256 Hashing Utilities
 *
 * Uses the native Web Crypto API (SubtleCrypto) — zero dependencies.
 */

const encoder = new TextEncoder();

/**
 * Compute the full SHA-256 hex digest of a string.
 * @param {string} message
 * @returns {Promise<string>} 64-char lowercase hex string
 */
export async function sha256(message) {
  const data = encoder.encode(message);
  const hashBuffer = await crypto.subtle.digest("SHA-256", data);
  const hashArray = Array.from(new Uint8Array(hashBuffer));
  return hashArray.map((b) => b.toString(16).padStart(2, "0")).join("");
}

/**
 * Hash a password for storage.
 * @param {string} plaintext
 * @returns {Promise<string>}
 */
export async function hashPassword(plaintext) {
  return sha256(plaintext);
}

/**
 * Compare a plaintext password against a stored SHA-256 hash.
 * @param {string} plaintext
 * @param {string} storedHash
 * @returns {Promise<boolean>}
 */
export async function verifyPassword(plaintext, storedHash) {
  const hashed = await sha256(plaintext);
  return hashed === storedHash;
}

/**
 * Generate a truncated user hash for audit logs.
 * Replaces the collision-prone btoa().slice(0, 8) approach.
 * @param {string} userId
 * @returns {Promise<string>} 16-char hex string (8 bytes of SHA-256)
 */
export async function hashUserId(userId) {
  const full = await sha256(userId);
  return full.slice(0, 16);
}

/**
 * Hash a vote choice ID so the stored value is opaque.
 * Truncated to 48 chars to fit Appwrite string attribute limits.
 * @param {string} choiceId  e.g. "opt_1"
 * @param {string} pollId
 * @returns {Promise<string>}
 */
export async function hashChoiceId(choiceId, pollId) {
  const full = await sha256(choiceId + pollId);
  return full.slice(0, 48);
}

/**
 * Generate a deterministic, Appwrite-safe vote document ID.
 * Always starts with 'v' (letter) so Appwrite accepts it.
 * Same userId + pollId always produces the same ID — guarantees one-time voting.
 * @param {string} userId
 * @param {string} pollId
 * @returns {Promise<string>}
 */
export async function generateVoteId(userId, pollId) {
  const hash = await sha256(userId + "::" + pollId);
  return "v" + hash.slice(0, 31);
}
