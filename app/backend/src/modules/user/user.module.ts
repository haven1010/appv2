import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { UserController } from './user.controller';
import { UserService } from './user.service';
import { SysUser } from './entities/sys-user.entity';

@Module({
  imports: [TypeOrmModule.forFeature([SysUser])],
  controllers: [UserController],
  providers: [UserService],
  exports: [UserService], // 只导出 Service，其他模块要用就注入 Service
})
export class UserModule { }