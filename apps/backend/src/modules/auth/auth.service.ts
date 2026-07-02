/**
 * Layer: Backend Service
 * Responsibility: Implements the Auth application service for the Auth module, including business rules, side effects, and persistence coordination.
 * Notes: Keep comments focused on intent, invariants, side effects, and cross-module contracts.
 */
import { Injectable, UnauthorizedException, BadRequestException, ConflictException } from '@nestjs/common';
import { JwtService } from '@nestjs/jwt';
import { ConfigService } from '@nestjs/config';
import { UserService } from '../user/user.service';
import { SmsService } from '../common/services/sms.service';
import { OperationLogService } from '../common/services/operation-log.service';
import { OperationType, ResourceType } from '../common/entities/operation-log.entity';
import * as https from 'https';
import * as crypto from 'crypto';

@Injectable()
/**
 * 认证服务负责账号校验与 JWT 签发。
 * 这里的注释重点放在认证前置条件、敏感字段处理方式，以及登录态载荷约定。
 */
export class AuthService {
  // In-memory SMS code store: phone → { code, expiresAt }
  private readonly smsCodeStore = new Map<string, { code: string; expiresAt: number }>();
  private readonly SMS_CODE_TTL_MS = 5 * 60 * 1000; // 5 minutes

  constructor(
    private userService: UserService,
    private jwtService: JwtService,
    private operationLogService: OperationLogService,
    private configService: ConfigService,
    private smsService: SmsService,
  ) { }

  /**
   * 生成并发送短信验证码。
   * 同一手机号每分钟最多发送一次。
   */
  async sendCode(phone: string): Promise<{ ok: boolean; msg: string }> {
    // Rate limit: 1 request per minute per phone
    const existing = this.smsCodeStore.get(phone);
    if (existing && existing.expiresAt > Date.now()) {
      const elapsed = Date.now() - (existing.expiresAt - this.SMS_CODE_TTL_MS);
      if (elapsed < 60_000) {
        throw new BadRequestException('请勿频繁发送验证码，请稍后再试');
      }
    }

    const code = String(Math.floor(100000 + Math.random() * 900000));
    const expiresAt = Date.now() + this.SMS_CODE_TTL_MS;

    this.smsCodeStore.set(phone, { code, expiresAt });

    // Log the code for development
    console.log(`[Auth] SMS code for ${phone}: ${code} (expires in 5 min)`);

    // Try to send via SMS service
    const sent = await this.smsService.sendCode(phone, code);

    return {
      ok: sent,
      msg: sent ? '验证码已发送' : `验证码已发送（开发环境：${code}）`,
    };
  }

  /**
   * 检验验证码有效性。
   */
  private verifyCode(phone: string, code: string): boolean {
    const stored = this.smsCodeStore.get(phone);
    if (!stored) return false;
    if (Date.now() > stored.expiresAt) {
      this.smsCodeStore.delete(phone);
      return false;
    }
    const valid = stored.code === code;
    if (valid) {
      this.smsCodeStore.delete(phone); // One-time use
    }
    return valid;
  }

  /**
   * 手机号+验证码一键注册并登录。
   * 创建最小账号（仅手机号），注册后直接颁发 JWT。
   */
  async registerByPhone(phone: string, code: string, request?: any) {
    // Verify code
    if (!this.verifyCode(phone, code)) {
      throw new UnauthorizedException('验证码错误或已过期');
    }

    // Check if phone already registered
    const existingUser = await this.userService.findByPhone(phone);
    if (existingUser) {
      // User already exists — just log them in
      const payload = { username: existingUser.name || '', sub: existingUser.id, role: existingUser.roleKey, uid: existingUser.uid };
      return {
        access_token: this.jwtService.sign(payload),
        user: {
          id: existingUser.id,
          name: existingUser.name || '',
          role: existingUser.roleKey,
          uid: existingUser.uid,
          faceImgUrl: existingUser.faceImgUrl || null,
          assignedBaseId: existingUser.assignedBaseId || null,
        },
        registerStage: existingUser.name ? 'complete' : 'phone_only',
        isNewUser: false,
      };
    }

    // Create minimal user from phone
    const newUser = await this.userService.createFromPhone(phone);

    // Generate JWT
    const payload = { username: '', sub: newUser.id, role: newUser.roleKey, uid: newUser.uid };

    await this.operationLogService.logWithContext({
      operationType: OperationType.CREATE,
      resourceType: ResourceType.USER,
      resourceId: newUser.id,
      userId: newUser.id,
      request,
      description: `手机号注册: ${phone} (${newUser.uid})`,
      afterData: {
        uid: newUser.uid,
        roleKey: newUser.roleKey,
      },
    });

    return {
      access_token: this.jwtService.sign(payload),
      user: {
        id: newUser.id,
        name: '',
        role: newUser.roleKey,
        uid: newUser.uid,
        faceImgUrl: null,
        assignedBaseId: null,
      },
      registerStage: 'phone_only',
      isNewUser: true,
    };
  }

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

    if (user.loginLockReason) {
      console.log(`[Auth] ❌ Account login locked: ${user.loginLockReason}`);
      throw new UnauthorizedException(user.loginLockReason);
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

  /**
   * WeChat one-click login using wx.login() code.
   * Exchanges code for openid via WeChat jscode2session API,
   * then finds or creates a user by openid.
   */
  async wechatLogin(code: string, request?: any) {
    const appId = this.configService.get<string>('WECHAT_APP_ID');
    const appSecret = this.configService.get<string>('WECHAT_APP_SECRET');

    if (!appId || !appSecret) {
      throw new UnauthorizedException('微信登录未配置，请联系管理员设置 WECHAT_APP_ID / WECHAT_APP_SECRET');
    }

    // Call WeChat jscode2session API
    const url = `https://api.weixin.qq.com/sns/jscode2session?appid=${appId}&secret=${appSecret}&js_code=${code}&grant_type=authorization_code`;

    const sessionData = await new Promise<any>((resolve, reject) => {
      https.get(url, (res) => {
        let data = '';
        res.on('data', (chunk) => { data += chunk; });
        res.on('end', () => {
          try { resolve(JSON.parse(data)); } catch (e) { reject(e); }
        });
      }).on('error', reject);
    });

    if (!sessionData.openid) {
      throw new UnauthorizedException('微信登录失败：' + (sessionData.errmsg || '无法获取用户身份'));
    }

    // Find or create user
    let user = await this.userService.findByOpenid(sessionData.openid);
    if (!user) {
      user = await this.userService.createFromWechat(sessionData.openid);
    }

    if (user.loginLockReason) {
      throw new UnauthorizedException(user.loginLockReason);
    }

    // Generate JWT
    const payload = { username: user.name, sub: user.id, role: user.roleKey, uid: user.uid };

    await this.operationLogService.logWithContext({
      operationType: OperationType.LOGIN,
      resourceType: ResourceType.USER,
      resourceId: user.id,
      userId: user.id,
      request,
      description: `微信登录: ${user.name || '新用户'} (${user.uid})`,
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
      },
      registerStage: user.name ? 'complete' : 'wechat_only',
    };
  }
}
