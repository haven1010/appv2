import { Entity, Column, PrimaryGeneratedColumn, CreateDateColumn, UpdateDateColumn, ManyToOne, JoinColumn, Index } from 'typeorm';
import { BaseInfo } from './base-info.entity';
import { SysUser } from '../../user/entities/sys-user.entity';

/**
 * 基地评价实体（预留接口）
 * 未来可新增用户对基地的评价接口，完善基地口碑体系
 */
@Entity('base_rating')
export class BaseRating {
  @PrimaryGeneratedColumn({ type: 'bigint' })
  id: number;

  @Index()
  @Column({ name: 'base_id', type: 'bigint' })
  baseId: number;

  @Index()
  @Column({ name: 'user_id', type: 'bigint' })
  userId: number;

  @Column({ type: 'tinyint', comment: '评分 1-5' })
  rating: number;

  @Column({ type: 'text', nullable: true, comment: '评价内容' })
  comment: string;

  @Column({ type: 'json', nullable: true, comment: '评价标签（如：环境好、待遇优等）' })
  tags: string[];

  @ManyToOne(() => BaseInfo)
  @JoinColumn({ name: 'base_id' })
  base: BaseInfo;

  @ManyToOne(() => SysUser)
  @JoinColumn({ name: 'user_id' })
  user: SysUser;

  @CreateDateColumn({ name: 'created_at' })
  createdAt: Date;

  @UpdateDateColumn({ name: 'updated_at' })
  updatedAt: Date;
}
