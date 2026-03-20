-- Migration: Add pendingAvatar column to users table
-- Run this on production before deploying the new code.

ALTER TABLE `users`
  ADD COLUMN IF NOT EXISTS `pendingAvatar` varchar(500) NULL DEFAULT NULL AFTER `avatar`;
  