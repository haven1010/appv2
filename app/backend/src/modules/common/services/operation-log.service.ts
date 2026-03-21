/**
 * Layer: Backend Service
 * Responsibility: Implements the Operation Log application service for the Common module, including business rules, side effects, and persistence coordination.
 * Notes: Keep comments focused on intent, invariants, side effects, and cross-module contracts.
 */
import { Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { OperationLog, OperationType, ResourceType } from '../entities/operation-log.entity';

@Injectable()
/**
 * 操作日志服务负责统一落审计日志，并提供检索和统计查询。
 * 所有写入都应该经过该服务，以保证日志结构和序列化策略保持一致。
 */
export class OperationLogService {
  constructor(
    @InjectRepository(OperationLog)
    private logRepository: Repository<OperationLog>,
  ) {}

  /**
   * 写入一条操作日志。
   * 这里会将前后状态快照序列化为 JSON 文本，保证日志结构在查询侧稳定可回放。
   */
  async log(
    operationType: OperationType,
    resourceType: ResourceType,
    resourceId: number,
    userId: number,
    description?: string,
    beforeData?: any,
    afterData?: any,
    ipAddress?: string,
    userAgent?: string,
  ): Promise<OperationLog> {
    const log = this.logRepository.create({
      operationType,
      resourceType,
      resourceId,
      userId,
      description,
      beforeData: beforeData ? JSON.stringify(beforeData) : null,
      afterData: afterData ? JSON.stringify(afterData) : null,
      ipAddress,
      userAgent,
    });

    return this.logRepository.save(log);
  }

  /**
   * 按资源类型、资源 ID 或操作人查询最近日志。
   * 该方法适合详情页附近的轻量追溯，不负责复杂分页。
   */
  async getLogs(
    resourceType?: ResourceType,
    resourceId?: number,
    userId?: number,
    limit: number = 100,
  ): Promise<OperationLog[]> {
    const qb = this.logRepository.createQueryBuilder('log');

    if (resourceType) {
      qb.andWhere('log.resourceType = :resourceType', { resourceType });
    }
    if (resourceId) {
      qb.andWhere('log.resourceId = :resourceId', { resourceId });
    }
    if (userId) {
      qb.andWhere('log.userId = :userId', { userId });
    }

    qb.orderBy('log.createdAt', 'DESC').limit(limit);

    return qb.getMany();
  }

  /**
   * 分页查询操作日志列表，供管理端检索与审计使用。
   */
  async getLogsPaginated(query: {
    operationType?: string;
    resourceType?: string;
    keyword?: string;
    page?: number;
    pageSize?: number;
  }) {
    const { operationType, resourceType, keyword, page = 1, pageSize = 20 } = query;

    const qb = this.logRepository
      .createQueryBuilder('log')
      .orderBy('log.createdAt', 'DESC');

    if (operationType) {
      qb.andWhere('log.operationType = :operationType', { operationType });
    }
    if (resourceType) {
      qb.andWhere('log.resourceType = :resourceType', { resourceType });
    }
    if (keyword) {
      qb.andWhere('log.description LIKE :kw', { kw: `%${keyword}%` });
    }

    const total = await qb.getCount();
    const list = await qb
      .skip((page - 1) * pageSize)
      .take(pageSize)
      .getMany();

    return {
      list,
      total,
      page: Number(page),
      pageSize: Number(pageSize),
    };
  }

  /**
   * 聚合操作日志总量、今日新增量和按操作类型划分的统计摘要。
   */
  async getLogStats() {
    const total = await this.logRepository.count();

    const today = new Date();
    today.setHours(0, 0, 0, 0);
    const todayCount = await this.logRepository
      .createQueryBuilder('log')
      .where('log.createdAt >= :today', { today })
      .getCount();

    // 按类型统计
    const byType = await this.logRepository
      .createQueryBuilder('log')
      .select('log.operationType', 'type')
      .addSelect('COUNT(*)', 'count')
      .groupBy('log.operationType')
      .getRawMany();

    return { total, todayCount, byType };
  }
}
