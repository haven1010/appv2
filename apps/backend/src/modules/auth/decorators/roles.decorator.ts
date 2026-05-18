/**
 * Layer: Backend Decorator
 * Responsibility: Declares reusable route metadata for the Auth module through the Roles helper.
 * Notes: Keep comments focused on intent, invariants, side effects, and cross-module contracts.
 */
import { SetMetadata } from '@nestjs/common';
import { UserRole } from '../../user/entities/sys-user.entity';

export const ROLES_KEY = 'roles';
export const Roles = (...roles: UserRole[]) => SetMetadata(ROLES_KEY, roles);
