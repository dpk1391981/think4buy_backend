-- Migration: Add property_status_history table
-- Run this on production BEFORE deploying the backend build that includes
-- AdminService.approveProperty / rejectProperty status history tracking.

CREATE TABLE IF NOT EXISTS `property_status_history` (
  `id`            VARCHAR(36)  NOT NULL DEFAULT (UUID()),
  `propertyId`    VARCHAR(36)  NOT NULL,
  `oldStatus`     VARCHAR(50)  NULL,
  `newStatus`     VARCHAR(50)  NOT NULL,
  `updatedBy`     VARCHAR(36)  NULL,
  `updatedByRole` VARCHAR(50)  NULL,
  `note`          TEXT         NULL,
  `createdAt`     DATETIME(6)  NOT NULL DEFAULT CURRENT_TIMESTAMP(6),
  PRIMARY KEY (`id`),
  INDEX `idx_psh_propertyId` (`propertyId`),
  INDEX `idx_psh_createdAt` (`createdAt`),
  CONSTRAINT `fk_psh_property`
    FOREIGN KEY (`propertyId`) REFERENCES `properties`(`id`) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
