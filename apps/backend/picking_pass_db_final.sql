-- MySQL dump 10.13  Distrib 9.6.0, for macos26.2 (arm64)
--
-- Host: 127.0.0.1    Database: pickpass_db
-- ------------------------------------------------------
-- Server version	9.6.0

/*!40101 SET @OLD_CHARACTER_SET_CLIENT=@@CHARACTER_SET_CLIENT */;
/*!40101 SET @OLD_CHARACTER_SET_RESULTS=@@CHARACTER_SET_RESULTS */;
/*!40101 SET @OLD_COLLATION_CONNECTION=@@COLLATION_CONNECTION */;
/*!50503 SET NAMES utf8mb4 */;
/*!40103 SET @OLD_TIME_ZONE=@@TIME_ZONE */;
/*!40103 SET TIME_ZONE='+00:00' */;
/*!40014 SET @OLD_UNIQUE_CHECKS=@@UNIQUE_CHECKS, UNIQUE_CHECKS=0 */;
/*!40014 SET @OLD_FOREIGN_KEY_CHECKS=@@FOREIGN_KEY_CHECKS, FOREIGN_KEY_CHECKS=0 */;
/*!40101 SET @OLD_SQL_MODE=@@SQL_MODE, SQL_MODE='NO_AUTO_VALUE_ON_ZERO' */;
/*!40111 SET @OLD_SQL_NOTES=@@SQL_NOTES, SQL_NOTES=0 */;

--
-- Table structure for table `base_cooperation`
--

DROP TABLE IF EXISTS `base_cooperation`;
/*!40101 SET @saved_cs_client     = @@character_set_client */;
/*!50503 SET character_set_client = utf8mb4 */;
CREATE TABLE `base_cooperation` (
  `id` bigint NOT NULL AUTO_INCREMENT,
  `base_id` bigint NOT NULL COMMENT '申请合作的基地ID',
  `applicant_id` bigint NOT NULL COMMENT '申请人ID（区域管理员/超级管理员）',
  `requirement` text NOT NULL COMMENT '合作需求描述（工种、人数、周期等）',
  `status` tinyint NOT NULL DEFAULT '0' COMMENT '0:待审核, 1:已同意, 2:已拒绝',
  `pending_guard` tinyint GENERATED ALWAYS AS ((case when (`status` = 0) then 1 else NULL end)) STORED,
  `rejectReason` text,
  `reviewed_by` bigint DEFAULT NULL COMMENT '审核人ID',
  `reviewed_at` datetime DEFAULT NULL COMMENT '审核时间',
  `created_at` datetime(6) NOT NULL DEFAULT CURRENT_TIMESTAMP(6),
  `updated_at` datetime(6) NOT NULL DEFAULT CURRENT_TIMESTAMP(6) ON UPDATE CURRENT_TIMESTAMP(6),
  PRIMARY KEY (`id`),
  UNIQUE KEY `UQ_base_cooperation_pending` (`applicant_id`,`base_id`,`pending_guard`),
  KEY `IDX_base_cooperation_base_id` (`base_id`),
  KEY `IDX_base_cooperation_applicant_id` (`applicant_id`),
  KEY `IDX_base_cooperation_reviewed_by` (`reviewed_by`),
  CONSTRAINT `FK_base_cooperation_applicant` FOREIGN KEY (`applicant_id`) REFERENCES `sys_user` (`id`),
  CONSTRAINT `FK_base_cooperation_base` FOREIGN KEY (`base_id`) REFERENCES `base_info` (`id`),
  CONSTRAINT `FK_base_cooperation_reviewed_by` FOREIGN KEY (`reviewed_by`) REFERENCES `sys_user` (`id`) ON DELETE RESTRICT
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_0900_ai_ci;
/*!40101 SET character_set_client = @saved_cs_client */;

--
-- Dumping data for table `base_cooperation`
--

LOCK TABLES `base_cooperation` WRITE;
/*!40000 ALTER TABLE `base_cooperation` DISABLE KEYS */;
/*!40000 ALTER TABLE `base_cooperation` ENABLE KEYS */;
UNLOCK TABLES;

--
-- Table structure for table `base_info`
--

DROP TABLE IF EXISTS `base_info`;
/*!40101 SET @saved_cs_client     = @@character_set_client */;
/*!50503 SET character_set_client = utf8mb4 */;
CREATE TABLE `base_info` (
  `id` bigint NOT NULL AUTO_INCREMENT,
  `base_name` varchar(100) NOT NULL COMMENT 'Base Name',
  `license_enc` varchar(512) NOT NULL COMMENT 'Encrypted License Image URL',
  `contact_enc` varchar(256) NOT NULL COMMENT 'Encrypted Contact Phone',
  `category` tinyint NOT NULL DEFAULT '1' COMMENT '1:Fruit, 2:Veg, 3:Other',
  `region_code` int NOT NULL COMMENT 'Region Code',
  `address` text COMMENT 'Address',
  `description` text COMMENT 'JSON Description',
  `audit_status` tinyint NOT NULL DEFAULT '0' COMMENT '0:Pending, 1:Approved, 2:Rejected',
  `owner_id` bigint NOT NULL,
  `is_deleted` tinyint NOT NULL DEFAULT '0',
  `created_at` datetime(6) NOT NULL DEFAULT CURRENT_TIMESTAMP(6),
  `updated_at` datetime(6) NOT NULL DEFAULT CURRENT_TIMESTAMP(6) ON UPDATE CURRENT_TIMESTAMP(6),
  PRIMARY KEY (`id`),
  UNIQUE KEY `UQ_base_info_base_name` (`base_name`),
  KEY `IDX_8422d7bd73e8f45eedd8e73c25` (`category`),
  KEY `IDX_1039900b9090090abffeb6b90a` (`region_code`),
  KEY `FK_base_info_owner` (`owner_id`),
  CONSTRAINT `FK_base_info_owner` FOREIGN KEY (`owner_id`) REFERENCES `sys_user` (`id`) ON DELETE RESTRICT
) ENGINE=InnoDB AUTO_INCREMENT=6 DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_0900_ai_ci;
/*!40101 SET character_set_client = @saved_cs_client */;

--
-- Dumping data for table `base_info`
--

LOCK TABLES `base_info` WRITE;
/*!40000 ALTER TABLE `base_info` DISABLE KEYS */;
INSERT INTO `base_info` VALUES (2,'杭州西湖农场','55391aac1c343350210f48bf99c1258d7b25ba707aa26ebb2461f700798882c1f6b4ba851cd66c7c1e55ca81d54cda02f9de1905728aa2f00d6a9d3054db8e37','77dc542f22bbce1649817288ab17681b',1,330100,'浙江省杭州市西湖区龙井路1号','{\"video\": \"https://example.com/video.mp4\", \"vr\": \"https://example.com/vr\"}',1,9,0,'2025-12-21 02:28:11.375386','2025-12-21 04:04:03.000000'),(3,'青山湖香蕉采摘园','51010ca0db7378ae86681dd6f6af1c43c9340cba440549f2d16ca03e11707d16','26e8503db7f7c716c28e5cf15b50f493',1,330100,'杭州市临安区xxx路','{\"video\": \"...\", \"vr\": \"...\"}',0,9,0,'2025-12-21 12:30:30.823842','2025-12-21 12:30:30.823842'),(4,'演示苹果基地','v2:907cd4c372f24bfb41499c5600b19d3a:258b87fd438b645f66b30177d92611b036bae048c474c7b703c83512bc2cdbe837f1421cd2fa2cbd8d4c3f5de1d7393435bbabfacb34624f85538f9178815ab5','v2:1e97abe1e346beb043167b52a9ed47cf:29de6d5b7b2869fc68a21dbc9e9d5ac8',1,370600,'山东省烟台市福山区演示果园 1 号','演示基地（系统自动初始化），用于前端岗位浏览与联调。',1,2,0,'2026-04-01 19:53:54.955526','2026-04-01 19:53:54.955526'),(5,'内蒙捡土豆','v2:88d1238402e362970ec3704fd8b8384a:d91f173092cdefaa3d89875c96ce67b52d693b2bba3c1300213950cd22c8c241cb323560243fc40cb0bf88633a03d62c36babb36d01e32190bf73dd6f112497a','v2:ed69fac8777b561a75aceb06c3e29ef4:d232df104a2c82579b9565d373d80e7d',2,150100,'内蒙古呼和浩特市土豆测试基地 1 号','测试基地：内蒙捡土豆，便于小程序联调与岗位浏览测试。',1,2,0,'2026-04-01 19:53:54.961215','2026-04-01 19:53:54.961215');
/*!40000 ALTER TABLE `base_info` ENABLE KEYS */;
UNLOCK TABLES;
/*!50003 SET @saved_cs_client      = @@character_set_client */ ;
/*!50003 SET @saved_cs_results     = @@character_set_results */ ;
/*!50003 SET @saved_col_connection = @@collation_connection */ ;
/*!50003 SET character_set_client  = utf8mb4 */ ;
/*!50003 SET character_set_results = utf8mb4 */ ;
/*!50003 SET collation_connection  = utf8mb4_unicode_ci */ ;
/*!50003 SET @saved_sql_mode       = @@sql_mode */ ;
/*!50003 SET sql_mode              = 'IGNORE_SPACE,ONLY_FULL_GROUP_BY,STRICT_TRANS_TABLES,NO_ZERO_IN_DATE,NO_ZERO_DATE,ERROR_FOR_DIVISION_BY_ZERO,NO_ENGINE_SUBSTITUTION' */ ;
DELIMITER ;;
/*!50003 CREATE*/ /*!50017 DEFINER=`root`@`127.0.0.1`*/ /*!50003 TRIGGER `TRG_base_info_validate_owner_before_insert` BEFORE INSERT ON `base_info` FOR EACH ROW BEGIN
         IF (SELECT role_key FROM sys_user WHERE id = NEW.owner_id) NOT IN ('base_manager', 'boss') THEN
           SIGNAL SQLSTATE '45000' SET MESSAGE_TEXT = 'base owner must be base_manager or boss';
         END IF;
       END */;;
DELIMITER ;
/*!50003 SET sql_mode              = @saved_sql_mode */ ;
/*!50003 SET character_set_client  = @saved_cs_client */ ;
/*!50003 SET character_set_results = @saved_cs_results */ ;
/*!50003 SET collation_connection  = @saved_col_connection */ ;
/*!50003 SET @saved_cs_client      = @@character_set_client */ ;
/*!50003 SET @saved_cs_results     = @@character_set_results */ ;
/*!50003 SET @saved_col_connection = @@collation_connection */ ;
/*!50003 SET character_set_client  = utf8mb4 */ ;
/*!50003 SET character_set_results = utf8mb4 */ ;
/*!50003 SET collation_connection  = utf8mb4_unicode_ci */ ;
/*!50003 SET @saved_sql_mode       = @@sql_mode */ ;
/*!50003 SET sql_mode              = 'IGNORE_SPACE,ONLY_FULL_GROUP_BY,STRICT_TRANS_TABLES,NO_ZERO_IN_DATE,NO_ZERO_DATE,ERROR_FOR_DIVISION_BY_ZERO,NO_ENGINE_SUBSTITUTION' */ ;
DELIMITER ;;
/*!50003 CREATE*/ /*!50017 DEFINER=`root`@`127.0.0.1`*/ /*!50003 TRIGGER `TRG_base_info_validate_owner_before_update` BEFORE UPDATE ON `base_info` FOR EACH ROW BEGIN
         IF (SELECT role_key FROM sys_user WHERE id = NEW.owner_id) NOT IN ('base_manager', 'boss') THEN
           SIGNAL SQLSTATE '45000' SET MESSAGE_TEXT = 'base owner must be base_manager or boss';
         END IF;
       END */;;
DELIMITER ;
/*!50003 SET sql_mode              = @saved_sql_mode */ ;
/*!50003 SET character_set_client  = @saved_cs_client */ ;
/*!50003 SET character_set_results = @saved_cs_results */ ;
/*!50003 SET collation_connection  = @saved_col_connection */ ;

--
-- Table structure for table `daily_signup`
--

DROP TABLE IF EXISTS `daily_signup`;
/*!40101 SET @saved_cs_client     = @@character_set_client */;
/*!50503 SET character_set_client = utf8mb4 */;
CREATE TABLE `daily_signup` (
  `id` bigint NOT NULL AUTO_INCREMENT,
  `user_id` bigint NOT NULL,
  `base_id` bigint NOT NULL,
  `job_id` bigint NOT NULL,
  `work_date` date NOT NULL,
  `status` tinyint NOT NULL DEFAULT '0' COMMENT '0:已报名, 1:已签到, 2:缺勤, 3:取消',
  `checkin_time` datetime DEFAULT NULL,
  `is_proxy` tinyint NOT NULL DEFAULT '0',
  `proxy_user_id` bigint DEFAULT NULL,
  `is_offline_sync` tinyint NOT NULL DEFAULT '0',
  `created_at` datetime(6) NOT NULL DEFAULT CURRENT_TIMESTAMP(6),
  `updated_at` datetime(6) NOT NULL DEFAULT CURRENT_TIMESTAMP(6) ON UPDATE CURRENT_TIMESTAMP(6),
  PRIMARY KEY (`id`),
  UNIQUE KEY `UQ_daily_signup_user_job_date` (`user_id`,`job_id`,`work_date`),
  KEY `FK_22fd44a023e2fd23c37a78ef3f9` (`base_id`),
  KEY `FK_6ce935b94287a29b9d100873292` (`job_id`),
  KEY `IDX_daily_signup_user_id` (`user_id`),
  KEY `IDX_daily_signup_job_base` (`job_id`,`base_id`),
  KEY `FK_daily_signup_proxy_user` (`proxy_user_id`),
  CONSTRAINT `FK_22fd44a023e2fd23c37a78ef3f9` FOREIGN KEY (`base_id`) REFERENCES `base_info` (`id`),
  CONSTRAINT `FK_6ce935b94287a29b9d100873292` FOREIGN KEY (`job_id`) REFERENCES `recruitment_job` (`id`),
  CONSTRAINT `FK_daily_signup_job_base` FOREIGN KEY (`job_id`, `base_id`) REFERENCES `recruitment_job` (`id`, `base_id`) ON DELETE RESTRICT,
  CONSTRAINT `FK_daily_signup_proxy_user` FOREIGN KEY (`proxy_user_id`) REFERENCES `sys_user` (`id`) ON DELETE SET NULL,
  CONSTRAINT `FK_e2d0644de775f57f4ecad4c2714` FOREIGN KEY (`user_id`) REFERENCES `sys_user` (`id`)
) ENGINE=InnoDB AUTO_INCREMENT=5 DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_0900_ai_ci;
/*!40101 SET character_set_client = @saved_cs_client */;

--
-- Dumping data for table `daily_signup`
--

LOCK TABLES `daily_signup` WRITE;
/*!40000 ALTER TABLE `daily_signup` DISABLE KEYS */;
INSERT INTO `daily_signup` VALUES (1,8,2,1,'2025-12-21',1,'2025-12-21 17:00:00',0,NULL,1,'2025-12-21 08:00:58.473077','2025-12-21 08:08:07.000000'),(2,8,2,1,'2025-01-01',1,NULL,0,NULL,0,'2025-12-21 08:19:01.000000','2025-12-21 08:19:01.000000'),(3,8,2,1,'2025-01-02',1,NULL,0,NULL,0,'2025-12-21 08:19:01.000000','2025-12-21 08:19:01.000000'),(4,8,2,1,'2025-01-03',1,NULL,0,NULL,0,'2025-12-21 08:19:01.000000','2025-12-21 08:19:01.000000');
/*!40000 ALTER TABLE `daily_signup` ENABLE KEYS */;
UNLOCK TABLES;

--
-- Table structure for table `job_application`
--

DROP TABLE IF EXISTS `job_application`;
/*!40101 SET @saved_cs_client     = @@character_set_client */;
/*!50503 SET character_set_client = utf8mb4 */;
CREATE TABLE `job_application` (
  `id` bigint NOT NULL AUTO_INCREMENT,
  `user_id` bigint NOT NULL,
  `job_id` bigint NOT NULL,
  `base_id` bigint NOT NULL,
  `status` tinyint NOT NULL DEFAULT '0' COMMENT '0:待处理, 1:已通过, 2:已拒绝, 3:已取消',
  `pending_guard` tinyint GENERATED ALWAYS AS ((case when (`status` = 0) then 1 else NULL end)) STORED,
  `note` text,
  `rejectReason` text,
  `reviewed_by` bigint DEFAULT NULL COMMENT '审核人ID',
  `reviewed_at` datetime DEFAULT NULL COMMENT '审核时间',
  `created_at` datetime(6) NOT NULL DEFAULT CURRENT_TIMESTAMP(6),
  `updated_at` datetime(6) NOT NULL DEFAULT CURRENT_TIMESTAMP(6) ON UPDATE CURRENT_TIMESTAMP(6),
  PRIMARY KEY (`id`),
  UNIQUE KEY `UQ_job_application_pending` (`user_id`,`job_id`,`base_id`,`pending_guard`),
  KEY `IDX_job_application_user_id` (`user_id`),
  KEY `IDX_job_application_job_id` (`job_id`),
  KEY `IDX_job_application_base_id` (`base_id`),
  KEY `IDX_job_application_reviewed_by` (`reviewed_by`),
  KEY `IDX_job_application_job_base` (`job_id`,`base_id`),
  CONSTRAINT `FK_job_application_base` FOREIGN KEY (`base_id`) REFERENCES `base_info` (`id`),
  CONSTRAINT `FK_job_application_job` FOREIGN KEY (`job_id`) REFERENCES `recruitment_job` (`id`),
  CONSTRAINT `FK_job_application_job_base` FOREIGN KEY (`job_id`, `base_id`) REFERENCES `recruitment_job` (`id`, `base_id`) ON DELETE RESTRICT,
  CONSTRAINT `FK_job_application_reviewed_by` FOREIGN KEY (`reviewed_by`) REFERENCES `sys_user` (`id`) ON DELETE RESTRICT,
  CONSTRAINT `FK_job_application_user` FOREIGN KEY (`user_id`) REFERENCES `sys_user` (`id`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_0900_ai_ci;
/*!40101 SET character_set_client = @saved_cs_client */;

--
-- Dumping data for table `job_application`
--

LOCK TABLES `job_application` WRITE;
/*!40000 ALTER TABLE `job_application` DISABLE KEYS */;
/*!40000 ALTER TABLE `job_application` ENABLE KEYS */;
UNLOCK TABLES;

--
-- Table structure for table `labor_salary`
--

DROP TABLE IF EXISTS `labor_salary`;
/*!40101 SET @saved_cs_client     = @@character_set_client */;
/*!50503 SET character_set_client = utf8mb4 */;
CREATE TABLE `labor_salary` (
  `id` bigint NOT NULL AUTO_INCREMENT,
  `signup_id` bigint NOT NULL,
  `work_duration` decimal(4,1) NOT NULL DEFAULT '0.0',
  `piece_count` int NOT NULL DEFAULT '0',
  `unit_price_snapshot` decimal(10,2) NOT NULL,
  `total_amount` decimal(10,2) NOT NULL,
  `payout_type` tinyint DEFAULT NULL COMMENT '1:Cash, 2:Transfer',
  `status` tinyint NOT NULL DEFAULT '0' COMMENT '0:Pending, 1:Confirmed, 2:Paid',
  `proof_img_url` varchar(255) DEFAULT NULL,
  `worker_sign_url` varchar(255) DEFAULT NULL,
  `admin_id` bigint NOT NULL,
  `created_at` datetime(6) NOT NULL DEFAULT CURRENT_TIMESTAMP(6),
  `updated_at` datetime(6) NOT NULL DEFAULT CURRENT_TIMESTAMP(6) ON UPDATE CURRENT_TIMESTAMP(6),
  PRIMARY KEY (`id`),
  UNIQUE KEY `IDX_ba4a47c6f7ee6d3fab12536638` (`signup_id`),
  KEY `FK_labor_salary_admin` (`admin_id`),
  CONSTRAINT `FK_ba4a47c6f7ee6d3fab125366386` FOREIGN KEY (`signup_id`) REFERENCES `daily_signup` (`id`),
  CONSTRAINT `FK_labor_salary_admin` FOREIGN KEY (`admin_id`) REFERENCES `sys_user` (`id`) ON DELETE RESTRICT
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_0900_ai_ci;
/*!40101 SET character_set_client = @saved_cs_client */;

--
-- Dumping data for table `labor_salary`
--

LOCK TABLES `labor_salary` WRITE;
/*!40000 ALTER TABLE `labor_salary` DISABLE KEYS */;
/*!40000 ALTER TABLE `labor_salary` ENABLE KEYS */;
UNLOCK TABLES;

--
-- Table structure for table `offline_attendance_event`
--

DROP TABLE IF EXISTS `offline_attendance_event`;
/*!40101 SET @saved_cs_client     = @@character_set_client */;
/*!50503 SET character_set_client = utf8mb4 */;
CREATE TABLE `offline_attendance_event` (
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
  KEY `FK_offline_attendance_event_worker` (`worker_id`),
  KEY `FK_offline_attendance_event_job` (`job_id`),
  KEY `FK_offline_attendance_event_reviewer` (`reviewed_by`),
  KEY `FK_offline_attendance_event_signup` (`applied_signup_id`),
  CONSTRAINT `FK_offline_attendance_event_base` FOREIGN KEY (`base_id`) REFERENCES `base_info` (`id`) ON DELETE RESTRICT,
  CONSTRAINT `FK_offline_attendance_event_job` FOREIGN KEY (`job_id`) REFERENCES `recruitment_job` (`id`) ON DELETE SET NULL,
  CONSTRAINT `FK_offline_attendance_event_reviewer` FOREIGN KEY (`reviewed_by`) REFERENCES `sys_user` (`id`) ON DELETE SET NULL,
  CONSTRAINT `FK_offline_attendance_event_signup` FOREIGN KEY (`applied_signup_id`) REFERENCES `daily_signup` (`id`) ON DELETE SET NULL,
  CONSTRAINT `FK_offline_attendance_event_submitter` FOREIGN KEY (`submitted_by`) REFERENCES `sys_user` (`id`) ON DELETE RESTRICT,
  CONSTRAINT `FK_offline_attendance_event_worker` FOREIGN KEY (`worker_id`) REFERENCES `sys_user` (`id`) ON DELETE SET NULL
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_0900_ai_ci;
/*!40101 SET character_set_client = @saved_cs_client */;

--
-- Dumping data for table `offline_attendance_event`
--

LOCK TABLES `offline_attendance_event` WRITE;
/*!40000 ALTER TABLE `offline_attendance_event` DISABLE KEYS */;
/*!40000 ALTER TABLE `offline_attendance_event` ENABLE KEYS */;
UNLOCK TABLES;

--
-- Table structure for table `operation_log`
--

DROP TABLE IF EXISTS `operation_log`;
/*!40101 SET @saved_cs_client     = @@character_set_client */;
/*!50503 SET character_set_client = utf8mb4 */;
CREATE TABLE `operation_log` (
  `id` bigint NOT NULL AUTO_INCREMENT,
  `operationType` enum('create','update','delete','audit','login','checkin','payment','export') NOT NULL COMMENT '操作类型',
  `resourceType` enum('user','base','job','signup','salary','offline_event') NOT NULL COMMENT '资源类型',
  `resource_id` bigint NOT NULL COMMENT '资源ID',
  `user_id` bigint NOT NULL COMMENT '操作用户ID',
  `description` text COMMENT '操作描述',
  `before_data` text COMMENT '操作前数据',
  `after_data` text COMMENT '操作后数据',
  `ip_address` varchar(45) DEFAULT NULL COMMENT 'IP地址',
  `user_agent` text COMMENT 'User Agent',
  `created_at` datetime(6) NOT NULL DEFAULT CURRENT_TIMESTAMP(6),
  PRIMARY KEY (`id`),
  KEY `IDX_operation_log_operationType` (`operationType`),
  KEY `IDX_operation_log_resourceType` (`resourceType`),
  KEY `IDX_operation_log_resource_id` (`resource_id`),
  KEY `IDX_operation_log_user_id` (`user_id`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_0900_ai_ci;
/*!40101 SET character_set_client = @saved_cs_client */;

--
-- Dumping data for table `operation_log`
--

LOCK TABLES `operation_log` WRITE;
/*!40000 ALTER TABLE `operation_log` DISABLE KEYS */;
/*!40000 ALTER TABLE `operation_log` ENABLE KEYS */;
UNLOCK TABLES;

--
-- Table structure for table `recruitment_job`
--

DROP TABLE IF EXISTS `recruitment_job`;
/*!40101 SET @saved_cs_client     = @@character_set_client */;
/*!50503 SET character_set_client = utf8mb4 */;
CREATE TABLE `recruitment_job` (
  `id` bigint NOT NULL AUTO_INCREMENT,
  `base_id` bigint NOT NULL,
  `pay_type` tinyint NOT NULL DEFAULT '1' COMMENT '1:固定, 2:时薪, 3:计件',
  `unit_price` decimal(10,2) DEFAULT NULL COMMENT '单价（计件或时薪时使用）',
  `targetCount` int DEFAULT '0' COMMENT '目标数量（计件用）',
  `requirements` text COMMENT '招聘要求',
  `status` tinyint NOT NULL DEFAULT '1' COMMENT '状态：0-已下架，1-招聘中，2-已招满，3-已过期',
  `valid_until` datetime DEFAULT NULL COMMENT '有效期至',
  `created_at` datetime(6) NOT NULL DEFAULT CURRENT_TIMESTAMP(6),
  `updated_at` datetime(6) NOT NULL DEFAULT CURRENT_TIMESTAMP(6) ON UPDATE CURRENT_TIMESTAMP(6),
  `recruit_count` int NOT NULL DEFAULT '1' COMMENT '招聘人数',
  `work_cycle` tinyint NOT NULL DEFAULT '1' COMMENT '工作周期: 1-日结,2-周结,3-月结,4-季节工,5-长期工',
  `work_content` text COMMENT '工作内容',
  `work_hours` varchar(50) DEFAULT NULL COMMENT '工作时间，如：08:00-17:00',
  `work_start_date` date DEFAULT NULL COMMENT '工作开始日期',
  `work_end_date` date DEFAULT NULL COMMENT '工作结束日期',
  `salary_amount` decimal(10,2) DEFAULT NULL COMMENT '固定工资金额',
  `hourly_rate` decimal(10,2) DEFAULT NULL COMMENT '时薪',
  `min_age` tinyint DEFAULT NULL COMMENT '最小年龄',
  `max_age` tinyint DEFAULT NULL COMMENT '最大年龄',
  `experience_required` text COMMENT '经验要求',
  `physical_requirement` text COMMENT '体力要求',
  `benefits` text COMMENT '福利保障描述',
  `has_accommodation` tinyint NOT NULL DEFAULT '0' COMMENT '是否提供住宿',
  `has_meals` tinyint NOT NULL DEFAULT '0' COMMENT '是否提供餐食',
  `has_transportation` tinyint NOT NULL DEFAULT '0' COMMENT '是否有交通补贴',
  `transportation_subsidy` decimal(10,2) DEFAULT NULL COMMENT '交通补贴金额',
  `workplace_images` json DEFAULT NULL COMMENT '工作场景图片URL数组',
  `video_url` varchar(500) DEFAULT NULL COMMENT '工作场景视频URL',
  `is_active` tinyint NOT NULL DEFAULT '1' COMMENT '是否有效',
  `auto_renew` tinyint NOT NULL DEFAULT '0' COMMENT '是否自动续期',
  `renewal_days` int NOT NULL DEFAULT '7' COMMENT '续期天数',
  `applicant_count` int NOT NULL DEFAULT '0' COMMENT '已申请人数',
  `view_count` int NOT NULL DEFAULT '0' COMMENT '查看次数',
  `job_title` varchar(100) NOT NULL COMMENT '岗位名称',
  PRIMARY KEY (`id`),
  UNIQUE KEY `UQ_recruitment_job_id_base` (`id`,`base_id`),
  KEY `FK_622b304d76ffe1265f92d9e06ec` (`base_id`),
  KEY `IDX_f75321f338dcd5e4966aa7d33a` (`status`),
  KEY `IDX_recruitment_job_id_base` (`id`,`base_id`),
  CONSTRAINT `FK_622b304d76ffe1265f92d9e06ec` FOREIGN KEY (`base_id`) REFERENCES `base_info` (`id`),
  CONSTRAINT `CHK_recruitment_job_age_range` CHECK (((`min_age` is null) or (`max_age` is null) or (`min_age` <= `max_age`))),
  CONSTRAINT `CHK_recruitment_job_pay_fields` CHECK ((((`pay_type` = 1) and (`salary_amount` is not null) and (`salary_amount` > 0) and (`hourly_rate` is null) and (`unit_price` is null) and ((`targetCount` is null) or (`targetCount` = 0))) or ((`pay_type` = 2) and (`hourly_rate` is not null) and (`hourly_rate` > 0) and (`salary_amount` is null) and (`unit_price` is null) and ((`targetCount` is null) or (`targetCount` = 0))) or ((`pay_type` = 3) and (`unit_price` is not null) and (`unit_price` > 0) and (`targetCount` is not null) and (`targetCount` > 0) and (`salary_amount` is null) and (`hourly_rate` is null)))),
  CONSTRAINT `CHK_recruitment_job_work_dates` CHECK (((`work_start_date` is null) or (`work_end_date` is null) or (`work_start_date` <= `work_end_date`)))
) ENGINE=InnoDB AUTO_INCREMENT=4 DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_0900_ai_ci;
/*!40101 SET character_set_client = @saved_cs_client */;

--
-- Dumping data for table `recruitment_job`
--

LOCK TABLES `recruitment_job` WRITE;
/*!40000 ALTER TABLE `recruitment_job` DISABLE KEYS */;
INSERT INTO `recruitment_job` VALUES (1,2,2,NULL,NULL,'身体健康，吃苦耐劳',1,'2023-12-31 08:00:00','2025-12-21 07:24:48.100979','2025-12-21 07:26:42.000000',5,1,'负责大棚内草莓采摘、装筐','08:00-17:00','2023-10-01','2023-12-31',NULL,25.00,18,60,'无经验要求','适中','包午餐，有高温补贴',0,1,0,0.00,'[\"https://url.com/1.jpg\"]','https://url.com/video.mp4',1,0,7,0,1,'草莓采摘工'),(2,4,1,NULL,NULL,'身体健康，能适应户外劳动。',1,'2026-05-01 19:53:55','2026-04-01 19:53:54.964046','2026-04-01 19:53:54.964046',40,1,'果园采摘、分拣与装筐，按现场排班执行。','08:00-17:00',NULL,NULL,120.00,NULL,NULL,NULL,NULL,NULL,'包住宿',1,0,0,NULL,'[]','',1,0,7,0,0,'苹果采摘'),(3,4,1,NULL,NULL,'手脚麻利，服从班组安排。',1,'2026-05-01 19:53:55','2026-04-01 19:53:54.967090','2026-04-01 19:53:54.967090',30,1,'按标准采茶，负责初筛和称重登记。','07:30-16:30',NULL,NULL,150.00,NULL,NULL,NULL,NULL,NULL,'包餐',0,1,0,NULL,'[]','',1,0,7,0,0,'茶叶采摘');
/*!40000 ALTER TABLE `recruitment_job` ENABLE KEYS */;
UNLOCK TABLES;

--
-- Table structure for table `salary_payment`
--

DROP TABLE IF EXISTS `salary_payment`;
/*!40101 SET @saved_cs_client     = @@character_set_client */;
/*!50503 SET character_set_client = utf8mb4 */;
CREATE TABLE `salary_payment` (
  `id` bigint NOT NULL AUTO_INCREMENT,
  `salary_id` bigint NOT NULL COMMENT '工资记录ID',
  `paymentMethod` enum('cash','transfer') NOT NULL COMMENT '发放方式',
  `status` tinyint NOT NULL DEFAULT '0' COMMENT '0:待确认, 1:已确认, 2:已发放, 3:已取消',
  `confirm_signature_url` text COMMENT '确认签字照片URL',
  `payment_voucher_url` text COMMENT '发放凭证照片URL',
  `paid_at` datetime DEFAULT NULL COMMENT '发放时间',
  `paid_by` bigint DEFAULT NULL COMMENT '发放人ID',
  `note` text COMMENT '备注',
  `created_at` datetime(6) NOT NULL DEFAULT CURRENT_TIMESTAMP(6),
  `updated_at` datetime(6) NOT NULL DEFAULT CURRENT_TIMESTAMP(6) ON UPDATE CURRENT_TIMESTAMP(6),
  PRIMARY KEY (`id`),
  UNIQUE KEY `UQ_salary_payment_salary_id` (`salary_id`),
  KEY `FK_salary_payment_paid_by` (`paid_by`),
  CONSTRAINT `FK_salary_payment_paid_by` FOREIGN KEY (`paid_by`) REFERENCES `sys_user` (`id`) ON DELETE SET NULL,
  CONSTRAINT `FK_salary_payment_salary` FOREIGN KEY (`salary_id`) REFERENCES `labor_salary` (`id`) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_0900_ai_ci;
/*!40101 SET character_set_client = @saved_cs_client */;

--
-- Dumping data for table `salary_payment`
--

LOCK TABLES `salary_payment` WRITE;
/*!40000 ALTER TABLE `salary_payment` DISABLE KEYS */;
/*!40000 ALTER TABLE `salary_payment` ENABLE KEYS */;
UNLOCK TABLES;

--
-- Table structure for table `sys_user`
--

DROP TABLE IF EXISTS `sys_user`;
/*!40101 SET @saved_cs_client     = @@character_set_client */;
/*!50503 SET character_set_client = utf8mb4 */;
CREATE TABLE `sys_user` (
  `id` bigint NOT NULL AUTO_INCREMENT,
  `uid` varchar(32) NOT NULL COMMENT 'Public Unique ID',
  `name` varchar(50) NOT NULL COMMENT 'Real Name',
  `id_card_enc` varchar(256) NOT NULL COMMENT 'Encrypted ID Card Number',
  `phone_enc` varchar(256) NOT NULL COMMENT 'Encrypted Phone Number',
  `id_card_hash` varchar(64) NOT NULL COMMENT 'SHA256 Hash of ID Card for Search',
  `role_key` enum('super_admin','region_admin','boss','base_manager','field_manager','worker') NOT NULL DEFAULT 'worker',
  `face_img_url` varchar(255) DEFAULT NULL COMMENT 'COS URL for Face/ID Photo',
  `region_code` int DEFAULT NULL COMMENT 'For Region Admins',
  `is_deleted` tinyint NOT NULL DEFAULT '0',
  `created_at` datetime(6) NOT NULL DEFAULT CURRENT_TIMESTAMP(6),
  `updated_at` datetime(6) NOT NULL DEFAULT CURRENT_TIMESTAMP(6) ON UPDATE CURRENT_TIMESTAMP(6),
  `phone_hash` varchar(64) DEFAULT NULL COMMENT 'SHA256 Hash of Phone for Search',
  `assigned_base_id` bigint DEFAULT NULL COMMENT 'For Field Managers - assigned base',
  `emergency_contact_enc` varchar(256) DEFAULT NULL COMMENT 'Encrypted Emergency Contact (Name and Relationship)',
  `emergency_phone_enc` varchar(256) DEFAULT NULL COMMENT 'Encrypted Emergency Contact Phone',
  `emergency_phone_hash` varchar(64) DEFAULT NULL COMMENT 'Hash of Emergency Phone for Search',
  `info_audit_status` tinyint NOT NULL DEFAULT '1' COMMENT '0:Pending, 1:Approved, 2:Rejected',
  `home_address_enc` varchar(512) DEFAULT NULL COMMENT 'Encrypted Home Address',
  `bank_name` varchar(100) DEFAULT NULL COMMENT 'Bank Name',
  `bank_card_no_enc` varchar(256) DEFAULT NULL COMMENT 'Encrypted Bank Card Number',
  `bank_card_no_hash` varchar(64) DEFAULT NULL COMMENT 'Hash of Bank Card Number for Search',
  PRIMARY KEY (`id`),
  UNIQUE KEY `IDX_5ad5e9aa3873d6537196e01353` (`uid`),
  UNIQUE KEY `UQ_sys_user_id_card_hash` (`id_card_hash`),
  UNIQUE KEY `UQ_sys_user_phone_hash` (`phone_hash`),
  KEY `IDX_sys_user_emergency_phone_hash` (`emergency_phone_hash`),
  KEY `FK_sys_user_assigned_base` (`assigned_base_id`),
  KEY `IDX_sys_user_bank_card_no_hash` (`bank_card_no_hash`),
  CONSTRAINT `FK_sys_user_assigned_base` FOREIGN KEY (`assigned_base_id`) REFERENCES `base_info` (`id`) ON DELETE SET NULL
) ENGINE=InnoDB AUTO_INCREMENT=12 DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_0900_ai_ci;
/*!40101 SET character_set_client = @saved_cs_client */;

--
-- Dumping data for table `sys_user`
--

LOCK TABLES `sys_user` WRITE;
/*!40000 ALTER TABLE `sys_user` DISABLE KEYS */;
INSERT INTO `sys_user` VALUES (1,'UMIAAA6NXBDEB','张三','3eb00eaf8e2985712d08c250a5f2af932704e24506f04302199081ee1a72322d','26e8503db7f7c716c28e5cf15b50f493','dfc4752430889d20667cb280241a0ba592a453f2977ae42d6975ea328d788558','worker','https://bucket.cos.region.myqcloud.com/face.jpg',3301,0,'2025-11-22 12:47:05.737665','2026-04-01 19:18:53.170063','264ebecfe76bdffc45d47162cbec4f2d6144a0baea11e842bb0ee205ef9311ad',NULL,NULL,NULL,NULL,1,NULL,NULL,NULL,NULL),(2,'UMIAAM91W8C7E','王老板','38909b2cdff9fdf3dc2dcdb82d7d9d76145485318f36b918b5c6c3ad2022fdad','44e89b8519d42ae387c0162b9c1e8475','7ebae9bddd0c6a90159dc7ec82d14a734f9cb1f1903b911e6691a10e79361e2a','base_manager','https://fake-url.com/boss.jpg',3301,0,'2025-11-22 12:56:27.624165','2026-04-01 19:18:53.170063','28a6a48be4bba9381469d72c40d02b4a87a05df3c02bed57be68c3a18ba8a8ee',NULL,NULL,NULL,NULL,1,NULL,NULL,NULL,NULL),(3,'UMIAAMI6WEA79','李师傅','9a653ea38b5c9394cc61efa8d721b35cf6ab154c529b6e6a31d59efe58de88e2','5ecc36778e547274bf8c71236b669738','f89c6b1d0d40a2a7f163e4995420ac80c364f568df5d2c3f540c9e1cdf15db6e','worker','https://fake-url.com/worker.jpg',3301,0,'2025-11-22 12:56:40.788168','2026-04-01 19:18:53.170063','83eba44ab1f93382fd14db14f494d748254adc6f7466cf4c114584a40aa53f78',NULL,NULL,NULL,NULL,1,NULL,NULL,NULL,NULL),(4,'UMIAB1PMOF14A','王老板','96b7c18949551c6b70ea838a7ea563d6432ed6f15dd097cf01fd6792fbc57583','b2aac5802bb8d9ebaf977d2f2666fae8','32bc88949a13117643d6d9e5716a17d7bed9b031acecd1c7331ac109ce470d7b','base_manager',NULL,3301,0,'2025-11-22 13:08:30.298021','2025-11-22 13:08:30.298021','ad168290d33f030f7455233cfa2c0ca00cce41d474717543e87136989d478407',NULL,NULL,NULL,NULL,1,NULL,NULL,NULL,NULL),(5,'UMIABIID30143','测试用户2','3eb00eaf8e2985712d08c250a5f2af93a87ac243eee6d4012ad079d9c53682c9','d6b4d1a4c8fe76bbd93bff4456335227','c9eac6a88082cea617745aefee71982f24dc6d0419f13b4f035864ae96acad5f','worker',NULL,NULL,0,'2025-11-22 13:21:33.311251','2025-11-22 13:21:33.311251','61dcc2c3877f154e8dbec858dcceb73c89d144c66ca6aac942476ff52bfc9249',NULL,NULL,NULL,NULL,1,NULL,NULL,NULL,NULL),(6,'UMIACN9G9028D','张四','1fbe8e873cff819ab0ed25d8b79a1969c73634b1ef41506450f2c24d19b2214f','70d9771711d36e584e734c99a271ab11','9eef90bb874fd41f17e3a373e2c43e3c08bfe2fbc6179e88b15fdcff233746dd','worker','https://bucket.cos.region.myqcloud.com/face.jpg',3301,0,'2025-11-22 13:53:15.098227','2025-11-22 13:53:15.098227','469ca5ff637552371663e4b66a5b72b3e7a7d2a29be1f3425e687ac6988c6bcb',NULL,NULL,NULL,NULL,1,NULL,NULL,NULL,NULL),(7,'UMIITM0RL553A','测试工人B','3eb00eaf8e2985712d08c250a5f2af9376af0002e9e66dfe393bcde28c8b9edc','c38265443b9e7b5f7cd8fcd8eb1ef041','3720b7d31203af3dff3ff60b04781cfdaa8ef766c75fb51d295929dc7eceb313','worker','https://i.imgur.com/2X8gZgG.jpg',3301,0,'2025-11-28 12:10:19.429636','2025-11-28 12:10:19.429636','bb63166deebe61d290485bfe19dd2cd97a4bbbe0ed3fa62044dd595f59c0ce53',NULL,NULL,NULL,NULL,1,NULL,NULL,NULL,NULL),(8,'UMJF2V8ES259D','李四','79d545f862a56fe8f464698f6cb8a5e7189a9c940423460e53540572e171b529','dfe81f2c646fb63b3d6550eee24a3a5a','d91ea9c75c691fb5a89df5cc12bbe17be2e54d50cf8e83b6f23d8c4d3cd62035','worker','',330100,0,'2025-12-21 01:58:03.706964','2025-12-21 08:18:48.075086','f1d8142cbb59c0a2f93f91fbe934f83f9afbdab0b8fafaabad0f842b32aab322',NULL,NULL,NULL,NULL,1,NULL,NULL,NULL,NULL),(9,'UMJF31C24ECDA','王经理','04d8e0fc9606eb668b94a3759f61a1cc56e97f83e8a67144efda0b0692b57c9f','77dc542f22bbce1649817288ab17681b','7e8ab2649967b3026c3a7d5f89afe4e8c7407b243d559106648c310ad55ffd69','base_manager','',3301,0,'2025-12-21 02:02:48.223271','2025-12-21 02:02:48.223271','71569b1aebf5c5b9976d2fcd84de7cc58725827a0b26d06570e912a701e9efbd',NULL,NULL,NULL,NULL,1,NULL,NULL,NULL,NULL),(10,'UMJF49NU69B2B','系统总管理员李','c2fb572ef5d0451485403f2fb29923c936b4d2fe95cd1dd891554ccbcf11881a','2c7656979c47c19f29ceb4db1db7ee16','5b9498ce1fc75479e91953dbea78e53343deb3b53ce640a11c6d80d334704b16','super_admin','',3301,0,'2025-12-21 02:37:16.456709','2025-12-21 02:37:16.456709','b2aca2b3d0d20906d0945bae1b317b7860a181db5037b095ee14bc403523ec32',NULL,NULL,NULL,NULL,1,NULL,NULL,NULL,NULL),(11,'UMJFPBEFY3323','王二','0782085c8f32beefc97414b7664bcc20b2238ea2fe66eecdb59f364ad89e0773','0068b2db10abb114ebb62dd64f9ab11f','a3ad505588b5e39534692058316eb0be5c295ca1f1bf7d32ff38438ccf365a3f','worker','https://bucket.cos.region.myqcloud.com/face.jpg',3301,0,'2025-12-21 12:26:29.506575','2025-12-21 12:26:29.506575','89b24e2d8f2737f68c5da3e216a31e227ec6617e74aba67a1f9e193ca844d6f4',NULL,NULL,NULL,NULL,1,NULL,NULL,NULL,NULL);
/*!40000 ALTER TABLE `sys_user` ENABLE KEYS */;
UNLOCK TABLES;
/*!50003 SET @saved_cs_client      = @@character_set_client */ ;
/*!50003 SET @saved_cs_results     = @@character_set_results */ ;
/*!50003 SET @saved_col_connection = @@collation_connection */ ;
/*!50003 SET character_set_client  = utf8mb4 */ ;
/*!50003 SET character_set_results = utf8mb4 */ ;
/*!50003 SET collation_connection  = utf8mb4_unicode_ci */ ;
/*!50003 SET @saved_sql_mode       = @@sql_mode */ ;
/*!50003 SET sql_mode              = 'IGNORE_SPACE,ONLY_FULL_GROUP_BY,STRICT_TRANS_TABLES,NO_ZERO_IN_DATE,NO_ZERO_DATE,ERROR_FOR_DIVISION_BY_ZERO,NO_ENGINE_SUBSTITUTION' */ ;
DELIMITER ;;
/*!50003 CREATE*/ /*!50017 DEFINER=`root`@`127.0.0.1`*/ /*!50003 TRIGGER `TRG_sys_user_validate_role_before_insert` BEFORE INSERT ON `sys_user` FOR EACH ROW BEGIN
         IF NEW.role_key = 'field_manager' AND NEW.assigned_base_id IS NULL THEN
           SIGNAL SQLSTATE '45000' SET MESSAGE_TEXT = 'field_manager must have assigned_base_id';
         END IF;
         IF NEW.role_key <> 'field_manager' AND NEW.assigned_base_id IS NOT NULL THEN
           SIGNAL SQLSTATE '45000' SET MESSAGE_TEXT = 'only field_manager can set assigned_base_id';
         END IF;
       END */;;
DELIMITER ;
/*!50003 SET sql_mode              = @saved_sql_mode */ ;
/*!50003 SET character_set_client  = @saved_cs_client */ ;
/*!50003 SET character_set_results = @saved_cs_results */ ;
/*!50003 SET collation_connection  = @saved_col_connection */ ;
/*!50003 SET @saved_cs_client      = @@character_set_client */ ;
/*!50003 SET @saved_cs_results     = @@character_set_results */ ;
/*!50003 SET @saved_col_connection = @@collation_connection */ ;
/*!50003 SET character_set_client  = utf8mb4 */ ;
/*!50003 SET character_set_results = utf8mb4 */ ;
/*!50003 SET collation_connection  = utf8mb4_unicode_ci */ ;
/*!50003 SET @saved_sql_mode       = @@sql_mode */ ;
/*!50003 SET sql_mode              = 'IGNORE_SPACE,ONLY_FULL_GROUP_BY,STRICT_TRANS_TABLES,NO_ZERO_IN_DATE,NO_ZERO_DATE,ERROR_FOR_DIVISION_BY_ZERO,NO_ENGINE_SUBSTITUTION' */ ;
DELIMITER ;;
/*!50003 CREATE*/ /*!50017 DEFINER=`root`@`127.0.0.1`*/ /*!50003 TRIGGER `TRG_sys_user_validate_role_before_update` BEFORE UPDATE ON `sys_user` FOR EACH ROW BEGIN
         IF NEW.role_key = 'field_manager' AND NEW.assigned_base_id IS NULL THEN
           SIGNAL SQLSTATE '45000' SET MESSAGE_TEXT = 'field_manager must have assigned_base_id';
         END IF;
         IF NEW.role_key <> 'field_manager' AND NEW.assigned_base_id IS NOT NULL THEN
           SIGNAL SQLSTATE '45000' SET MESSAGE_TEXT = 'only field_manager can set assigned_base_id';
         END IF;
       END */;;
DELIMITER ;
/*!50003 SET sql_mode              = @saved_sql_mode */ ;
/*!50003 SET character_set_client  = @saved_cs_client */ ;
/*!50003 SET character_set_results = @saved_cs_results */ ;
/*!50003 SET collation_connection  = @saved_col_connection */ ;
/*!50003 SET @saved_cs_client      = @@character_set_client */ ;
/*!50003 SET @saved_cs_results     = @@character_set_results */ ;
/*!50003 SET @saved_col_connection = @@collation_connection */ ;
/*!50003 SET character_set_client  = utf8mb4 */ ;
/*!50003 SET character_set_results = utf8mb4 */ ;
/*!50003 SET collation_connection  = utf8mb4_unicode_ci */ ;
/*!50003 SET @saved_sql_mode       = @@sql_mode */ ;
/*!50003 SET sql_mode              = 'IGNORE_SPACE,ONLY_FULL_GROUP_BY,STRICT_TRANS_TABLES,NO_ZERO_IN_DATE,NO_ZERO_DATE,ERROR_FOR_DIVISION_BY_ZERO,NO_ENGINE_SUBSTITUTION' */ ;
DELIMITER ;;
/*!50003 CREATE*/ /*!50017 DEFINER=`root`@`127.0.0.1`*/ /*!50003 TRIGGER `TRG_sys_user_guard_owner_role_before_update` BEFORE UPDATE ON `sys_user` FOR EACH ROW BEGIN
         IF NEW.role_key NOT IN ('base_manager', 'boss')
            AND EXISTS (SELECT 1 FROM base_info WHERE owner_id = NEW.id LIMIT 1) THEN
           SIGNAL SQLSTATE '45000' SET MESSAGE_TEXT = 'base owner must remain base_manager or boss';
         END IF;
       END */;;
DELIMITER ;
/*!50003 SET sql_mode              = @saved_sql_mode */ ;
/*!50003 SET character_set_client  = @saved_cs_client */ ;
/*!50003 SET character_set_results = @saved_cs_results */ ;
/*!50003 SET collation_connection  = @saved_col_connection */ ;

--
-- Dumping events for database 'pickpass_db'
--

--
-- Dumping routines for database 'pickpass_db'
--
/*!40103 SET TIME_ZONE=@OLD_TIME_ZONE */;

/*!40101 SET SQL_MODE=@OLD_SQL_MODE */;
/*!40014 SET FOREIGN_KEY_CHECKS=@OLD_FOREIGN_KEY_CHECKS */;
/*!40014 SET UNIQUE_CHECKS=@OLD_UNIQUE_CHECKS */;
/*!40101 SET CHARACTER_SET_CLIENT=@OLD_CHARACTER_SET_CLIENT */;
/*!40101 SET CHARACTER_SET_RESULTS=@OLD_CHARACTER_SET_RESULTS */;
/*!40101 SET COLLATION_CONNECTION=@OLD_COLLATION_CONNECTION */;
/*!40111 SET SQL_NOTES=@OLD_SQL_NOTES */;

-- Dump completed on 2026-04-01 19:57:39
