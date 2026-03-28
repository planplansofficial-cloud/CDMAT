/**
 * Lightweight JWT utility using Web Crypto API (HMAC-SHA256).
 *
 * Tokens are signed/verified entirely client-side with a shared secret
 * from VITE_JWT_SECRET.  This gives the session a tamper-evident,
 * expiring envelope without needing a backend endpoint.
 */

const encoder = new TextEncoder();

function base64urlEncode(data) {
  const bytes = typeof data === "string" ? encoder.encode(data) : data;
  let binary = "";
  bytes.forEach((b) => (binary += String.fromCharCode(b)));
  return btoa(binary).replace(/=/g, "").replace(/\+/g, "-").replace(/\//g, "_");
}

function base64urlDecode(str) {
  str = str.replace(/-/g, "+").replace(/_/g, "/");
  while (str.length % 4) str += "=";
  const binary = atob(str);
  const bytes = new Uint8Array(binary.length);
  for (let i = 0; i < binary.length; i++) bytes[i] = binary.charCodeAt(i);
  return bytes;
}

async function getSigningKey() {
  const secret = import.meta.env.VITE_JWT_SECRET;
  if (!secret) {
    throw new Error("VITE_JWT_SECRET is not set");
  }
  return crypto.subtle.importKey(
    "raw",
    encoder.encode(secret),
    { name: "HMAC", hash: "SHA-256" },
    false,
    ["sign", "verify"]
  );
}

/**
 * Create a signed JWT.
 * @param {object} payload  - claims to embed (sub, role, group, …)
 * @param {number} ttlSeconds - token lifetime (default 8 h)
 * @returns {Promise<string>} "header.payload.signature"
 */
export async function signJwt(payload, ttlSeconds = 8 * 60 * 60) {
  const header = { alg: "HS256", typ: "JWT" };
  const now = Math.floor(Date.now() / 1000);
  const fullPayload = { ...payload, iat: now, exp: now + ttlSeconds };

  const headerB64 = base64urlEncode(JSON.stringify(header));
  const payloadB64 = base64urlEncode(JSON.stringify(fullPayload));
  const signingInput = `${headerB64}.${payloadB64}`;

  const key = await getSigningKey();
  const sigBuffer = await crypto.subtle.sign(
    "HMAC",
    key,
    encoder.encode(signingInput)
  );
  const signatureB64 = base64urlEncode(new Uint8Array(sigBuffer));

  return `${signingInput}.${signatureB64}`;
}

/**
 * Verify and decode a JWT.
 * @param {string} token
 * @returns {Promise<object>} decoded payload
 * @throws if signature invalid or token expired
 */
export async function verifyJwt(token) {
  const parts = token.split(".");
  if (parts.length !== 3) throw new Error("Malformed token");

  const [headerB64, payloadB64, signatureB64] = parts;
  const signingInput = `${headerB64}.${payloadB64}`;

  const key = await getSigningKey();
  const sigBytes = base64urlDecode(signatureB64);
  const valid = await crypto.subtle.verify(
    "HMAC",
    key,
    sigBytes,
    encoder.encode(signingInput)
  );

  if (!valid) throw new Error("Invalid signature");

  const payloadJson = new TextDecoder().decode(base64urlDecode(payloadB64));
  const payload = JSON.parse(payloadJson);

  const now = Math.floor(Date.now() / 1000);
  if (payload.exp && payload.exp < now) {
    throw new Error("Token expired");
  }

  return payload;
}
