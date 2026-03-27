-- ============================================================
--  think4buysale — Super Admin Seeder Bootstrap Schema
--  Run this ONCE on a fresh server before running seed:super-admin
--  All statements use IF NOT EXISTS — safe to re-run
-- ============================================================

SET NAMES utf8mb4;
SET CHARACTER SET utf8mb4;
SET time_zone = '+00:00';

-- ── 1. roles ────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS `roles` (
  `id`          VARCHAR(36)   NOT NULL,
  `name`        VARCHAR(60)   NOT NULL,
  `displayName` VARCHAR(100)  NOT NULL,
  `description` TEXT          NULL,
  `isSystem`    TINYINT(1)    NOT NULL DEFAULT 0,
  `isActive`    TINYINT(1)    NOT NULL DEFAULT 1,
  `level`       INT           NOT NULL DEFAULT 0,
  `createdAt`   DATETIME(6)   NOT NULL DEFAULT CURRENT_TIMESTAMP(6),
  `updatedAt`   DATETIME(6)   NOT NULL DEFAULT CURRENT_TIMESTAMP(6) ON UPDATE CURRENT_TIMESTAMP(6),
  PRIMARY KEY (`id`),
  UNIQUE KEY `UQ_roles_name` (`name`),
  KEY `IDX_roles_name` (`name`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- ── 2. permissions ──────────────────────────────────────────
CREATE TABLE IF NOT EXISTS `permissions` (
  `id`          VARCHAR(36)   NOT NULL,
  `key`         VARCHAR(120)  NOT NULL,
  `name`        VARCHAR(100)  NOT NULL,
  `module`      VARCHAR(60)   NOT NULL,
  `description` TEXT          NULL,
  `isActive`    TINYINT(1)    NOT NULL DEFAULT 1,
  `createdAt`   DATETIME(6)   NOT NULL DEFAULT CURRENT_TIMESTAMP(6),
  `updatedAt`   DATETIME(6)   NOT NULL DEFAULT CURRENT_TIMESTAMP(6) ON UPDATE CURRENT_TIMESTAMP(6),
  PRIMARY KEY (`id`),
  UNIQUE KEY `UQ_permissions_key` (`key`),
  KEY `IDX_permissions_key` (`key`),
  KEY `IDX_permissions_module` (`module`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- ── 3. role_permissions (junction) ─────────────────────────
CREATE TABLE IF NOT EXISTS `role_permissions` (
  `roleId`       VARCHAR(36) NOT NULL,
  `permissionId` VARCHAR(36) NOT NULL,
  PRIMARY KEY (`roleId`, `permissionId`),
  KEY `IDX_role_permissions_roleId`       (`roleId`),
  KEY `IDX_role_permissions_permissionId` (`permissionId`),
  CONSTRAINT `FK_role_permissions_role`
    FOREIGN KEY (`roleId`)       REFERENCES `roles`       (`id`) ON DELETE CASCADE,
  CONSTRAINT `FK_role_permissions_permission`
    FOREIGN KEY (`permissionId`) REFERENCES `permissions` (`id`) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- ── 4. users ────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS `users` (
  `id`                 VARCHAR(36)   NOT NULL,
  `name`               VARCHAR(100)  NOT NULL,
  `email`              VARCHAR(150)  NOT NULL,
  `phone`              VARCHAR(15)   NULL,
  `password`           VARCHAR(255)  NOT NULL,
  `role`               ENUM('buyer','owner','seller','agent','broker','admin','super_admin') NOT NULL DEFAULT 'buyer',
  `isSuperAdmin`       TINYINT(1)    NOT NULL DEFAULT 0,
  `systemRoleId`       VARCHAR(36)   NULL,
  `avatar`             VARCHAR(500)  NULL,
  `pendingAvatar`      VARCHAR(500)  NULL,
  `company`            VARCHAR(200)  NULL,
  `city`               VARCHAR(100)  NULL,
  `state`              VARCHAR(100)  NULL,
  `stateId`            VARCHAR(36)   NULL,
  `cityId`             VARCHAR(36)   NULL,
  `isActive`           TINYINT(1)    NOT NULL DEFAULT 1,
  `isVerified`         TINYINT(1)    NOT NULL DEFAULT 0,
  `needsOnboarding`    TINYINT(1)    NOT NULL DEFAULT 0,
  `agentLicense`       VARCHAR(100)  NULL,
  `agentGstNumber`     VARCHAR(20)   NULL,
  `agentBio`           TEXT          NULL,
  `agentExperience`    INT           NULL,
  `agentRating`        DECIMAL(3,1)  NULL,
  `totalDeals`         INT           NOT NULL DEFAULT 0,
  `agentFreeQuota`     INT           NOT NULL DEFAULT 100,
  `agentUsedQuota`     INT           NOT NULL DEFAULT 0,
  `agentTick`          ENUM('none','verified','bronze','silver','gold') NOT NULL DEFAULT 'none',
  `agentProfileStatus` ENUM('none','pending','approved','inactive')     NOT NULL DEFAULT 'none',
  `dailyCreditUsed`    INT           NOT NULL DEFAULT 0,
  `dailyCreditDate`    DATE          NULL,
  `refreshToken`       VARCHAR(500)  NULL,
  `failedLoginAttempts` INT          NOT NULL DEFAULT 0,
  `lockedUntil`        DATETIME      NULL,
  `lastLoginAt`        DATETIME      NULL,
  `createdAt`          DATETIME(6)   NOT NULL DEFAULT CURRENT_TIMESTAMP(6),
  `updatedAt`          DATETIME(6)   NOT NULL DEFAULT CURRENT_TIMESTAMP(6) ON UPDATE CURRENT_TIMESTAMP(6),
  PRIMARY KEY (`id`),
  UNIQUE KEY `UQ_users_email` (`email`),
  KEY `IDX_users_systemRoleId` (`systemRoleId`),
  CONSTRAINT `FK_users_systemRole`
    FOREIGN KEY (`systemRoleId`) REFERENCES `roles` (`id`) ON DELETE SET NULL
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- ── 5. audit_logs ───────────────────────────────────────────
CREATE TABLE IF NOT EXISTS `audit_logs` (
  `id`         VARCHAR(36)  NOT NULL,
  `actorId`    VARCHAR(36)  NOT NULL,
  `actorName`  VARCHAR(120) NULL,
  `actorRole`  VARCHAR(60)  NULL,
  `action`     VARCHAR(80)  NOT NULL,
  `resource`   VARCHAR(60)  NOT NULL,
  `resourceId` VARCHAR(120) NULL,
  `summary`    TEXT         NULL,
  `before`     JSON         NULL,
  `after`      JSON         NULL,
  `ipAddress`  VARCHAR(50)  NULL,
  `userAgent`  TEXT         NULL,
  `createdAt`  DATETIME(6)  NOT NULL DEFAULT CURRENT_TIMESTAMP(6),
  PRIMARY KEY (`id`),
  KEY `IDX_audit_logs_actorId`   (`actorId`),
  KEY `IDX_audit_logs_action`    (`action`),
  KEY `IDX_audit_logs_resource`  (`resource`),
  KEY `IDX_audit_logs_createdAt` (`createdAt`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- ============================================================
--  Done — now run:  npm run seed:super-admin
-- ============================================================
