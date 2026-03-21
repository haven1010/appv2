/**
 * Layer: Backend Utility
 * Responsibility: Provides the Crypto helper used by shared infrastructure without owning business workflow state.
 * Notes: Keep comments focused on intent, invariants, side effects, and cross-module contracts.
 */
import * as crypto from 'crypto';

const CURRENT_ENCRYPTION_VERSION = 'v2';
const LEGACY_DEFAULT_AES_KEY = 'CaiZhiTong2025AES32ByteKey123456';
const LEGACY_DEFAULT_AES_IV = '0123456789012345';
const ALGORITHM = 'aes-256-cbc';

function normalizeKey(input: string): Buffer {
  const raw = Buffer.from(input, 'utf8');
  if (raw.length === 32) {
    return raw;
  }
  if (raw.length < 32) {
    return crypto.createHash('sha256').update(input).digest();
  }
  return raw.subarray(0, 32);
}

function normalizeIv(input: string): Buffer {
  const raw = Buffer.from(input, 'utf8');
  if (raw.length === 16) {
    return raw;
  }
  if (raw.length < 16) {
    return crypto.createHash('md5').update(input).digest();
  }
  return raw.subarray(0, 16);
}

function getRequiredEncryptionKey(): Buffer {
  const key = process.env.AES_KEY;
  if (!key) {
    throw new Error('AES_KEY is required for sensitive data encryption');
  }
  return normalizeKey(key);
}

function getLegacySecrets(): Array<{ key: Buffer; iv: Buffer }> {
  const currentKey = process.env.AES_KEY;
  const currentIv = process.env.AES_IV;
  const secrets: Array<{ key: Buffer; iv: Buffer }> = [];

  if (currentKey) {
    secrets.push({
      key: normalizeKey(currentKey),
      iv: normalizeIv(currentIv || LEGACY_DEFAULT_AES_IV),
    });
  }

  if (currentKey !== LEGACY_DEFAULT_AES_KEY || currentIv !== LEGACY_DEFAULT_AES_IV) {
    secrets.push({
      key: normalizeKey(LEGACY_DEFAULT_AES_KEY),
      iv: normalizeIv(LEGACY_DEFAULT_AES_IV),
    });
  }

  return secrets;
}

export function encryptSensitiveValue(plaintext: string): string {
  if (!plaintext) {
    return plaintext;
  }

  const key = getRequiredEncryptionKey();
  const iv = crypto.randomBytes(16);
  const cipher = crypto.createCipheriv(ALGORITHM, key, iv);
  let encrypted = cipher.update(plaintext, 'utf8', 'hex');
  encrypted += cipher.final('hex');

  return `${CURRENT_ENCRYPTION_VERSION}:${iv.toString('hex')}:${encrypted}`;
}

export function decryptSensitiveValue(ciphertext: string): string {
  if (!ciphertext) {
    return ciphertext;
  }

  if (ciphertext.startsWith(`${CURRENT_ENCRYPTION_VERSION}:`)) {
    const [, ivHex, encryptedHex] = ciphertext.split(':');
    if (!ivHex || !encryptedHex) {
      throw new Error('Invalid encrypted payload format');
    }

    const decipher = crypto.createDecipheriv(
      ALGORITHM,
      getRequiredEncryptionKey(),
      Buffer.from(ivHex, 'hex'),
    );
    let decrypted = decipher.update(encryptedHex, 'hex', 'utf8');
    decrypted += decipher.final('utf8');
    return decrypted;
  }

  for (const secret of getLegacySecrets()) {
    try {
      const decipher = crypto.createDecipheriv(ALGORITHM, secret.key, secret.iv);
      let decrypted = decipher.update(ciphertext, 'hex', 'utf8');
      decrypted += decipher.final('utf8');
      return decrypted;
    } catch (error) {
      continue;
    }
  }

  return ciphertext;
}

export function hashSensitiveValue(value: string): string {
  if (!value) {
    return value;
  }
  return crypto.createHash('sha256').update(value).digest('hex');
}

export function isLegacyEncryptedValue(value: string): boolean {
  return Boolean(value) && !value.startsWith(`${CURRENT_ENCRYPTION_VERSION}:`);
}
