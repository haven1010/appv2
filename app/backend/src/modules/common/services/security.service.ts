/**
 * Layer: Backend Service
 * Responsibility: Implements the Security application service for the Common module, including business rules, side effects, and persistence coordination.
 * Notes: Keep comments focused on intent, invariants, side effects, and cross-module contracts.
 */
import { Injectable } from '@nestjs/common';
import {
  decryptSensitiveValue,
  encryptSensitiveValue,
  hashSensitiveValue,
} from '../utils/crypto.util';

@Injectable()
export class SecurityService {
  /**
   * Encrypts plaintext using AES-256-CBC
   * @param text Plain text
   * @returns Hex string of encrypted data
   */
  encrypt(text: string): string {
    return encryptSensitiveValue(text);
  }

  /**
   * Decrypts hex string using AES-256-CBC
   * @param encryptedText Hex string
   * @returns Plain text
   */
  decrypt(encryptedText: string): string {
    return decryptSensitiveValue(encryptedText);
  }

  /**
   * Generates SHA-256 hash for exact matching (since we can't search encrypted columns efficiently)
   * @param text Plain text
   * @returns Hash string
   */
  hash(text: string): string {
    return hashSensitiveValue(text);
  }
}
