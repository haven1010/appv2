-- Add encrypted home address field for worker profile and payroll report usage.

START TRANSACTION;

ALTER TABLE `sys_user`
  ADD COLUMN `home_address_enc` varchar(512) NULL COMMENT '家庭地址（加密）' AFTER `emergency_phone_hash`;

COMMIT;
