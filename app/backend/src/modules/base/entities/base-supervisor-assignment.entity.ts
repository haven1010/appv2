/**
 * Layer: Persistence Entity
 * Responsibility: Defines supervisor assignments between bases and internal management roles.
 * Notes: Keep comments focused on intent, invariants, side effects, and cross-module contracts.
 */
import {
  Column,
  CreateDateColumn,
  Entity,
  Index,
  JoinColumn,
  ManyToOne,
  PrimaryGeneratedColumn,
  UpdateDateColumn,
} from 'typeorm';
import { BaseInfo } from './base-info.entity';
import { SysUser, UserRole } from '../../user/entities/sys-user.entity';

@Entity('base_supervisor_assignment')
@Index('UQ_base_supervisor_assignment_base_user', ['baseId', 'userId'], { unique: true })
@Index('IDX_base_supervisor_assignment_user_role', ['userId', 'roleKey'])
export class BaseSupervisorAssignment {
  @PrimaryGeneratedColumn({ type: 'bigint' })
  id: number;

  @Column({ name: 'base_id', type: 'bigint', comment: '基地 ID' })
  baseId: number;

  @ManyToOne(() => BaseInfo, { onDelete: 'CASCADE' })
  @JoinColumn({ name: 'base_id' })
  base: BaseInfo;

  @Column({ name: 'user_id', type: 'bigint', comment: '监督人用户 ID' })
  userId: number;

  @ManyToOne(() => SysUser, { onDelete: 'CASCADE' })
  @JoinColumn({ name: 'user_id' })
  user: SysUser;

  @Column({
    name: 'role_key',
    type: 'enum',
    enum: UserRole,
    comment: '监督角色，仅允许 base_manager 或 field_manager',
  })
  roleKey: UserRole;

  @Column({ name: 'assigned_by', type: 'bigint', nullable: true, comment: '分配人 ID' })
  assignedBy: number | null;

  @ManyToOne(() => SysUser, { nullable: true, onDelete: 'SET NULL' })
  @JoinColumn({ name: 'assigned_by' })
  assigner?: SysUser | null;

  @CreateDateColumn({ name: 'created_at' })
  createdAt: Date;

  @UpdateDateColumn({ name: 'updated_at' })
  updatedAt: Date;
}
