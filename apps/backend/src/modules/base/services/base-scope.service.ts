/**
 * Layer: Backend Service
 * Responsibility: Resolves which bases a user can own or supervise across business modules.
 * Notes: Keep comments focused on intent, invariants, side effects, and cross-module contracts.
 */
import { ForbiddenException, Injectable, NotFoundException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { In, Repository } from 'typeorm';
import { BaseInfo } from '../entities/base-info.entity';
import { BaseSupervisorAssignment } from '../entities/base-supervisor-assignment.entity';
import { SysUser, UserRole, isSuperAdmin } from '../../user/entities/sys-user.entity';

type ScopedUser = {
  id: number;
  role?: string;
  roleKey?: UserRole;
};

@Injectable()
export class BaseScopeService {
  constructor(
    @InjectRepository(BaseInfo)
    private readonly baseRepo: Repository<BaseInfo>,
    @InjectRepository(BaseSupervisorAssignment)
    private readonly assignmentRepo: Repository<BaseSupervisorAssignment>,
    @InjectRepository(SysUser)
    private readonly userRepo: Repository<SysUser>,
  ) {}

  private resolveRole(user: ScopedUser): string | undefined {
    return user.role ?? user.roleKey;
  }

  private dedupeBaseIds(values: Array<number | null | undefined>): number[] {
    return Array.from(
      new Set(
        values
          .map((item) => Number(item || 0))
          .filter((item) => Number.isInteger(item) && item > 0),
      ),
    );
  }

  async getOwnedBaseIds(ownerId: number): Promise<number[]> {
    const bases = await this.baseRepo.find({
      where: {
        ownerId,
        isDeleted: false,
      },
      select: ['id'],
    });
    return bases.map((item) => Number(item.id));
  }

  async getSupervisedBaseIds(user: ScopedUser): Promise<number[] | null> {
    const role = this.resolveRole(user);
    if (!role) return [];

    if (isSuperAdmin(role)) {
      return null;
    }

    if (role === UserRole.BOSS) {
      return this.getOwnedBaseIds(user.id);
    }

    if (role !== UserRole.BASE_MANAGER && role !== UserRole.FIELD_MANAGER) {
      return [];
    }

    const [assignments, legacyUser] = await Promise.all([
      this.assignmentRepo.find({
        where: {
          userId: user.id,
          roleKey: role as UserRole,
        },
        select: ['baseId'],
      }),
      this.userRepo.findOne({
        where: { id: user.id, isDeleted: false },
        select: ['assignedBaseId'],
      }),
    ]);

    const assignmentIds = assignments.map((item) => Number(item.baseId));
    const legacyIds =
      role === UserRole.BASE_MANAGER
        ? await this.getOwnedBaseIds(user.id)
        : [Number(legacyUser?.assignedBaseId || 0)];

    return this.dedupeBaseIds([...assignmentIds, ...legacyIds]);
  }

  async getManagedBases(user: ScopedUser): Promise<BaseInfo[]> {
    const scopedBaseIds = await this.getSupervisedBaseIds(user);
    if (scopedBaseIds === null) {
      return this.baseRepo.find({
        where: { isDeleted: false },
        order: { createdAt: 'DESC' },
      });
    }

    if (scopedBaseIds.length === 0) {
      return [];
    }

    return this.baseRepo.find({
      where: {
        id: In(scopedBaseIds),
        isDeleted: false,
      },
      order: { createdAt: 'DESC' },
    });
  }

  async assertCanSuperviseBase(user: ScopedUser, baseId: number): Promise<BaseInfo> {
    const normalizedBaseId = Number(baseId);
    const base = await this.baseRepo.findOne({
      where: { id: normalizedBaseId, isDeleted: false },
    });
    if (!base) {
      throw new NotFoundException('Base not found');
    }

    const scopedBaseIds = await this.getSupervisedBaseIds(user);
    if (scopedBaseIds === null) {
      return base;
    }

    if (!scopedBaseIds.includes(normalizedBaseId)) {
      throw new ForbiddenException('无权管理该基地');
    }

    return base;
  }

  async assertCanOwnBase(user: ScopedUser, baseId: number): Promise<BaseInfo> {
    const normalizedBaseId = Number(baseId);
    const base = await this.baseRepo.findOne({
      where: { id: normalizedBaseId, isDeleted: false },
    });
    if (!base) {
      throw new NotFoundException('Base not found');
    }

    if (Number(base.ownerId || 0) !== Number(user.id || 0)) {
      throw new ForbiddenException('无权操作该基地');
    }

    return base;
  }
}
