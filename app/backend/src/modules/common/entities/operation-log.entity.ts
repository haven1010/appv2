import { Entity, Column, PrimaryGeneratedColumn, CreateDateColumn, Index } from 'typeorm';
import { ApiProperty } from '@nestjs/swagger';

export enum OperationType {
  CREATE = 'create',
  UPDATE = 'update',
  DELETE = 'delete',
  AUDIT = 'audit',
  LOGIN = 'login',
  CHECKIN = 'checkin',
  PAYMENT = 'payment',
}

export enum ResourceType {
  USER = 'user',
  BASE = 'base',
  JOB = 'job',
  SIGNUP = 'signup',
  SALARY = 'salary',
}

@Entity('operation_log')
export class OperationLog {
  @ApiProperty({ description: '日志ID' })
  @PrimaryGeneratedColumn({ type: 'bigint' })
  id: number;

  @ApiProperty({ description: '操作类型', enum: OperationType })
  @Index()
  @Column({ 
    type: 'enum', 
    enum: OperationType,
    comment: '操作类型' 
  })
  operationType: OperationType;

  @ApiProperty({ description: '资源类型', enum: ResourceType })
  @Index()
  @Column({ 
    type: 'enum', 
    enum: ResourceType,
    comment: '资源类型' 
  })
  resourceType: ResourceType;

  @ApiProperty({ description: '资源ID' })
  @Index()
  @Column({ name: 'resource_id', type: 'bigint', comment: '资源ID' })
  resourceId: number;

  @ApiProperty({ description: '操作用户ID' })
  @Index()
  @Column({ name: 'user_id', type: 'bigint', comment: '操作用户ID' })
  userId: number;

  @ApiProperty({ description: '操作描述' })
  @Column({ type: 'text', nullable: true, comment: '操作描述' })
  description: string;

  @ApiProperty({ description: '操作前数据（JSON）', required: false })
  @Column({ name: 'before_data', type: 'text', nullable: true, comment: '操作前数据' })
  beforeData: string;

  @ApiProperty({ description: '操作后数据（JSON）', required: false })
  @Column({ name: 'after_data', type: 'text', nullable: true, comment: '操作后数据' })
  afterData: string;

  @ApiProperty({ description: 'IP地址', required: false })
  @Column({ name: 'ip_address', length: 45, nullable: true, comment: 'IP地址' })
  ipAddress: string;

  @ApiProperty({ description: '用户代理', required: false })
  @Column({ name: 'user_agent', type: 'text', nullable: true, comment: 'User Agent' })
  userAgent: string;

  @ApiProperty({ description: '创建时间' })
  @CreateDateColumn({ name: 'created_at' })
  createdAt: Date;
}
