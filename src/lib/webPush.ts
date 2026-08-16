// No "server-only" guard here (unlike most of src/lib): this module is also
// imported by worker-entry.ts's scheduled handler, which is bundled by
// wrangler's esbuild outside Next's react-server module graph — the guard
// would throw unconditionally there instead of only in real client bundles.
import type { PushSubscription as StoredPushSubscription } from "@/db/schema";

/** subject must be "mailto:..." or "https://..." per RFC 8292. */
export interface VapidKeys {
  subject: string;
  /** base64url, raw uncompressed EC point (65 bytes). */
  publicKey: string;
  /** base64url, raw private scalar "d" (32 bytes) — the JWK "d" value. */
  privateKey: string;
}

export interface PushMessagePayload {
  title: string;
  body: string;
  url?: string;
}

export interface PushSendResult {
  ok: boolean;
  /** true when the push service says this subscription is gone (404/410) and should be deleted. */
  expired: boolean;
  status: number;
}

function base64UrlEncode(bytes: Uint8Array): string {
  let binary = "";
  for (const byte of bytes) binary += String.fromCharCode(byte);
  return btoa(binary).replace(/\+/g, "-").replace(/\//g, "_").replace(/=+$/, "");
}

function base64UrlDecode(value: string): Uint8Array {
  const padded = value.replace(/-/g, "+").replace(/_/g, "/") + "===".slice((value.length + 3) % 4);
  const binary = atob(padded);
  const bytes = new Uint8Array(binary.length);
  for (let i = 0; i < binary.length; i += 1) bytes[i] = binary.charCodeAt(i);
  return bytes;
}

// TS's dom lib types Uint8Array as generic over its backing buffer, which
// makes it structurally incompatible with BufferSource/ArrayBuffer params
// even though every Uint8Array we construct here is plain-ArrayBuffer-backed
// at runtime. Cast at the Web Crypto call sites instead of fighting the type.
function asBuf(bytes: Uint8Array): BufferSource {
  return bytes as BufferSource;
}

function concatBytes(...arrays: Uint8Array[]): Uint8Array {
  const total = arrays.reduce((sum, array) => sum + array.length, 0);
  const out = new Uint8Array(total);
  let offset = 0;
  for (const array of arrays) {
    out.set(array, offset);
    offset += array.length;
  }
  return out;
}

async function hmacSha256(keyBytes: Uint8Array, data: Uint8Array): Promise<Uint8Array> {
  const key = await crypto.subtle.importKey("raw", asBuf(keyBytes), { name: "HMAC", hash: "SHA-256" }, false, ["sign"]);
  return new Uint8Array(await crypto.subtle.sign("HMAC", key, asBuf(data)));
}

/** HKDF (RFC 5869) with a single 32-byte-max output block — enough for the 16/12/32-byte keys Web Push needs. */
async function hkdf(salt: Uint8Array, ikm: Uint8Array, info: Uint8Array, length: number): Promise<Uint8Array> {
  const prk = await hmacSha256(salt, ikm);
  const block = await hmacSha256(prk, concatBytes(info, new Uint8Array([1])));
  return block.slice(0, length);
}

async function signVapidJwt(endpoint: string, vapid: VapidKeys): Promise<string> {
  const publicKeyBytes = base64UrlDecode(vapid.publicKey);
  const privateKey = await crypto.subtle.importKey(
    "jwk",
    {
      kty: "EC",
      crv: "P-256",
      x: base64UrlEncode(publicKeyBytes.slice(1, 33)),
      y: base64UrlEncode(publicKeyBytes.slice(33, 65)),
      d: vapid.privateKey,
    },
    { name: "ECDSA", namedCurve: "P-256" },
    false,
    ["sign"],
  );

  const encoder = new TextEncoder();
  const header = base64UrlEncode(encoder.encode(JSON.stringify({ typ: "JWT", alg: "ES256" })));
  const claims = base64UrlEncode(
    encoder.encode(
      JSON.stringify({
        aud: new URL(endpoint).origin,
        exp: Math.floor(Date.now() / 1000) + 12 * 60 * 60,
        sub: vapid.subject,
      }),
    ),
  );
  const unsigned = `${header}.${claims}`;
  const signature = await crypto.subtle.sign({ name: "ECDSA", hash: "SHA-256" }, privateKey, asBuf(encoder.encode(unsigned)));
  return `${unsigned}.${base64UrlEncode(new Uint8Array(signature))}`;
}

/**
 * Encrypts `plaintext` per RFC 8291 ("aes128gcm" content coding, RFC 8188).
 * Assumes the whole message fits in a single record (true for our short
 * notification payloads — no multi-record chunking is implemented).
 */
async function encryptPayload(
  plaintext: Uint8Array,
  subscription: Pick<StoredPushSubscription, "p256dh" | "auth">,
): Promise<Uint8Array> {
  const uaPublicRaw = base64UrlDecode(subscription.p256dh);
  const authSecret = base64UrlDecode(subscription.auth);

  const uaPublicKey = await crypto.subtle.importKey("raw", asBuf(uaPublicRaw), { name: "ECDH", namedCurve: "P-256" }, false, []);
  const senderKeyPair = await crypto.subtle.generateKey({ name: "ECDH", namedCurve: "P-256" }, true, ["deriveBits"]);
  const senderPublicRaw = new Uint8Array(await crypto.subtle.exportKey("raw", senderKeyPair.publicKey));

  const sharedSecret = new Uint8Array(
    await crypto.subtle.deriveBits({ name: "ECDH", public: uaPublicKey }, senderKeyPair.privateKey, 256),
  );

  const encoder = new TextEncoder();
  const keyInfo = concatBytes(encoder.encode("WebPush: info\0"), uaPublicRaw, senderPublicRaw);
  const ikm = await hkdf(authSecret, sharedSecret, keyInfo, 32);

  const salt = crypto.getRandomValues(new Uint8Array(16));
  const cek = await hkdf(salt, ikm, encoder.encode("Content-Encoding: aes128gcm\0"), 16);
  const nonce = await hkdf(salt, ikm, encoder.encode("Content-Encoding: nonce\0"), 12);

  const aesKey = await crypto.subtle.importKey("raw", asBuf(cek), { name: "AES-GCM" }, false, ["encrypt"]);
  const padded = concatBytes(plaintext, new Uint8Array([2])); // 0x02 = last (only) record delimiter, no extra padding
  const ciphertext = new Uint8Array(
    await crypto.subtle.encrypt({ name: "AES-GCM", iv: asBuf(nonce) }, aesKey, asBuf(padded)),
  );

  const recordSize = new Uint8Array(4);
  new DataView(recordSize.buffer).setUint32(0, 4096, false);
  const header = concatBytes(salt, recordSize, new Uint8Array([senderPublicRaw.length]), senderPublicRaw);
  return concatBytes(header, ciphertext);
}

/** Sends one Web Push notification. Never throws — check the returned result instead. */
export async function sendPushNotification(
  subscription: Pick<StoredPushSubscription, "endpoint" | "p256dh" | "auth">,
  message: PushMessagePayload,
  vapid: VapidKeys,
): Promise<PushSendResult> {
  try {
    const plaintext = new TextEncoder().encode(JSON.stringify(message));
    const [body, jwt] = await Promise.all([encryptPayload(plaintext, subscription), signVapidJwt(subscription.endpoint, vapid)]);

    const response = await fetch(subscription.endpoint, {
      method: "POST",
      headers: {
        "content-type": "application/octet-stream",
        "content-encoding": "aes128gcm",
        ttl: String(60 * 60 * 24),
        authorization: `vapid t=${jwt}, k=${vapid.publicKey}`,
      },
      body: asBuf(body) as BodyInit,
    });
    return { ok: response.ok, expired: response.status === 404 || response.status === 410, status: response.status };
  } catch {
    return { ok: false, expired: false, status: 0 };
  }
}
