import crypto from "node:crypto";

/** 12-byte IV + 16-byte auth tag + ciphertext, all base64url-ish (standard base64) for storage in `text` columns. */
export function encryptAes256Gcm(plaintext: string, masterKey: Buffer): string {
  if (masterKey.length !== 32) {
    throw new Error("masterKey must be 32 bytes (AES-256)");
  }
  const iv = crypto.randomBytes(12);
  const cipher = crypto.createCipheriv("aes-256-gcm", masterKey, iv);
  const ciphertext = Buffer.concat([cipher.update(plaintext, "utf8"), cipher.final()]);
  const tag = cipher.getAuthTag();
  return Buffer.concat([iv, tag, ciphertext]).toString("base64");
}

export function decryptAes256Gcm(payloadB64: string, masterKey: Buffer): string {
  if (masterKey.length !== 32) {
    throw new Error("masterKey must be 32 bytes (AES-256)");
  }
  const raw = Buffer.from(payloadB64, "base64");
  const iv = raw.subarray(0, 12);
  const tag = raw.subarray(12, 28);
  const ciphertext = raw.subarray(28);
  const decipher = crypto.createDecipheriv("aes-256-gcm", masterKey, iv);
  decipher.setAuthTag(tag);
  return Buffer.concat([decipher.update(ciphertext), decipher.final()]).toString("utf8");
}

export function parseMasterKeyFromEnv(value: string | undefined): Buffer {
  if (!value) {
    throw new Error("APP_MASTER_KEY is required (32-byte key as base64 or 64-char hex)");
  }
  if (/^[0-9a-fA-F]{64}$/.test(value)) {
    return Buffer.from(value, "hex");
  }
  const buf = Buffer.from(value, "base64");
  if (buf.length !== 32) {
    throw new Error("APP_MASTER_KEY base64 must decode to 32 bytes");
  }
  return buf;
}
