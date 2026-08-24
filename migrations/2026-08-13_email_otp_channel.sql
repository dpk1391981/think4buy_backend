-- ============================================================================
-- Email OTP support for otp_verifications
-- ============================================================================
-- Adds the email channel alongside the existing SMS one. Mobile OTP is switched
-- off at launch (DLT template approval outstanding) and email becomes the live
-- channel, so rows must be able to key on an address instead of a number.
--
-- Run in production only — dev/staging use TypeORM synchronize (app.module.ts).
--
--   mysql -u <user> -p <db> < migrations/2026-08-13_email_otp_channel.sql
--
-- Safe to re-run: every statement is guarded.
-- ============================================================================

-- ── 1. New columns ──────────────────────────────────────────────────────────

SET @add_email := (
  SELECT IF(COUNT(*) = 0,
    'ALTER TABLE otp_verifications ADD COLUMN email VARCHAR(150) NULL AFTER phone',
    'SELECT "otp_verifications.email already exists" AS note')
  FROM information_schema.COLUMNS
  WHERE TABLE_SCHEMA = DATABASE()
    AND TABLE_NAME   = 'otp_verifications'
    AND COLUMN_NAME  = 'email'
);
PREPARE stmt FROM @add_email; EXECUTE stmt; DEALLOCATE PREPARE stmt;

SET @add_channel := (
  SELECT IF(COUNT(*) = 0,
    'ALTER TABLE otp_verifications ADD COLUMN channel VARCHAR(10) NOT NULL DEFAULT ''sms'' AFTER email',
    'SELECT "otp_verifications.channel already exists" AS note')
  FROM information_schema.COLUMNS
  WHERE TABLE_SCHEMA = DATABASE()
    AND TABLE_NAME   = 'otp_verifications'
    AND COLUMN_NAME  = 'channel'
);
PREPARE stmt FROM @add_channel; EXECUTE stmt; DEALLOCATE PREPARE stmt;

-- ── 2. phone becomes nullable ───────────────────────────────────────────────
-- Email-channel rows carry no phone number. Idempotent: MODIFY to the same
-- definition is a no-op.

ALTER TABLE otp_verifications MODIFY COLUMN phone VARCHAR(20) NULL;

-- ── 3. Backfill existing rows ───────────────────────────────────────────────
-- Every pre-existing row was an SMS OTP. The column default already covers
-- rows inserted after step 1, this catches any left blank.

UPDATE otp_verifications SET channel = 'sms' WHERE channel IS NULL OR channel = '';

-- ── 4. Lookup index for the email channel ───────────────────────────────────
-- Mirrors idx_otp_phone_purpose; every verify does a
-- (email, purpose, used) ORDER BY createdAt DESC lookup.

SET @add_idx := (
  SELECT IF(COUNT(*) = 0,
    'CREATE INDEX idx_otp_email_purpose ON otp_verifications (email, purpose)',
    'SELECT "idx_otp_email_purpose already exists" AS note')
  FROM information_schema.STATISTICS
  WHERE TABLE_SCHEMA = DATABASE()
    AND TABLE_NAME   = 'otp_verifications'
    AND INDEX_NAME   = 'idx_otp_email_purpose'
);
PREPARE stmt FROM @add_idx; EXECUTE stmt; DEALLOCATE PREPARE stmt;

-- ── 5. Feature flags ────────────────────────────────────────────────────────
-- ENABLE_MOBILE_OTP = false keeps the SMS path dark until DLT approval; flip it
-- to 'true' in system config (or here) to switch mobile OTP back on with no
-- redeploy. Code defaults are already false/true respectively, so these rows
-- exist to make both flags visible and togglable in the admin UI.
--
-- `id` is a TypeORM uuid PK with no DB-level default, so UUID() supplies it.

INSERT INTO system_configs (`id`, `key`, `value`, `valueType`, `description`, `group`)
SELECT UUID(), 'ENABLE_MOBILE_OTP', 'false', 'boolean',
       'Mobile/SMS OTP login. Off until DLT template approval.', 'auth'
WHERE NOT EXISTS (SELECT 1 FROM system_configs WHERE `key` = 'ENABLE_MOBILE_OTP');

INSERT INTO system_configs (`id`, `key`, `value`, `valueType`, `description`, `group`)
SELECT UUID(), 'ENABLE_EMAIL_OTP', 'true', 'boolean',
       'Email OTP login and registration verification.', 'auth'
WHERE NOT EXISTS (SELECT 1 FROM system_configs WHERE `key` = 'ENABLE_EMAIL_OTP');
