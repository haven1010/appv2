import { Injectable } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import * as crypto from 'crypto';
import { Buffer } from 'buffer';

@Injectable()
export class SecurityService {
  private readonly algorithm = 'aes-256-cbc';
  private readonly key: Buffer;
  private readonly iv: Buffer;

  constructor(private configService: ConfigService) {
    // Key must be 32 bytes (256 bits)
    const keyString = this.configService.get<string>('AES_KEY') || '00000000000000000000000000000000'; 
    // IV must be 16 bytes
    const ivString = this.configService.get<string>('AES_IV') || '0000000000000000';

    // Convert key string to buffer and ensure it's exactly 32 bytes
    // If not 32 bytes, use SHA-256 hash to generate a 32-byte key
    const keyBuffer = Buffer.from(keyString, 'utf8');
    if (keyBuffer.length === 32) {
      this.key = keyBuffer;
    } else if (keyBuffer.length < 32) {
      // Use SHA-256 hash to generate exactly 32 bytes from the input
      this.key = crypto.createHash('sha256').update(keyString).digest();
    } else {
      // If longer than 32 bytes, truncate to 32 bytes
      this.key = keyBuffer.slice(0, 32);
    }

    // Convert IV string to buffer and ensure it's exactly 16 bytes
    // If not 16 bytes, use MD5 hash to generate a 16-byte IV (MD5 always produces 16 bytes)
    const ivBuffer = Buffer.from(ivString, 'utf8');
    if (ivBuffer.length === 16) {
      this.iv = ivBuffer;
    } else if (ivBuffer.length < 16) {
      // Use MD5 hash to generate exactly 16 bytes from the input
      this.iv = crypto.createHash('md5').update(ivString).digest();
    } else {
      // If longer than 16 bytes, truncate to 16 bytes
      this.iv = ivBuffer.slice(0, 16);
    }
  }

  /**
   * Encrypts plaintext using AES-256-CBC
   * @param text Plain text
   * @returns Hex string of encrypted data
   */
  encrypt(text: string): string {
    if (!text) return text;
    const cipher = crypto.createCipheriv(this.algorithm, this.key, this.iv);
    let encrypted = cipher.update(text, 'utf8', 'hex');
    encrypted += cipher.final('hex');
    return encrypted;
  }

  /**
   * Decrypts hex string using AES-256-CBC
   * @param encryptedText Hex string
   * @returns Plain text
   */
  decrypt(encryptedText: string): string {
    if (!encryptedText) return encryptedText;
    try {
      const decipher = crypto.createDecipheriv(this.algorithm, this.key, this.iv);
      let decrypted = decipher.update(encryptedText, 'hex', 'utf8');
      decrypted += decipher.final('utf8');
      return decrypted;
    } catch (error) {
      console.error('Decryption failed:', error);
      return null; // Or throw error depending on requirement
    }
  }

  /**
   * Generates SHA-256 hash for exact matching (since we can't search encrypted columns efficiently)
   * @param text Plain text
   * @returns Hash string
   */
  hash(text: string): string {
    if (!text) return text;
    return crypto.createHash('sha256').update(text).digest('hex');
  }
}