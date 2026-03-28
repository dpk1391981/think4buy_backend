-- ─────────────────────────────────────────────────────────────────────────────
-- Migration: Media Processing Pipeline + System Config
-- Run in production (synchronize=false)
-- ─────────────────────────────────────────────────────────────────────────────

-- 1. system_configs ────────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS `system_configs` (
  `id`          VARCHAR(36)  NOT NULL DEFAULT (UUID()),
  `key`         VARCHAR(100) NOT NULL,
  `value`       TEXT         NOT NULL,
  `valueType`   ENUM('boolean','string','number','json') NOT NULL DEFAULT 'boolean',
  `description` VARCHAR(500) NULL,
  `group`       VARCHAR(50)  NOT NULL DEFAULT 'general',
  `isSecret`    TINYINT(1)   NOT NULL DEFAULT 0,
  `createdAt`   DATETIME(6)  NOT NULL DEFAULT CURRENT_TIMESTAMP(6),
  `updatedAt`   DATETIME(6)  NOT NULL DEFAULT CURRENT_TIMESTAMP(6) ON UPDATE CURRENT_TIMESTAMP(6),
  PRIMARY KEY (`id`),
  UNIQUE KEY `UQ_system_configs_key` (`key`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

-- Seed defaults
INSERT IGNORE INTO `system_configs` (`key`, `value`, `valueType`, `description`, `group`) VALUES
  ('ENABLE_PROPERTY_VIDEO_UPLOAD',  'false', 'boolean', 'Allow video uploads with property listings', 'media'),
  ('ENABLE_IMAGE_ASYNC_PROCESSING', 'true',  'boolean', 'Process images asynchronously via BullMQ', 'media'),
  ('MAX_IMAGES_PER_PROPERTY',       '20',    'number',  'Maximum images per property listing', 'media'),
  ('MAX_VIDEO_SIZE_MB',             '100',   'number',  'Maximum video file size in MB', 'media'),
  ('ENABLE_DB_REPLICA',             'false', 'boolean', 'Route reads to MySQL read replica', 'database'),
  ('ENABLE_CDN',                    'false', 'boolean', 'Serve media via CloudFront CDN', 'storage'),
  ('MAINTENANCE_MODE',              'false', 'boolean', 'Return 503 for all non-admin requests', 'general');

-- 2. media_jobs ────────────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS `media_jobs` (
  `id`                VARCHAR(36)   NOT NULL DEFAULT (UUID()),
  `type`              ENUM('image','video') NOT NULL,
  `status`            ENUM('queued','processing','completed','failed') NOT NULL DEFAULT 'queued',
  `originalPath`      VARCHAR(1000) NOT NULL,
  `outputs`           JSON          NULL,
  `entityType`        VARCHAR(100)  NULL,
  `entityId`          VARCHAR(36)   NULL,
  `userId`            VARCHAR(36)   NULL,
  `queueJobId`        VARCHAR(100)  NULL,
  `attemptCount`      INT UNSIGNED  NOT NULL DEFAULT 0,
  `errorMessage`      TEXT          NULL,
  `processingMs`      INT UNSIGNED  NULL,
  `originalSizeBytes` BIGINT UNSIGNED NULL,
  `createdAt`         DATETIME(6)   NOT NULL DEFAULT CURRENT_TIMESTAMP(6),
  `updatedAt`         DATETIME(6)   NOT NULL DEFAULT CURRENT_TIMESTAMP(6) ON UPDATE CURRENT_TIMESTAMP(6),
  PRIMARY KEY (`id`),
  INDEX `IDX_media_jobs_status`     (`status`),
  INDEX `IDX_media_jobs_type`       (`type`),
  INDEX `IDX_media_jobs_entityId`   (`entityId`),
  INDEX `IDX_media_jobs_createdAt`  (`createdAt`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

-- 3. property_images — add async processing columns ───────────────────────────
ALTER TABLE `property_images`
  ADD COLUMN IF NOT EXISTS `thumbnailUrl`     VARCHAR(500) NULL AFTER `url`,
  ADD COLUMN IF NOT EXISTS `mediumUrl`        VARCHAR(500) NULL AFTER `thumbnailUrl`,
  ADD COLUMN IF NOT EXISTS `mediaType`        ENUM('image','video') NOT NULL DEFAULT 'image' AFTER `alt`,
  ADD COLUMN IF NOT EXISTS `processingStatus` ENUM('pending','queued','processed','failed') NOT NULL DEFAULT 'pending' AFTER `mediaType`,
  ADD COLUMN IF NOT EXISTS `mediaJobId`       VARCHAR(36)  NULL AFTER `processingStatus`;

-- Index for polling unprocessed images
CREATE INDEX IF NOT EXISTS `IDX_property_images_processingStatus`
  ON `property_images` (`processingStatus`);

-- 4. RBAC permissions for new admin pages ────────────────────────────────────
INSERT IGNORE INTO `permissions` (`name`, `resource`, `action`, `description`)
VALUES
  ('system_config.read',        'system_config',   'read',   'View system configuration'),
  ('system_config.write',       'system_config',   'write',  'Update system configuration'),
  ('media_processing.read',     'media_processing','read',   'View media processing queue'),
  ('media_processing.manage',   'media_processing','manage', 'Retry/delete media jobs');

-- Grant to admin role (assuming role_id=1 is admin)
INSERT IGNORE INTO `role_permissions` (`roleId`, `permissionId`)
SELECT 1, `id` FROM `permissions`
WHERE `name` IN (
  'system_config.read', 'system_config.write',
  'media_processing.read', 'media_processing.manage'
);
