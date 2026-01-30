-- MySQL dump 10.13  Distrib 8.0.43, for Win64 (x86_64)
--
-- Host: localhost    Database: pickpass_db
-- ------------------------------------------------------
-- Server version	8.0.44

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
  KEY `IDX_8422d7bd73e8f45eedd8e73c25` (`category`),
  KEY `IDX_1039900b9090090abffeb6b90a` (`region_code`)
) ENGINE=InnoDB AUTO_INCREMENT=4 DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_0900_ai_ci;
/*!40101 SET character_set_client = @saved_cs_client */;

--
-- Dumping data for table `base_info`
--

LOCK TABLES `base_info` WRITE;
/*!40000 ALTER TABLE `base_info` DISABLE KEYS */;
INSERT INTO `base_info` VALUES (2,'杭州西湖农场','55391aac1c343350210f48bf99c1258d7b25ba707aa26ebb2461f700798882c1f6b4ba851cd66c7c1e55ca81d54cda02f9de1905728aa2f00d6a9d3054db8e37','77dc542f22bbce1649817288ab17681b',1,330100,'浙江省杭州市西湖区龙井路1号','{\"video\": \"https://example.com/video.mp4\", \"vr\": \"https://example.com/vr\"}',1,9,0,'2025-12-21 02:28:11.375386','2025-12-21 04:04:03.000000'),(3,'青山湖香蕉采摘园','51010ca0db7378ae86681dd6f6af1c43c9340cba440549f2d16ca03e11707d16','26e8503db7f7c716c28e5cf15b50f493',1,330100,'杭州市临安区xxx路','{\"video\": \"...\", \"vr\": \"...\"}',0,9,0,'2025-12-21 12:30:30.823842','2025-12-21 12:30:30.823842');
/*!40000 ALTER TABLE `base_info` ENABLE KEYS */;
UNLOCK TABLES;

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
  UNIQUE KEY `IDX_96b07a56d0da164eab16b1b9b6` (`user_id`,`work_date`),
  KEY `FK_22fd44a023e2fd23c37a78ef3f9` (`base_id`),
  KEY `FK_6ce935b94287a29b9d100873292` (`job_id`),
  CONSTRAINT `FK_22fd44a023e2fd23c37a78ef3f9` FOREIGN KEY (`base_id`) REFERENCES `base_info` (`id`),
  CONSTRAINT `FK_6ce935b94287a29b9d100873292` FOREIGN KEY (`job_id`) REFERENCES `recruitment_job` (`id`),
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
  UNIQUE KEY `REL_ba4a47c6f7ee6d3fab12536638` (`signup_id`),
  CONSTRAINT `FK_ba4a47c6f7ee6d3fab125366386` FOREIGN KEY (`signup_id`) REFERENCES `daily_signup` (`id`)
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
  KEY `FK_622b304d76ffe1265f92d9e06ec` (`base_id`),
  KEY `IDX_f75321f338dcd5e4966aa7d33a` (`status`),
  CONSTRAINT `FK_622b304d76ffe1265f92d9e06ec` FOREIGN KEY (`base_id`) REFERENCES `base_info` (`id`)
) ENGINE=InnoDB AUTO_INCREMENT=2 DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_0900_ai_ci;
/*!40101 SET character_set_client = @saved_cs_client */;

--
-- Dumping data for table `recruitment_job`
--

LOCK TABLES `recruitment_job` WRITE;
/*!40000 ALTER TABLE `recruitment_job` DISABLE KEYS */;
INSERT INTO `recruitment_job` VALUES (1,2,2,NULL,NULL,'身体健康，吃苦耐劳',1,'2023-12-31 08:00:00','2025-12-21 07:24:48.100979','2025-12-21 07:26:42.000000',5,1,'负责大棚内草莓采摘、装筐','08:00-17:00','2023-10-01','2023-12-31',NULL,25.00,18,60,'无经验要求','适中','包午餐，有高温补贴',0,1,0,0.00,'[\"https://url.com/1.jpg\"]','https://url.com/video.mp4',1,0,7,0,1,'草莓采摘工');
/*!40000 ALTER TABLE `recruitment_job` ENABLE KEYS */;
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
  `role_key` enum('super_admin','region_admin','base_manager','field_manager','worker') NOT NULL DEFAULT 'worker',
  `face_img_url` varchar(255) DEFAULT NULL COMMENT 'COS URL for Face/ID Photo',
  `region_code` int DEFAULT NULL COMMENT 'For Region Admins',
  `is_deleted` tinyint NOT NULL DEFAULT '0',
  `created_at` datetime(6) NOT NULL DEFAULT CURRENT_TIMESTAMP(6),
  `updated_at` datetime(6) NOT NULL DEFAULT CURRENT_TIMESTAMP(6) ON UPDATE CURRENT_TIMESTAMP(6),
  `phone_hash` varchar(64) NOT NULL COMMENT 'SHA256 Hash of Phone for Search',
  PRIMARY KEY (`id`),
  UNIQUE KEY `IDX_5ad5e9aa3873d6537196e01353` (`uid`),
  KEY `IDX_b3f96c7b107162727a0fb7d5fb` (`id_card_hash`),
  KEY `IDX_14640e62c4be0dc6b727664e20` (`phone_hash`)
) ENGINE=InnoDB AUTO_INCREMENT=12 DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_0900_ai_ci;
/*!40101 SET character_set_client = @saved_cs_client */;

--
-- Dumping data for table `sys_user`
--

LOCK TABLES `sys_user` WRITE;
/*!40000 ALTER TABLE `sys_user` DISABLE KEYS */;
INSERT INTO `sys_user` VALUES (1,'UMIAAA6NXBDEB','张三','3eb00eaf8e2985712d08c250a5f2af932704e24506f04302199081ee1a72322d','26e8503db7f7c716c28e5cf15b50f493','dfc4752430889d20667cb280241a0ba592a453f2977ae42d6975ea328d788558','worker','https://bucket.cos.region.myqcloud.com/face.jpg',3301,0,'2025-11-22 12:47:05.737665','2025-11-22 12:47:05.737665',''),(2,'UMIAAM91W8C7E','王老板','38909b2cdff9fdf3dc2dcdb82d7d9d76145485318f36b918b5c6c3ad2022fdad','44e89b8519d42ae387c0162b9c1e8475','7ebae9bddd0c6a90159dc7ec82d14a734f9cb1f1903b911e6691a10e79361e2a','base_manager','https://fake-url.com/boss.jpg',3301,0,'2025-11-22 12:56:27.624165','2025-11-22 12:56:27.624165',''),(3,'UMIAAMI6WEA79','李师傅','9a653ea38b5c9394cc61efa8d721b35cf6ab154c529b6e6a31d59efe58de88e2','5ecc36778e547274bf8c71236b669738','f89c6b1d0d40a2a7f163e4995420ac80c364f568df5d2c3f540c9e1cdf15db6e','worker','https://fake-url.com/worker.jpg',3301,0,'2025-11-22 12:56:40.788168','2025-11-22 12:56:40.788168',''),(4,'UMIAB1PMOF14A','王老板','96b7c18949551c6b70ea838a7ea563d6432ed6f15dd097cf01fd6792fbc57583','b2aac5802bb8d9ebaf977d2f2666fae8','32bc88949a13117643d6d9e5716a17d7bed9b031acecd1c7331ac109ce470d7b','base_manager',NULL,3301,0,'2025-11-22 13:08:30.298021','2025-11-22 13:08:30.298021','ad168290d33f030f7455233cfa2c0ca00cce41d474717543e87136989d478407'),(5,'UMIABIID30143','测试用户2','3eb00eaf8e2985712d08c250a5f2af93a87ac243eee6d4012ad079d9c53682c9','d6b4d1a4c8fe76bbd93bff4456335227','c9eac6a88082cea617745aefee71982f24dc6d0419f13b4f035864ae96acad5f','worker',NULL,NULL,0,'2025-11-22 13:21:33.311251','2025-11-22 13:21:33.311251','61dcc2c3877f154e8dbec858dcceb73c89d144c66ca6aac942476ff52bfc9249'),(6,'UMIACN9G9028D','张四','1fbe8e873cff819ab0ed25d8b79a1969c73634b1ef41506450f2c24d19b2214f','70d9771711d36e584e734c99a271ab11','9eef90bb874fd41f17e3a373e2c43e3c08bfe2fbc6179e88b15fdcff233746dd','worker','https://bucket.cos.region.myqcloud.com/face.jpg',3301,0,'2025-11-22 13:53:15.098227','2025-11-22 13:53:15.098227','469ca5ff637552371663e4b66a5b72b3e7a7d2a29be1f3425e687ac6988c6bcb'),(7,'UMIITM0RL553A','测试工人B','3eb00eaf8e2985712d08c250a5f2af9376af0002e9e66dfe393bcde28c8b9edc','c38265443b9e7b5f7cd8fcd8eb1ef041','3720b7d31203af3dff3ff60b04781cfdaa8ef766c75fb51d295929dc7eceb313','worker','https://i.imgur.com/2X8gZgG.jpg',3301,0,'2025-11-28 12:10:19.429636','2025-11-28 12:10:19.429636','bb63166deebe61d290485bfe19dd2cd97a4bbbe0ed3fa62044dd595f59c0ce53'),(8,'UMJF2V8ES259D','李四','79d545f862a56fe8f464698f6cb8a5e7189a9c940423460e53540572e171b529','dfe81f2c646fb63b3d6550eee24a3a5a','d91ea9c75c691fb5a89df5cc12bbe17be2e54d50cf8e83b6f23d8c4d3cd62035','worker','',330100,0,'2025-12-21 01:58:03.706964','2025-12-21 08:18:48.075086','f1d8142cbb59c0a2f93f91fbe934f83f9afbdab0b8fafaabad0f842b32aab322'),(9,'UMJF31C24ECDA','王经理','04d8e0fc9606eb668b94a3759f61a1cc56e97f83e8a67144efda0b0692b57c9f','77dc542f22bbce1649817288ab17681b','7e8ab2649967b3026c3a7d5f89afe4e8c7407b243d559106648c310ad55ffd69','base_manager','',3301,0,'2025-12-21 02:02:48.223271','2025-12-21 02:02:48.223271','71569b1aebf5c5b9976d2fcd84de7cc58725827a0b26d06570e912a701e9efbd'),(10,'UMJF49NU69B2B','系统总管理员李','c2fb572ef5d0451485403f2fb29923c936b4d2fe95cd1dd891554ccbcf11881a','2c7656979c47c19f29ceb4db1db7ee16','5b9498ce1fc75479e91953dbea78e53343deb3b53ce640a11c6d80d334704b16','super_admin','',3301,0,'2025-12-21 02:37:16.456709','2025-12-21 02:37:16.456709','b2aca2b3d0d20906d0945bae1b317b7860a181db5037b095ee14bc403523ec32'),(11,'UMJFPBEFY3323','王二','0782085c8f32beefc97414b7664bcc20b2238ea2fe66eecdb59f364ad89e0773','0068b2db10abb114ebb62dd64f9ab11f','a3ad505588b5e39534692058316eb0be5c295ca1f1bf7d32ff38438ccf365a3f','worker','https://bucket.cos.region.myqcloud.com/face.jpg',3301,0,'2025-12-21 12:26:29.506575','2025-12-21 12:26:29.506575','89b24e2d8f2737f68c5da3e216a31e227ec6617e74aba67a1f9e193ca844d6f4');
/*!40000 ALTER TABLE `sys_user` ENABLE KEYS */;
UNLOCK TABLES;

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

-- Dump completed on 2025-12-21 23:38:40
