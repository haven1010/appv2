-- Prelaunch hardening migration
-- Run this before starting the production app.

START TRANSACTION;

CREATE TABLE IF NOT EXISTS `operation_log` (
  `id` bigint NOT NULL AUTO_INCREMENT,
  `operationType` enum('create','update','delete','audit','login','checkin','payment') NOT NULL COMMENT '操作类型',
  `resourceType` enum('user','base','job','signup','salary') NOT NULL COMMENT '资源类型',
  `resource_id` bigint NOT NULL COMMENT '资源ID',
  `user_id` bigint NOT NULL COMMENT '操作用户ID',
  `description` text COMMENT '操作描述',
  `before_data` text COMMENT '操作前数据',
  `after_data` text COMMENT '操作后数据',
  `ip_address` varchar(45) DEFAULT NULL COMMENT 'IP地址',
  `user_agent` text COMMENT 'User Agent',
  `created_at` datetime(6) NOT NULL DEFAULT CURRENT_TIMESTAMP(6),
  PRIMARY KEY (`id`),
  KEY `IDX_operation_log_operationType` (`operationType`),
  KEY `IDX_operation_log_resourceType` (`resourceType`),
  KEY `IDX_operation_log_resource_id` (`resource_id`),
  KEY `IDX_operation_log_user_id` (`user_id`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_0900_ai_ci;

CREATE TABLE IF NOT EXISTS `job_application` (
  `id` bigint NOT NULL AUTO_INCREMENT,
  `user_id` bigint NOT NULL,
  `job_id` bigint NOT NULL,
  `base_id` bigint NOT NULL,
  `status` tinyint NOT NULL DEFAULT '0' COMMENT '0:待处理, 1:已通过, 2:已拒绝, 3:已取消',
  `note` text,
  `rejectReason` text,
  `reviewed_by` bigint DEFAULT NULL COMMENT '审核人ID',
  `reviewed_at` datetime DEFAULT NULL COMMENT '审核时间',
  `created_at` datetime(6) NOT NULL DEFAULT CURRENT_TIMESTAMP(6),
  `updated_at` datetime(6) NOT NULL DEFAULT CURRENT_TIMESTAMP(6) ON UPDATE CURRENT_TIMESTAMP(6),
  PRIMARY KEY (`id`),
  KEY `IDX_job_application_user_id` (`user_id`),
  KEY `IDX_job_application_job_id` (`job_id`),
  KEY `IDX_job_application_base_id` (`base_id`),
  CONSTRAINT `FK_job_application_user` FOREIGN KEY (`user_id`) REFERENCES `sys_user` (`id`),
  CONSTRAINT `FK_job_application_job` FOREIGN KEY (`job_id`) REFERENCES `recruitment_job` (`id`),
  CONSTRAINT `FK_job_application_base` FOREIGN KEY (`base_id`) REFERENCES `base_info` (`id`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_0900_ai_ci;

CREATE TABLE IF NOT EXISTS `base_cooperation` (
  `id` bigint NOT NULL AUTO_INCREMENT,
  `base_id` bigint NOT NULL COMMENT '申请合作的基地ID',
  `applicant_id` bigint NOT NULL COMMENT '申请人ID（区域管理员/超级管理员）',
  `requirement` text NOT NULL COMMENT '合作需求描述（工种、人数、周期等）',
  `status` tinyint NOT NULL DEFAULT '0' COMMENT '0:待审核, 1:已同意, 2:已拒绝',
  `rejectReason` text,
  `reviewed_by` bigint DEFAULT NULL COMMENT '审核人ID',
  `reviewed_at` datetime DEFAULT NULL COMMENT '审核时间',
  `created_at` datetime(6) NOT NULL DEFAULT CURRENT_TIMESTAMP(6),
  `updated_at` datetime(6) NOT NULL DEFAULT CURRENT_TIMESTAMP(6) ON UPDATE CURRENT_TIMESTAMP(6),
  PRIMARY KEY (`id`),
  KEY `IDX_base_cooperation_base_id` (`base_id`),
  KEY `IDX_base_cooperation_applicant_id` (`applicant_id`),
  CONSTRAINT `FK_base_cooperation_base` FOREIGN KEY (`base_id`) REFERENCES `base_info` (`id`),
  CONSTRAINT `FK_base_cooperation_applicant` FOREIGN KEY (`applicant_id`) REFERENCES `sys_user` (`id`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_0900_ai_ci;

CREATE TABLE IF NOT EXISTS `salary_payment` (
  `id` bigint NOT NULL AUTO_INCREMENT,
  `salary_id` bigint NOT NULL COMMENT '工资记录ID',
  `paymentMethod` enum('cash','transfer') NOT NULL COMMENT '发放方式',
  `status` tinyint NOT NULL DEFAULT '0' COMMENT '0:待确认, 1:已确认, 2:已发放, 3:已取消',
  `confirm_signature_url` text COMMENT '确认签字照片URL',
  `payment_voucher_url` text COMMENT '发放凭证照片URL',
  `paid_at` datetime DEFAULT NULL COMMENT '发放时间',
  `paid_by` bigint DEFAULT NULL COMMENT '发放人ID',
  `note` text COMMENT '备注',
  `created_at` datetime(6) NOT NULL DEFAULT CURRENT_TIMESTAMP(6),
  `updated_at` datetime(6) NOT NULL DEFAULT CURRENT_TIMESTAMP(6) ON UPDATE CURRENT_TIMESTAMP(6),
  PRIMARY KEY (`id`),
  UNIQUE KEY `UQ_salary_payment_salary_id` (`salary_id`),
  CONSTRAINT `FK_salary_payment_salary` FOREIGN KEY (`salary_id`) REFERENCES `labor_salary` (`id`) ON DELETE CASCADE,
  CONSTRAINT `FK_salary_payment_paid_by` FOREIGN KEY (`paid_by`) REFERENCES `sys_user` (`id`) ON DELETE SET NULL
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_0900_ai_ci;

ALTER TABLE `sys_user`
  ADD COLUMN IF NOT EXISTS `assigned_base_id` bigint DEFAULT NULL COMMENT 'For Field Managers - assigned base',
  ADD COLUMN IF NOT EXISTS `emergency_contact_enc` varchar(256) DEFAULT NULL COMMENT 'Encrypted Emergency Contact (Name and Relationship)',
  ADD COLUMN IF NOT EXISTS `emergency_phone_enc` varchar(256) DEFAULT NULL COMMENT 'Encrypted Emergency Contact Phone',
  ADD COLUMN IF NOT EXISTS `emergency_phone_hash` varchar(64) DEFAULT NULL COMMENT 'Hash of Emergency Phone for Search',
  ADD COLUMN IF NOT EXISTS `info_audit_status` tinyint NOT NULL DEFAULT '1' COMMENT '0:Pending, 1:Approved, 2:Rejected';

UPDATE `sys_user` SET `phone_hash` = NULL WHERE `phone_hash` = '';
UPDATE `sys_user` SET `emergency_phone_hash` = NULL WHERE `emergency_phone_hash` = '';

ALTER TABLE `sys_user`
  MODIFY COLUMN `id_card_hash` varchar(64) NOT NULL COMMENT 'SHA256 Hash of ID Card for Search',
  MODIFY COLUMN `phone_hash` varchar(64) DEFAULT NULL COMMENT 'SHA256 Hash of Phone for Search';

ALTER TABLE `sys_user`
  ADD UNIQUE KEY `UQ_sys_user_id_card_hash` (`id_card_hash`),
  ADD UNIQUE KEY `UQ_sys_user_phone_hash` (`phone_hash`),
  ADD KEY `IDX_sys_user_emergency_phone_hash` (`emergency_phone_hash`),
  ADD CONSTRAINT `FK_sys_user_assigned_base` FOREIGN KEY (`assigned_base_id`) REFERENCES `base_info` (`id`) ON DELETE SET NULL;

ALTER TABLE `base_info`
  ADD CONSTRAINT `FK_base_info_owner` FOREIGN KEY (`owner_id`) REFERENCES `sys_user` (`id`) ON DELETE RESTRICT;

ALTER TABLE `daily_signup`
  DROP INDEX `IDX_96b07a56d0da164eab16b1b9b6`,
  ADD UNIQUE KEY `UQ_daily_signup_user_base_date` (`user_id`,`base_id`,`work_date`),
  ADD CONSTRAINT `FK_daily_signup_proxy_user` FOREIGN KEY (`proxy_user_id`) REFERENCES `sys_user` (`id`) ON DELETE SET NULL;

ALTER TABLE `labor_salary`
  ADD CONSTRAINT `FK_labor_salary_admin` FOREIGN KEY (`admin_id`) REFERENCES `sys_user` (`id`) ON DELETE RESTRICT;

COMMIT;
