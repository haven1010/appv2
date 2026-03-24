/**
 * Layer: Backend Service
 * Responsibility: Implements the Auth application service for the Auth module, including business rules, side effects, and persistence coordination.
 * Notes: Keep comments focused on intent, invariants, side effects, and cross-module contracts.
 */
import { Injectable } from '@nestjs/common';
import { JwtService } from '@nestjs/jwt';
import { UserService } from '../user/user.service';
import { OperationLogService } from '../common/services/operation-log.service';
import { OperationType, ResourceType } from '../common/entities/operation-log.entity';

@Injectable()
/**
 * 认证服务负责账号校验与 JWT 签发。
 * 这里的注释重点放在认证前置条件、敏感字段处理方式，以及登录态载荷约定。
 */
export class AuthService {
  constructor(
    private userService: UserService,
    private jwtService: JwtService,
    private operationLogService: OperationLogService,
  ) { }

  /**
   * 使用手机号和身份证后六位完成轻量登录校验。
   * 约束:
   * 1. 用户必须存在且未被业务层过滤掉。
   * 2. `idCard` 已由实体 transformer 自动解密，这里不能再次手动解密。
   * 返回值:
   * 成功时返回去除敏感字段后的用户视图，失败时返回 `null` 而不是抛错。
   */
  async validateUser(phone: string, idCardLast6: string): Promise<any> {
    console.log(`[Auth] 正在验证用户: ${phone}`);

    // 1. 查找用户
    const user = await this.userService.findByPhone(phone);
    if (!user) {
      console.log(`[Auth] ❌ User not found for phone: ${phone}`);
      return null;
    }

    // 🔥 关键修改：TypeORM 的 Transformer 已经自动解密了，这里直接取值即可！
    // 不要再调用 securityService.decrypt 了
    const realIdCard = user.idCard;

    console.log(`[Auth] 数据库中的身份证(已自动解密): ${realIdCard}`);
    console.log(`[Auth] 用户输入的后6位: ${idCardLast6}`);

    if (!realIdCard) {
      console.log(`[Auth] ❌ ID card is empty or null`);
      return null;
    }

    // 2. 比对后6位
    if (!realIdCard.endsWith(idCardLast6)) {
      console.log(`[Auth] ❌ ID card mismatch. Expected ends with: ${idCardLast6}, got: ${realIdCard.slice(-6)}`);
      return null;
    }

    console.log(`[Auth] ✅ 登录验证成功！`);

    // Return user without sensitive info
    const { idCard, phone: userPhone, idCardHash, phoneHash, ...result } = user;
    return result;
  }

  /**
   * 为已通过校验的用户签发访问令牌，并返回前端登录态所需的最小用户信息。
   * 这里约定 JWT 载荷包含 `sub`、`role` 和 `uid`，供后续鉴权与路由隔离使用。
   */
  async login(user: any, request?: any) {
    const payload = { username: user.name, sub: user.id, role: user.roleKey, uid: user.uid };

    await this.operationLogService.logWithContext({
      operationType: OperationType.LOGIN,
      resourceType: ResourceType.USER,
      resourceId: user.id,
      userId: user.id,
      request,
      description: `用户登录: ${user.name} (${user.uid})`,
      afterData: {
        uid: user.uid,
        roleKey: user.roleKey,
      },
    });

    return {
      access_token: this.jwtService.sign(payload),
      user: {
        id: user.id,
        name: user.name,
        role: user.roleKey,
        uid: user.uid,
        faceImgUrl: user.faceImgUrl,
        assignedBaseId: user.assignedBaseId || null,
      }
    };
  }
}
