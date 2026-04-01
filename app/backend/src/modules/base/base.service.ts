/**
 * Layer: Backend Service
 * Responsibility: Implements the Base application service for the Base module, including business rules, side effects, and persistence coordination.
 * Notes: Keep comments focused on intent, invariants, side effects, and cross-module contracts.
 */
import { Injectable, NotFoundException, Logger, ConflictException, BadRequestException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { DataSource, Repository } from 'typeorm';
import { BaseInfo, AuditStatus } from './entities/base-info.entity';
import { RecruitmentJob, PayType, JobStatus } from './entities/recruitment-job.entity';
import { CreateBaseDto } from './dto/create-base.dto';
import { CreateJobDto } from './dto/create-job.dto';
import { JobApplicationService } from './services/job-application.service';
import { BaseCooperationService } from './services/base-cooperation.service';
import { ApplicationStatus } from './entities/job-application.entity';
import { CooperationStatus } from './entities/base-cooperation.entity';
import { OperationLogService, OperationLogContext } from '../common/services/operation-log.service';
import { OperationType, ResourceType } from '../common/entities/operation-log.entity';
import { SysUser, UserRole } from '../user/entities/sys-user.entity';

@Injectable()
/**
 * 鍩哄湴鏈嶅姟璐熻矗鍩哄湴銆佸矖浣嶃€佺敵璇峰拰鍚堜綔娴佺▼鐨勪富涓氬姟缂栨帓銆? * 瀹冩槸鍩哄湴鍩熺殑鑱氬悎鏍规湇鍔★紝缁熶竴澶勭悊鏉冮檺鏍￠獙銆佺姸鎬佹祦杞拰鏃ュ織鍓綔鐢ㄣ€? */
export class BaseService {
  private readonly logger = new Logger(BaseService.name);

  constructor(
    @InjectRepository(BaseInfo)
    private baseRepo: Repository<BaseInfo>,
    @InjectRepository(RecruitmentJob)
    private jobRepo: Repository<RecruitmentJob>,
    @InjectRepository(SysUser)
    private userRepo: Repository<SysUser>,
    private jobApplicationService: JobApplicationService,
    private baseCooperationService: BaseCooperationService,
    private operationLogService: OperationLogService,
    private dataSource: DataSource,
  ) { }

  private isTemporaryImageUrl(value: string): boolean {
    const text = String(value || '').trim();
    if (!text) return false;
    return (
      /^https?:\/\/127\.0\.0\.1:\d+\/__tmp__\//i.test(text)
      || /^wxfile:\/\//i.test(text)
      || /^[a-zA-Z]:\\/.test(text)
      || /^file:\/\//i.test(text)
    );
  }

  private ensurePersistedImageUrl(value: string, fieldLabel: string): string {
    const text = String(value || '').trim();
    if (!text) {
      throw new BadRequestException(`${fieldLabel}涓嶈兘涓虹┖`);
    }
    if (this.isTemporaryImageUrl(text)) {
      throw new BadRequestException(`${fieldLabel} cannot use temporary local URL, please upload first`);
    }
    if (!/^https?:\/\//i.test(text)) {
      throw new BadRequestException(`${fieldLabel} 鏍煎紡鏃犳晥锛岃浣跨敤鍙闂殑鍥剧墖 URL`);
    }
    return text;
  }

  private sanitizeDescriptionImages(description?: string): string {
    const text = String(description || '').trim();
    if (!text) return text;

    let parsed: any;
    try {
      parsed = JSON.parse(text);
    } catch (_) {
      return text;
    }

    if (typeof parsed?.licenseUrl === 'string' && parsed.licenseUrl.trim()) {
      parsed.licenseUrl = this.ensurePersistedImageUrl(parsed.licenseUrl, '钀ヤ笟鎵х収鍥剧墖');
    }

    if (Array.isArray(parsed?.workEnvImages)) {
      const normalized = parsed.workEnvImages
        .map((item: any) => String(item || '').trim())
        .filter(Boolean)
        .map((url: string) => this.ensurePersistedImageUrl(url, '宸ヤ綔鐜鍥剧墖'));
      parsed.workEnvImages = normalized;
    }

    return JSON.stringify(parsed);
  }

  // ========== 鍩哄湴鐩稿叧鏂规硶 ==========

  /**
   * 鍒涘缓鍩哄湴骞朵繚璇佸悕绉般€佽礋璐ｄ汉瑙掕壊涓庤蒋鍒犻櫎澶嶇敤瑙勫垯鍚屾椂鎴愮珛銆?   * 鑻ユ暟鎹簱鍞竴閿骞跺彂鍐欏叆瑙﹀彂锛岃繖閲屼細杞崲鎴愬彲璇荤殑涓氬姟鍐茬獊閿欒銆?   */
  async create(createBaseDto: CreateBaseDto, ownerId: number, context?: OperationLogContext): Promise<BaseInfo> {
    this.logger.log(`[鍒涘缓鍩哄湴] 寮€濮? ${createBaseDto.baseName}, 鎵€鏈夎€? ${ownerId}`);

    createBaseDto.licenseUrl = this.ensurePersistedImageUrl(createBaseDto.licenseUrl, '营业执照图片');
    if (createBaseDto.description !== undefined) {
      createBaseDto.description = this.sanitizeDescriptionImages(createBaseDto.description);
    }

    // 1. Validate input name
    const baseName = createBaseDto.baseName.trim();
    if (!baseName) {
      throw new BadRequestException('Base name cannot be empty');
    }

    const owner = await this.userRepo.findOne({ where: { id: ownerId, isDeleted: false } });
    if (!owner) {
      throw new NotFoundException('鍩哄湴璐熻矗浜轰笉瀛樺湪');
    }
    if (![UserRole.BASE_MANAGER, UserRole.BOSS].includes(owner.roleKey)) {
      throw new BadRequestException('鍙湁 base_manager 鎴?boss 鍙互鎻愪氦浼佷笟淇℃伅');
    }

    // 2. Check duplicated name including soft-deleted records
    const existing = await this.baseRepo.findOne({
      where: { baseName },
      withDeleted: true
    });

    if (existing) {
      if (!existing.isDeleted) {
        this.logger.error(`[鍒涘缓鍩哄湴] 澶辫触: 鍩哄湴鍚嶇О "${baseName}" 宸插瓨鍦?(ID: ${existing.id})`);
        throw new ConflictException(`Base name "${baseName}" already exists`);
      } else {
        this.logger.warn(`[鍒涘缓鍩哄湴] 鍙戠幇宸插垹闄ょ殑鍚屽悕鍩哄湴: "${baseName}" (ID: ${existing.id})`);
        throw new ConflictException(`鍩哄湴鍚嶇О "${baseName}" 宸茶浣跨敤杩囷紝璇蜂娇鐢ㄦ柊鍚嶇О`);
      }
    }

    this.logger.log(`[鍒涘缓鍩哄湴] 鍚嶇О楠岃瘉閫氳繃: "${baseName}"`);

    // 3. 鍒涘缓鍩哄湴
    const base = this.baseRepo.create({
      ...createBaseDto,
      baseName,
      ownerId,
      auditStatus: AuditStatus.PENDING,
    });

    try {
      const savedBase = await this.baseRepo.save(base);
      await this.operationLogService.logWithContext({
        operationType: OperationType.CREATE,
        resourceType: ResourceType.BASE,
        resourceId: savedBase.id,
        userId: ownerId,
        request: context?.request,
        description: `鍒涘缓鍩哄湴: ${savedBase.baseName}`,
        afterData: {
          baseName: savedBase.baseName,
          ownerId: savedBase.ownerId,
          auditStatus: savedBase.auditStatus,
          regionCode: savedBase.regionCode,
          category: savedBase.category,
        },
      });
      this.logger.log(`[鍒涘缓鍩哄湴] 鎴愬姛: ID=${savedBase.id}, 鍚嶇О=${savedBase.baseName}`);
      return savedBase;
    } catch (error) {
      if (error.code === 'ER_DUP_ENTRY' || error.errno === 1062) {
        this.logger.error(`[鍒涘缓鍩哄湴] 鏁版嵁搴撳敮涓€绾︽潫閿欒: ${baseName}`);
        throw new ConflictException(`Base name "${baseName}" already exists`);
      }
      this.logger.error(`[鍒涘缓鍩哄湴] 淇濆瓨澶辫触: ${error.message}`);
      throw error;
    }
  }

  /**
   * 瀹℃牳鍩哄湴鐘舵€侊紝骞惰褰曠姸鎬佸彉鏇存棩蹇椼€?   * 杩欓噷鍙礋璐ｇ姸鎬佹祦杞紝涓嶈礋璐ｆ洿缁嗙殑璺ㄧ粍缁囧鎵圭紪鎺掋€?   */
  async audit(id: number, status: any, context?: OperationLogContext): Promise<BaseInfo> {
    this.logger.log(`[瀹℃牳鍩哄湴] 寮€濮? id=${id}, status=${status}`);

    const statusNum = Number(status);
    if (isNaN(statusNum) || ![0, 1, 2].includes(statusNum)) {
      this.logger.error(`[瀹℃牳鍩哄湴] 鏃犳晥鐘舵€? ${status}`);
      throw new BadRequestException('瀹℃牳鐘舵€佸繀椤绘槸 0锛堝緟瀹℃牳锛? 1锛堥€氳繃锛夋垨 2锛堟嫆缁濓級');
    }

    const { result, beforeStatus, baseName } = await this.dataSource.transaction(async (manager) => {
      const base = await manager.findOne(BaseInfo, {
        where: { id },
        lock: { mode: 'pessimistic_write' },
      });
      if (!base) {
        this.logger.error(`[瀹℃牳鍩哄湴] 澶辫触: 鍩哄湴涓嶅瓨鍦?id=${id}`);
        throw new NotFoundException('Base not found');
      }
      if (base.auditStatus !== AuditStatus.PENDING) {
        throw new ConflictException('璇ュ熀鍦板凡琚鏍革紝璇峰埛鏂板悗閲嶈瘯');
      }

      const previousStatus = base.auditStatus;
      base.auditStatus = statusNum;
      const saved = await manager.save(BaseInfo, base);
      return {
        result: saved,
        beforeStatus: previousStatus,
        baseName: base.baseName,
      };
    });

    this.logger.log(`[瀹℃牳鍩哄湴] 瀹屾垚: id=${id}, 鏂扮姸鎬?${result.auditStatus}`);

    // 璁板綍瀹℃牳鎿嶄綔鏃ュ織
    await this.operationLogService.logWithContext({
      operationType: OperationType.AUDIT,
      resourceType: ResourceType.BASE,
      resourceId: id,
      userId: context?.userId,
      request: context?.request,
      description: `鍩哄湴瀹℃牳: ${baseName}, ${beforeStatus} -> ${statusNum}`,
      beforeData: { auditStatus: beforeStatus },
      afterData: { auditStatus: statusNum },
    });

    return result;
  }

  async transferOwner(
    id: number,
    ownerId: number,
    operatorId: number,
    context?: OperationLogContext,
  ): Promise<BaseInfo> {
    const { savedBase, beforeOwnerId, beforeAuditStatus } = await this.dataSource.transaction(async (manager) => {
      const base = await manager.findOne(BaseInfo, {
        where: { id },
        lock: { mode: 'pessimistic_write' },
      });
      if (!base || base.isDeleted) {
        throw new NotFoundException('Base not found');
      }

      const newOwner = await manager.findOne(SysUser, {
        where: { id: ownerId, isDeleted: false },
      });
      if (!newOwner) {
        throw new NotFoundException('New owner not found');
      }
      if (newOwner.roleKey !== UserRole.BASE_MANAGER) {
        throw new BadRequestException('鏂拌礋璐ｄ汉蹇呴』鏄?base_manager');
      }

      const previousOwnerId = base.ownerId;
      const previousAuditStatus = base.auditStatus;
      base.ownerId = ownerId;
      const saved = await manager.save(BaseInfo, base);

      return {
        savedBase: saved,
        beforeOwnerId: previousOwnerId,
        beforeAuditStatus: previousAuditStatus,
      };
    });

    await this.operationLogService.logWithContext({
      operationType: OperationType.UPDATE,
      resourceType: ResourceType.BASE,
      resourceId: savedBase.id,
      userId: operatorId,
      request: context?.request,
      description: `杞氦鍩哄湴璐熻矗浜? baseId=${savedBase.id}, ownerId=${beforeOwnerId} -> ${savedBase.ownerId}`,
      beforeData: {
        ownerId: beforeOwnerId,
        auditStatus: beforeAuditStatus,
      },
      afterData: {
        ownerId: savedBase.ownerId,
        auditStatus: savedBase.auditStatus,
      },
    });

    return savedBase;
  }

  /**
   * 鎸夋煡璇㈡潯浠舵媺鍙栧熀鍦板垪琛ㄣ€?   * 榛樿浠呰繑鍥炲鏍搁€氳繃涓旀湭鍒犻櫎鐨勫熀鍦帮紝绠＄悊绔彲閫氳繃 `showAll` 鏀惧璇ョ害鏉熴€?   */
  async findAll(query: any): Promise<BaseInfo[]> {
    this.logger.log(`[鏌ヨ鍩哄湴鍒楄〃] 鍙傛暟: ${JSON.stringify(query)}`);

    const qb = this.baseRepo.createQueryBuilder('base');

    if (query.regionCode) {
      qb.andWhere('base.regionCode = :region', { region: query.regionCode });
    }
    if (query.category) {
      qb.andWhere('base.category = :category', { category: query.category });
    }
    if (query.ownerId) {
      qb.andWhere('base.ownerId = :ownerId', { ownerId: query.ownerId });
    }

    if (!query.showAll) {
      qb.andWhere('base.auditStatus = :status', { status: AuditStatus.APPROVED });
    }

    qb.andWhere('base.isDeleted = :isDeleted', { isDeleted: false });
    qb.orderBy('base.createdAt', 'DESC');

    const results = await qb.getMany();
    this.logger.log(`[List bases] result count: ${results.length}`);
    return results;
  }

  async findOne(id: number): Promise<BaseInfo> {
    this.logger.log(`[鏌ヨ鍩哄湴璇︽儏] id=${id}`);

    const base = await this.baseRepo.findOne({
      where: { id },
      relations: ['jobs']
    });

    if (!base) {
      this.logger.warn(`[鏌ヨ鍩哄湴璇︽儏] 涓嶅瓨鍦? id=${id}`);
      throw new NotFoundException(`Base ID=${id} not found`);
    }

    this.logger.log(`[鏌ヨ鍩哄湴璇︽儏] 鎴愬姛: id=${base.id}, 鍚嶇О=${base.baseName}`);
    return base;
  }

  /**
   * 鏇存柊鍩哄湴鍩虹淇℃伅锛堝湴鍧€銆佹墽鐓с€佺幆澧冩弿杩扮瓑锛夈€?   * 涓氬姟绾︽潫:
   * 1. 瓒呯/鍖哄煙绠＄悊鍛樺彲鏇存柊浠绘剰鍩哄湴锛?   * 2. 鑰佹澘鎴栧熀鍦扮鐞嗗憳浠呭彲鏇存柊鑷繁鍚嶄笅鍩哄湴锛?   * 3. 闈炵鐞嗗憳鏇存柊鍚庡皢鍥炲埌寰呭鏍哥姸鎬併€?   */
  async updateBase(id: number, updateBaseDto: Partial<CreateBaseDto>, userId: number, context?: OperationLogContext): Promise<BaseInfo> {
    this.logger.log(`[鏇存柊鍩哄湴] 寮€濮? id=${id}, userId=${userId}`);

    const base = await this.baseRepo.findOne({ where: { id } });
    if (!base || base.isDeleted) {
      throw new NotFoundException('Base not found');
    }

    const operator = await this.userRepo.findOne({ where: { id: userId, isDeleted: false } });
    if (!operator) {
      throw new NotFoundException('Operator user not found');
    }

    const isAdmin = [UserRole.SUPER_ADMIN, UserRole.REGION_ADMIN].includes(operator.roleKey);
    const isOwnerRole = [UserRole.BOSS, UserRole.BASE_MANAGER].includes(operator.roleKey);
    if (!isAdmin) {
      if (!isOwnerRole || base.ownerId !== userId) {
        throw new ConflictException('鏃犳潈闄愭洿鏂拌鍩哄湴');
      }
    }

    const beforeSnapshot = {
      baseName: base.baseName,
      licenseUrl: base.licenseUrl,
      contactPhone: base.contactPhone,
      category: base.category,
      regionCode: base.regionCode,
      address: base.address,
      description: base.description,
      auditStatus: base.auditStatus,
    };

    if (updateBaseDto.baseName !== undefined) {
      const nextBaseName = String(updateBaseDto.baseName || '').trim();
      if (!nextBaseName) {
        throw new BadRequestException('鍩哄湴鍚嶇О涓嶈兘涓虹┖');
      }
      const existing = await this.baseRepo.findOne({ where: { baseName: nextBaseName } });
      if (existing && Number(existing.id) !== Number(id) && !existing.isDeleted) {
        throw new ConflictException(`Base name "${nextBaseName}" already exists`);
      }
      base.baseName = nextBaseName;
    }

    if (updateBaseDto.licenseUrl !== undefined) {
      const nextLicenseUrl = String(updateBaseDto.licenseUrl || '').trim();
      base.licenseUrl = nextLicenseUrl
        ? this.ensurePersistedImageUrl(nextLicenseUrl, '营业执照图片')
        : '';
    }
    if (updateBaseDto.contactPhone !== undefined) {
      base.contactPhone = String(updateBaseDto.contactPhone || '').trim();
    }
    if (updateBaseDto.address !== undefined) {
      base.address = String(updateBaseDto.address || '').trim();
    }
    if (updateBaseDto.description !== undefined) {
      base.description = this.sanitizeDescriptionImages(String(updateBaseDto.description || '').trim());
    }
    if (updateBaseDto.category !== undefined) {
      const category = Number(updateBaseDto.category);
      if (![1, 2, 3].includes(category)) {
        throw new BadRequestException('鍩哄湴鍒嗙被鏃犳晥');
      }
      base.category = category as BaseInfo['category'];
    }
    if (updateBaseDto.regionCode !== undefined) {
      const regionCode = Number(updateBaseDto.regionCode);
      if (!Number.isInteger(regionCode) || regionCode <= 0) {
        throw new BadRequestException('鍖哄煙缂栫爜鏃犳晥');
      }
      base.regionCode = regionCode;
    }

    if (!isAdmin) {
      base.auditStatus = AuditStatus.PENDING;
    }

    const updated = await this.baseRepo.save(base);

    await this.operationLogService.logWithContext({
      operationType: OperationType.UPDATE,
      resourceType: ResourceType.BASE,
      resourceId: updated.id,
      userId,
      request: context?.request,
      description: `鏇存柊鍩哄湴: ${updated.baseName}`,
      beforeData: beforeSnapshot,
      afterData: {
        baseName: updated.baseName,
        licenseUrl: updated.licenseUrl,
        contactPhone: updated.contactPhone,
        category: updated.category,
        regionCode: updated.regionCode,
        address: updated.address,
        description: updated.description,
        auditStatus: updated.auditStatus,
      },
    });

    this.logger.log(`[鏇存柊鍩哄湴] 鎴愬姛: id=${updated.id}, 瀹℃牳鐘舵€?${updated.auditStatus}`);
    return updated;
  }

  /**
   * 瓒呯骇绠＄悊鍛樺垹闄ゅ熀鍦帮紙杞垹闄わ級銆?   * 鍚屾椂灏嗚鍩哄湴浠嶅浜庡惎鐢ㄧ姸鎬佺殑宀椾綅鎵归噺涓嬬嚎锛岄伩鍏嶅悗缁户缁嫑宸ャ€?   */
  async remove(id: number, operatorId: number, context?: OperationLogContext): Promise<{ msg: string }> {
    const { beforeSnapshot, affectedJobs } = await this.dataSource.transaction(async (manager) => {
      const base = await manager.findOne(BaseInfo, {
        where: { id },
        lock: { mode: 'pessimistic_write' },
      });

      if (!base) {
        throw new NotFoundException('Base not found');
      }
      if (base.isDeleted) {
        throw new ConflictException('璇ュ熀鍦板凡鍒犻櫎');
      }

      const previous = {
        baseName: base.baseName,
        ownerId: base.ownerId,
        auditStatus: base.auditStatus,
        isDeleted: base.isDeleted,
      };

      base.isDeleted = true;
      await manager.save(BaseInfo, base);

      const jobsResult = await manager
        .createQueryBuilder()
        .update(RecruitmentJob)
        .set({
          isActive: false,
          status: JobStatus.OFFLINE,
        })
        .where('base_id = :baseId', { baseId: id })
        .andWhere('is_active = :isActive', { isActive: true })
        .execute();

      return {
        beforeSnapshot: previous,
        affectedJobs: jobsResult.affected || 0,
      };
    });

    await this.operationLogService.logWithContext({
      operationType: OperationType.DELETE,
      resourceType: ResourceType.BASE,
      resourceId: id,
      userId: operatorId,
      request: context?.request,
      description: `鍒犻櫎鍩哄湴: baseId=${id}, 鍚屾涓嬬嚎宀椾綅=${affectedJobs}`,
      beforeData: beforeSnapshot,
      afterData: {
        isDeleted: true,
        deactivatedJobs: affectedJobs,
      },
    });

    return { msg: '鍩哄湴鍒犻櫎鎴愬姛' };
  }

  // ========== 鎷涜仒宀椾綅鐩稿叧鏂规硶 ==========

  /**
   * 鍦ㄦ寚瀹氬熀鍦颁笅鍒涘缓鎷涜仒宀椾綅銆?   * 鍓嶇疆鏉′欢:
   * 1. 鍩哄湴瀛樺湪涓斿凡瀹℃牳閫氳繃銆?   * 2. 钖祫瀛楁銆佸勾榫勫尯闂村拰鏃ユ湡鍖洪棿婊¤冻涓氬姟绾︽潫銆?   */
  async createJob(baseId: number, createJobDto: CreateJobDto, userId: number, context?: OperationLogContext): Promise<RecruitmentJob> {
    this.logger.log(`[鍙戝竷鎷涜仒] 寮€濮? baseId=${baseId}, userId=${userId}`);

    const base = await this.baseRepo.findOne({ where: { id: baseId } });
    if (!base) {
      this.logger.error(`[鍙戝竷鎷涜仒] 澶辫触: 鍩哄湴涓嶅瓨鍦?baseId=${baseId}`);
      throw new NotFoundException('Base not found');
    }

    if (base.auditStatus !== AuditStatus.APPROVED) {
      this.logger.error(`[鍙戝竷鎷涜仒] 澶辫触: 鍩哄湴鏈鏍搁€氳繃 auditStatus=${base.auditStatus}`);
      throw new ConflictException('Base is not approved, cannot publish recruitment');
    }

    if (base.ownerId !== userId) {
      this.logger.warn(`[鍙戝竷鎷涜仒] 璀﹀憡: 鐢ㄦ埛 ${userId} 涓嶆槸鍩哄湴鎵€鏈夎€?${base.ownerId}`);
      throw new ConflictException('Only base owner can publish recruitment');
    }

    const operator = await this.userRepo.findOne({ where: { id: userId, isDeleted: false } });
    if (!operator || operator.roleKey !== UserRole.BASE_MANAGER) {
      throw new ConflictException('Only base manager can publish recruitment');
    }

    this.validateSalaryFields(createJobDto);
    this.validateJobRanges(createJobDto);

    const jobData: any = {
      ...createJobDto,
      baseId,
      isActive: true,
      status: JobStatus.RECRUITING,
      applicantCount: 0,
      viewCount: 0,
    };

    // 濡傛灉浼犲叆浜唙alidUntil瀛楃涓诧紝杞崲涓篋ate瀵硅薄
    if (createJobDto.validUntil) {
      jobData.validUntil = new Date(createJobDto.validUntil);
    } else {
      // 榛樿鏈夋晥鏈?0澶?
      const now = new Date();
      now.setDate(now.getDate() + 30);
      jobData.validUntil = now;
    }

    this.cleanSalaryFields(jobData, createJobDto.payType);

    // 銆愪慨澶嶇偣銆? 鏄惧紡鏂█涓?RecruitmentJob锛岄伩鍏嶅洜涓?jobData 鏄?any 瀵艰嚧鐨?create 閲嶈浇姝т箟
    const job = this.jobRepo.create(jobData) as unknown as RecruitmentJob;

    try {
      const savedJob = await this.jobRepo.save(job);
      await this.operationLogService.logWithContext({
        operationType: OperationType.CREATE,
        resourceType: ResourceType.JOB,
        resourceId: savedJob.id,
        userId,
        request: context?.request,
        description: `鍒涘缓宀椾綅: ${savedJob.jobTitle}`,
        afterData: {
          baseId: savedJob.baseId,
          jobTitle: savedJob.jobTitle,
          status: savedJob.status,
          payType: savedJob.payType,
          validUntil: savedJob.validUntil,
        },
      });
      this.logger.log(`[鍙戝竷鎷涜仒] 鎴愬姛: jobId=${savedJob.id}, 宀椾綅=${savedJob.jobTitle}`);
      return savedJob;
    } catch (error) {
      this.logger.error(`[鍙戝竷鎷涜仒] 淇濆瓨澶辫触: ${error.message}`);
      throw error;
    }
  }

  /**
   * 鏍￠獙涓嶅悓璁¤柂鏂瑰紡瀵瑰簲鐨勫繀濉瓧娈碉紝闃叉宀椾綅杩涘叆涓嶅彲缁撶畻鐘舵€併€?   */
  private validateSalaryFields(dto: CreateJobDto): void {
    switch (dto.payType) {
      case PayType.FIXED:
        if (!dto.salaryAmount || dto.salaryAmount <= 0) {
          throw new BadRequestException('鍥哄畾宸ヨ祫蹇呴』濉啓钖祫閲戦锛屼笖閲戦蹇呴』澶т簬0');
        }
        break;
      case PayType.PIECEWORK:
        if (!dto.unitPrice || dto.unitPrice <= 0) {
          throw new BadRequestException('璁′欢宸ヨ祫蹇呴』濉啓鍗曚环锛屼笖鍗曚环蹇呴』澶т簬0');
        }
        if (!dto.targetCount || dto.targetCount <= 0) {
          throw new BadRequestException('璁′欢宸ヨ祫蹇呴』濉啓鐩爣鏁伴噺锛屼笖鏁伴噺蹇呴』澶т簬0');
        }
        break;
      case PayType.HOURLY:
        if (!dto.hourlyRate || dto.hourlyRate <= 0) {
          throw new BadRequestException('鏃惰柂蹇呴』濉啓鏃惰柂閲戦锛屼笖閲戦蹇呴』澶т簬0');
        }
        break;
      default:
        throw new BadRequestException(`鏃犳晥鐨勮柂璧勭被鍨? ${dto.payType}`);
    }
  }

  /**
   * 鏍￠獙骞撮緞鍖洪棿鍜屽伐浣滄棩鏈熷尯闂达紝閬垮厤鐢熸垚閫昏緫鑷浉鐭涚浘鐨勫矖浣嶅畾涔夈€?   */
  private validateJobRanges(dto: CreateJobDto): void {
    if (
      dto.minAge !== undefined
      && dto.maxAge !== undefined
      && dto.minAge !== null
      && dto.maxAge !== null
      && dto.minAge > dto.maxAge
    ) {
      throw new BadRequestException('Minimum age cannot be greater than maximum age');
    }

    if (
      dto.workStartDate
      && dto.workEndDate
      && new Date(dto.workStartDate).getTime() > new Date(dto.workEndDate).getTime()
    ) {
      throw new BadRequestException('Work start date cannot be later than work end date');
    }
  }

  /**
   * 鏍规嵁璁¤柂鏂瑰紡娓呯悊浜掓枼瀛楁锛屼繚璇佸簱涓彧淇濈暀褰撳墠妯″紡鐪熸鐢熸晥鐨勫伐璧勯厤缃€?   */
  private cleanSalaryFields(jobData: any, payType: PayType): void {
    switch (payType) {
      case PayType.FIXED:
        jobData.unitPrice = null;
        jobData.hourlyRate = null;
        jobData.targetCount = null;
        break;
      case PayType.HOURLY:
        jobData.salaryAmount = null;
        jobData.unitPrice = null;
        jobData.targetCount = null;
        break;
      case PayType.PIECEWORK:
        jobData.salaryAmount = null;
        jobData.hourlyRate = null;
        break;
    }
  }

  /**
   * 鑾峰彇鏌愬熀鍦扮殑宀椾綅鍒楄〃锛屽苟鏀寔鎸夌姸鎬佸拰鎷涜仒鏈夋晥鎬ц繃婊ゃ€?   */
  async getJobsByBase(baseId: number, query: any = {}): Promise<RecruitmentJob[]> {
    this.logger.log(`[鏌ヨ鍩哄湴宀椾綅] baseId=${baseId}, query=${JSON.stringify(query)}`);

    const qb = this.jobRepo.createQueryBuilder('job')
      .where('job.baseId = :baseId', { baseId })
      .andWhere('job.isActive = :isActive', { isActive: true });

    if (query.status !== undefined) {
      qb.andWhere('job.status = :status', { status: query.status });
    }
    if (query.payType !== undefined) {
      qb.andWhere('job.payType = :payType', { payType: query.payType });
    }
    if (query.onlyValid === true) {
      const now = new Date();
      qb.andWhere('job.validUntil > :now', { now });
    }

    qb.orderBy('job.createdAt', 'DESC');

    const results = await qb.getMany();
    if (results.length) {
      const applicantCountMap = await this.jobApplicationService.getApplicantCountsByJobIds(
        results.map((job) => Number(job.id)),
      );
      results.forEach((job) => {
        const count = applicantCountMap[Number(job.id)];
        job.applicantCount = Number.isInteger(count) ? count : Number(job.applicantCount) || 0;
      });
    }
    this.logger.log(`[List base jobs] result count: ${results.length}`);
    return results;
  }

  async getJobById(jobId: number): Promise<RecruitmentJob> {
    this.logger.log(`[鏌ヨ宀椾綅璇︽儏] jobId=${jobId}`);

    const job = await this.jobRepo.findOne({
      where: { id: jobId },
      relations: ['base']
    });

    if (!job) {
      this.logger.warn(`[鏌ヨ宀椾綅璇︽儏] 涓嶅瓨鍦? jobId=${jobId}`);
      throw new NotFoundException(`Job ID=${jobId} not found`);
    }

    if (job.isActive) {
      await this.jobRepo.increment({ id: job.id }, 'viewCount', 1);
      job.viewCount += 1;
    }

    this.logger.log(`[鏌ヨ宀椾綅璇︽儏] 鎴愬姛: jobId=${job.id}, 宀椾綅=${job.jobTitle}`);
    return job;
  }

  /**
   * 鏇存柊宀椾綅鐘舵€併€?   * 璇ユ柟娉曡礋璐ｅ熀鍦版墍鏈夋潈鏍￠獙锛岄伩鍏嶉潪宀椾綅褰掑睘鏂逛慨鏀规嫑鑱樺紑鍏炽€?   */
  async updateJobStatus(jobId: number, status: JobStatus, userId: number, context?: OperationLogContext): Promise<RecruitmentJob> {
    this.logger.log(`[鏇存柊宀椾綅鐘舵€乚 jobId=${jobId}, status=${status}`);

    const { updatedJob, beforeStatus, beforeActive } = await this.dataSource.transaction(async (manager) => {
      const job = await manager.findOne(RecruitmentJob, {
        where: { id: jobId },
        lock: { mode: 'pessimistic_write' },
      });
      if (!job) {
        throw new NotFoundException('Recruitment job not found');
      }

      const base = await manager.findOne(BaseInfo, { where: { id: job.baseId } });
      if (!base) {
        throw new NotFoundException('Base not found');
      }
      if (base.ownerId !== userId) {
        throw new ConflictException('Only base owner can update job status');
      }

      const operator = await manager.findOne(SysUser, { where: { id: userId, isDeleted: false } });
      if (!operator || operator.roleKey !== UserRole.BASE_MANAGER) {
        throw new ConflictException('Only base manager can update job status');
      }

      const previousStatus = job.status;
      const previousActive = job.isActive;

      job.status = status;
      job.isActive = ![JobStatus.OFFLINE, JobStatus.FULL].includes(status);

      const next = await manager.save(RecruitmentJob, job);
      return {
        updatedJob: next,
        beforeStatus: previousStatus,
        beforeActive: previousActive,
      };
    });
    await this.operationLogService.logWithContext({
      operationType: OperationType.UPDATE,
      resourceType: ResourceType.JOB,
      resourceId: updatedJob.id,
      userId,
      request: context?.request,
      description: `鏇存柊宀椾綅鐘舵€? ${updatedJob.jobTitle}`,
      beforeData: {
        status: beforeStatus,
        isActive: beforeActive,
      },
      afterData: {
        status: updatedJob.status,
        isActive: updatedJob.isActive,
      },
    });
    this.logger.log(`[鏇存柊宀椾綅鐘舵€乚 鎴愬姛: jobId=${jobId}, 鏂扮姸鎬?${status}`);
    return updatedJob;
  }

  async renewJob(jobId: number, userId: number, context?: OperationLogContext): Promise<RecruitmentJob> {
    this.logger.log(`[缁湡宀椾綅] jobId=${jobId}`);

    const { renewedJob, beforeValidUntil, beforeStatus } = await this.dataSource.transaction(async (manager) => {
      const job = await manager.findOne(RecruitmentJob, {
        where: { id: jobId },
        lock: { mode: 'pessimistic_write' },
      });
      if (!job) {
        throw new NotFoundException('Recruitment job not found');
      }

      const base = await manager.findOne(BaseInfo, { where: { id: job.baseId } });
      if (!base) {
        throw new NotFoundException('Base not found');
      }
      if (base.ownerId !== userId) {
        throw new ConflictException('Only base owner can renew recruitment');
      }

      const operator = await manager.findOne(SysUser, { where: { id: userId, isDeleted: false } });
      if (!operator || operator.roleKey !== UserRole.BASE_MANAGER) {
        throw new ConflictException('Only base manager can renew recruitment');
      }

      const newValidUntil = new Date(job.validUntil);
      newValidUntil.setDate(newValidUntil.getDate() + job.renewalDays);
      const previousValidUntil = job.validUntil;
      const previousStatus = job.status;

      job.validUntil = newValidUntil;
      job.isActive = true;
      job.status = JobStatus.RECRUITING;

      const next = await manager.save(RecruitmentJob, job);
      return {
        renewedJob: next,
        beforeValidUntil: previousValidUntil,
        beforeStatus: previousStatus,
      };
    });
    await this.operationLogService.logWithContext({
      operationType: OperationType.UPDATE,
      resourceType: ResourceType.JOB,
      resourceId: renewedJob.id,
      userId,
      request: context?.request,
      description: `缁湡宀椾綅: ${renewedJob.jobTitle}`,
      beforeData: {
        validUntil: beforeValidUntil,
        status: beforeStatus,
      },
      afterData: {
        validUntil: renewedJob.validUntil,
        status: renewedJob.status,
      },
    });
    this.logger.log(`[缁湡宀椾綅] 鎴愬姛: jobId=${jobId}, 鏂版湁鏁堟湡=${renewedJob.validUntil.toISOString()}`);
    return renewedJob;
  }

  /**
   * 鑱氬悎鍩哄湴缁村害鐨勫矖浣嶄笌鐢宠缁熻锛岀敤浜庣鐞嗙鐪嬫澘鍜岃繍钀ヨ鍥俱€?   */
  async getBaseStatistics(baseId: number): Promise<any> {
    this.logger.log(`[鑾峰彇鍩哄湴缁熻] baseId=${baseId}`);

    const base = await this.baseRepo.findOne({ where: { id: baseId } });
    if (!base) {
      throw new NotFoundException('Base not found');
    }

    const jobStats = await this.jobRepo
      .createQueryBuilder('job')
      .select([
        'COUNT(*) as totalJobs',
        'SUM(CASE WHEN job.isActive = true THEN 1 ELSE 0 END) as activeJobs',
        'SUM(CASE WHEN job.status = :recruiting THEN 1 ELSE 0 END) as recruitingJobs',
        'SUM(CASE WHEN job.status = :full THEN 1 ELSE 0 END) as fullJobs',
        'SUM(job.recruitCount) as totalRecruitCount',
        'SUM(job.applicantCount) as totalApplicantCount',
      ])
      .setParameters({
        recruiting: JobStatus.RECRUITING,
        full: JobStatus.FULL
      })
      .where('job.baseId = :baseId', { baseId })
      .getRawOne();

    return {
      baseId,
      baseName: base.baseName,
      auditStatus: base.auditStatus,
      statistics: {
        jobs: {
          total: Number(jobStats.totalJobs) || 0,
          active: Number(jobStats.activeJobs) || 0,
          recruiting: Number(jobStats.recruitingJobs) || 0,
          full: Number(jobStats.fullJobs) || 0,
        },
        recruitment: {
          target: Number(jobStats.totalRecruitCount) || 0,
          applied: Number(jobStats.totalApplicantCount) || 0,
          completionRate: jobStats.totalRecruitCount > 0
            ? (Number(jobStats.totalApplicantCount) / Number(jobStats.totalRecruitCount) * 100).toFixed(2) + '%'
            : '0%'
        }
      }
    };
  }

  /**
   * 妫€鏌ュ熀鍦板悕绉版槸鍚﹀彲鐢ㄣ€?   * 杩欓噷浼氬悓鏃舵嫤鎴凡瀛樺湪鍚嶇О鍜屽巻鍙茶蒋鍒犻櫎鍚庝笉鍙鐢ㄧ殑鍚嶇О銆?   */
  async checkBaseNameAvailability(baseName: string): Promise<{ available: boolean; message: string }> {
    const name = baseName.trim();

    if (!name) {
      return { available: false, message: '鍩哄湴鍚嶇О涓嶈兘涓虹┖' };
    }

    const existing = await this.baseRepo.findOne({
      where: { baseName: name },
      withDeleted: true
    });

    if (existing) {
      if (!existing.isDeleted) {
        return {
          available: false,
          message: `Base name "${name}" already exists`
        };
      } else {
        return {
          available: false,
          message: `鍩哄湴鍚嶇О "${name}" 宸茶浣跨敤杩囷紝璇蜂娇鐢ㄦ柊鍚嶇О`
        };
      }
    }

    return {
      available: true,
      message: `鍩哄湴鍚嶇О "${name}" 鍙敤`
    };
  }

  async getExpiringJobs(days: number = 3): Promise<RecruitmentJob[]> {
    const now = new Date();
    const warningDate = new Date(now);
    warningDate.setDate(now.getDate() + days);

    return this.jobRepo
      .createQueryBuilder('job')
      .innerJoinAndSelect('job.base', 'base')
      .where('job.isActive = :isActive', { isActive: true })
      .andWhere('job.validUntil BETWEEN :now AND :warningDate', {
        now,
        warningDate
      })
      .andWhere('job.status = :status', { status: JobStatus.RECRUITING })
      .orderBy('job.validUntil', 'ASC')
      .getMany();
  }

  /**
   * 鎵归噺鍋滅敤宸茶繃鏈熷矖浣嶏紝渚涘畾鏃朵换鍔℃垨鍚庡彴缁存姢鍏ュ彛璋冪敤銆?   * 杩斿洖鍊肩敤浜庤繍缁寸粺璁℃湰杞疄闄呭仠鐢ㄧ殑宀椾綅鏁伴噺銆?   */
  async deactivateExpiredJobs(): Promise<{ deactivated: number }> {
    const now = new Date();
    const result = await this.jobRepo
      .createQueryBuilder()
      .update(RecruitmentJob)
      .set({
        isActive: false,
        status: JobStatus.EXPIRED,
      })
      .where('is_active = :isActive', { isActive: true })
      .andWhere('auto_renew = :autoRenew', { autoRenew: false })
      .andWhere('valid_until IS NOT NULL')
      .andWhere('valid_until <= :now', { now })
      .andWhere('status <> :expiredStatus', { expiredStatus: JobStatus.EXPIRED })
      .execute();

    return { deactivated: result.affected || 0 };
  }

  async applyJob(userId: number, jobId: number, baseId: number, note?: string, context?: OperationLogContext) {
    return this.jobApplicationService.create(userId, jobId, baseId, note, context);
  }

  async getJobApplications(jobId: number) {
    return this.jobApplicationService.getApplicationsByJob(jobId);
  }

  /** 褰撳墠鐢ㄦ埛鐨勫矖浣嶇敵璇峰垪琛紙宸ヤ汉绔€屾垜鐨勬姤鍚嶃€嶏級 */
  async getApplicationsByUser(userId: number) {
    return this.jobApplicationService.getApplicationsByUser(userId);
  }

  async getApplicationsByBase(baseId: number, status?: number) {
    return this.jobApplicationService.getApplicationsByBase(baseId, status as ApplicationStatus);
  }

  async reviewApplication(applicationId: number, status: number, reviewedBy: number, rejectReason?: string, context?: OperationLogContext) {
    return this.jobApplicationService.review(applicationId, status as ApplicationStatus, reviewedBy, rejectReason, context);
  }

  async createCooperation(applicantId: number, baseId: number, requirement: string, context?: OperationLogContext) {
    return this.baseCooperationService.create(applicantId, baseId, requirement, context);
  }

  async reviewCooperation(cooperationId: number, status: number, reviewedBy: number, rejectReason?: string, context?: OperationLogContext) {
    return this.baseCooperationService.review(cooperationId, status as CooperationStatus, reviewedBy, rejectReason, context);
  }

  async getBaseCooperations(baseId: number) {
    return this.baseCooperationService.getCooperationsByBase(baseId);
  }
}
