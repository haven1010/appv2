import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { UserController } from './user.controller';
import { UserService } from './user.service';
import { SysUser } from './entities/sys-user.entity';
import { RolesGuard } from '../auth/guards/roles.guard';
import { BaseInfo } from '../base/entities/base-info.entity';

@Module({
  imports: [TypeOrmModule.forFeature([SysUser, BaseInfo])],
  controllers: [UserController],
  providers: [UserService, RolesGuard],
  exports: [UserService], // 只导出 Service，其他模块要用就注入 Service
})
export class UserModule { }
