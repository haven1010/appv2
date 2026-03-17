import { NestFactory } from '@nestjs/core';
import { AppModule } from './app.module';
import { ValidationPipe } from '@nestjs/common';
import { DocumentBuilder, SwaggerModule } from '@nestjs/swagger';
import * as dotenv from 'dotenv';
dotenv.config();

async function bootstrap() {
  const app = await NestFactory.create(AppModule);

  // 1. 设置全局路由前缀 (必须在 Swagger 配置之前)
  // 所有接口变成: http://localhost:3001/api/xxx
  app.setGlobalPrefix('api');

  // 2. 跨域配置 (CORS)
  // 说明：
  // - Swagger UI 运行在 http://localhost:3001/docs，Origin 是 http://localhost:3001
  // - React 前端一般运行在 http://localhost:3000
  // - 微信小程序开发工具的请求 Origin 为 http://localhost 或 http://127.0.0.1
  app.enableCors({
    origin: (origin, callback) => {
      // 允许无 Origin 的请求（如 Swagger 后端自调用、curl、本地脚本）
      if (!origin) {
        return callback(null, true);
      }

      const allowedOrigins = [
        'http://localhost:3000',
        'http://127.0.0.1:3000',
        'http://localhost:3001',
        'http://127.0.0.1:3001',
        'http://localhost',
        'http://127.0.0.1',
      ];

      if (allowedOrigins.includes(origin)) {
        return callback(null, true);
      }

      // 其他来源也先放行，方便本地调试，如需严格控制可改为 callback(new Error('Not allowed by CORS'))
      return callback(null, true);
    },
    methods: 'GET,HEAD,PUT,PATCH,POST,DELETE,OPTIONS',
    credentials: true,
    allowedHeaders: ['Content-Type', 'Authorization'],
  });

  // 3. 全局 DTO 参数校验
  app.useGlobalPipes(new ValidationPipe({
    whitelist: true, // 自动剔除 DTO 中未定义的属性
    transform: true, // 自动类型转换 (例如把 id string 转为 number)
    forbidNonWhitelisted: true, // 如果有多余参数则报错
  }));

  // 4. Swagger 文档配置
  const config = new DocumentBuilder()
    .setTitle('采摘通 API')
    .setDescription('CaiZhaiTong Full Lifecycle Management System API')
    .setVersion('1.0')
    .addBearerAuth() // 开启 Token 认证按钮
    .build();

  const document = SwaggerModule.createDocument(app, config);
  SwaggerModule.setup('docs', app, document);

  // 🔥 修改点：端口改为 3001
  // 因为你的前端已经占用了 3000，后端必须避开
  const port = 3001;

  await app.listen(port);

  console.log(`\n🚀 采摘通后端服务已启动！`);
  console.log(`🌐 服务地址: http://localhost:${port}/api`);
  console.log(`📖 接口文档: http://localhost:${port}/docs\n`);
}
bootstrap();