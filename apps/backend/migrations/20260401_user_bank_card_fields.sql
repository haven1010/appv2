-- Add bank card fields for user registration and profile updates.

START TRANSACTION;

ALTER TABLE `sys_user`
  ADD COLUMN `bank_name` varchar(100) NULL COMMENT '开户银行' AFTER `emergency_phone_hash`,
  ADD COLUMN `bank_card_no_enc` text NULL COMMENT '银行卡号（加密）' AFTER `bank_name`,
  ADD COLUMN `bank_card_no_hash` varchar(64) NULL COMMENT '银行卡号哈希' AFTER `bank_card_no_enc`;

ALTER TABLE `sys_user`
  ADD INDEX `IDX_sys_user_bank_card_no_hash` (`bank_card_no_hash`);

COMMIT;
