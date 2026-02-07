import { Module } from '@nestjs/common';
import { ConfigModule, ConfigService } from '@nestjs/config';
import { TypeOrmModule } from '@nestjs/typeorm';
import { AppController } from './app.controller';
import { AppService } from './app.service';

// 所有实体一次性全局导入（终极解决方案！）
import { SysUser } from './modules/user/entities/sys-user.entity';
import { BaseInfo } from './modules/base/entities/base-info.entity';
import { RecruitmentJob } from './modules/base/entities/recruitment-job.entity';
import { JobApplication } from './modules/base/entities/job-application.entity';
import { BaseCooperation } from './modules/base/entities/base-cooperation.entity';
import { DailySignup } from './modules/attendance/entities/daily-signup.entity';
import { LaborSalary } from './modules/salary/entities/labor-salary.entity';
import { SalaryPayment } from './modules/salary/entities/salary-payment.entity';
import { OperationLog } from './modules/common/entities/operation-log.entity';

// 所有模块
import { UserModule } from './modules/user/user.module';
import { BaseModule } from './modules/base/base.module';
import { AttendanceModule } from './modules/attendance/attendance.module';
import { SalaryModule } from './modules/salary/salary.module';
import { QrCodeModule } from './modules/qrcode/qrcode.module';
import { RecommendationModule } from './modules/recommendation/recommendation.module';
import { AuthModule } from './modules/auth/auth.module';
import { DashboardModule } from './modules/dashboard/dashboard.module';
import { CommonModule } from './modules/common/common.module';

@Module({
  imports: [
    // 加载环境变量
    ConfigModule.forRoot({
      isGlobal: true,
      envFilePath: '.env',
    }),
    // 关键！所有实体一次性全局注册，任何模块都能注入任意 Repository
    TypeOrmModule.forRootAsync({
      imports: [ConfigModule],
      inject: [ConfigService],
      useFactory: (configService: ConfigService) => {
        // 调试：打印当前实际使用的数据库配置，避免 .env 未生效导致的困惑
        const dbConfig = {
          host: configService.get<string>('DB_HOST', 'localhost'),
          port: configService.get<number>('DB_PORT', 3306),
          username: configService.get<string>('DB_USERNAME', 'root'),
          password: configService.get<string>('DB_PASSWORD', 'root123'),
          database: configService.get<string>('DB_DATABASE', 'caizhitong'),
        };

        // 只在本地开发环境下打印，避免生产环境泄露配置
        if (process.env.NODE_ENV !== 'production') {
          // 密码只显示前几位，防止完整泄露
          const maskedPassword = dbConfig.password
            ? dbConfig.password.slice(0, 2) + '***'
            : '';
          // eslint-disable-next-line no-console
          console.log('Using DB config from ConfigService:', {
            host: dbConfig.host,
            port: dbConfig.port,
            username: dbConfig.username,
            password: maskedPassword,
            database: dbConfig.database,
          });
        }

        return {
          type: 'mysql',
          host: dbConfig.host,
          port: dbConfig.port,
          username: dbConfig.username,
          password: dbConfig.password,
          database: dbConfig.database,
          entities: [
            SysUser,
            BaseInfo,
            RecruitmentJob,
            JobApplication,
            BaseCooperation,
            DailySignup,
            LaborSalary,
            SalaryPayment,
            OperationLog,
          ],
          synchronize: true, // 生产环境一定要关
          logging: false,
        };
      },
    }),

    // 公共模块（OperationLogService、SecurityService 等）
    CommonModule,
    // 所有业务模块（都不需要再 forFeature 了！）
    UserModule,
    BaseModule,
    AttendanceModule,
    SalaryModule,
    QrCodeModule,
    RecommendationModule,
    AuthModule,
    DashboardModule,
  ],
  controllers: [AppController],
  providers: [AppService],
})
export class AppModule { }