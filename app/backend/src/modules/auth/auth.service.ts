import { Injectable, UnauthorizedException } from '@nestjs/common';
import { JwtService } from '@nestjs/jwt';
import { UserService } from '../user/user.service';
import { SecurityService } from '../common/services/security.service';

@Injectable()
export class AuthService {
  constructor(
    private userService: UserService,
    private jwtService: JwtService,
    private securityService: SecurityService,
  ) { }

  // Simplified login: Phone + ID Card Last 6 Digits (acting as password)
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

  async login(user: any) {
    const payload = { username: user.name, sub: user.id, role: user.roleKey, uid: user.uid };
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