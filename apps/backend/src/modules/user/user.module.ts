/**
 * Layer: Backend Module
 * Responsibility: Defines provider wiring, repository exposure, and dependency composition for the User module.
 * Notes: Keep comments focused on intent, invariants, side effects, and cross-module contracts.
 */
import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { UserController } from './user.controller';
import { UserService } from './user.service';
import { SysUser } from './entities/sys-user.entity';
import { ProxyRegistrationCase } from './entities/proxy-registration-case.entity';
import { RolesGuard } from '../auth/guards/roles.guard';
import { BaseInfo } from '../base/entities/base-info.entity';

@Module({
  imports: [TypeOrmModule.forFeature([SysUser, BaseInfo, ProxyRegistrationCase])],
  controllers: [UserController],
  providers: [UserService, RolesGuard],
  exports: [UserService], // 只导出 Service，其他模块要用就注入 Service
})
export class UserModule { }
