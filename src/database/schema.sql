mysqldump: [Warning] Using a password on the command line interface can be insecure.
-- MySQL dump 10.13  Distrib 8.0.43, for Linux (x86_64)
--
-- Host: localhost    Database: realestate_db
-- ------------------------------------------------------
-- Server version	8.0.43

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
-- Table structure for table `agencies`
--

DROP TABLE IF EXISTS `agencies`;
/*!40101 SET @saved_cs_client     = @@character_set_client */;
/*!50503 SET character_set_client = utf8mb4 */;
CREATE TABLE `agencies` (
  `id` varchar(36) NOT NULL,
  `name` varchar(200) NOT NULL,
  `description` text,
  `logo` varchar(500) DEFAULT NULL,
  `countryId` varchar(36) DEFAULT NULL,
  `stateId` varchar(36) DEFAULT NULL,
  `cityId` varchar(36) DEFAULT NULL,
  `address` varchar(300) DEFAULT NULL,
  `contactEmail` varchar(150) DEFAULT NULL,
  `contactPhone` varchar(20) DEFAULT NULL,
  `website` varchar(200) DEFAULT NULL,
  `licenseNumber` varchar(100) DEFAULT NULL,
  `isActive` tinyint NOT NULL DEFAULT '1',
  `isVerified` tinyint NOT NULL DEFAULT '0',
  `totalAgents` int NOT NULL DEFAULT '0',
  `totalListings` int NOT NULL DEFAULT '0',
  `createdAt` datetime(6) NOT NULL DEFAULT CURRENT_TIMESTAMP(6),
  `updatedAt` datetime(6) NOT NULL DEFAULT CURRENT_TIMESTAMP(6) ON UPDATE CURRENT_TIMESTAMP(6),
  `status` enum('pending','approved','rejected') NOT NULL DEFAULT 'approved',
  `createdByUserId` varchar(36) DEFAULT NULL,
  `rejectionReason` varchar(500) DEFAULT NULL,
  PRIMARY KEY (`id`),
  KEY `IDX_1ea16c73ecef4bab2f61c31c88` (`name`),
  KEY `IDX_32955173410a7f8ced27363b4e` (`status`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_0900_ai_ci;
/*!40101 SET character_set_client = @saved_cs_client */;

--
-- Table structure for table `agent_feedback`
--

DROP TABLE IF EXISTS `agent_feedback`;
/*!40101 SET @saved_cs_client     = @@character_set_client */;
/*!50503 SET character_set_client = utf8mb4 */;
CREATE TABLE `agent_feedback` (
  `id` varchar(36) NOT NULL,
  `agentId` varchar(36) NOT NULL,
  `reviewerId` varchar(36) NOT NULL,
  `reviewerName` varchar(100) NOT NULL,
  `rating` tinyint unsigned NOT NULL,
  `comment` text,
  `createdAt` datetime(6) NOT NULL DEFAULT CURRENT_TIMESTAMP(6),
  PRIMARY KEY (`id`),
  UNIQUE KEY `uq_reviewer_agent` (`reviewerId`,`agentId`),
  KEY `IDX_01c3bda91eae0bad5b91f9d592` (`agentId`),
  KEY `IDX_e99e5fc1a968799b837f666675` (`agentId`,`createdAt`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_0900_ai_ci;
/*!40101 SET character_set_client = @saved_cs_client */;

--
-- Table structure for table `agent_location_map`
--

DROP TABLE IF EXISTS `agent_location_map`;
/*!40101 SET @saved_cs_client     = @@character_set_client */;
/*!50503 SET character_set_client = utf8mb4 */;
CREATE TABLE `agent_location_map` (
  `id` varchar(36) NOT NULL,
  `agentId` varchar(36) NOT NULL,
  `countryId` varchar(36) DEFAULT NULL,
  `stateId` varchar(36) DEFAULT NULL,
  `cityId` varchar(36) DEFAULT NULL,
  `createdAt` datetime(6) NOT NULL DEFAULT CURRENT_TIMESTAMP(6),
  `agent_id` varchar(36) DEFAULT NULL,
  `coverageType` enum('state','city','locality') NOT NULL DEFAULT 'city',
  `localityId` varchar(36) DEFAULT NULL,
  `stateName` varchar(100) DEFAULT NULL,
  `cityName` varchar(100) DEFAULT NULL,
  `localityName` varchar(150) DEFAULT NULL,
  `stateSlug` varchar(120) DEFAULT NULL,
  `citySlug` varchar(120) DEFAULT NULL,
  `localitySlug` varchar(150) DEFAULT NULL,
  `isActive` tinyint NOT NULL DEFAULT '1',
  `approvedBy` varchar(36) DEFAULT NULL,
  `approvedAt` timestamp NULL DEFAULT NULL,
  `updatedAt` datetime(6) NOT NULL DEFAULT CURRENT_TIMESTAMP(6) ON UPDATE CURRENT_TIMESTAMP(6),
  PRIMARY KEY (`id`),
  KEY `IDX_3d26237e86e9b8f2a5f7bf7934` (`agentId`),
  KEY `IDX_8d3cfbe6aacb8b4d4e8703bdaf` (`cityId`),
  KEY `FK_2a12a21dfc1eb92b976b8747275` (`agent_id`),
  KEY `IDX_0dee720e078c32abc168657922` (`stateSlug`),
  KEY `IDX_50855797e3ccf0cbd1e169aed2` (`citySlug`),
  KEY `IDX_4b05b3e98919fdcbc79cba54dd` (`localitySlug`),
  CONSTRAINT `FK_2a12a21dfc1eb92b976b8747275` FOREIGN KEY (`agent_id`) REFERENCES `agent_profiles` (`id`) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_0900_ai_ci;
/*!40101 SET character_set_client = @saved_cs_client */;

--
-- Table structure for table `agent_profiles`
--

DROP TABLE IF EXISTS `agent_profiles`;
/*!40101 SET @saved_cs_client     = @@character_set_client */;
/*!50503 SET character_set_client = utf8mb4 */;
CREATE TABLE `agent_profiles` (
  `id` varchar(36) NOT NULL,
  `userId` varchar(36) NOT NULL,
  `agencyId` varchar(36) DEFAULT NULL,
  `experienceYears` int NOT NULL DEFAULT '0',
  `licenseNumber` varchar(100) DEFAULT NULL,
  `rating` decimal(3,1) NOT NULL DEFAULT '0.0',
  `totalDeals` int NOT NULL DEFAULT '0',
  `totalListings` int NOT NULL DEFAULT '0',
  `isActive` tinyint NOT NULL DEFAULT '1',
  `bio` text,
  `tick` enum('none','verified','bronze','silver','gold') NOT NULL DEFAULT 'none',
  `createdAt` datetime(6) NOT NULL DEFAULT CURRENT_TIMESTAMP(6),
  `updatedAt` datetime(6) NOT NULL DEFAULT CURRENT_TIMESTAMP(6) ON UPDATE CURRENT_TIMESTAMP(6),
  `agency_id` varchar(36) DEFAULT NULL,
  `metaTitle` varchar(200) DEFAULT NULL,
  `metaDescription` varchar(500) DEFAULT NULL,
  `introContent` text,
  `seoContent` text,
  `authorityScore` decimal(5,2) NOT NULL DEFAULT '0.00',
  `authorityScoreUpdatedAt` timestamp NULL DEFAULT NULL,
  `avgResponseHours` int DEFAULT NULL,
  `complaintCount` int NOT NULL DEFAULT '0',
  PRIMARY KEY (`id`),
  UNIQUE KEY `IDX_b33e9dd5843a6c76a1123463bc` (`userId`),
  KEY `IDX_8ff4a3452a69420dfe64f424b0` (`agencyId`),
  KEY `FK_c4e5767e6dd7ab13d539815a8d7` (`agency_id`),
  CONSTRAINT `FK_c4e5767e6dd7ab13d539815a8d7` FOREIGN KEY (`agency_id`) REFERENCES `agencies` (`id`) ON DELETE SET NULL
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_0900_ai_ci;
/*!40101 SET character_set_client = @saved_cs_client */;

--
-- Table structure for table `agent_subscriptions`
--

DROP TABLE IF EXISTS `agent_subscriptions`;
/*!40101 SET @saved_cs_client     = @@character_set_client */;
/*!50503 SET character_set_client = utf8mb4 */;
CREATE TABLE `agent_subscriptions` (
  `id` varchar(36) NOT NULL,
  `agentId` varchar(255) NOT NULL,
  `planId` varchar(255) NOT NULL,
  `status` enum('active','expired','cancelled') NOT NULL DEFAULT 'active',
  `startsAt` timestamp NOT NULL,
  `expiresAt` timestamp NOT NULL,
  `tokensDeducted` decimal(10,2) NOT NULL DEFAULT '0.00',
  `planSnapshot` json DEFAULT NULL,
  `createdAt` datetime(6) NOT NULL DEFAULT CURRENT_TIMESTAMP(6),
  PRIMARY KEY (`id`),
  KEY `FK_75d6af367b76d17284477a9a7b0` (`agentId`),
  KEY `FK_4fa3191e000dd17143694758cd2` (`planId`),
  CONSTRAINT `FK_4fa3191e000dd17143694758cd2` FOREIGN KEY (`planId`) REFERENCES `subscription_plans` (`id`),
  CONSTRAINT `FK_75d6af367b76d17284477a9a7b0` FOREIGN KEY (`agentId`) REFERENCES `users` (`id`) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_0900_ai_ci;
/*!40101 SET character_set_client = @saved_cs_client */;

--
-- Table structure for table `amenities`
--

DROP TABLE IF EXISTS `amenities`;
/*!40101 SET @saved_cs_client     = @@character_set_client */;
/*!50503 SET character_set_client = utf8mb4 */;
CREATE TABLE `amenities` (
  `id` varchar(36) NOT NULL,
  `name` varchar(100) NOT NULL,
  `icon` varchar(100) DEFAULT NULL,
  `category` enum('basic','society','security','recreation','commercial') NOT NULL DEFAULT 'basic',
  `status` tinyint NOT NULL DEFAULT '1',
  PRIMARY KEY (`id`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_0900_ai_ci;
/*!40101 SET character_set_client = @saved_cs_client */;

--
-- Table structure for table `analytics_events`
--

DROP TABLE IF EXISTS `analytics_events`;
/*!40101 SET @saved_cs_client     = @@character_set_client */;
/*!50503 SET character_set_client = utf8mb4 */;
CREATE TABLE `analytics_events` (
  `id` varchar(36) NOT NULL,
  `eventType` varchar(50) NOT NULL,
  `entityType` varchar(20) DEFAULT NULL,
  `entityId` varchar(36) DEFAULT NULL,
  `userId` varchar(36) DEFAULT NULL,
  `sessionId` varchar(100) DEFAULT NULL,
  `country` varchar(100) DEFAULT NULL,
  `state` varchar(100) DEFAULT NULL,
  `city` varchar(100) DEFAULT NULL,
  `deviceType` varchar(20) DEFAULT 'desktop',
  `source` varchar(30) DEFAULT 'direct',
  `metadata` json DEFAULT NULL,
  `createdAt` datetime(6) NOT NULL DEFAULT CURRENT_TIMESTAMP(6),
  PRIMARY KEY (`id`),
  KEY `IDX_912e1a6815f864d5142e165f57` (`eventType`),
  KEY `IDX_3d8497e90037d87e6cd9a1f3f8` (`entityId`),
  KEY `IDX_dcdc768d67c956416a921146bf` (`state`),
  KEY `IDX_3fc4bb49a5e93a17b7960c6fa1` (`city`),
  KEY `IDX_ddb13aa0cd6b4d0c61bc3682d2` (`createdAt`),
  KEY `IDX_47af708771d4e5ee77ae8e519b` (`country`,`state`,`city`,`createdAt`),
  KEY `IDX_346ac4ab58a5bd3d2e107f83e3` (`entityType`,`entityId`,`createdAt`),
  KEY `IDX_38c954e266791189dfd7b6ffc4` (`eventType`,`createdAt`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_0900_ai_ci;
/*!40101 SET character_set_client = @saved_cs_client */;

--
-- Table structure for table `articles`
--

DROP TABLE IF EXISTS `articles`;
/*!40101 SET @saved_cs_client     = @@character_set_client */;
/*!50503 SET character_set_client = utf8mb4 */;
CREATE TABLE `articles` (
  `id` varchar(36) NOT NULL,
  `title` varchar(300) NOT NULL,
  `slug` varchar(350) NOT NULL,
  `excerpt` text,
  `content` longtext NOT NULL,
  `featuredImage` varchar(500) DEFAULT NULL,
  `gallery` json DEFAULT NULL,
  `category` enum('news','tips','market-insights','guides','legal','investment') NOT NULL DEFAULT 'news',
  `tags` json DEFAULT NULL,
  `status` enum('draft','published') NOT NULL DEFAULT 'draft',
  `isFeatured` tinyint NOT NULL DEFAULT '0',
  `readTime` int DEFAULT NULL,
  `viewCount` int NOT NULL DEFAULT '0',
  `publishedAt` timestamp NULL DEFAULT NULL,
  `authorId` varchar(255) DEFAULT NULL,
  `metaTitle` varchar(200) DEFAULT NULL,
  `metaDescription` varchar(500) DEFAULT NULL,
  `metaKeywords` varchar(500) DEFAULT NULL,
  `ogImage` varchar(500) DEFAULT NULL,
  `canonicalUrl` varchar(500) DEFAULT NULL,
  `createdAt` datetime(6) NOT NULL DEFAULT CURRENT_TIMESTAMP(6),
  `updatedAt` datetime(6) NOT NULL DEFAULT CURRENT_TIMESTAMP(6) ON UPDATE CURRENT_TIMESTAMP(6),
  PRIMARY KEY (`id`),
  UNIQUE KEY `IDX_1123ff6815c5b8fec0ba9fec37` (`slug`),
  KEY `FK_65d9ccc1b02f4d904e90bd76a34` (`authorId`),
  CONSTRAINT `FK_65d9ccc1b02f4d904e90bd76a34` FOREIGN KEY (`authorId`) REFERENCES `users` (`id`) ON DELETE SET NULL
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_0900_ai_ci;
/*!40101 SET character_set_client = @saved_cs_client */;

--
-- Table structure for table `audit_logs`
--

DROP TABLE IF EXISTS `audit_logs`;
/*!40101 SET @saved_cs_client     = @@character_set_client */;
/*!50503 SET character_set_client = utf8mb4 */;
CREATE TABLE `audit_logs` (
  `id` varchar(36) NOT NULL,
  `actorId` varchar(36) NOT NULL,
  `actorName` varchar(120) DEFAULT NULL,
  `actorRole` varchar(60) DEFAULT NULL,
  `action` varchar(80) NOT NULL,
  `resource` varchar(60) NOT NULL,
  `resourceId` varchar(120) DEFAULT NULL,
  `summary` text,
  `before` json DEFAULT NULL,
  `after` json DEFAULT NULL,
  `ipAddress` varchar(50) DEFAULT NULL,
  `userAgent` text,
  `createdAt` datetime(6) NOT NULL DEFAULT CURRENT_TIMESTAMP(6),
  PRIMARY KEY (`id`),
  KEY `IDX_2dc33f7f3c22e2e7badafca1d1` (`actorId`),
  KEY `IDX_cee5459245f652b75eb2759b4c` (`action`),
  KEY `IDX_8769d5d852a6b56dd77186a1c6` (`resource`),
  KEY `IDX_c69efb19bf127c97e6740ad530` (`createdAt`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_0900_ai_ci;
/*!40101 SET character_set_client = @saved_cs_client */;

--
-- Table structure for table `boost_plans`
--

DROP TABLE IF EXISTS `boost_plans`;
/*!40101 SET @saved_cs_client     = @@character_set_client */;
/*!50503 SET character_set_client = utf8mb4 */;
CREATE TABLE `boost_plans` (
  `id` varchar(36) NOT NULL,
  `name` varchar(255) NOT NULL,
  `durationDays` int NOT NULL,
  `tokenCost` int NOT NULL,
  `description` varchar(255) DEFAULT NULL,
  `isActive` tinyint NOT NULL DEFAULT '1',
  `sortOrder` int NOT NULL DEFAULT '0',
  `createdAt` datetime(6) NOT NULL DEFAULT CURRENT_TIMESTAMP(6),
  `updatedAt` datetime(6) NOT NULL DEFAULT CURRENT_TIMESTAMP(6) ON UPDATE CURRENT_TIMESTAMP(6),
  PRIMARY KEY (`id`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_0900_ai_ci;
/*!40101 SET character_set_client = @saved_cs_client */;

--
-- Table structure for table `category_analytics`
--

DROP TABLE IF EXISTS `category_analytics`;
/*!40101 SET @saved_cs_client     = @@character_set_client */;
/*!50503 SET character_set_client = utf8mb4 */;
CREATE TABLE `category_analytics` (
  `id` varchar(36) NOT NULL,
  `propertyType` varchar(60) NOT NULL,
  `label` varchar(100) NOT NULL,
  `icon` varchar(10) DEFAULT NULL,
  `score` decimal(12,4) NOT NULL DEFAULT '0.0000',
  `rank` int NOT NULL DEFAULT '0',
  `totalListings` int NOT NULL DEFAULT '0',
  `totalViews` int NOT NULL DEFAULT '0',
  `totalSearches` int NOT NULL DEFAULT '0',
  `totalInquiries` int NOT NULL DEFAULT '0',
  `totalSaves` int NOT NULL DEFAULT '0',
  `trendingScore` decimal(8,4) NOT NULL DEFAULT '0.0000',
  `isTrending` tinyint NOT NULL DEFAULT '0',
  `country` varchar(100) DEFAULT NULL,
  `state` varchar(100) DEFAULT NULL,
  `city` varchar(100) DEFAULT NULL,
  `updatedAt` datetime(6) NOT NULL DEFAULT CURRENT_TIMESTAMP(6) ON UPDATE CURRENT_TIMESTAMP(6),
  PRIMARY KEY (`id`),
  KEY `IDX_69869be5fcf3b89cecd2e38530` (`propertyType`),
  KEY `IDX_70cc0e4a582debf5eb64be8279` (`isTrending`),
  KEY `IDX_e7adb5720b5b72f6c081a58e77` (`state`),
  KEY `IDX_f4f3deaf3652d791f56f52ff16` (`city`),
  KEY `IDX_5fc5635e07fec7e6f17c63376b` (`country`,`state`,`city`,`rank`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_0900_ai_ci;
/*!40101 SET character_set_client = @saved_cs_client */;

--
-- Table structure for table `category_city_seo`
--

DROP TABLE IF EXISTS `category_city_seo`;
/*!40101 SET @saved_cs_client     = @@character_set_client */;
/*!50503 SET character_set_client = utf8mb4 */;
CREATE TABLE `category_city_seo` (
  `id` varchar(36) NOT NULL,
  `category_slug` varchar(100) NOT NULL,
  `city_slug` varchar(150) NOT NULL,
  `city_name` varchar(150) NOT NULL,
  `slug` varchar(300) NOT NULL,
  `h1_title` varchar(250) DEFAULT NULL,
  `meta_title` varchar(250) DEFAULT NULL,
  `meta_description` varchar(500) DEFAULT NULL,
  `meta_keywords` varchar(300) DEFAULT NULL,
  `canonical_url` varchar(500) DEFAULT NULL,
  `intro_content` text,
  `bottom_content` text,
  `faq_json` json DEFAULT NULL,
  `internal_links` json DEFAULT NULL,
  `robots` varchar(100) DEFAULT 'index,follow',
  `is_active` tinyint NOT NULL DEFAULT '1',
  `created_at` datetime(6) NOT NULL DEFAULT CURRENT_TIMESTAMP(6),
  `updated_at` datetime(6) NOT NULL DEFAULT CURRENT_TIMESTAMP(6) ON UPDATE CURRENT_TIMESTAMP(6),
  PRIMARY KEY (`id`),
  UNIQUE KEY `IDX_513e3f015b27cbd6ca655f12a5` (`category_slug`,`city_slug`),
  UNIQUE KEY `IDX_adb033c32edea5859c5e8f0749` (`slug`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_0900_ai_ci;
/*!40101 SET character_set_client = @saved_cs_client */;

--
-- Table structure for table `category_locality_seo`
--

DROP TABLE IF EXISTS `category_locality_seo`;
/*!40101 SET @saved_cs_client     = @@character_set_client */;
/*!50503 SET character_set_client = utf8mb4 */;
CREATE TABLE `category_locality_seo` (
  `id` varchar(36) NOT NULL,
  `category_slug` varchar(100) NOT NULL,
  `city_slug` varchar(150) NOT NULL,
  `city_name` varchar(150) NOT NULL,
  `locality_slug` varchar(150) NOT NULL,
  `locality_name` varchar(150) NOT NULL,
  `slug` varchar(300) NOT NULL,
  `h1_title` varchar(250) DEFAULT NULL,
  `meta_title` varchar(250) DEFAULT NULL,
  `meta_description` varchar(500) DEFAULT NULL,
  `meta_keywords` varchar(300) DEFAULT NULL,
  `canonical_url` varchar(500) DEFAULT NULL,
  `intro_content` text,
  `bottom_content` text,
  `faq_json` json DEFAULT NULL,
  `internal_links` json DEFAULT NULL,
  `robots` varchar(100) DEFAULT 'index,follow',
  `is_active` tinyint NOT NULL DEFAULT '1',
  `created_at` datetime(6) NOT NULL DEFAULT CURRENT_TIMESTAMP(6),
  `updated_at` datetime(6) NOT NULL DEFAULT CURRENT_TIMESTAMP(6) ON UPDATE CURRENT_TIMESTAMP(6),
  PRIMARY KEY (`id`),
  UNIQUE KEY `IDX_d5167c164c76162ec5840b5d92` (`category_slug`,`city_slug`,`locality_slug`),
  UNIQUE KEY `IDX_e869edd47ff82c0826e0d28fe9` (`slug`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_0900_ai_ci;
/*!40101 SET character_set_client = @saved_cs_client */;

--
-- Table structure for table `cities`
--

DROP TABLE IF EXISTS `cities`;
/*!40101 SET @saved_cs_client     = @@character_set_client */;
/*!50503 SET character_set_client = utf8mb4 */;
CREATE TABLE `cities` (
  `id` varchar(36) NOT NULL,
  `name` varchar(255) NOT NULL,
  `state_id` varchar(255) NOT NULL,
  `isActive` tinyint NOT NULL DEFAULT '1',
  `isFeatured` tinyint NOT NULL DEFAULT '0',
  `propertyCount` int NOT NULL DEFAULT '0',
  `imageUrl` varchar(255) DEFAULT NULL,
  `createdAt` datetime(6) NOT NULL DEFAULT CURRENT_TIMESTAMP(6),
  `updatedAt` datetime(6) NOT NULL DEFAULT CURRENT_TIMESTAMP(6) ON UPDATE CURRENT_TIMESTAMP(6),
  `slug` varchar(150) DEFAULT NULL,
  `h1` varchar(200) DEFAULT NULL,
  `metaTitle` varchar(200) DEFAULT NULL,
  `metaDescription` varchar(500) DEFAULT NULL,
  `metaKeywords` varchar(300) DEFAULT NULL,
  `introContent` text,
  `seoContent` text,
  `faqs` json DEFAULT NULL,
  PRIMARY KEY (`id`),
  KEY `FK_1229b56aa12cae674b824fccd13` (`state_id`),
  CONSTRAINT `FK_1229b56aa12cae674b824fccd13` FOREIGN KEY (`state_id`) REFERENCES `states` (`id`) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_0900_ai_ci;
/*!40101 SET character_set_client = @saved_cs_client */;

--
-- Table structure for table `city_seo_pages`
--

DROP TABLE IF EXISTS `city_seo_pages`;
/*!40101 SET @saved_cs_client     = @@character_set_client */;
/*!50503 SET character_set_client = utf8mb4 */;
CREATE TABLE `city_seo_pages` (
  `id` varchar(36) NOT NULL,
  `cityName` varchar(100) NOT NULL,
  `cityId` varchar(36) DEFAULT NULL,
  `pageType` enum('buy','rent','pg','commercial','new_projects') NOT NULL,
  `slug` varchar(300) NOT NULL,
  `h1` varchar(200) DEFAULT NULL,
  `metaTitle` varchar(200) DEFAULT NULL,
  `metaDescription` varchar(500) DEFAULT NULL,
  `metaKeywords` varchar(300) DEFAULT NULL,
  `introContent` text,
  `faqs` json DEFAULT NULL,
  `seoContent` text,
  `isActive` tinyint NOT NULL DEFAULT '1',
  `createdAt` datetime(6) NOT NULL DEFAULT CURRENT_TIMESTAMP(6),
  `updatedAt` datetime(6) NOT NULL DEFAULT CURRENT_TIMESTAMP(6) ON UPDATE CURRENT_TIMESTAMP(6),
  PRIMARY KEY (`id`),
  UNIQUE KEY `IDX_fb782e99aafb6c1180ea3cef72` (`slug`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_0900_ai_ci;
/*!40101 SET character_set_client = @saved_cs_client */;

--
-- Table structure for table `commissions`
--

DROP TABLE IF EXISTS `commissions`;
/*!40101 SET @saved_cs_client     = @@character_set_client */;
/*!50503 SET character_set_client = utf8mb4 */;
CREATE TABLE `commissions` (
  `id` varchar(36) NOT NULL,
  `dealId` varchar(36) NOT NULL,
  `agentId` varchar(36) NOT NULL,
  `agencyId` varchar(36) DEFAULT NULL,
  `dealPrice` decimal(15,2) NOT NULL,
  `commissionRate` decimal(5,2) NOT NULL,
  `grossCommission` decimal(15,2) NOT NULL,
  `platformCutPct` decimal(5,2) NOT NULL DEFAULT '30.00',
  `platformAmount` decimal(15,2) NOT NULL,
  `agencyCutPct` decimal(5,2) DEFAULT NULL,
  `agencyAmount` decimal(15,2) DEFAULT NULL,
  `agentGross` decimal(15,2) NOT NULL,
  `tdsRate` decimal(5,2) NOT NULL DEFAULT '5.00',
  `tdsAmount` decimal(15,2) NOT NULL DEFAULT '0.00',
  `agentNetPayout` decimal(15,2) NOT NULL,
  `status` enum('pending','approved','invoiced','paid','disputed','clawback','cancelled') NOT NULL DEFAULT 'pending',
  `approvedBy` varchar(36) DEFAULT NULL,
  `approvedAt` timestamp NULL DEFAULT NULL,
  `invoiceNumber` varchar(50) DEFAULT NULL,
  `invoiceDate` date DEFAULT NULL,
  `paymentDate` date DEFAULT NULL,
  `paymentReference` varchar(100) DEFAULT NULL,
  `clawbackReason` text,
  `notes` text,
  `createdAt` datetime(6) NOT NULL DEFAULT CURRENT_TIMESTAMP(6),
  `updatedAt` datetime(6) NOT NULL DEFAULT CURRENT_TIMESTAMP(6) ON UPDATE CURRENT_TIMESTAMP(6),
  PRIMARY KEY (`id`),
  KEY `IDX_5bd8b4349c628bb094e3963d52` (`dealId`),
  KEY `IDX_7e4e78904cef625e0212dc9138` (`agentId`),
  KEY `IDX_a4fdb3d46dc59b3b32a5440db9` (`status`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_0900_ai_ci;
/*!40101 SET character_set_client = @saved_cs_client */;

--
-- Table structure for table `cookie_consents`
--

DROP TABLE IF EXISTS `cookie_consents`;
/*!40101 SET @saved_cs_client     = @@character_set_client */;
/*!50503 SET character_set_client = utf8mb4 */;
CREATE TABLE `cookie_consents` (
  `id` varchar(36) NOT NULL,
  `userId` varchar(36) DEFAULT NULL,
  `sessionId` varchar(100) DEFAULT NULL,
  `ipAddress` varchar(45) DEFAULT NULL,
  `userAgent` text,
  `essential` tinyint NOT NULL DEFAULT '1',
  `personalization` tinyint NOT NULL DEFAULT '0',
  `analytics` tinyint NOT NULL DEFAULT '0',
  `marketing` tinyint NOT NULL DEFAULT '0',
  `consentVersion` varchar(10) NOT NULL DEFAULT '1.0',
  `source` enum('banner','modal','settings') NOT NULL DEFAULT 'banner',
  `createdAt` datetime(6) NOT NULL DEFAULT CURRENT_TIMESTAMP(6),
  `updatedAt` datetime(6) NOT NULL DEFAULT CURRENT_TIMESTAMP(6) ON UPDATE CURRENT_TIMESTAMP(6),
  PRIMARY KEY (`id`),
  KEY `IDX_fef738e879f3e90aeb637bb9a7` (`createdAt`),
  KEY `IDX_e61ce1fd5b92b1bf0721a0c23b` (`sessionId`),
  KEY `IDX_db9a80646ad5b8e03c5a83b712` (`userId`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_0900_ai_ci;
/*!40101 SET character_set_client = @saved_cs_client */;

--
-- Table structure for table `countries`
--

DROP TABLE IF EXISTS `countries`;
/*!40101 SET @saved_cs_client     = @@character_set_client */;
/*!50503 SET character_set_client = utf8mb4 */;
CREATE TABLE `countries` (
  `id` varchar(36) NOT NULL,
  `name` varchar(100) NOT NULL,
  `code` varchar(3) NOT NULL,
  `dialCode` varchar(10) DEFAULT NULL,
  `flag` varchar(10) DEFAULT NULL,
  `imageUrl` varchar(500) DEFAULT NULL,
  `isActive` tinyint NOT NULL DEFAULT '1',
  `sortOrder` int NOT NULL DEFAULT '0',
  `createdAt` datetime(6) NOT NULL DEFAULT CURRENT_TIMESTAMP(6),
  `updatedAt` datetime(6) NOT NULL DEFAULT CURRENT_TIMESTAMP(6) ON UPDATE CURRENT_TIMESTAMP(6),
  `seoSlug` varchar(150) DEFAULT NULL,
  `metaTitle` varchar(200) DEFAULT NULL,
  `metaDescription` varchar(500) DEFAULT NULL,
  `metaKeywords` varchar(300) DEFAULT NULL,
  PRIMARY KEY (`id`),
  UNIQUE KEY `IDX_fa1376321185575cf2226b1491` (`name`),
  UNIQUE KEY `IDX_b47cbb5311bad9c9ae17b8c1ed` (`code`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_0900_ai_ci;
/*!40101 SET character_set_client = @saved_cs_client */;

--
-- Table structure for table `deals`
--

DROP TABLE IF EXISTS `deals`;
/*!40101 SET @saved_cs_client     = @@character_set_client */;
/*!50503 SET character_set_client = utf8mb4 */;
CREATE TABLE `deals` (
  `id` varchar(36) NOT NULL,
  `leadId` varchar(36) NOT NULL,
  `agentId` varchar(36) NOT NULL,
  `agencyId` varchar(36) DEFAULT NULL,
  `propertyId` varchar(36) DEFAULT NULL,
  `sellerType` enum('builder','owner','agency') NOT NULL DEFAULT 'owner',
  `sellerId` varchar(36) DEFAULT NULL,
  `agreedPrice` decimal(15,2) NOT NULL,
  `bookingAmount` decimal(15,2) DEFAULT NULL,
  `stage` enum('shortlisted','negotiation','offer_accepted','booking_paid','agreement_created','closed','cancelled') NOT NULL DEFAULT 'shortlisted',
  `offerDate` date DEFAULT NULL,
  `bookingDate` date DEFAULT NULL,
  `agreementDate` date DEFAULT NULL,
  `registrationDate` date DEFAULT NULL,
  `cancellationDate` date DEFAULT NULL,
  `cancellationReason` text,
  `notes` text,
  `commissionCreated` tinyint NOT NULL DEFAULT '0',
  `createdAt` datetime(6) NOT NULL DEFAULT CURRENT_TIMESTAMP(6),
  `updatedAt` datetime(6) NOT NULL DEFAULT CURRENT_TIMESTAMP(6) ON UPDATE CURRENT_TIMESTAMP(6),
  `commissionRate` decimal(5,2) DEFAULT '2.00',
  PRIMARY KEY (`id`),
  KEY `IDX_98dfceead99eef98d2b32f2a1d` (`leadId`),
  KEY `IDX_92ce46b4fa9abd0adb145ad5fd` (`agentId`),
  KEY `IDX_d9d02e1c6a8746af7b565df55c` (`stage`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_0900_ai_ci;
/*!40101 SET character_set_client = @saved_cs_client */;

--
-- Table structure for table `event_template_mappings`
--

DROP TABLE IF EXISTS `event_template_mappings`;
/*!40101 SET @saved_cs_client     = @@character_set_client */;
/*!50503 SET character_set_client = utf8mb4 */;
CREATE TABLE `event_template_mappings` (
  `id` varchar(36) NOT NULL,
  `event` enum('lead_created','lead_status_updated','lead_assigned','inquiry_created','property_approved','property_rejected','site_visit_scheduled','deal_created','deal_won','user_registered','otp_sent') NOT NULL,
  `recipientType` enum('buyer','agent','admin','owner') NOT NULL,
  `templateId` varchar(36) NOT NULL,
  `isActive` tinyint NOT NULL DEFAULT '1',
  `description` varchar(255) DEFAULT NULL,
  `createdAt` datetime(6) NOT NULL DEFAULT CURRENT_TIMESTAMP(6),
  `updatedAt` datetime(6) NOT NULL DEFAULT CURRENT_TIMESTAMP(6) ON UPDATE CURRENT_TIMESTAMP(6),
  PRIMARY KEY (`id`),
  KEY `FK_a4a8df1a3346eaf8b2bed286045` (`templateId`),
  CONSTRAINT `FK_a4a8df1a3346eaf8b2bed286045` FOREIGN KEY (`templateId`) REFERENCES `message_templates` (`id`) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_0900_ai_ci;
/*!40101 SET character_set_client = @saved_cs_client */;

--
-- Table structure for table `footer_seo_link_groups`
--

DROP TABLE IF EXISTS `footer_seo_link_groups`;
/*!40101 SET @saved_cs_client     = @@character_set_client */;
/*!50503 SET character_set_client = utf8mb4 */;
CREATE TABLE `footer_seo_link_groups` (
  `id` varchar(36) NOT NULL,
  `title` varchar(200) NOT NULL,
  `sortOrder` int NOT NULL DEFAULT '0',
  `isActive` tinyint NOT NULL DEFAULT '1',
  `createdAt` datetime(6) NOT NULL DEFAULT CURRENT_TIMESTAMP(6),
  `updatedAt` datetime(6) NOT NULL DEFAULT CURRENT_TIMESTAMP(6) ON UPDATE CURRENT_TIMESTAMP(6),
  PRIMARY KEY (`id`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_0900_ai_ci;
/*!40101 SET character_set_client = @saved_cs_client */;

--
-- Table structure for table `footer_seo_links`
--

DROP TABLE IF EXISTS `footer_seo_links`;
/*!40101 SET @saved_cs_client     = @@character_set_client */;
/*!50503 SET character_set_client = utf8mb4 */;
CREATE TABLE `footer_seo_links` (
  `id` varchar(36) NOT NULL,
  `groupId` varchar(36) NOT NULL,
  `label` varchar(200) NOT NULL,
  `url` varchar(500) NOT NULL,
  `sortOrder` int NOT NULL DEFAULT '0',
  `isActive` tinyint NOT NULL DEFAULT '1',
  `createdAt` datetime(6) NOT NULL DEFAULT CURRENT_TIMESTAMP(6),
  `updatedAt` datetime(6) NOT NULL DEFAULT CURRENT_TIMESTAMP(6) ON UPDATE CURRENT_TIMESTAMP(6),
  `h1Title` varchar(250) DEFAULT NULL,
  `metaTitle` varchar(250) DEFAULT NULL,
  `metaDescription` varchar(500) DEFAULT NULL,
  `metaKeywords` varchar(300) DEFAULT NULL,
  `canonicalUrl` varchar(500) DEFAULT NULL,
  `introContent` text,
  `bottomContent` text,
  `faqJson` json DEFAULT NULL,
  `robots` varchar(100) NOT NULL DEFAULT 'index,follow',
  PRIMARY KEY (`id`),
  KEY `FK_94e82ac832e7cb86708ee7dcc20` (`groupId`),
  CONSTRAINT `FK_94e82ac832e7cb86708ee7dcc20` FOREIGN KEY (`groupId`) REFERENCES `footer_seo_link_groups` (`id`) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_0900_ai_ci;
/*!40101 SET character_set_client = @saved_cs_client */;

--
-- Table structure for table `inquiries`
--

DROP TABLE IF EXISTS `inquiries`;
/*!40101 SET @saved_cs_client     = @@character_set_client */;
/*!50503 SET character_set_client = utf8mb4 */;
CREATE TABLE `inquiries` (
  `id` varchar(36) NOT NULL,
  `name` varchar(100) NOT NULL,
  `email` varchar(150) DEFAULT NULL,
  `phone` varchar(15) NOT NULL,
  `message` text,
  `type` enum('general','site_visit','price_negotiation') NOT NULL DEFAULT 'general',
  `status` enum('pending','responded','closed') NOT NULL DEFAULT 'pending',
  `propertyId` varchar(255) DEFAULT NULL,
  `userId` varchar(255) DEFAULT NULL,
  `createdAt` datetime(6) NOT NULL DEFAULT CURRENT_TIMESTAMP(6),
  `updatedAt` datetime(6) NOT NULL DEFAULT CURRENT_TIMESTAMP(6) ON UPDATE CURRENT_TIMESTAMP(6),
  `property_id` varchar(36) DEFAULT NULL,
  `user_id` varchar(36) DEFAULT NULL,
  `agentId` varchar(255) DEFAULT NULL,
  `agent_id` varchar(36) DEFAULT NULL,
  PRIMARY KEY (`id`),
  KEY `FK_fb8f767d33104c829ea4eabeca6` (`property_id`),
  KEY `FK_a896a1864d60d5707403e0a0810` (`user_id`),
  KEY `FK_605cc5383d87f6ea4dd43008427` (`agent_id`),
  CONSTRAINT `FK_605cc5383d87f6ea4dd43008427` FOREIGN KEY (`agent_id`) REFERENCES `users` (`id`) ON DELETE SET NULL,
  CONSTRAINT `FK_a896a1864d60d5707403e0a0810` FOREIGN KEY (`user_id`) REFERENCES `users` (`id`) ON DELETE SET NULL,
  CONSTRAINT `FK_fb8f767d33104c829ea4eabeca6` FOREIGN KEY (`property_id`) REFERENCES `properties` (`id`) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_0900_ai_ci;
/*!40101 SET character_set_client = @saved_cs_client */;

--
-- Table structure for table `lead_activity_logs`
--

DROP TABLE IF EXISTS `lead_activity_logs`;
/*!40101 SET @saved_cs_client     = @@character_set_client */;
/*!50503 SET character_set_client = utf8mb4 */;
CREATE TABLE `lead_activity_logs` (
  `id` varchar(36) NOT NULL,
  `leadId` varchar(36) NOT NULL,
  `actorId` varchar(36) DEFAULT NULL,
  `actorType` enum('agent','admin','system','client') NOT NULL DEFAULT 'agent',
  `activityType` enum('status_change','note_added','call_logged','whatsapp_sent','email_sent','visit_scheduled','visit_completed','deal_created','assignment_changed','reminder_set','document_uploaded') NOT NULL,
  `oldValue` json DEFAULT NULL,
  `newValue` json DEFAULT NULL,
  `notes` text,
  `createdAt` datetime(6) NOT NULL DEFAULT CURRENT_TIMESTAMP(6),
  PRIMARY KEY (`id`),
  KEY `IDX_20be0e7a89b5542ce45dc19583` (`leadId`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_0900_ai_ci;
/*!40101 SET character_set_client = @saved_cs_client */;

--
-- Table structure for table `lead_assignments`
--

DROP TABLE IF EXISTS `lead_assignments`;
/*!40101 SET @saved_cs_client     = @@character_set_client */;
/*!50503 SET character_set_client = utf8mb4 */;
CREATE TABLE `lead_assignments` (
  `id` varchar(36) NOT NULL,
  `leadId` varchar(36) NOT NULL,
  `agentId` varchar(36) NOT NULL,
  `agencyId` varchar(36) DEFAULT NULL,
  `assignedBy` varchar(36) DEFAULT NULL,
  `assignmentType` enum('auto','manual','reassigned','transferred') NOT NULL DEFAULT 'manual',
  `isActive` tinyint NOT NULL DEFAULT '1',
  `reason` varchar(255) DEFAULT NULL,
  `unassignedAt` timestamp NULL DEFAULT NULL,
  `assignedAt` datetime(6) NOT NULL DEFAULT CURRENT_TIMESTAMP(6),
  PRIMARY KEY (`id`),
  KEY `IDX_f93898965925353d9055885bd7` (`leadId`),
  KEY `IDX_7e3a21d8c28a67cdfe7949e13b` (`agentId`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_0900_ai_ci;
/*!40101 SET character_set_client = @saved_cs_client */;

--
-- Table structure for table `leads`
--

DROP TABLE IF EXISTS `leads`;
/*!40101 SET @saved_cs_client     = @@character_set_client */;
/*!50503 SET character_set_client = utf8mb4 */;
CREATE TABLE `leads` (
  `id` varchar(36) NOT NULL,
  `source` enum('property_page','view_phone','schedule_visit','download_brochure','chatbot','seo_form','find_property','property_alert','search','contact_form','enquiry','call','whatsapp','campaign','portal_import','walkin','manual') NOT NULL DEFAULT 'manual',
  `sourceRef` varchar(255) DEFAULT NULL,
  `propertyId` varchar(36) DEFAULT NULL,
  `contactName` varchar(100) NOT NULL,
  `contactPhone` varchar(20) NOT NULL,
  `contactEmail` varchar(150) DEFAULT NULL,
  `city` varchar(100) DEFAULT NULL,
  `state` varchar(100) DEFAULT NULL,
  `cityId` varchar(36) DEFAULT NULL,
  `propertyType` enum('residential','commercial','plot','rental') DEFAULT NULL,
  `budgetMin` decimal(15,2) DEFAULT NULL,
  `budgetMax` decimal(15,2) DEFAULT NULL,
  `requirement` text,
  `leadScore` int NOT NULL DEFAULT '0',
  `temperature` enum('hot','warm','cold') NOT NULL DEFAULT 'cold',
  `status` enum('new','contacted','follow_up','site_visit_scheduled','site_visit_completed','negotiation','deal_in_progress','deal_won','deal_lost','duplicate','junk') NOT NULL DEFAULT 'new',
  `duplicateOfId` varchar(36) DEFAULT NULL,
  `assignedAgentId` varchar(36) DEFAULT NULL,
  `agencyId` varchar(36) DEFAULT NULL,
  `lostReason` text,
  `notes` text,
  `createdAt` datetime(6) NOT NULL DEFAULT CURRENT_TIMESTAMP(6),
  `updatedAt` datetime(6) NOT NULL DEFAULT CURRENT_TIMESTAMP(6) ON UPDATE CURRENT_TIMESTAMP(6),
  `utmSource` varchar(100) DEFAULT NULL,
  `utmMedium` varchar(100) DEFAULT NULL,
  `utmCampaign` varchar(100) DEFAULT NULL,
  `sessionId` varchar(100) DEFAULT NULL,
  `deviceType` varchar(50) DEFAULT NULL,
  `locality` varchar(100) DEFAULT NULL,
  `localityId` varchar(36) DEFAULT NULL,
  `propertyFor` varchar(20) DEFAULT NULL,
  `areaMin` decimal(10,2) DEFAULT NULL,
  `areaMax` decimal(10,2) DEFAULT NULL,
  `areaUnit` varchar(20) DEFAULT NULL,
  `userType` varchar(20) DEFAULT NULL,
  `preferredLocalities` text,
  `contactUserId` varchar(36) DEFAULT NULL,
  PRIMARY KEY (`id`),
  KEY `IDX_7ac03134445b9b807c2f44910a` (`propertyId`),
  KEY `IDX_9a2bd775699a40cc5c831e85d1` (`contactPhone`),
  KEY `IDX_491b018d616822bd64ce7d4726` (`status`),
  KEY `IDX_f9cfe9b633ea175a3bd8d8b128` (`assignedAgentId`),
  KEY `idx_lead_dedup` (`contactPhone`,`propertyId`,`createdAt`),
  KEY `IDX_f725ff924cb7968419e75c1b74` (`localityId`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_0900_ai_ci;
/*!40101 SET character_set_client = @saved_cs_client */;

--
-- Table structure for table `listing_filter_configs`
--

DROP TABLE IF EXISTS `listing_filter_configs`;
/*!40101 SET @saved_cs_client     = @@character_set_client */;
/*!50503 SET character_set_client = utf8mb4 */;
CREATE TABLE `listing_filter_configs` (
  `id` varchar(36) NOT NULL,
  `filterKey` varchar(80) NOT NULL,
  `label` varchar(120) NOT NULL,
  `icon` varchar(40) DEFAULT NULL,
  `widgetType` enum('price_range','bedroom_select','property_type','area_range','option_select','amenity_picker','text_input','toggle_boolean') NOT NULL DEFAULT 'option_select',
  `optionsJson` json DEFAULT NULL,
  `categories` json DEFAULT NULL,
  `defaultOpen` tinyint NOT NULL DEFAULT '0',
  `showOnMobile` tinyint NOT NULL DEFAULT '1',
  `isActive` tinyint NOT NULL DEFAULT '1',
  `sortOrder` int NOT NULL DEFAULT '0',
  `createdAt` datetime(6) NOT NULL DEFAULT CURRENT_TIMESTAMP(6),
  `updatedAt` datetime(6) NOT NULL DEFAULT CURRENT_TIMESTAMP(6) ON UPDATE CURRENT_TIMESTAMP(6),
  PRIMARY KEY (`id`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_0900_ai_ci;
/*!40101 SET character_set_client = @saved_cs_client */;

--
-- Table structure for table `locality_circle_rates`
--

DROP TABLE IF EXISTS `locality_circle_rates`;
/*!40101 SET @saved_cs_client     = @@character_set_client */;
/*!50503 SET character_set_client = utf8mb4 */;
CREATE TABLE `locality_circle_rates` (
  `id` varchar(36) NOT NULL,
  `city` varchar(100) NOT NULL,
  `locality` varchar(150) NOT NULL,
  `circleRate` decimal(12,2) NOT NULL,
  `effectiveFrom` date DEFAULT NULL,
  `notes` text,
  `source` varchar(200) DEFAULT NULL,
  `createdAt` datetime(6) NOT NULL DEFAULT CURRENT_TIMESTAMP(6),
  `updatedAt` datetime(6) NOT NULL DEFAULT CURRENT_TIMESTAMP(6) ON UPDATE CURRENT_TIMESTAMP(6),
  PRIMARY KEY (`id`),
  UNIQUE KEY `idx_lcr_city_locality` (`city`,`locality`),
  KEY `IDX_e48dc08da48079c4197e83608e` (`city`),
  KEY `IDX_4d58b28f5bf129fe5fdfc46a29` (`locality`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_0900_ai_ci;
/*!40101 SET character_set_client = @saved_cs_client */;

--
-- Table structure for table `locality_seo`
--

DROP TABLE IF EXISTS `locality_seo`;
/*!40101 SET @saved_cs_client     = @@character_set_client */;
/*!50503 SET character_set_client = utf8mb4 */;
CREATE TABLE `locality_seo` (
  `id` varchar(36) NOT NULL,
  `city_slug` varchar(150) NOT NULL,
  `city_name` varchar(150) NOT NULL,
  `locality_slug` varchar(150) NOT NULL,
  `locality_name` varchar(150) NOT NULL,
  `slug` varchar(300) NOT NULL,
  `h1_title` varchar(250) DEFAULT NULL,
  `meta_title` varchar(250) DEFAULT NULL,
  `meta_description` varchar(500) DEFAULT NULL,
  `meta_keywords` varchar(300) DEFAULT NULL,
  `canonical_url` varchar(500) DEFAULT NULL,
  `intro_content` text,
  `bottom_content` text,
  `faq_json` json DEFAULT NULL,
  `internal_links` json DEFAULT NULL,
  `robots` varchar(100) DEFAULT 'index,follow',
  `is_active` tinyint NOT NULL DEFAULT '1',
  `created_at` datetime(6) NOT NULL DEFAULT CURRENT_TIMESTAMP(6),
  `updated_at` datetime(6) NOT NULL DEFAULT CURRENT_TIMESTAMP(6) ON UPDATE CURRENT_TIMESTAMP(6),
  PRIMARY KEY (`id`),
  UNIQUE KEY `IDX_9838d943942e405b9ceaf4af84` (`city_slug`,`locality_slug`),
  UNIQUE KEY `IDX_c4ac9f5b08a000d33227dcf91d` (`slug`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_0900_ai_ci;
/*!40101 SET character_set_client = @saved_cs_client */;

--
-- Table structure for table `locations`
--

DROP TABLE IF EXISTS `locations`;
/*!40101 SET @saved_cs_client     = @@character_set_client */;
/*!50503 SET character_set_client = utf8mb4 */;
CREATE TABLE `locations` (
  `id` varchar(36) NOT NULL,
  `city` varchar(100) NOT NULL,
  `state` varchar(100) NOT NULL,
  `locality` varchar(100) DEFAULT NULL,
  `pincode` varchar(10) DEFAULT NULL,
  `latitude` decimal(10,8) DEFAULT NULL,
  `longitude` decimal(11,8) DEFAULT NULL,
  `isActive` tinyint NOT NULL DEFAULT '1',
  `propertyCount` int NOT NULL DEFAULT '0',
  PRIMARY KEY (`id`),
  KEY `IDX_f1a9093eafe4afa3a5ee8ca096` (`city`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_0900_ai_ci;
/*!40101 SET character_set_client = @saved_cs_client */;

--
-- Table structure for table `market_snapshots`
--

DROP TABLE IF EXISTS `market_snapshots`;
/*!40101 SET @saved_cs_client     = @@character_set_client */;
/*!50503 SET character_set_client = utf8mb4 */;
CREATE TABLE `market_snapshots` (
  `id` varchar(36) NOT NULL,
  `city` varchar(100) DEFAULT NULL,
  `state` varchar(100) DEFAULT NULL,
  `avgPsf` decimal(12,2) NOT NULL DEFAULT '0.00',
  `prevAvgPsf` decimal(12,2) NOT NULL DEFAULT '0.00',
  `trend` varchar(20) NOT NULL DEFAULT 'stable',
  `trendPct` decimal(6,2) NOT NULL DEFAULT '0.00',
  `avgPrice` decimal(15,2) NOT NULL DEFAULT '0.00',
  `minPrice` decimal(15,2) NOT NULL DEFAULT '0.00',
  `maxPrice` decimal(15,2) NOT NULL DEFAULT '0.00',
  `listingCount` int NOT NULL DEFAULT '0',
  `totalListingCount` int NOT NULL DEFAULT '0',
  `avgMonthlyRent` decimal(12,2) NOT NULL DEFAULT '0.00',
  `rentYield` decimal(5,2) NOT NULL DEFAULT '0.00',
  `buySavingsPct` decimal(5,2) NOT NULL DEFAULT '0.00',
  `topLocalities` json DEFAULT NULL,
  `isFeatured` tinyint NOT NULL DEFAULT '0',
  `sortOrder` int NOT NULL DEFAULT '100',
  `createdAt` datetime(6) NOT NULL DEFAULT CURRENT_TIMESTAMP(6),
  `updatedAt` datetime(6) NOT NULL DEFAULT CURRENT_TIMESTAMP(6) ON UPDATE CURRENT_TIMESTAMP(6),
  `medianPsf` decimal(12,2) DEFAULT '0.00',
  `medianPrice` decimal(15,2) DEFAULT '0.00',
  `medianRent` decimal(12,2) DEFAULT '0.00',
  `confidenceScore` int DEFAULT '0',
  `dataQuality` varchar(10) DEFAULT 'low',
  `priceType` varchar(60) DEFAULT 'Indicative Listing Price',
  `byType` json DEFAULT NULL,
  `propertyType` varchar(50) DEFAULT NULL,
  `listingType` varchar(20) DEFAULT NULL,
  `avgRentPsf` decimal(10,2) DEFAULT '0.00',
  `priceTrend` json DEFAULT NULL,
  `smartInsights` json DEFAULT NULL,
  PRIMARY KEY (`id`),
  KEY `IDX_a64975f6c4c8e243b2e87a2858` (`city`),
  KEY `IDX_ae54a7b3184f58f61781a40f73` (`city`,`propertyType`,`listingType`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_0900_ai_ci;
/*!40101 SET character_set_client = @saved_cs_client */;

--
-- Table structure for table `menus`
--

DROP TABLE IF EXISTS `menus`;
/*!40101 SET @saved_cs_client     = @@character_set_client */;
/*!50503 SET character_set_client = utf8mb4 */;
CREATE TABLE `menus` (
  `id` int NOT NULL AUTO_INCREMENT,
  `name` varchar(100) NOT NULL,
  `slug` varchar(100) NOT NULL,
  `icon` varchar(100) DEFAULT NULL,
  `parent_id` int DEFAULT NULL,
  `sort_order` int NOT NULL DEFAULT '0',
  `is_active` tinyint NOT NULL DEFAULT '1',
  `created_at` datetime(6) NOT NULL DEFAULT CURRENT_TIMESTAMP(6),
  `updated_at` datetime(6) NOT NULL DEFAULT CURRENT_TIMESTAMP(6) ON UPDATE CURRENT_TIMESTAMP(6),
  `section` varchar(100) DEFAULT NULL,
  PRIMARY KEY (`id`),
  UNIQUE KEY `IDX_478abfb63bdfce389d94d5d932` (`slug`)
) ENGINE=InnoDB AUTO_INCREMENT=48 DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_0900_ai_ci;
/*!40101 SET character_set_client = @saved_cs_client */;

--
-- Table structure for table `message_logs`
--

DROP TABLE IF EXISTS `message_logs`;
/*!40101 SET @saved_cs_client     = @@character_set_client */;
/*!50503 SET character_set_client = utf8mb4 */;
CREATE TABLE `message_logs` (
  `id` varchar(36) NOT NULL,
  `event` varchar(100) NOT NULL,
  `templateId` varchar(36) DEFAULT NULL,
  `serviceId` varchar(36) DEFAULT NULL,
  `recipientType` varchar(20) DEFAULT NULL,
  `recipient` varchar(200) DEFAULT NULL,
  `recipientUserId` varchar(36) DEFAULT NULL,
  `status` enum('queued','sent','failed','retrying','skipped') NOT NULL DEFAULT 'queued',
  `renderedBody` text,
  `attempts` int NOT NULL DEFAULT '0',
  `errorMessage` text,
  `jobId` varchar(100) DEFAULT NULL,
  `sentAt` timestamp NULL DEFAULT NULL,
  `contextData` json DEFAULT NULL,
  `createdAt` datetime(6) NOT NULL DEFAULT CURRENT_TIMESTAMP(6),
  PRIMARY KEY (`id`),
  KEY `IDX_c9bd4e5e79011fe2e2df22131f` (`event`),
  KEY `IDX_b79d4d15b8de1d8ef5c7761f81` (`status`),
  KEY `IDX_3dfac9df59742b3a3cf1ef2c70` (`createdAt`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_0900_ai_ci;
/*!40101 SET character_set_client = @saved_cs_client */;

--
-- Table structure for table `message_services`
--

DROP TABLE IF EXISTS `message_services`;
/*!40101 SET @saved_cs_client     = @@character_set_client */;
/*!50503 SET character_set_client = utf8mb4 */;
CREATE TABLE `message_services` (
  `id` varchar(36) NOT NULL,
  `name` varchar(100) NOT NULL,
  `channel` enum('whatsapp','sms','email') NOT NULL,
  `provider` enum('meta','twilio','msg91','smtp','sendgrid','generic') NOT NULL DEFAULT 'generic',
  `config` json DEFAULT NULL,
  `isActive` tinyint NOT NULL DEFAULT '1',
  `createdAt` datetime(6) NOT NULL DEFAULT CURRENT_TIMESTAMP(6),
  `updatedAt` datetime(6) NOT NULL DEFAULT CURRENT_TIMESTAMP(6) ON UPDATE CURRENT_TIMESTAMP(6),
  PRIMARY KEY (`id`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_0900_ai_ci;
/*!40101 SET character_set_client = @saved_cs_client */;

--
-- Table structure for table `message_templates`
--

DROP TABLE IF EXISTS `message_templates`;
/*!40101 SET @saved_cs_client     = @@character_set_client */;
/*!50503 SET character_set_client = utf8mb4 */;
CREATE TABLE `message_templates` (
  `id` varchar(36) NOT NULL,
  `name` varchar(100) NOT NULL,
  `description` varchar(200) DEFAULT NULL,
  `channel` enum('whatsapp','sms','email') NOT NULL,
  `providerTemplateName` varchar(100) DEFAULT NULL,
  `subject` varchar(255) DEFAULT NULL,
  `body` text NOT NULL,
  `variables` json DEFAULT NULL,
  `serviceId` varchar(36) DEFAULT NULL,
  `isActive` tinyint NOT NULL DEFAULT '1',
  `createdAt` datetime(6) NOT NULL DEFAULT CURRENT_TIMESTAMP(6),
  `updatedAt` datetime(6) NOT NULL DEFAULT CURRENT_TIMESTAMP(6) ON UPDATE CURRENT_TIMESTAMP(6),
  PRIMARY KEY (`id`),
  UNIQUE KEY `IDX_87ceb46338feac77623f4bad9a` (`name`),
  KEY `FK_da9b2e3b8f0aaf19953180cc2fe` (`serviceId`),
  CONSTRAINT `FK_da9b2e3b8f0aaf19953180cc2fe` FOREIGN KEY (`serviceId`) REFERENCES `message_services` (`id`) ON DELETE SET NULL
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_0900_ai_ci;
/*!40101 SET character_set_client = @saved_cs_client */;

--
-- Table structure for table `notifications`
--

DROP TABLE IF EXISTS `notifications`;
/*!40101 SET @saved_cs_client     = @@character_set_client */;
/*!50503 SET character_set_client = utf8mb4 */;
CREATE TABLE `notifications` (
  `id` varchar(36) NOT NULL,
  `userId` varchar(36) NOT NULL,
  `role` varchar(50) DEFAULT NULL,
  `title` varchar(255) NOT NULL,
  `message` text,
  `type` enum('lead','property','system','message','admin') NOT NULL DEFAULT 'system',
  `entityType` varchar(50) DEFAULT NULL,
  `entityId` varchar(36) DEFAULT NULL,
  `isRead` tinyint NOT NULL DEFAULT '0',
  `createdAt` datetime(6) NOT NULL DEFAULT CURRENT_TIMESTAMP(6),
  PRIMARY KEY (`id`),
  KEY `IDX_692a909ee0fa9383e7859f9b40` (`userId`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_0900_ai_ci;
/*!40101 SET character_set_client = @saved_cs_client */;

--
-- Table structure for table `otp_verifications`
--

DROP TABLE IF EXISTS `otp_verifications`;
/*!40101 SET @saved_cs_client     = @@character_set_client */;
/*!50503 SET character_set_client = utf8mb4 */;
CREATE TABLE `otp_verifications` (
  `id` varchar(36) NOT NULL,
  `phone` varchar(20) NOT NULL,
  `otpHash` varchar(60) NOT NULL,
  `purpose` varchar(20) NOT NULL DEFAULT 'login',
  `attempts` int NOT NULL DEFAULT '0',
  `expiresAt` datetime NOT NULL,
  `used` tinyint NOT NULL DEFAULT '0',
  `createdAt` datetime(6) NOT NULL DEFAULT CURRENT_TIMESTAMP(6),
  PRIMARY KEY (`id`),
  KEY `idx_otp_phone_purpose` (`phone`,`purpose`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_0900_ai_ci;
/*!40101 SET character_set_client = @saved_cs_client */;

--
-- Table structure for table `permissions`
--

DROP TABLE IF EXISTS `permissions`;
/*!40101 SET @saved_cs_client     = @@character_set_client */;
/*!50503 SET character_set_client = utf8mb4 */;
CREATE TABLE `permissions` (
  `id` varchar(36) NOT NULL,
  `key` varchar(120) NOT NULL,
  `name` varchar(100) NOT NULL,
  `module` varchar(60) NOT NULL,
  `description` text,
  `isActive` tinyint(1) NOT NULL DEFAULT '1',
  `createdAt` datetime(6) NOT NULL DEFAULT CURRENT_TIMESTAMP(6),
  `updatedAt` datetime(6) NOT NULL DEFAULT CURRENT_TIMESTAMP(6) ON UPDATE CURRENT_TIMESTAMP(6),
  PRIMARY KEY (`id`),
  UNIQUE KEY `IDX_017943867ed5ceef9c03edd974` (`key`),
  KEY `IDX_8b634526cdd01f2adba6c7ac07` (`module`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_0900_ai_ci;
/*!40101 SET character_set_client = @saved_cs_client */;

--
-- Table structure for table `premium_slots`
--

DROP TABLE IF EXISTS `premium_slots`;
/*!40101 SET @saved_cs_client     = @@character_set_client */;
/*!50503 SET character_set_client = utf8mb4 */;
CREATE TABLE `premium_slots` (
  `id` varchar(36) NOT NULL,
  `city` varchar(100) NOT NULL,
  `cityId` varchar(36) DEFAULT NULL,
  `slotNumber` int NOT NULL DEFAULT '1',
  `agentId` varchar(36) NOT NULL,
  `agencyId` varchar(36) DEFAULT NULL,
  `agentName` varchar(200) DEFAULT NULL,
  `agentAvatar` varchar(500) DEFAULT NULL,
  `agentPhone` varchar(30) DEFAULT NULL,
  `price` decimal(10,2) NOT NULL DEFAULT '0.00',
  `durationDays` int NOT NULL DEFAULT '30',
  `startsAt` timestamp NOT NULL,
  `expiresAt` timestamp NOT NULL,
  `isActive` tinyint NOT NULL DEFAULT '1',
  `adminNotes` text,
  `createdAt` datetime(6) NOT NULL DEFAULT CURRENT_TIMESTAMP(6),
  `updatedAt` datetime(6) NOT NULL DEFAULT CURRENT_TIMESTAMP(6) ON UPDATE CURRENT_TIMESTAMP(6),
  PRIMARY KEY (`id`),
  KEY `IDX_ea857bbd22e81e6d2c4e197b26` (`city`),
  KEY `IDX_21e270de6c23ef2f34e1b27da9` (`agentId`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_0900_ai_ci;
/*!40101 SET character_set_client = @saved_cs_client */;

--
-- Table structure for table `prop_categories`
--

DROP TABLE IF EXISTS `prop_categories`;
/*!40101 SET @saved_cs_client     = @@character_set_client */;
/*!50503 SET character_set_client = utf8mb4 */;
CREATE TABLE `prop_categories` (
  `id` varchar(36) NOT NULL,
  `name` varchar(100) NOT NULL,
  `slug` varchar(100) NOT NULL,
  `icon` varchar(10) DEFAULT NULL,
  `description` varchar(500) DEFAULT NULL,
  `status` tinyint NOT NULL DEFAULT '1',
  `sortOrder` int NOT NULL DEFAULT '0',
  `createdAt` datetime(6) NOT NULL DEFAULT CURRENT_TIMESTAMP(6),
  `updatedAt` datetime(6) NOT NULL DEFAULT CURRENT_TIMESTAMP(6) ON UPDATE CURRENT_TIMESTAMP(6),
  `h1` varchar(200) DEFAULT NULL,
  `metaTitle` varchar(200) DEFAULT NULL,
  `metaDescription` varchar(500) DEFAULT NULL,
  `metaKeywords` varchar(500) DEFAULT NULL,
  `introContent` text,
  `seoContent` text,
  `faqs` json DEFAULT NULL,
  PRIMARY KEY (`id`),
  UNIQUE KEY `IDX_60c4d27b3394f71f7e0d01afa5` (`slug`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_0900_ai_ci;
/*!40101 SET character_set_client = @saved_cs_client */;

--
-- Table structure for table `prop_type_amenities`
--

DROP TABLE IF EXISTS `prop_type_amenities`;
/*!40101 SET @saved_cs_client     = @@character_set_client */;
/*!50503 SET character_set_client = utf8mb4 */;
CREATE TABLE `prop_type_amenities` (
  `id` varchar(36) NOT NULL,
  `propTypeId` varchar(36) NOT NULL,
  `amenityId` varchar(36) NOT NULL,
  PRIMARY KEY (`id`),
  KEY `FK_9953bda40e418a451cbc65645cb` (`propTypeId`),
  KEY `FK_fb9cbf26a58d5167ddc9679ab78` (`amenityId`),
  CONSTRAINT `FK_9953bda40e418a451cbc65645cb` FOREIGN KEY (`propTypeId`) REFERENCES `prop_types` (`id`) ON DELETE CASCADE,
  CONSTRAINT `FK_fb9cbf26a58d5167ddc9679ab78` FOREIGN KEY (`amenityId`) REFERENCES `amenities` (`id`) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_0900_ai_ci;
/*!40101 SET character_set_client = @saved_cs_client */;

--
-- Table structure for table `prop_type_fields`
--

DROP TABLE IF EXISTS `prop_type_fields`;
/*!40101 SET @saved_cs_client     = @@character_set_client */;
/*!50503 SET character_set_client = utf8mb4 */;
CREATE TABLE `prop_type_fields` (
  `id` varchar(36) NOT NULL,
  `propTypeId` varchar(36) NOT NULL,
  `fieldName` varchar(100) NOT NULL,
  `fieldLabel` varchar(200) NOT NULL,
  `fieldType` enum('text','number','dropdown','checkbox','radio','textarea','dependent') NOT NULL DEFAULT 'text',
  `optionsJson` json DEFAULT NULL,
  `placeholder` varchar(500) DEFAULT NULL,
  `isRequired` tinyint NOT NULL DEFAULT '0',
  `sortOrder` int NOT NULL DEFAULT '0',
  PRIMARY KEY (`id`),
  KEY `FK_f1a0c6052213aa853dbc73b820f` (`propTypeId`),
  CONSTRAINT `FK_f1a0c6052213aa853dbc73b820f` FOREIGN KEY (`propTypeId`) REFERENCES `prop_types` (`id`) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_0900_ai_ci;
/*!40101 SET character_set_client = @saved_cs_client */;

--
-- Table structure for table `prop_types`
--

DROP TABLE IF EXISTS `prop_types`;
/*!40101 SET @saved_cs_client     = @@character_set_client */;
/*!50503 SET character_set_client = utf8mb4 */;
CREATE TABLE `prop_types` (
  `id` varchar(36) NOT NULL,
  `name` varchar(100) NOT NULL,
  `slug` varchar(100) NOT NULL,
  `icon` varchar(10) DEFAULT NULL,
  `status` tinyint NOT NULL DEFAULT '1',
  `sortOrder` int NOT NULL DEFAULT '0',
  `categoryId` varchar(36) NOT NULL,
  `createdAt` datetime(6) NOT NULL DEFAULT CURRENT_TIMESTAMP(6),
  `updatedAt` datetime(6) NOT NULL DEFAULT CURRENT_TIMESTAMP(6) ON UPDATE CURRENT_TIMESTAMP(6),
  `category_id` varchar(36) DEFAULT NULL,
  `aliasOf` varchar(100) DEFAULT NULL,
  PRIMARY KEY (`id`),
  KEY `FK_abe728230de4f18aa057fd77c7d` (`category_id`),
  CONSTRAINT `FK_abe728230de4f18aa057fd77c7d` FOREIGN KEY (`category_id`) REFERENCES `prop_categories` (`id`) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_0900_ai_ci;
/*!40101 SET character_set_client = @saved_cs_client */;

--
-- Table structure for table `properties`
--

DROP TABLE IF EXISTS `properties`;
/*!40101 SET @saved_cs_client     = @@character_set_client */;
/*!50503 SET character_set_client = utf8mb4 */;
CREATE TABLE `properties` (
  `id` varchar(36) NOT NULL,
  `title` varchar(200) NOT NULL,
  `slug` varchar(250) NOT NULL,
  `description` text NOT NULL,
  `price` decimal(15,2) NOT NULL,
  `priceUnit` varchar(20) DEFAULT NULL,
  `area` decimal(10,2) DEFAULT NULL,
  `areaUnit` varchar(20) DEFAULT NULL,
  `bedrooms` int DEFAULT NULL,
  `bathrooms` int DEFAULT NULL,
  `balconies` int DEFAULT NULL,
  `totalFloors` int DEFAULT NULL,
  `floorNumber` int DEFAULT NULL,
  `parkingSpots` int DEFAULT NULL,
  `furnishingStatus` enum('furnished','semi_furnished','unfurnished') DEFAULT NULL,
  `possessionStatus` enum('ready_to_move','under_construction') NOT NULL DEFAULT 'ready_to_move',
  `possessionDate` datetime DEFAULT NULL,
  `city` varchar(100) NOT NULL,
  `locality` varchar(100) NOT NULL,
  `society` varchar(200) DEFAULT NULL,
  `address` varchar(300) DEFAULT NULL,
  `pincode` varchar(10) DEFAULT NULL,
  `latitude` decimal(10,8) DEFAULT NULL,
  `longitude` decimal(11,8) DEFAULT NULL,
  `status` enum('active','under_deal','sold','rented','inactive','pending') NOT NULL DEFAULT 'active',
  `isFeatured` tinyint NOT NULL DEFAULT '0',
  `isPremium` tinyint NOT NULL DEFAULT '0',
  `isVerified` tinyint NOT NULL DEFAULT '0',
  `viewCount` int NOT NULL DEFAULT '0',
  `approvalStatus` enum('pending','approved','rejected') NOT NULL DEFAULT 'pending',
  `rejectionReason` varchar(500) DEFAULT NULL,
  `listingPlan` enum('free','basic','premium','featured') NOT NULL DEFAULT 'free',
  `listingExpiresAt` datetime DEFAULT NULL,
  `boostExpiresAt` datetime DEFAULT NULL,
  `reraNumber` varchar(50) DEFAULT NULL,
  `builderName` varchar(100) DEFAULT NULL,
  `propertyAge` int DEFAULT NULL,
  `metaTitle` varchar(200) DEFAULT NULL,
  `metaDescription` varchar(500) DEFAULT NULL,
  `listedBy` enum('owner','agent') NOT NULL DEFAULT 'owner',
  `brokerage` varchar(100) DEFAULT NULL,
  `extraDetails` json DEFAULT NULL,
  `state` varchar(100) DEFAULT NULL,
  `stateId` varchar(36) DEFAULT NULL,
  `cityId` varchar(36) DEFAULT NULL,
  `ownerId` varchar(255) DEFAULT NULL,
  `createdAt` datetime(6) NOT NULL DEFAULT CURRENT_TIMESTAMP(6),
  `updatedAt` datetime(6) NOT NULL DEFAULT CURRENT_TIMESTAMP(6) ON UPDATE CURRENT_TIMESTAMP(6),
  `owner_id` varchar(36) DEFAULT NULL,
  `isNewProject` tinyint NOT NULL DEFAULT '0',
  `agentId` varchar(36) DEFAULT NULL,
  `agencyId` varchar(36) DEFAULT NULL,
  `isDraft` tinyint NOT NULL DEFAULT '0',
  `allowIndexing` tinyint NOT NULL DEFAULT '0',
  `localityId` varchar(36) DEFAULT NULL,
  `statusUpdatedAt` datetime DEFAULT NULL,
  `statusUpdatedBy` varchar(36) DEFAULT NULL,
  `statusNote` text,
  `listingType` varchar(20) DEFAULT NULL,
  `viewsLast24h` int NOT NULL DEFAULT '0',
  `viewsLast7d` int NOT NULL DEFAULT '0',
  `inquiriesLast24h` int NOT NULL DEFAULT '0',
  `inquiriesLast7d` int NOT NULL DEFAULT '0',
  `savesLast7d` int NOT NULL DEFAULT '0',
  `listingScore` decimal(12,4) NOT NULL DEFAULT '0.0000',
  `featuredScore` decimal(8,4) NOT NULL DEFAULT '0.0000',
  `dealScore` decimal(8,4) NOT NULL DEFAULT '0.0000',
  `isHotDeal` tinyint NOT NULL DEFAULT '0',
  `isTrending` tinyint NOT NULL DEFAULT '0',
  `hotTagExpiresAt` datetime DEFAULT NULL,
  `brochureUrl` varchar(500) DEFAULT NULL,
  `type` varchar(100) NOT NULL,
  `category` varchar(100) NOT NULL,
  PRIMARY KEY (`id`),
  UNIQUE KEY `IDX_089e10e6f1282e7b4bd0c58263` (`slug`),
  KEY `IDX_c7aea7f222acdb48e3422361f8` (`city`),
  KEY `IDX_92c923085d2eddf44188d41c8c` (`locality`),
  KEY `IDX_9cd2513cd04f57c9967f640b0a` (`status`),
  KEY `IDX_f530cefcae42a1ce263ef30ef4` (`approvalStatus`),
  KEY `FK_797b76e2d11a5bf755127d1aa67` (`owner_id`),
  KEY `IDX_788ff519ace064755e87fa90ee` (`category`),
  CONSTRAINT `FK_797b76e2d11a5bf755127d1aa67` FOREIGN KEY (`owner_id`) REFERENCES `users` (`id`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_0900_ai_ci;
/*!40101 SET character_set_client = @saved_cs_client */;

--
-- Table structure for table `property_agent_map`
--

DROP TABLE IF EXISTS `property_agent_map`;
/*!40101 SET @saved_cs_client     = @@character_set_client */;
/*!50503 SET character_set_client = utf8mb4 */;
CREATE TABLE `property_agent_map` (
  `id` varchar(36) NOT NULL,
  `propertyId` varchar(36) NOT NULL,
  `agentId` varchar(36) NOT NULL,
  `assignedByAdmin` tinyint NOT NULL DEFAULT '0',
  `isActive` tinyint NOT NULL DEFAULT '1',
  `createdAt` datetime(6) NOT NULL DEFAULT CURRENT_TIMESTAMP(6),
  `agent_id` varchar(36) DEFAULT NULL,
  PRIMARY KEY (`id`),
  KEY `IDX_710958c4480a4b930aea8692b5` (`propertyId`),
  KEY `IDX_3f7c3a6394962d229c1acbf787` (`agentId`),
  KEY `FK_b9bd475c84dc029a7ee822715e5` (`agent_id`),
  CONSTRAINT `FK_b9bd475c84dc029a7ee822715e5` FOREIGN KEY (`agent_id`) REFERENCES `agent_profiles` (`id`) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_0900_ai_ci;
/*!40101 SET character_set_client = @saved_cs_client */;

--
-- Table structure for table `property_alerts`
--

DROP TABLE IF EXISTS `property_alerts`;
/*!40101 SET @saved_cs_client     = @@character_set_client */;
/*!50503 SET character_set_client = utf8mb4 */;
CREATE TABLE `property_alerts` (
  `id` varchar(36) NOT NULL,
  `userId` varchar(255) NOT NULL,
  `alertName` varchar(150) NOT NULL,
  `category` varchar(50) DEFAULT NULL,
  `city` varchar(100) DEFAULT NULL,
  `locality` varchar(150) DEFAULT NULL,
  `propertyType` varchar(100) DEFAULT NULL,
  `minPrice` bigint DEFAULT NULL,
  `maxPrice` bigint DEFAULT NULL,
  `bedrooms` int DEFAULT NULL,
  `isActive` tinyint NOT NULL DEFAULT '1',
  `frequency` varchar(20) NOT NULL DEFAULT 'daily',
  `lastTriggeredAt` timestamp NULL DEFAULT NULL,
  `createdAt` datetime(6) NOT NULL DEFAULT CURRENT_TIMESTAMP(6),
  `updatedAt` datetime(6) NOT NULL DEFAULT CURRENT_TIMESTAMP(6) ON UPDATE CURRENT_TIMESTAMP(6),
  PRIMARY KEY (`id`),
  KEY `FK_486b8961c92738f7f368ecc7f95` (`userId`),
  CONSTRAINT `FK_486b8961c92738f7f368ecc7f95` FOREIGN KEY (`userId`) REFERENCES `users` (`id`) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_0900_ai_ci;
/*!40101 SET character_set_client = @saved_cs_client */;

--
-- Table structure for table `property_amenities`
--

DROP TABLE IF EXISTS `property_amenities`;
/*!40101 SET @saved_cs_client     = @@character_set_client */;
/*!50503 SET character_set_client = utf8mb4 */;
CREATE TABLE `property_amenities` (
  `propertiesId` varchar(36) NOT NULL,
  `amenitiesId` varchar(36) NOT NULL,
  PRIMARY KEY (`propertiesId`,`amenitiesId`),
  KEY `IDX_73f149bf7a208e3fa00d5e9d32` (`propertiesId`),
  KEY `IDX_6ff8f55ba52924e4418a6b4b71` (`amenitiesId`),
  CONSTRAINT `FK_6ff8f55ba52924e4418a6b4b716` FOREIGN KEY (`amenitiesId`) REFERENCES `amenities` (`id`) ON DELETE CASCADE ON UPDATE CASCADE,
  CONSTRAINT `FK_73f149bf7a208e3fa00d5e9d327` FOREIGN KEY (`propertiesId`) REFERENCES `properties` (`id`) ON DELETE CASCADE ON UPDATE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_0900_ai_ci;
/*!40101 SET character_set_client = @saved_cs_client */;

--
-- Table structure for table `property_images`
--

DROP TABLE IF EXISTS `property_images`;
/*!40101 SET @saved_cs_client     = @@character_set_client */;
/*!50503 SET character_set_client = utf8mb4 */;
CREATE TABLE `property_images` (
  `id` varchar(36) NOT NULL,
  `url` varchar(500) NOT NULL,
  `alt` varchar(200) DEFAULT NULL,
  `isPrimary` tinyint NOT NULL DEFAULT '0',
  `sortOrder` int NOT NULL DEFAULT '0',
  `propertyId` varchar(255) NOT NULL,
  `createdAt` datetime(6) NOT NULL DEFAULT CURRENT_TIMESTAMP(6),
  PRIMARY KEY (`id`),
  KEY `FK_7a07b6b7f9418bf1d5160106694` (`propertyId`),
  CONSTRAINT `FK_7a07b6b7f9418bf1d5160106694` FOREIGN KEY (`propertyId`) REFERENCES `properties` (`id`) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_0900_ai_ci;
/*!40101 SET character_set_client = @saved_cs_client */;

--
-- Table structure for table `property_status_history`
--

DROP TABLE IF EXISTS `property_status_history`;
/*!40101 SET @saved_cs_client     = @@character_set_client */;
/*!50503 SET character_set_client = utf8mb4 */;
CREATE TABLE `property_status_history` (
  `id` varchar(36) NOT NULL,
  `propertyId` varchar(36) NOT NULL,
  `oldStatus` varchar(50) DEFAULT NULL,
  `newStatus` varchar(50) NOT NULL,
  `updatedBy` varchar(36) DEFAULT NULL,
  `updatedByRole` varchar(50) DEFAULT NULL,
  `note` text,
  `createdAt` datetime(6) NOT NULL DEFAULT CURRENT_TIMESTAMP(6),
  PRIMARY KEY (`id`),
  KEY `FK_719a3ff5337146817e9cb785a8a` (`propertyId`),
  CONSTRAINT `FK_719a3ff5337146817e9cb785a8a` FOREIGN KEY (`propertyId`) REFERENCES `properties` (`id`) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_0900_ai_ci;
/*!40101 SET character_set_client = @saved_cs_client */;

--
-- Table structure for table `property_views`
--

DROP TABLE IF EXISTS `property_views`;
/*!40101 SET @saved_cs_client     = @@character_set_client */;
/*!50503 SET character_set_client = utf8mb4 */;
CREATE TABLE `property_views` (
  `id` varchar(36) NOT NULL,
  `property_id` varchar(255) NOT NULL,
  `user_id` varchar(255) DEFAULT NULL,
  `ipAddress` varchar(50) NOT NULL,
  `userAgent` varchar(512) DEFAULT NULL,
  `sessionId` varchar(100) DEFAULT NULL,
  `source` varchar(50) DEFAULT NULL,
  `referrer` varchar(512) DEFAULT NULL,
  `deviceType` varchar(20) DEFAULT NULL,
  `viewed_at` datetime(6) NOT NULL DEFAULT CURRENT_TIMESTAMP(6),
  PRIMARY KEY (`id`),
  KEY `IDX_0b9c30804d82d6b8245669d005` (`property_id`),
  KEY `IDX_691523b62adaee92dd000c3187` (`user_id`),
  KEY `IDX_1603578e75b7e3448ee8105801` (`ipAddress`),
  KEY `IDX_3f34fd7727d12d57fd0a4641dd` (`viewed_at`),
  KEY `IDX_8ede395aa4f0c60b81bfce05c1` (`property_id`,`ipAddress`,`viewed_at`),
  KEY `IDX_3d919ee34d99c2fe7ecf602207` (`property_id`,`user_id`,`viewed_at`),
  CONSTRAINT `FK_0b9c30804d82d6b8245669d005a` FOREIGN KEY (`property_id`) REFERENCES `properties` (`id`) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_0900_ai_ci;
/*!40101 SET character_set_client = @saved_cs_client */;

--
-- Table structure for table `role_menu_permissions`
--

DROP TABLE IF EXISTS `role_menu_permissions`;
/*!40101 SET @saved_cs_client     = @@character_set_client */;
/*!50503 SET character_set_client = utf8mb4 */;
CREATE TABLE `role_menu_permissions` (
  `id` int NOT NULL AUTO_INCREMENT,
  `role` enum('buyer','owner','seller','agent','broker','admin','super_admin') NOT NULL,
  `menu_id` int NOT NULL,
  `is_visible` tinyint NOT NULL DEFAULT '1',
  `created_at` datetime(6) NOT NULL DEFAULT CURRENT_TIMESTAMP(6),
  `updated_at` datetime(6) NOT NULL DEFAULT CURRENT_TIMESTAMP(6) ON UPDATE CURRENT_TIMESTAMP(6),
  PRIMARY KEY (`id`),
  KEY `FK_f977008e3e233681034567b4b10` (`menu_id`),
  CONSTRAINT `FK_f977008e3e233681034567b4b10` FOREIGN KEY (`menu_id`) REFERENCES `menus` (`id`) ON DELETE CASCADE
) ENGINE=InnoDB AUTO_INCREMENT=146 DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_0900_ai_ci;
/*!40101 SET character_set_client = @saved_cs_client */;

--
-- Table structure for table `role_permissions`
--

DROP TABLE IF EXISTS `role_permissions`;
/*!40101 SET @saved_cs_client     = @@character_set_client */;
/*!50503 SET character_set_client = utf8mb4 */;
CREATE TABLE `role_permissions` (
  `roleId` varchar(36) NOT NULL,
  `permissionId` varchar(36) NOT NULL,
  PRIMARY KEY (`roleId`,`permissionId`),
  KEY `IDX_b4599f8b8f548d35850afa2d12` (`roleId`),
  KEY `IDX_06792d0c62ce6b0203c03643cd` (`permissionId`),
  CONSTRAINT `FK_06792d0c62ce6b0203c03643cdd` FOREIGN KEY (`permissionId`) REFERENCES `permissions` (`id`),
  CONSTRAINT `FK_b4599f8b8f548d35850afa2d12c` FOREIGN KEY (`roleId`) REFERENCES `roles` (`id`) ON DELETE CASCADE ON UPDATE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_0900_ai_ci;
/*!40101 SET character_set_client = @saved_cs_client */;

--
-- Table structure for table `roles`
--

DROP TABLE IF EXISTS `roles`;
/*!40101 SET @saved_cs_client     = @@character_set_client */;
/*!50503 SET character_set_client = utf8mb4 */;
CREATE TABLE `roles` (
  `id` varchar(36) NOT NULL,
  `name` varchar(60) NOT NULL,
  `displayName` varchar(100) NOT NULL,
  `description` text,
  `isSystem` tinyint(1) NOT NULL DEFAULT '0',
  `isActive` tinyint(1) NOT NULL DEFAULT '1',
  `level` int NOT NULL DEFAULT '0',
  `createdAt` datetime(6) NOT NULL DEFAULT CURRENT_TIMESTAMP(6),
  `updatedAt` datetime(6) NOT NULL DEFAULT CURRENT_TIMESTAMP(6) ON UPDATE CURRENT_TIMESTAMP(6),
  PRIMARY KEY (`id`),
  UNIQUE KEY `IDX_648e3f5447f725579d7d4ffdfb` (`name`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_0900_ai_ci;
/*!40101 SET character_set_client = @saved_cs_client */;

--
-- Table structure for table `saved_properties`
--

DROP TABLE IF EXISTS `saved_properties`;
/*!40101 SET @saved_cs_client     = @@character_set_client */;
/*!50503 SET character_set_client = utf8mb4 */;
CREATE TABLE `saved_properties` (
  `id` varchar(36) NOT NULL,
  `userId` varchar(255) NOT NULL,
  `propertyId` varchar(255) NOT NULL,
  `createdAt` datetime(6) NOT NULL DEFAULT CURRENT_TIMESTAMP(6),
  PRIMARY KEY (`id`),
  UNIQUE KEY `IDX_5e65004c205bb2d9db671b4ef3` (`userId`,`propertyId`),
  KEY `FK_bc0fde5fa627d3eb2c562e7826e` (`propertyId`),
  CONSTRAINT `FK_001f67aab6d64d4b08ecb7b2bdf` FOREIGN KEY (`userId`) REFERENCES `users` (`id`) ON DELETE CASCADE,
  CONSTRAINT `FK_bc0fde5fa627d3eb2c562e7826e` FOREIGN KEY (`propertyId`) REFERENCES `properties` (`id`) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_0900_ai_ci;
/*!40101 SET character_set_client = @saved_cs_client */;

--
-- Table structure for table `scoring_config`
--

DROP TABLE IF EXISTS `scoring_config`;
/*!40101 SET @saved_cs_client     = @@character_set_client */;
/*!50503 SET character_set_client = utf8mb4 */;
CREATE TABLE `scoring_config` (
  `key` varchar(80) NOT NULL,
  `value` decimal(8,4) NOT NULL,
  `description` varchar(200) NOT NULL DEFAULT '',
  `group` varchar(30) NOT NULL DEFAULT 'listing',
  `updatedAt` datetime(6) NOT NULL DEFAULT CURRENT_TIMESTAMP(6) ON UPDATE CURRENT_TIMESTAMP(6),
  PRIMARY KEY (`key`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_0900_ai_ci;
/*!40101 SET character_set_client = @saved_cs_client */;

--
-- Table structure for table `search_logs`
--

DROP TABLE IF EXISTS `search_logs`;
/*!40101 SET @saved_cs_client     = @@character_set_client */;
/*!50503 SET character_set_client = utf8mb4 */;
CREATE TABLE `search_logs` (
  `id` varchar(36) NOT NULL,
  `userId` varchar(36) DEFAULT NULL,
  `searchQuery` text NOT NULL,
  `parsedFilters` json DEFAULT NULL,
  `latitude` decimal(10,7) DEFAULT NULL,
  `longitude` decimal(10,7) DEFAULT NULL,
  `resultCount` int NOT NULL DEFAULT '0',
  `sessionId` varchar(100) DEFAULT NULL,
  `ipAddress` varchar(50) DEFAULT NULL,
  `userAgent` text,
  `createdAt` datetime(6) NOT NULL DEFAULT CURRENT_TIMESTAMP(6),
  PRIMARY KEY (`id`),
  KEY `IDX_8c823ac135c1cdfe48a79854fa` (`userId`),
  KEY `idx_search_logs_created` (`createdAt`),
  KEY `idx_search_logs_user` (`userId`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_0900_ai_ci;
/*!40101 SET character_set_client = @saved_cs_client */;

--
-- Table structure for table `seo_configs`
--

DROP TABLE IF EXISTS `seo_configs`;
/*!40101 SET @saved_cs_client     = @@character_set_client */;
/*!50503 SET character_set_client = utf8mb4 */;
CREATE TABLE `seo_configs` (
  `id` varchar(36) NOT NULL,
  `key` varchar(100) NOT NULL,
  `value` text,
  `label` varchar(200) DEFAULT NULL,
  `description` varchar(500) DEFAULT NULL,
  `createdAt` datetime(6) NOT NULL DEFAULT CURRENT_TIMESTAMP(6),
  `updatedAt` datetime(6) NOT NULL DEFAULT CURRENT_TIMESTAMP(6) ON UPDATE CURRENT_TIMESTAMP(6),
  PRIMARY KEY (`id`),
  UNIQUE KEY `IDX_ad1e2360351d595793e245b668` (`key`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_0900_ai_ci;
/*!40101 SET character_set_client = @saved_cs_client */;

--
-- Table structure for table `service_leads`
--

DROP TABLE IF EXISTS `service_leads`;
/*!40101 SET @saved_cs_client     = @@character_set_client */;
/*!50503 SET character_set_client = utf8mb4 */;
CREATE TABLE `service_leads` (
  `id` varchar(36) NOT NULL,
  `serviceId` varchar(36) NOT NULL,
  `name` varchar(100) NOT NULL,
  `phone` varchar(20) NOT NULL,
  `email` varchar(150) DEFAULT NULL,
  `location` varchar(100) DEFAULT NULL,
  `interest` varchar(255) DEFAULT NULL,
  `message` text,
  `source` varchar(20) NOT NULL DEFAULT 'web',
  `status` enum('new','contacted','closed') NOT NULL DEFAULT 'new',
  `adminNote` text,
  `createdAt` datetime(6) NOT NULL DEFAULT CURRENT_TIMESTAMP(6),
  `updatedAt` datetime(6) NOT NULL DEFAULT CURRENT_TIMESTAMP(6) ON UPDATE CURRENT_TIMESTAMP(6),
  PRIMARY KEY (`id`),
  KEY `IDX_5451c7857ec9f87702ec35c08d` (`serviceId`),
  KEY `idx_slead_status` (`status`),
  KEY `idx_slead_service` (`serviceId`),
  KEY `idx_slead_phone` (`phone`),
  CONSTRAINT `FK_5451c7857ec9f87702ec35c08de` FOREIGN KEY (`serviceId`) REFERENCES `services_catalog` (`id`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_0900_ai_ci;
/*!40101 SET character_set_client = @saved_cs_client */;

--
-- Table structure for table `services_catalog`
--

DROP TABLE IF EXISTS `services_catalog`;
/*!40101 SET @saved_cs_client     = @@character_set_client */;
/*!50503 SET character_set_client = utf8mb4 */;
CREATE TABLE `services_catalog` (
  `id` varchar(36) NOT NULL,
  `name` varchar(100) NOT NULL,
  `slug` varchar(100) NOT NULL,
  `description` text,
  `icon` varchar(200) DEFAULT NULL,
  `bannerImage` varchar(200) DEFAULT NULL,
  `type` enum('home_loan','legal','interior','packers_movers','vastu','property_management','rental_agreement','insurance') NOT NULL,
  `ctaUrl` varchar(500) DEFAULT NULL,
  `ctaText` varchar(100) DEFAULT NULL,
  `isActive` tinyint NOT NULL DEFAULT '1',
  `sortOrder` int NOT NULL DEFAULT '0',
  `partnerName` varchar(200) DEFAULT NULL,
  `partnerApiUrl` varchar(500) DEFAULT NULL,
  `config` json DEFAULT NULL,
  `createdAt` datetime(6) NOT NULL DEFAULT CURRENT_TIMESTAMP(6),
  `updatedAt` datetime(6) NOT NULL DEFAULT CURRENT_TIMESTAMP(6) ON UPDATE CURRENT_TIMESTAMP(6),
  PRIMARY KEY (`id`),
  UNIQUE KEY `IDX_4494695ed8378a79ff086d88e2` (`slug`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_0900_ai_ci;
/*!40101 SET character_set_client = @saved_cs_client */;

--
-- Table structure for table `site_visits`
--

DROP TABLE IF EXISTS `site_visits`;
/*!40101 SET @saved_cs_client     = @@character_set_client */;
/*!50503 SET character_set_client = utf8mb4 */;
CREATE TABLE `site_visits` (
  `id` varchar(36) NOT NULL,
  `leadId` varchar(36) NOT NULL,
  `agentId` varchar(36) NOT NULL,
  `propertyId` varchar(36) DEFAULT NULL,
  `scheduledAt` datetime NOT NULL,
  `confirmedAt` timestamp NULL DEFAULT NULL,
  `startedAt` timestamp NULL DEFAULT NULL,
  `completedAt` timestamp NULL DEFAULT NULL,
  `status` enum('scheduled','confirmed','in_progress','completed','no_show','cancelled','rescheduled') NOT NULL DEFAULT 'scheduled',
  `agentCheckinLat` decimal(10,8) DEFAULT NULL,
  `agentCheckinLng` decimal(11,8) DEFAULT NULL,
  `outcome` enum('very_interested','interested','needs_time','not_interested','price_issue','location_issue') DEFAULT NULL,
  `agentNotes` text,
  `clientRating` tinyint DEFAULT NULL,
  `clientFeedback` text,
  `rescheduleCount` int NOT NULL DEFAULT '0',
  `cancelReason` varchar(255) DEFAULT NULL,
  `createdAt` datetime(6) NOT NULL DEFAULT CURRENT_TIMESTAMP(6),
  `updatedAt` datetime(6) NOT NULL DEFAULT CURRENT_TIMESTAMP(6) ON UPDATE CURRENT_TIMESTAMP(6),
  PRIMARY KEY (`id`),
  KEY `IDX_1919b3c11a25af75f1793bd11c` (`leadId`),
  KEY `IDX_17d4bbc16422bfe071f02b67db` (`agentId`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_0900_ai_ci;
/*!40101 SET character_set_client = @saved_cs_client */;

--
-- Table structure for table `states`
--

DROP TABLE IF EXISTS `states`;
/*!40101 SET @saved_cs_client     = @@character_set_client */;
/*!50503 SET character_set_client = utf8mb4 */;
CREATE TABLE `states` (
  `id` varchar(36) NOT NULL,
  `name` varchar(255) NOT NULL,
  `code` varchar(10) NOT NULL,
  `isActive` tinyint NOT NULL DEFAULT '1',
  `propertyCount` int NOT NULL DEFAULT '0',
  `imageUrl` varchar(500) DEFAULT NULL,
  `countryId` varchar(255) DEFAULT NULL,
  `createdAt` datetime(6) NOT NULL DEFAULT CURRENT_TIMESTAMP(6),
  `updatedAt` datetime(6) NOT NULL DEFAULT CURRENT_TIMESTAMP(6) ON UPDATE CURRENT_TIMESTAMP(6),
  `slug` varchar(150) DEFAULT NULL,
  `h1` varchar(200) DEFAULT NULL,
  `metaTitle` varchar(200) DEFAULT NULL,
  `metaDescription` varchar(500) DEFAULT NULL,
  `metaKeywords` varchar(300) DEFAULT NULL,
  `seoContent` text,
  PRIMARY KEY (`id`),
  UNIQUE KEY `IDX_fe52f02449eaf27be2b2cb7acd` (`name`),
  UNIQUE KEY `IDX_b8af4194277281dcfe08be4264` (`code`),
  KEY `FK_76ac7edf8f44e80dff569db7321` (`countryId`),
  CONSTRAINT `FK_76ac7edf8f44e80dff569db7321` FOREIGN KEY (`countryId`) REFERENCES `countries` (`id`) ON DELETE SET NULL
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_0900_ai_ci;
/*!40101 SET character_set_client = @saved_cs_client */;

--
-- Table structure for table `storage_configs`
--

DROP TABLE IF EXISTS `storage_configs`;
/*!40101 SET @saved_cs_client     = @@character_set_client */;
/*!50503 SET character_set_client = utf8mb4 */;
CREATE TABLE `storage_configs` (
  `id` int NOT NULL AUTO_INCREMENT,
  `key` varchar(80) NOT NULL,
  `value` text,
  `updatedAt` datetime(6) NOT NULL DEFAULT CURRENT_TIMESTAMP(6) ON UPDATE CURRENT_TIMESTAMP(6),
  PRIMARY KEY (`id`),
  UNIQUE KEY `IDX_c55d6d2d427ee4740d2e86a275` (`key`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_0900_ai_ci;
/*!40101 SET character_set_client = @saved_cs_client */;

--
-- Table structure for table `subscription_plans`
--

DROP TABLE IF EXISTS `subscription_plans`;
/*!40101 SET @saved_cs_client     = @@character_set_client */;
/*!50503 SET character_set_client = utf8mb4 */;
CREATE TABLE `subscription_plans` (
  `id` varchar(36) NOT NULL,
  `name` varchar(255) NOT NULL,
  `type` enum('basic','premium','featured','enterprise') NOT NULL,
  `price` decimal(10,2) NOT NULL,
  `durationDays` int NOT NULL DEFAULT '30',
  `tokensIncluded` int NOT NULL DEFAULT '0',
  `maxListings` int NOT NULL DEFAULT '5',
  `features` json DEFAULT NULL,
  `isActive` tinyint NOT NULL DEFAULT '1',
  `sortOrder` int NOT NULL DEFAULT '0',
  `createdAt` datetime(6) NOT NULL DEFAULT CURRENT_TIMESTAMP(6),
  `updatedAt` datetime(6) NOT NULL DEFAULT CURRENT_TIMESTAMP(6) ON UPDATE CURRENT_TIMESTAMP(6),
  `agentBadge` enum('none','verified','bronze','silver','gold') NOT NULL DEFAULT 'none',
  PRIMARY KEY (`id`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_0900_ai_ci;
/*!40101 SET character_set_client = @saved_cs_client */;

--
-- Table structure for table `top_agents_cache`
--

DROP TABLE IF EXISTS `top_agents_cache`;
/*!40101 SET @saved_cs_client     = @@character_set_client */;
/*!50503 SET character_set_client = utf8mb4 */;
CREATE TABLE `top_agents_cache` (
  `id` varchar(36) NOT NULL,
  `agentId` varchar(36) NOT NULL,
  `score` decimal(12,4) NOT NULL DEFAULT '0.0000',
  `rank` int NOT NULL DEFAULT '0',
  `profileViews` int NOT NULL DEFAULT '0',
  `listingsCount` int NOT NULL DEFAULT '0',
  `inquiriesCount` int NOT NULL DEFAULT '0',
  `country` varchar(100) DEFAULT NULL,
  `state` varchar(100) DEFAULT NULL,
  `city` varchar(100) DEFAULT NULL,
  `updatedAt` datetime(6) NOT NULL DEFAULT CURRENT_TIMESTAMP(6) ON UPDATE CURRENT_TIMESTAMP(6),
  PRIMARY KEY (`id`),
  KEY `IDX_0caf1c7a4f6974a837b3fe0b3b` (`agentId`),
  KEY `IDX_6f2059ab313732499843cfa8f2` (`country`,`state`,`city`,`rank`),
  CONSTRAINT `FK_0caf1c7a4f6974a837b3fe0b3b5` FOREIGN KEY (`agentId`) REFERENCES `users` (`id`) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_0900_ai_ci;
/*!40101 SET character_set_client = @saved_cs_client */;

--
-- Table structure for table `top_locations_cache`
--

DROP TABLE IF EXISTS `top_locations_cache`;
/*!40101 SET @saved_cs_client     = @@character_set_client */;
/*!50503 SET character_set_client = utf8mb4 */;
CREATE TABLE `top_locations_cache` (
  `id` varchar(36) NOT NULL,
  `entityType` varchar(10) NOT NULL,
  `entityId` varchar(36) DEFAULT NULL,
  `entityName` varchar(150) NOT NULL,
  `parentName` varchar(150) DEFAULT NULL,
  `imageUrl` varchar(100) DEFAULT NULL,
  `score` decimal(12,4) NOT NULL DEFAULT '0.0000',
  `rank` int NOT NULL DEFAULT '0',
  `propertyCount` int NOT NULL DEFAULT '0',
  `searchCount` int NOT NULL DEFAULT '0',
  `viewCount` int NOT NULL DEFAULT '0',
  `inquiryCount` int NOT NULL DEFAULT '0',
  `isTrending` tinyint NOT NULL DEFAULT '0',
  `updatedAt` datetime(6) NOT NULL DEFAULT CURRENT_TIMESTAMP(6) ON UPDATE CURRENT_TIMESTAMP(6),
  PRIMARY KEY (`id`),
  KEY `IDX_8c4ce0ef00861226790434b717` (`entityType`),
  KEY `IDX_2f1e7d57a995002d22c00715dc` (`parentName`),
  KEY `IDX_9f5fe3546c6af7a87e40399840` (`isTrending`),
  KEY `IDX_888e410d74d7d7c158abc70add` (`entityType`,`isTrending`),
  KEY `IDX_8065fb594a7d977a053732d8b8` (`entityType`,`parentName`,`rank`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_0900_ai_ci;
/*!40101 SET character_set_client = @saved_cs_client */;

--
-- Table structure for table `top_projects_cache`
--

DROP TABLE IF EXISTS `top_projects_cache`;
/*!40101 SET @saved_cs_client     = @@character_set_client */;
/*!50503 SET character_set_client = utf8mb4 */;
CREATE TABLE `top_projects_cache` (
  `id` varchar(36) NOT NULL,
  `propertyId` varchar(36) NOT NULL,
  `score` decimal(12,4) NOT NULL DEFAULT '0.0000',
  `rank` int NOT NULL DEFAULT '0',
  `viewsCount` int NOT NULL DEFAULT '0',
  `inquiriesCount` int NOT NULL DEFAULT '0',
  `country` varchar(100) DEFAULT NULL,
  `state` varchar(100) DEFAULT NULL,
  `city` varchar(100) DEFAULT NULL,
  `updatedAt` datetime(6) NOT NULL DEFAULT CURRENT_TIMESTAMP(6) ON UPDATE CURRENT_TIMESTAMP(6),
  PRIMARY KEY (`id`),
  KEY `IDX_92fa5cd0a44f4052d08407d3a9` (`propertyId`),
  KEY `IDX_96ac281d5efeb9e0955429c20b` (`country`,`state`,`city`,`rank`),
  CONSTRAINT `FK_92fa5cd0a44f4052d08407d3a91` FOREIGN KEY (`propertyId`) REFERENCES `properties` (`id`) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_0900_ai_ci;
/*!40101 SET character_set_client = @saved_cs_client */;

--
-- Table structure for table `top_properties_cache`
--

DROP TABLE IF EXISTS `top_properties_cache`;
/*!40101 SET @saved_cs_client     = @@character_set_client */;
/*!50503 SET character_set_client = utf8mb4 */;
CREATE TABLE `top_properties_cache` (
  `id` varchar(36) NOT NULL,
  `propertyId` varchar(36) NOT NULL,
  `score` decimal(12,4) NOT NULL DEFAULT '0.0000',
  `rank` int NOT NULL DEFAULT '0',
  `viewsCount` int NOT NULL DEFAULT '0',
  `inquiriesCount` int NOT NULL DEFAULT '0',
  `savesCount` int NOT NULL DEFAULT '0',
  `tab` varchar(30) NOT NULL DEFAULT 'featured',
  `period` varchar(10) NOT NULL DEFAULT '7d',
  `country` varchar(100) DEFAULT NULL,
  `state` varchar(100) DEFAULT NULL,
  `city` varchar(100) DEFAULT NULL,
  `updatedAt` datetime(6) NOT NULL DEFAULT CURRENT_TIMESTAMP(6) ON UPDATE CURRENT_TIMESTAMP(6),
  PRIMARY KEY (`id`),
  KEY `IDX_eed1749134bf58baf6e41b3bde` (`propertyId`),
  KEY `IDX_4f633d2896bcb0458345958707` (`tab`),
  KEY `IDX_98c7f74b5f13f1eb56fddc8443` (`period`),
  KEY `IDX_02b1cb3e3b2ccb04a3b7a733d2` (`period`,`rank`),
  KEY `IDX_a92c9b68ecfb0cc881cb416b8a` (`country`,`state`,`city`,`period`,`rank`),
  CONSTRAINT `FK_eed1749134bf58baf6e41b3bde0` FOREIGN KEY (`propertyId`) REFERENCES `properties` (`id`) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_0900_ai_ci;
/*!40101 SET character_set_client = @saved_cs_client */;

--
-- Table structure for table `user_behavior`
--

DROP TABLE IF EXISTS `user_behavior`;
/*!40101 SET @saved_cs_client     = @@character_set_client */;
/*!50503 SET character_set_client = utf8mb4 */;
CREATE TABLE `user_behavior` (
  `id` varchar(36) NOT NULL,
  `userId` varchar(36) DEFAULT NULL,
  `propertyId` varchar(36) NOT NULL,
  `eventType` enum('view','long_stay','wishlist','contact','inquiry','scroll_deep','image_click','share') NOT NULL,
  `duration` int DEFAULT NULL,
  `score` int NOT NULL DEFAULT '0',
  `cumulativeScore` int NOT NULL DEFAULT '0',
  `sessionId` varchar(100) DEFAULT NULL,
  `ipAddress` varchar(50) DEFAULT NULL,
  `createdAt` datetime(6) NOT NULL DEFAULT CURRENT_TIMESTAMP(6),
  PRIMARY KEY (`id`),
  KEY `IDX_b2ca702327682b452506a0a1d4` (`userId`),
  KEY `IDX_cf1d9826e4d0d21448f8a4579a` (`propertyId`),
  KEY `idx_user_behavior_session` (`sessionId`),
  KEY `idx_user_behavior_property` (`propertyId`),
  KEY `idx_user_behavior_user` (`userId`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_0900_ai_ci;
/*!40101 SET character_set_client = @saved_cs_client */;

--
-- Table structure for table `users`
--

DROP TABLE IF EXISTS `users`;
/*!40101 SET @saved_cs_client     = @@character_set_client */;
/*!50503 SET character_set_client = utf8mb4 */;
CREATE TABLE `users` (
  `id` varchar(36) NOT NULL,
  `name` varchar(100) NOT NULL,
  `email` varchar(150) NOT NULL,
  `phone` varchar(15) DEFAULT NULL,
  `password` varchar(255) NOT NULL,
  `role` enum('buyer','owner','seller','agent','broker','admin','super_admin') NOT NULL DEFAULT 'buyer',
  `avatar` varchar(500) DEFAULT NULL,
  `company` varchar(200) DEFAULT NULL,
  `city` varchar(100) DEFAULT NULL,
  `state` varchar(100) DEFAULT NULL,
  `stateId` varchar(36) DEFAULT NULL,
  `cityId` varchar(36) DEFAULT NULL,
  `isActive` tinyint NOT NULL DEFAULT '1',
  `isVerified` tinyint NOT NULL DEFAULT '0',
  `agentLicense` varchar(100) DEFAULT NULL,
  `agentBio` text,
  `agentExperience` int DEFAULT NULL,
  `agentRating` decimal(3,1) DEFAULT NULL,
  `totalDeals` int NOT NULL DEFAULT '0',
  `agentFreeQuota` int NOT NULL DEFAULT '100',
  `agentUsedQuota` int NOT NULL DEFAULT '0',
  `agentTick` enum('none','verified','bronze','silver','gold') NOT NULL DEFAULT 'none',
  `dailyCreditUsed` int NOT NULL DEFAULT '0',
  `dailyCreditDate` date DEFAULT NULL,
  `createdAt` datetime(6) NOT NULL DEFAULT CURRENT_TIMESTAMP(6),
  `updatedAt` datetime(6) NOT NULL DEFAULT CURRENT_TIMESTAMP(6) ON UPDATE CURRENT_TIMESTAMP(6),
  `needsOnboarding` tinyint NOT NULL DEFAULT '0',
  `refreshToken` varchar(500) DEFAULT NULL,
  `failedLoginAttempts` int NOT NULL DEFAULT '0',
  `lockedUntil` datetime DEFAULT NULL,
  `lastLoginAt` datetime DEFAULT NULL,
  `pendingAvatar` varchar(500) DEFAULT NULL,
  `agentGstNumber` varchar(20) DEFAULT NULL,
  `agentProfileStatus` enum('none','pending','approved','inactive') NOT NULL DEFAULT 'none',
  `isSuperAdmin` tinyint(1) NOT NULL DEFAULT '0',
  `systemRoleId` varchar(36) DEFAULT NULL,
  PRIMARY KEY (`id`),
  UNIQUE KEY `IDX_97672ac88f789774dd47f7c8be` (`email`),
  KEY `IDX_e3cea2bab91d2c1aa999da6780` (`systemRoleId`),
  CONSTRAINT `FK_e3cea2bab91d2c1aa999da67804` FOREIGN KEY (`systemRoleId`) REFERENCES `roles` (`id`) ON DELETE SET NULL
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_0900_ai_ci;
/*!40101 SET character_set_client = @saved_cs_client */;

--
-- Table structure for table `wallet_transactions`
--

DROP TABLE IF EXISTS `wallet_transactions`;
/*!40101 SET @saved_cs_client     = @@character_set_client */;
/*!50503 SET character_set_client = utf8mb4 */;
CREATE TABLE `wallet_transactions` (
  `id` varchar(36) NOT NULL,
  `wallet_id` varchar(255) NOT NULL,
  `type` enum('credit','debit','bonus','refund') NOT NULL,
  `reason` enum('welcome_bonus','boost_property','subscription','admin_credit','admin_debit','refund','payment') NOT NULL,
  `amount` decimal(10,2) NOT NULL,
  `balanceBefore` decimal(10,2) NOT NULL,
  `balanceAfter` decimal(10,2) NOT NULL,
  `description` varchar(255) DEFAULT NULL,
  `referenceId` varchar(255) DEFAULT NULL,
  `referenceType` varchar(255) DEFAULT NULL,
  `createdAt` datetime(6) NOT NULL DEFAULT CURRENT_TIMESTAMP(6),
  PRIMARY KEY (`id`),
  KEY `FK_c57d19129968160f4db28fc8b28` (`wallet_id`),
  CONSTRAINT `FK_c57d19129968160f4db28fc8b28` FOREIGN KEY (`wallet_id`) REFERENCES `wallets` (`id`) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_0900_ai_ci;
/*!40101 SET character_set_client = @saved_cs_client */;

--
-- Table structure for table `wallets`
--

DROP TABLE IF EXISTS `wallets`;
/*!40101 SET @saved_cs_client     = @@character_set_client */;
/*!50503 SET character_set_client = utf8mb4 */;
CREATE TABLE `wallets` (
  `id` varchar(36) NOT NULL,
  `user_id` varchar(255) NOT NULL,
  `balance` decimal(10,2) NOT NULL DEFAULT '100.00',
  `totalEarned` decimal(10,2) NOT NULL DEFAULT '0.00',
  `totalSpent` decimal(10,2) NOT NULL DEFAULT '0.00',
  `createdAt` datetime(6) NOT NULL DEFAULT CURRENT_TIMESTAMP(6),
  `updatedAt` datetime(6) NOT NULL DEFAULT CURRENT_TIMESTAMP(6) ON UPDATE CURRENT_TIMESTAMP(6),
  PRIMARY KEY (`id`),
  UNIQUE KEY `REL_92558c08091598f7a4439586cd` (`user_id`),
  CONSTRAINT `FK_92558c08091598f7a4439586cda` FOREIGN KEY (`user_id`) REFERENCES `users` (`id`) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_0900_ai_ci;
/*!40101 SET character_set_client = @saved_cs_client */;

--
-- Dumping routines for database 'realestate_db'
--
/*!40103 SET TIME_ZONE=@OLD_TIME_ZONE */;

/*!40101 SET SQL_MODE=@OLD_SQL_MODE */;
/*!40014 SET FOREIGN_KEY_CHECKS=@OLD_FOREIGN_KEY_CHECKS */;
/*!40014 SET UNIQUE_CHECKS=@OLD_UNIQUE_CHECKS */;
/*!40101 SET CHARACTER_SET_CLIENT=@OLD_CHARACTER_SET_CLIENT */;
/*!40101 SET CHARACTER_SET_RESULTS=@OLD_CHARACTER_SET_RESULTS */;
/*!40101 SET COLLATION_CONNECTION=@OLD_COLLATION_CONNECTION */;
/*!40111 SET SQL_NOTES=@OLD_SQL_NOTES */;

-- Dump completed on 2026-03-27 22:41:14
