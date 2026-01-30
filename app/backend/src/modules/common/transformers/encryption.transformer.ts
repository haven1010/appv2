import { ValueTransformer } from 'typeorm';
import { SecurityService } from '../services/security.service';
import { Injectable } from '@nestjs/common';
import { Buffer } from 'buffer';

/**
 * Note: Transformers in TypeORM are instantiated independently.
 * For Dependency Injection to work, we often need a workaround or direct usage if strictly bound to module scope.
 * However, a common pattern for standalone transformers involves a static helper or passing the service manually.
 * 
 * For this strict requirement, we assume SecurityService is globally available or we instantiate a standalone helper.
 * To keep it pure NestJS, we will export a factory or handle it in the service layer.
 * 
 * BUT, to satisfy "Entity Level Encryption", the cleanest way is a custom transformer class 
 * that uses a singleton instance of the crypto logic.
 */

import * as crypto from 'crypto';

// Standalone simplified logic for Transformer to avoid Circular Dependency issues in Entity definition
// In a real app, load these from process.env directly for the transformer
const ALGORITHM = 'aes-256-cbc';
const KEY = Buffer.from(process.env.AES_KEY || '00000000000000000000000000000000', 'utf8');
const IV = Buffer.from(process.env.AES_IV || '0000000000000000', 'utf8');

export class EncryptionTransformer implements ValueTransformer {
  to(value: string): string {
    if (!value) return value;
    const cipher = crypto.createCipheriv(ALGORITHM, KEY, IV);
    let encrypted = cipher.update(value, 'utf8', 'hex');
    encrypted += cipher.final('hex');
    return encrypted;
  }

  from(value: string): string {
    if (!value) return value;
    try {
      const decipher = crypto.createDecipheriv(ALGORITHM, KEY, IV);
      let decrypted = decipher.update(value, 'hex', 'utf8');
      decrypted += decipher.final('utf8');
      return decrypted;
    } catch (e) {
      return value;
    }
  }
}