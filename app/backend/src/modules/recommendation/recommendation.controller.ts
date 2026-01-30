import { Controller, Get, UseGuards, Req, Query } from '@nestjs/common';
import { ApiTags, ApiOperation, ApiBearerAuth, ApiResponse, ApiQuery } from '@nestjs/swagger';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { RecommendationService } from './recommendation.service';
import { RecommendationResultDto } from './dto/recommendation-result.dto';

@ApiTags('智能推荐')
@Controller('recommendation')
@UseGuards(JwtAuthGuard)
@ApiBearerAuth()
export class RecommendationController {
  constructor(private readonly recommendationService: RecommendationService) { }

  @Get('bases')
  @ApiOperation({ summary: '获取适合当前用户的基地推荐列表' })
  @ApiResponse({ status: 200, type: [RecommendationResultDto] })
  @ApiQuery({ name: 'lat', required: false, description: '用户当前纬度 (预留)' })
  @ApiQuery({ name: 'lng', required: false, description: '用户当前经度 (预留)' })
  async getRecommendedBases(
    @Req() req,
    @Query('lat') lat?: number,
    @Query('lng') lng?: number,
  ): Promise<RecommendationResultDto[]> {
    // 这里的 lat/lng 暂时预留，Service层目前主要通过 regionCode 匹配
    return this.recommendationService.recommendForUser(req.user.id);
  }
}