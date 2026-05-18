-- Split boss ownership from manager supervision and add job audit status.

DROP PROCEDURE IF EXISTS `sp_20260402_supervisor_assignment_and_job_audit`;

DELIMITER $$

CREATE PROCEDURE `sp_20260402_supervisor_assignment_and_job_audit`()
BEGIN
  IF NOT EXISTS (
    SELECT 1
    FROM information_schema.columns
    WHERE table_schema = DATABASE()
      AND table_name = 'recruitment_job'
      AND column_name = 'audit_status'
  ) THEN
    ALTER TABLE `recruitment_job`
      ADD COLUMN `audit_status` tinyint NOT NULL DEFAULT 0 COMMENT '0:Pending, 1:Approved, 2:Rejected' AFTER `status`;
  END IF;

  IF NOT EXISTS (
    SELECT 1
    FROM information_schema.statistics
    WHERE table_schema = DATABASE()
      AND table_name = 'recruitment_job'
      AND index_name = 'IDX_recruitment_job_audit_status'
  ) THEN
    ALTER TABLE `recruitment_job`
      ADD INDEX `IDX_recruitment_job_audit_status` (`audit_status`);
  END IF;

  IF EXISTS (
    SELECT 1
    FROM information_schema.columns
    WHERE table_schema = DATABASE()
      AND table_name = 'recruitment_job'
      AND column_name = 'audit_status'
  ) THEN
    UPDATE `recruitment_job`
    SET `audit_status` = 1
    WHERE `audit_status` = 0;
  END IF;
END$$

DELIMITER ;

CALL `sp_20260402_supervisor_assignment_and_job_audit`();
DROP PROCEDURE IF EXISTS `sp_20260402_supervisor_assignment_and_job_audit`;

CREATE TABLE IF NOT EXISTS `base_supervisor_assignment` (
  `id` bigint NOT NULL AUTO_INCREMENT,
  `base_id` bigint NOT NULL COMMENT '基地 ID',
  `user_id` bigint NOT NULL COMMENT '监督人用户 ID',
  `role_key` enum('super_admin','region_admin','boss','base_manager','field_manager','worker') NOT NULL COMMENT '监督角色，仅允许 base_manager 或 field_manager',
  `assigned_by` bigint DEFAULT NULL COMMENT '分配人 ID',
  `created_at` datetime(6) NOT NULL DEFAULT CURRENT_TIMESTAMP(6),
  `updated_at` datetime(6) NOT NULL DEFAULT CURRENT_TIMESTAMP(6) ON UPDATE CURRENT_TIMESTAMP(6),
  PRIMARY KEY (`id`),
  UNIQUE KEY `UQ_base_supervisor_assignment_base_user` (`base_id`,`user_id`),
  KEY `IDX_base_supervisor_assignment_user_role` (`user_id`,`role_key`),
  KEY `FK_base_supervisor_assignment_assigner` (`assigned_by`),
  CONSTRAINT `FK_base_supervisor_assignment_base` FOREIGN KEY (`base_id`) REFERENCES `base_info` (`id`) ON DELETE CASCADE,
  CONSTRAINT `FK_base_supervisor_assignment_user` FOREIGN KEY (`user_id`) REFERENCES `sys_user` (`id`) ON DELETE CASCADE,
  CONSTRAINT `FK_base_supervisor_assignment_assigner` FOREIGN KEY (`assigned_by`) REFERENCES `sys_user` (`id`) ON DELETE SET NULL
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci COMMENT='基地监督关系';

DROP TRIGGER IF EXISTS `TRG_sys_user_validate_role_before_insert`;
DROP TRIGGER IF EXISTS `TRG_sys_user_validate_role_before_update`;

DELIMITER $$

CREATE TRIGGER `TRG_sys_user_validate_role_before_insert`
BEFORE INSERT ON `sys_user`
FOR EACH ROW
BEGIN
  IF NEW.role_key <> 'field_manager' AND NEW.assigned_base_id IS NOT NULL THEN
    SIGNAL SQLSTATE '45000' SET MESSAGE_TEXT = 'only field_manager can set assigned_base_id';
  END IF;
END$$

CREATE TRIGGER `TRG_sys_user_validate_role_before_update`
BEFORE UPDATE ON `sys_user`
FOR EACH ROW
BEGIN
  IF NEW.role_key <> 'field_manager' AND NEW.assigned_base_id IS NOT NULL THEN
    SIGNAL SQLSTATE '45000' SET MESSAGE_TEXT = 'only field_manager can set assigned_base_id';
  END IF;
END$$

DELIMITER ;
