/**
 * Layer: Backend Service
 * Responsibility: Provides the minimal application-level behavior consumed by the root controller contract.
 * Notes: Keep comments focused on intent, invariants, side effects, and cross-module contracts.
 */
import { Injectable } from '@nestjs/common';

@Injectable()
export class AppService {
  getHello(): string {
    return 'Hello World!';
  }
}

