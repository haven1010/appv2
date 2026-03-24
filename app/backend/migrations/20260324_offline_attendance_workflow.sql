-- Offline attendance workflow migration
-- Add raw offline event storage and review queue.

START TRANSACTION;

CREATE TABLE IF NOT EXISTS `offline_attendance_event` (
  `id` bigint NOT NULL AUTO_INCREMENT,
  `offline_record_id` varchar(64) NOT NULL COMMENT '离线端生成的幂等记录ID',
  `device_id` varchar(128) NOT NULL COMMENT '采集设备ID',
  `worker_uid` varchar(32) NOT NULL COMMENT '工人UID',
  `worker_id` bigint DEFAULT NULL COMMENT '解析出的工人ID',
  `base_id` bigint NOT NULL COMMENT '基地ID',
  `job_id` bigint DEFAULT NULL COMMENT '岗位ID',
  `work_date` date NOT NULL COMMENT '逻辑工作日',
  `occurred_at` datetime NOT NULL COMMENT '实际发生时间',
  `submitted_by` bigint NOT NULL COMMENT '提交人ID',
  `status` tinyint NOT NULL DEFAULT '0' COMMENT '0:待审核,1:自动通过,2:人工通过,3:拒绝',
  `risk_level` tinyint NOT NULL DEFAULT '1' COMMENT '0:低风险,1:高风险',
  `validation_message` text COMMENT '系统校验结果或风险说明',
  `evidence_note` text COMMENT '人工备注/证据说明',
  `evidence_json` text COMMENT '证据快照JSON',
  `payload_json` text COMMENT '原始上传载荷JSON',
  `reviewed_by` bigint DEFAULT NULL COMMENT '审核人ID',
  `reviewed_at` datetime DEFAULT NULL COMMENT '审核时间',
  `applied_signup_id` bigint DEFAULT NULL COMMENT '最终落到的签到记录ID',
  `created_at` datetime(6) NOT NULL DEFAULT CURRENT_TIMESTAMP(6),
  `updated_at` datetime(6) NOT NULL DEFAULT CURRENT_TIMESTAMP(6) ON UPDATE CURRENT_TIMESTAMP(6),
  PRIMARY KEY (`id`),
  UNIQUE KEY `UQ_offline_attendance_event_device_record` (`device_id`,`offline_record_id`),
  KEY `IDX_offline_attendance_event_worker_uid` (`worker_uid`),
  KEY `IDX_offline_attendance_event_base_id` (`base_id`),
  KEY `IDX_offline_attendance_event_work_date` (`work_date`),
  KEY `IDX_offline_attendance_event_status` (`status`),
  KEY `IDX_offline_attendance_event_submitted_by` (`submitted_by`),
  CONSTRAINT `FK_offline_attendance_event_worker` FOREIGN KEY (`worker_id`) REFERENCES `sys_user` (`id`) ON DELETE SET NULL,
  CONSTRAINT `FK_offline_attendance_event_base` FOREIGN KEY (`base_id`) REFERENCES `base_info` (`id`) ON DELETE RESTRICT,
  CONSTRAINT `FK_offline_attendance_event_job` FOREIGN KEY (`job_id`) REFERENCES `recruitment_job` (`id`) ON DELETE SET NULL,
  CONSTRAINT `FK_offline_attendance_event_submitter` FOREIGN KEY (`submitted_by`) REFERENCES `sys_user` (`id`) ON DELETE RESTRICT,
  CONSTRAINT `FK_offline_attendance_event_reviewer` FOREIGN KEY (`reviewed_by`) REFERENCES `sys_user` (`id`) ON DELETE SET NULL,
  CONSTRAINT `FK_offline_attendance_event_signup` FOREIGN KEY (`applied_signup_id`) REFERENCES `daily_signup` (`id`) ON DELETE SET NULL
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_0900_ai_ci;

COMMIT;
