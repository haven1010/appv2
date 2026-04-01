-- 新增老板角色，并允许 boss 作为企业信息提交主体（与 base_manager 职责分离）

ALTER TABLE sys_user
  MODIFY COLUMN role_key ENUM('super_admin', 'region_admin', 'boss', 'base_manager', 'field_manager', 'worker')
  NOT NULL DEFAULT 'worker';

DROP TRIGGER IF EXISTS TRG_base_info_validate_owner_before_insert;
DROP TRIGGER IF EXISTS TRG_base_info_validate_owner_before_update;
DROP TRIGGER IF EXISTS TRG_sys_user_guard_owner_role_before_update;

DELIMITER $$

CREATE TRIGGER TRG_base_info_validate_owner_before_insert
BEFORE INSERT ON base_info
FOR EACH ROW
BEGIN
  IF (SELECT role_key FROM sys_user WHERE id = NEW.owner_id) NOT IN ('base_manager', 'boss') THEN
    SIGNAL SQLSTATE '45000' SET MESSAGE_TEXT = 'base owner must be base_manager or boss';
  END IF;
END$$

CREATE TRIGGER TRG_base_info_validate_owner_before_update
BEFORE UPDATE ON base_info
FOR EACH ROW
BEGIN
  IF (SELECT role_key FROM sys_user WHERE id = NEW.owner_id) NOT IN ('base_manager', 'boss') THEN
    SIGNAL SQLSTATE '45000' SET MESSAGE_TEXT = 'base owner must be base_manager or boss';
  END IF;
END$$

CREATE TRIGGER TRG_sys_user_guard_owner_role_before_update
BEFORE UPDATE ON sys_user
FOR EACH ROW
BEGIN
  IF NEW.role_key NOT IN ('base_manager', 'boss')
     AND EXISTS (SELECT 1 FROM base_info WHERE owner_id = NEW.id LIMIT 1) THEN
    SIGNAL SQLSTATE '45000' SET MESSAGE_TEXT = 'base owner must remain base_manager or boss';
  END IF;
END$$

DELIMITER ;
