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
}
