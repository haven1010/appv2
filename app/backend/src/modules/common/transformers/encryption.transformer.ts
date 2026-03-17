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
