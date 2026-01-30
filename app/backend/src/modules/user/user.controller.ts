
import { Controller, Post, Body, Get, Patch, UseGuards, Req, Param, ParseIntPipe } from '@nestjs/common';
import { UserService } from './user.service';
import { CreateUserDto } from './dto/create-user.dto';
import { UpdateUserDto } from './dto/update-user.dto';
import { RegisterByOcrDto } from './dto/register-by-ocr.dto';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { ApiTags, ApiOperation, ApiBearerAuth } from '@nestjs/swagger';
import { TencentOcrService } from '../common/services/tencent-ocr.service';

@ApiTags('用户管理')
@Controller('user')
export class UserController {
  constructor(
    private readonly userService: UserService,
    private readonly ocrService: TencentOcrService,
  ) {}

  @Post('register')
  @ApiOperation({ summary: '用户注册/实名录入（手动填写）' })
  async register(@Body() createUserDto: CreateUserDto) {
    const user = await this.userService.create(createUserDto);
    return {
      id: user.id,
      uid: user.uid,
      name: user.name,
      msg: '注册成功',
    };
  }

  @Post('register/ocr')
  @ApiOperation({ summary: 'OCR拍照录入（拍摄身份证照片后OCR识别）' })
  async registerByOcr(@Body() dto: RegisterByOcrDto) {
    // 调用OCR服务识别身份证
    const ocrResult = await this.ocrService.recognizeIdCard(dto.imageUrl, dto.side);
    
    if (dto.side === 'FRONT') {
      // 正面：提取姓名、身份证号
      const createDto: CreateUserDto = {
        name: ocrResult.name,
        idCard: ocrResult.idNum,
        phone: '', // 需要用户补充
        roleKey: dto.roleKey || 'worker' as any,
        emergencyContact: dto.emergencyContact,
        emergencyPhone: dto.emergencyPhone,
      };
      
      return {
        ocrResult,
        message: 'OCR识别成功，请补充手机号等信息',
        partialData: createDto,
      };
    } else {
      // 反面：通常用于验证
      return {
        ocrResult,
        message: '身份证背面识别完成',
      };
    }
  }

  @Post('register/complete')
  @ApiOperation({ summary: '完成OCR注册（补充完整信息）' })
  async completeOcrRegister(@Body() createUserDto: CreateUserDto) {
    const user = await this.userService.create(createUserDto);
    return {
      id: user.id,
      uid: user.uid,
      name: user.name,
      msg: '注册成功',
    };
  }

  @Get('profile')
  @UseGuards(JwtAuthGuard)
  @ApiBearerAuth()
  @ApiOperation({ summary: '获取个人信息' })
  async getProfile(@Req() req) {
    return this.userService.findOne(req.user.id);
  }

  @Patch('profile')
  @UseGuards(JwtAuthGuard)
  @ApiBearerAuth()
  @ApiOperation({ summary: '更新个人信息（需要重新审核）' })
  async updateProfile(@Req() req, @Body() updateDto: UpdateUserDto) {
    return this.userService.update(req.user.id, updateDto);
  }

  @Patch(':id/audit')
  @UseGuards(JwtAuthGuard)
  @ApiBearerAuth()
  @ApiOperation({ summary: '审核用户信息更新' })
  async auditInfo(
    @Param('id', ParseIntPipe) userId: number,
    @Body('status') status: number,
    @Body('reason') reason?: string,
  ) {
    return this.userService.auditInfo(userId, status, reason);
  }
}
