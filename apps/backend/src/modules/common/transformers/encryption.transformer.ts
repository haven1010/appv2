/**
 * Layer: Persistence Transformer
 * Responsibility: Implements the Encryption adapter that transforms values between application memory and database storage.
 * Notes: Keep comments focused on intent, invariants, side effects, and cross-module contracts.
 */
import { ValueTransformer } from 'typeorm';
import { decryptSensitiveValue, encryptSensitiveValue } from '../utils/crypto.util';

export class EncryptionTransformer implements ValueTransformer {
  to(value: string): string {
    return encryptSensitiveValue(value);
  }

  from(value: string): string {
    try {
      return decryptSensitiveValue(value);
    } catch (e) {
      return value;
    }
  }
}
