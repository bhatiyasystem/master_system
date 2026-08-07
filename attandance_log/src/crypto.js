import crypto from 'node:crypto';

const KEY_BYTES_TO_ALGO = {
  16: 'aes-128-ecb',
  24: 'aes-192-ecb',
  32: 'aes-256-ecb',
};

/**
 * Mirrors the page's client-side login encryption:
 *   CryptoJS.AES.encrypt(password, CryptoJS.enc.Utf8.parse(secretKey), {
 *     mode: CryptoJS.mode.ECB, padding: CryptoJS.pad.Pkcs7
 *   }).toString()
 * CryptoJS treats a WordArray key as raw bytes (no KDF), so this is plain
 * AES-ECB/PKCS7 keyed with the UTF-8 bytes of secretKey, base64-encoded.
 */
export function encryptPassword(password, secretKey) {
  const keyBuffer = Buffer.from(secretKey, 'utf8');
  const algo = KEY_BYTES_TO_ALGO[keyBuffer.length];
  if (!algo) {
    throw new Error(`Unexpected login key length (${keyBuffer.length} bytes) — the portal's encryption scheme may have changed.`);
  }
  const cipher = crypto.createCipheriv(algo, keyBuffer, null);
  const encrypted = Buffer.concat([cipher.update(password, 'utf8'), cipher.final()]);
  return encrypted.toString('base64');
}
