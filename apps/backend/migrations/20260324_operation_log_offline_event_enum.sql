-- Extend operation_log.resource_type enum for offline attendance event auditing.

START TRANSACTION;

ALTER TABLE `operation_log`
  MODIFY COLUMN `resourceType` enum('user','base','job','signup','salary','offline_event') NOT NULL COMMENT '资源类型';

COMMIT;
