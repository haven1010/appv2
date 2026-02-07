import { Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { OperationLog, OperationType, ResourceType } from '../entities/operation-log.entity';

@Injectable()
export class OperationLogService {
  constructor(
    @InjectRepository(OperationLog)
    private logRepository: Repository<OperationLog>,
  ) {}

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
   * 分页查询操作日志（管理端）
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
   * 获取操作日志统计
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
