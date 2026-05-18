/**
 * Layer: Authentication Strategy
 * Responsibility: Implements the Jwt credential resolution flow used by NestJS and Passport integration points.
 * Notes: Keep comments focused on intent, invariants, side effects, and cross-module contracts.
 */
import { ExtractJwt, Strategy } from 'passport-jwt';
import { PassportStrategy } from '@nestjs/passport';
import { Injectable, UnauthorizedException } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { UserService } from '../../user/user.service';

type JwtPayload = {
  sub?: number;
  username?: string;
  role?: string;
  uid?: string;
};

@Injectable()
export class JwtStrategy extends PassportStrategy(Strategy) {
  constructor(configService: ConfigService, private readonly userService: UserService) {
    super({
      jwtFromRequest: ExtractJwt.fromAuthHeaderAsBearerToken(),
      ignoreExpiration: false,
      secretOrKey: configService.get<string>('JWT_SECRET') || 'defaultSecretKey',
    });
  }

  async validate(payload: JwtPayload) {
    const userId = Number(payload?.sub);
    if (!Number.isFinite(userId) || userId <= 0) {
      throw new UnauthorizedException('无效登录态，请重新登录');
    }

    // 关键防线：每次请求都回查账号实时状态，避免撤销后旧 token 继续生效。
    const user = await this.userService.findOne(userId);
    if (!user || user.isDeleted) {
      throw new UnauthorizedException('账号不存在或已停用');
    }

    if (user.loginLockReason) {
      throw new UnauthorizedException(user.loginLockReason);
    }

    return {
      id: user.id,
      username: user.name,
      role: user.roleKey,
      uid: user.uid,
    };
  }
}
