-- Add proxy registration workflow: user flags, proxy case table, and operation log enum extension.

START TRANSACTION;

ALTER TABLE `sys_user`
  ADD COLUMN `register_mode` enum('self','proxy') NOT NULL DEFAULT 'self' COMMENT 'self:本人注册, proxy:家人代注册' AFTER `info_audit_status`,
  ADD COLUMN `account_owner_verified` tinyint NOT NULL DEFAULT '1' COMMENT '1:已完成本人接管, 0:未完成' AFTER `register_mode`,
  ADD COLUMN `login_lock_reason` varchar(255) NULL COMMENT '登录限制原因（审核拒绝或撤销）' AFTER `account_owner_verified`;

CREATE TABLE `proxy_registration_case` (
  `id` bigint NOT NULL AUTO_INCREMENT,
  `worker_user_id` bigint NOT NULL COMMENT '被代注册工人用户 ID',
  `proxy_name` varchar(50) NOT NULL COMMENT '代办人姓名',
  `proxy_phone_enc` varchar(256) NOT NULL COMMENT '代办人手机号（加密）',
  `proxy_phone_hash` varchar(64) NOT NULL COMMENT '代办人手机号哈希',
  `relation_to_worker` varchar(32) NOT NULL COMMENT '代办人与工人关系',
  `consent_type` varchar(32) NOT NULL DEFAULT 'family_confirm' COMMENT '授权方式',
  `consent_statement` text NULL COMMENT '授权说明文本快照',
  `consent_evidence_url` varchar(512) NULL COMMENT '授权凭证链接',
  `status` enum('pending_review','approved','rejected','revoked','takeover_done') NOT NULL DEFAULT 'pending_review' COMMENT '代注册审核状态',
  `risk_level` enum('low','high') NOT NULL DEFAULT 'low' COMMENT '风控等级',
  `risk_tags_json` text NULL COMMENT '风控标签 JSON',
  `reviewed_by` bigint NULL COMMENT '审核人 ID',
  `reviewed_at` datetime NULL COMMENT '审核时间',
  `reject_reason` text NULL COMMENT '拒绝原因',
  `created_at` datetime(6) NOT NULL DEFAULT CURRENT_TIMESTAMP(6),
  `updated_at` datetime(6) NOT NULL DEFAULT CURRENT_TIMESTAMP(6) ON UPDATE CURRENT_TIMESTAMP(6),
  PRIMARY KEY (`id`),
  KEY `IDX_proxy_registration_worker_user_id` (`worker_user_id`),
  KEY `IDX_proxy_registration_proxy_phone_hash` (`proxy_phone_hash`),
  KEY `IDX_proxy_registration_status` (`status`),
  KEY `IDX_proxy_registration_reviewed_by` (`reviewed_by`),
  CONSTRAINT `FK_proxy_registration_worker_user` FOREIGN KEY (`worker_user_id`) REFERENCES `sys_user` (`id`) ON DELETE CASCADE,
  CONSTRAINT `FK_proxy_registration_reviewed_by` FOREIGN KEY (`reviewed_by`) REFERENCES `sys_user` (`id`) ON DELETE SET NULL
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_0900_ai_ci;

ALTER TABLE `operation_log`
  MODIFY COLUMN `resourceType` enum('user','base','job','signup','salary','offline_event','proxy_registration_case') NOT NULL COMMENT '资源类型';

COMMIT;
