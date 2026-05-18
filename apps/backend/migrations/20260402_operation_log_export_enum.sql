-- Extend operation_log.operationType enum for salary report export auditing.

START TRANSACTION;

ALTER TABLE `operation_log`
  MODIFY COLUMN `operationType` enum('create','update','delete','audit','login','checkin','payment','export') NOT NULL COMMENT '操作类型';

COMMIT;
