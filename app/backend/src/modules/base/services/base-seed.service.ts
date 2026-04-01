import { Injectable, Logger, OnApplicationBootstrap } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { SecurityService } from '../../common/services/security.service';
import { BaseCategory, BaseInfo, AuditStatus } from '../entities/base-info.entity';
import { JobStatus, PayType, RecruitmentJob, WorkCycle } from '../entities/recruitment-job.entity';
import { SysUser, UserRole } from '../../user/entities/sys-user.entity';

@Injectable()
export class BaseSeedService implements OnApplicationBootstrap {
  private readonly logger = new Logger(BaseSeedService.name);

  constructor(
    @InjectRepository(SysUser)
    private readonly userRepo: Repository<SysUser>,
    @InjectRepository(BaseInfo)
    private readonly baseRepo: Repository<BaseInfo>,
    @InjectRepository(RecruitmentJob)
    private readonly jobRepo: Repository<RecruitmentJob>,
    private readonly securityService: SecurityService,
  ) {}

  async onApplicationBootstrap(): Promise<void> {
    if (process.env.NODE_ENV === 'production') {
      this.logger.log('Skip recruitment seed in production mode.');
      return;
    }

    try {
      await this.seedDemoJobs();
    } catch (error) {
      this.logger.error(`Seed demo jobs failed: ${error?.message || error}`);
    }
  }

  private async seedDemoJobs(): Promise<void> {
    const owner = await this.ensureSeedOwner();
    const base = await this.ensureSeedBase(owner.id);
    const testBase = await this.ensureInnerMongoliaTestBase(owner.id);
    const created = await this.ensureSeedJobRows(base.id);

    if (created > 0) {
      this.logger.log(`Seeded ${created} recruitment jobs for baseId=${base.id}`);
    }

    this.logger.log(`Test base ready: ${testBase.baseName}(id=${testBase.id})`);
    if (created === 0) {
      this.logger.log('Recruitment seed skipped: demo data already exists.');
    }
  }

  private async ensureSeedOwner(): Promise<SysUser> {
    const seedUid = 'SEED_BASE_MANAGER';
    const byUid = await this.userRepo.findOne({
      where: { uid: seedUid, isDeleted: false },
    });
    if (byUid) {
      return byUid;
    }

    const firstBaseManager = await this.userRepo.findOne({
      where: { roleKey: UserRole.BASE_MANAGER, isDeleted: false },
      order: { id: 'ASC' },
    });
    if (firstBaseManager) {
      return firstBaseManager;
    }

    const phone = '13900009001';
    const idCard = '110101199001010123';
    const phoneHash = this.securityService.hash(phone);
    const idCardHash = this.securityService.hash(idCard);

    const existedByPhone = await this.userRepo.findOne({
      where: { phoneHash, isDeleted: false },
    });
    if (existedByPhone) {
      return existedByPhone;
    }

    const user = this.userRepo.create({
      uid: seedUid,
      name: '演示基地管理员',
      idCard,
      phone,
      idCardHash,
      phoneHash,
      roleKey: UserRole.BASE_MANAGER,
      faceImgUrl: '',
      regionCode: 370600,
      assignedBaseId: null,
      emergencyContact: '李四-家属',
      emergencyPhone: '13900009002',
      emergencyPhoneHash: this.securityService.hash('13900009002'),
      infoAuditStatus: 1,
      isDeleted: false,
    });

    return this.userRepo.save(user);
  }

  private async ensureSeedBase(ownerId: number): Promise<BaseInfo> {
    const seedBaseName = '演示苹果基地';
    const existed = await this.baseRepo.findOne({
      where: { baseName: seedBaseName },
    });

    if (existed) {
      let shouldSave = false;
      if (existed.isDeleted) {
        existed.isDeleted = false;
        shouldSave = true;
      }
      if (existed.auditStatus !== AuditStatus.APPROVED) {
        existed.auditStatus = AuditStatus.APPROVED;
        shouldSave = true;
      }
      if (!existed.ownerId) {
        existed.ownerId = ownerId;
        shouldSave = true;
      }
      if (shouldSave) {
        return this.baseRepo.save(existed);
      }
      return existed;
    }

    const base = this.baseRepo.create({
      baseName: seedBaseName,
      licenseUrl: 'https://example.com/license/demo-base-license.jpg',
      contactPhone: '13900009001',
      category: BaseCategory.FRUIT,
      regionCode: 370600,
      address: '山东省烟台市福山区演示果园 1 号',
      description: '演示基地（系统自动初始化），用于前端岗位浏览与联调。',
      auditStatus: AuditStatus.APPROVED,
      ownerId,
      isDeleted: false,
    });

    return this.baseRepo.save(base);
  }

  private async ensureInnerMongoliaTestBase(ownerId: number): Promise<BaseInfo> {
    const seedBaseName = '内蒙捡土豆';
    const existed = await this.baseRepo.findOne({
      where: { baseName: seedBaseName },
    });

    if (existed) {
      let shouldSave = false;
      if (existed.isDeleted) {
        existed.isDeleted = false;
        shouldSave = true;
      }
      if (existed.auditStatus !== AuditStatus.APPROVED) {
        existed.auditStatus = AuditStatus.APPROVED;
        shouldSave = true;
      }
      if (!existed.ownerId) {
        existed.ownerId = ownerId;
        shouldSave = true;
      }
      if (shouldSave) {
        return this.baseRepo.save(existed);
      }
      return existed;
    }

    const base = this.baseRepo.create({
      baseName: seedBaseName,
      licenseUrl: 'https://example.com/license/potato-base-license.jpg',
      contactPhone: '13900009003',
      category: BaseCategory.VEGETABLE,
      regionCode: 150100,
      address: '内蒙古呼和浩特市土豆测试基地 1 号',
      description: '测试基地：内蒙捡土豆，便于小程序联调与岗位浏览测试。',
      auditStatus: AuditStatus.APPROVED,
      ownerId,
      isDeleted: false,
    });

    return this.baseRepo.save(base);
  }

  private async ensureSeedJobRows(baseId: number): Promise<number> {
    const now = new Date();
    const validUntil = new Date(now);
    validUntil.setDate(now.getDate() + 30);

    const templates: Array<Partial<RecruitmentJob> & { jobTitle: string }> = [
      {
        baseId,
        jobTitle: '苹果采摘',
        recruitCount: 40,
        workCycle: WorkCycle.DAILY,
        workContent: '果园采摘、分拣与装筐，按现场排班执行。',
        workHours: '08:00-17:00',
        payType: PayType.FIXED,
        salaryAmount: 120,
        requirements: '身体健康，能适应户外劳动。',
        benefits: '包住宿',
        hasAccommodation: true,
        hasMeals: false,
        hasTransportation: false,
      },
      {
        baseId,
        jobTitle: '茶叶采摘',
        recruitCount: 30,
        workCycle: WorkCycle.DAILY,
        workContent: '按标准采茶，负责初筛和称重登记。',
        workHours: '07:30-16:30',
        payType: PayType.FIXED,
        salaryAmount: 150,
        requirements: '手脚麻利，服从班组安排。',
        benefits: '包餐',
        hasAccommodation: false,
        hasMeals: true,
        hasTransportation: false,
      },
    ];

    let createdCount = 0;

    for (const template of templates) {
      const existed = await this.jobRepo.findOne({
        where: {
          baseId,
          jobTitle: template.jobTitle,
        },
      });

      if (existed) {
        continue;
      }

      const entity = this.jobRepo.create({
        ...template,
        baseId,
        unitPrice: null,
        hourlyRate: null,
        targetCount: null,
        transportationSubsidy: null,
        workplaceImages: [],
        videoUrl: '',
        validUntil,
        isActive: true,
        autoRenew: false,
        renewalDays: 7,
        status: JobStatus.RECRUITING,
        applicantCount: 0,
        viewCount: 0,
      });

      await this.jobRepo.save(entity);
      createdCount += 1;
    }

    return createdCount;
  }
}
