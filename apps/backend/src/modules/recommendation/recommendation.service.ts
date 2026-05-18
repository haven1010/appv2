/**
 * Layer: Backend Service
 * Responsibility: Implements the Recommendation application service for the Recommendation module, including business rules, side effects, and persistence coordination.
 * Notes: Keep comments focused on intent, invariants, side effects, and cross-module contracts.
 */
import { Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { BaseInfo, BaseCategory } from '../base/entities/base-info.entity';
import { SysUser } from '../user/entities/sys-user.entity';
import { DailySignup } from '../attendance/entities/daily-signup.entity';
import { JobStatus } from '../base/entities/recruitment-job.entity';
import { RecommendationResultDto } from './dto/recommendation-result.dto';

@Injectable()
/**
 * 推荐服务负责为工人生成基地推荐结果。
 * 当前版本采用规则加权，而不是机器学习模型，因此权重与原因都应保持可解释。
 */
export class RecommendationService {
  constructor(
    @InjectRepository(BaseInfo)
    private baseRepository: Repository<BaseInfo>,
    @InjectRepository(SysUser)
    private userRepository: Repository<SysUser>,
    @InjectRepository(DailySignup)
    private signupRepository: Repository<DailySignup>,
  ) { }

  /**
   * 核心推荐算法。
   * 权重分配:
   * 1. 区域匹配 40%
   * 2. 历史偏好 30%
   * 3. 活跃岗位 30%
   * 输出要求:
   * 1. 只返回得分大于 0 的基地。
   * 2. 结果必须携带可解释推荐理由，便于前端展示。
   */
  async recommendForUser(userId: number): Promise<RecommendationResultDto[]> {
    // 1. 获取用户信息
    const user = await this.userRepository.findOne({ where: { id: userId } });
    if (!user) return [];

    // 2. 获取所有已审核且未删除的基地 (包含岗位信息)
    const bases = await this.baseRepository.find({
      where: { auditStatus: 1, isDeleted: false },
      relations: ['jobs'],
    });

    // 3. 分析用户历史偏好 (最近 20 次报名)
    const history = await this.signupRepository.find({
      where: { userId: userId },
      relations: ['base'],
      order: { createdAt: 'DESC' },
      take: 20,
    });

    // 统计用户最常去的基地类型
    const categoryCounts = { [BaseCategory.FRUIT]: 0, [BaseCategory.VEGETABLE]: 0, [BaseCategory.OTHER]: 0 };
    history.forEach(h => {
      if (h.base) categoryCounts[h.base.category]++;
    });

    // 找出最喜欢的类型
    let preferredCategory = 0;
    let maxCount = -1;
    for (const key in categoryCounts) {
      if (categoryCounts[key] > maxCount && categoryCounts[key] > 0) {
        maxCount = categoryCounts[key];
        preferredCategory = Number(key);
      }
    }

    // 4. 计算得分
    const scoredBases = bases.map(base => {
      let score = 0;
      const reasons: string[] = [];

      // A. 区域匹配 (40分)
      // 实际项目中这里可以使用经纬度计算距离，这里简化为区域码匹配
      if (user.regionCode && base.regionCode === user.regionCode) {
        score += 40;
        reasons.push('同城/同区');
      }

      // B. 兴趣偏好 (30分)
      if (preferredCategory !== 0 && base.category === preferredCategory) {
        score += 30;
        reasons.push('符合您的工种偏好');
      }

      // C. 正在热招 (30分)
      // 统计该基地正在招聘（状态为1）的岗位数量
      const activeJobs = base.jobs ? base.jobs.filter(j => j.status === JobStatus.RECRUITING && j.isActive) : [];
      if (activeJobs.length > 0) {
        score += 30;
        reasons.push(`有 ${activeJobs.length} 个岗位正在热招`);
      }

      return {
        base,
        score,
        reasons,
        activeJobsCount: activeJobs.length
      };
    });

    // 5. 排序 (分数高在前) 并 格式化输出
    // 过滤掉分数为 0 的（完全不相关的可以不推荐），或者只取前 10
    return scoredBases
      .filter(item => item.score > 0)
      .sort((a, b) => b.score - a.score)
      .slice(0, 10)
      .map(item => this.mapToDto(item.base, item.score, item.reasons, item.activeJobsCount));
  }

  /**
   * 将基地实体和打分结果映射成前端消费的推荐 DTO。
   * 该方法会尽量从描述 JSON 中提取封面图，解析失败时回落到默认占位图。
   */
  private mapToDto(base: BaseInfo, score: number, reasons: string[], activeJobsCount: number): RecommendationResultDto {
    const categoryMap = {
      [BaseCategory.FRUIT]: '水果种植',
      [BaseCategory.VEGETABLE]: '蔬菜种植',
      [BaseCategory.OTHER]: '其他农作',
    };

    // 尝试从 JSON 描述中获取第一张图片作为封面，如果没有则随机给一张
    let imageUrl = 'https://via.placeholder.com/300x200?text=No+Image';
    try {
      if (base.description) {
        const descObj = JSON.parse(base.description);
        if (descObj.images && descObj.images.length > 0) {
          imageUrl = descObj.images[0];
        }
      }
    } catch (e) { }

    return {
      id: base.id,
      baseName: base.baseName,
      categoryName: categoryMap[base.category] || '未知类别',
      regionCode: base.regionCode,
      score: score,
      matchReasons: reasons,
      activeJobsCount: activeJobsCount,
      imageUrl: imageUrl
    };
  }
}
