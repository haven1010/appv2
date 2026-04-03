-- Add worker salary appeal fields so workers can dispute drafts and base managers can adjust them.

START TRANSACTION;

ALTER TABLE `labor_salary`
  ADD COLUMN `worker_appeal_status` tinyint NOT NULL DEFAULT '0' COMMENT '0:无申诉, 1:待处理, 2:已调整待确认, 3:已驳回' AFTER `worker_sign_url`,
  ADD COLUMN `worker_appeal_reason` text NULL COMMENT '采摘工申诉原因' AFTER `worker_appeal_status`,
  ADD COLUMN `worker_expected_amount` decimal(10,2) NULL COMMENT '采摘工申诉期望金额' AFTER `worker_appeal_reason`,
  ADD COLUMN `worker_appealed_at` datetime NULL COMMENT '采摘工申诉时间' AFTER `worker_expected_amount`,
  ADD COLUMN `appeal_reply` text NULL COMMENT '基地管理员处理说明' AFTER `worker_appealed_at`,
  ADD COLUMN `appeal_handled_by` bigint NULL COMMENT '申诉处理人ID' AFTER `appeal_reply`,
  ADD COLUMN `appeal_handled_at` datetime NULL COMMENT '申诉处理时间' AFTER `appeal_handled_by`;

COMMIT;
