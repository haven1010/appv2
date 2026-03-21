/**
 * Layer: Backend Guard
 * Responsibility: Implements the Jwt Auth authorization check that runs before protected Auth routes execute.
 * Notes: Keep comments focused on intent, invariants, side effects, and cross-module contracts.
 */
import { Injectable } from '@nestjs/common';
import { AuthGuard } from '@nestjs/passport';

@Injectable()
export class JwtAuthGuard extends AuthGuard('jwt') {}
