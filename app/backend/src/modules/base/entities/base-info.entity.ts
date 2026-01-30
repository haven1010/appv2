
import { Entity, Column, PrimaryGeneratedColumn, CreateDateColumn, UpdateDateColumn, Index, OneToMany } from 'typeorm';
import { EncryptionTransformer } from '../../common/transformers/encryption.transformer';
import { RecruitmentJob } from './recruitment-job.entity';
import { DailySignup } from '../../attendance/entities/daily-signup.entity';

export enum BaseCategory {
  FRUIT = 1,
  VEGETABLE = 2,
  OTHER = 3,
}

export enum AuditStatus {
  PENDING = 0,
  APPROVED = 1,
  REJECTED = 2,
}

@Entity('base_info')
export class BaseInfo {
  @PrimaryGeneratedColumn({ type: 'bigint' })
  id: number;

  @Column({ name: 'base_name', length: 100, comment: 'Base Name' })
  baseName: string;

  // --- Sensitive Data Encrypted ---
  @Column({ 
    name: 'license_enc', 
    length: 512, 
    transformer: new EncryptionTransformer(),
    comment: 'Encrypted License Image URL' 
  })
  licenseUrl: string;

  @Column({ 
    name: 'contact_enc', 
    length: 256, 
    transformer: new EncryptionTransformer(),
    comment: 'Encrypted Contact Phone' 
  })
  contactPhone: string;
  // --------------------------------

  @Index()
  @Column({ 
    type: 'tinyint', 
    default: BaseCategory.FRUIT,
    comment: '1:Fruit, 2:Veg, 3:Other' 
  })
  category: BaseCategory;

  @Index()
  @Column({ name: 'region_code', type: 'int', comment: 'Region Code' })
  regionCode: number;

  @Column({ type: 'text', nullable: true, comment: 'Address' })
  address: string;

  @Column({ type: 'text', nullable: true, comment: 'JSON Description' })
  description: string;

  @Column({ 
    name: 'audit_status', 
    type: 'tinyint', 
    default: AuditStatus.PENDING,
    comment: '0:Pending, 1:Approved, 2:Rejected'
  })
  auditStatus: AuditStatus;

  @Column({ name: 'owner_id', type: 'bigint' })
  ownerId: number;

  @OneToMany(() => RecruitmentJob, (job) => job.base)
  jobs: RecruitmentJob[];

  @OneToMany(() => DailySignup, (signup) => signup.base)
  signups: DailySignup[];

  @Column({ default: false, name: 'is_deleted' })
  isDeleted: boolean;

  @CreateDateColumn({ name: 'created_at' })
  createdAt: Date;

  @UpdateDateColumn({ name: 'updated_at' })
  updatedAt: Date;
}
