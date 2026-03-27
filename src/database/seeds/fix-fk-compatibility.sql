-- ============================================================
--  Fix FK incompatibility between users.systemRoleId → roles.id
-- ============================================================

SET NAMES utf8mb4;
SET FOREIGN_KEY_CHECKS = 0;

-- 1. Ensure roles.id is VARCHAR(36) utf8mb4_unicode_ci
ALTER TABLE `roles`
  MODIFY COLUMN `id` VARCHAR(36)
    CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci NOT NULL;

-- 2. Ensure users.systemRoleId matches exactly
ALTER TABLE `users`
  MODIFY COLUMN `systemRoleId` VARCHAR(36)
    CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci NULL DEFAULT NULL;

SET FOREIGN_KEY_CHECKS = 1;
