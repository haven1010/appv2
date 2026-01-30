import { Controller, Post, Body, UnauthorizedException } from '@nestjs/common';
import { AuthService } from './auth.service';
import { ApiTags, ApiOperation, ApiOkResponse, ApiProperty } from '@nestjs/swagger'; // 🔥 引入 ApiOkResponse, ApiProperty
import { LoginDto } from './dto/login.dto';
import { SysUser } from '../user/entities/sys-user.entity';

// 🔥 定义返回数据的结构类
// 这样 Swagger 就知道返回的数据包含 access_token 和 user 对象
export class LoginResponse {
  @ApiProperty({ description: 'JWT 访问令牌' })
  access_token: string;

  @ApiProperty({ description: '登录成功的用户信息', type: SysUser })
  user: SysUser;
}

@ApiTags('认证模块')
@Controller('auth')
export class AuthController {
  constructor(private authService: AuthService) { }

  @Post('login')
  @ApiOperation({
    summary: '手机号+身份证后6位登录',
    description: '请使用 phone 和 idCardLast6 进行登录。'
  })
  // 🔥 核心修改：明确告诉 Swagger 返回类型是 LoginResponse
  // 这样 Orval 生成前端代码时，就不会是 void，而是 { access_token: string, user: SysUser }
  @ApiOkResponse({
    description: '登录成功',
    type: LoginResponse
  })
  async login(@Body() loginDto: LoginDto): Promise<LoginResponse> {
    const phone = loginDto.phone;
    const idCardLast6 = loginDto.idCardLast6;

    if (!phone || !idCardLast6) {
      throw new UnauthorizedException('请提供手机号(phone)和身份证后6位(idCardLast6)');
    }

    const user = await this.authService.validateUser(phone, idCardLast6);

    if (!user) {
      throw new UnauthorizedException('凭证无效，请检查手机号或密码是否正确。');
    }

    // 假设 authService.login 返回的是 { access_token: string }
    // 我们需要把它和 user 组合在一起返回
    const tokenResult = await this.authService.login(user);

    return {
      access_token: tokenResult.access_token,
      user: user
    };
  }
}