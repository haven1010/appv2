-- Add worker demographics fields and job work-end tracking columns required by payroll flows.

START TRANSACTION;

ALTER TABLE `sys_user`
  ADD COLUMN `gender` enum('male','female') NULL COMMENT 'male:男, female:女' AFTER `face_img_url`,
  ADD COLUMN `is_poor_household` tinyint NULL COMMENT '1:是, 0:否' AFTER `gender`;

ALTER TABLE `job_application`
  ADD COLUMN `work_end_time` datetime NULL COMMENT '结束务工时间' AFTER `reviewed_at`,
  ADD COLUMN `work_end_by` bigint NULL COMMENT '结束务工操作人ID' AFTER `work_end_time`,
  ADD COLUMN `work_end_recorded_at` datetime NULL COMMENT '结束务工记录创建时间' AFTER `work_end_by`;

COMMIT;
