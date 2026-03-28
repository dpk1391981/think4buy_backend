-- Migration: Add respondedAt to inquiries + avgResponseHours backfill
-- Safe to re-run (all operations are idempotent)

-- Step 1: Add respondedAt column to inquiries (if not exists)
DROP PROCEDURE IF EXISTS add_inquiry_responded_at;
DELIMITER $
CREATE PROCEDURE add_inquiry_responded_at()
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.COLUMNS
    WHERE TABLE_SCHEMA = DATABASE()
      AND TABLE_NAME   = 'inquiries'
      AND COLUMN_NAME  = 'respondedAt'
  ) THEN
    ALTER TABLE inquiries ADD COLUMN respondedAt DATETIME NULL DEFAULT NULL;
    ALTER TABLE inquiries ADD INDEX idx_inquiries_respondedAt (respondedAt);
  END IF;
END $
DELIMITER ;
CALL add_inquiry_responded_at();
DROP PROCEDURE IF EXISTS add_inquiry_responded_at;

-- Step 2: Ensure status column exists on inquiries (may already be present)
DROP PROCEDURE IF EXISTS add_inquiry_status;
DELIMITER $
CREATE PROCEDURE add_inquiry_status()
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.COLUMNS
    WHERE TABLE_SCHEMA = DATABASE()
      AND TABLE_NAME   = 'inquiries'
      AND COLUMN_NAME  = 'status'
  ) THEN
    ALTER TABLE inquiries ADD COLUMN status VARCHAR(20) NOT NULL DEFAULT 'pending';
  END IF;
END $
DELIMITER ;
CALL add_inquiry_status();
DROP PROCEDURE IF EXISTS add_inquiry_status;

-- Step 3: Recalculate avgResponseHours for all agents who have responded inquiries
-- Updates agent_profiles.avgResponseHours based on actual inquiry data
UPDATE agent_profiles ap
SET ap.avgResponseHours = (
  SELECT ROUND(AVG(TIMESTAMPDIFF(SECOND, i.createdAt, i.respondedAt)) / 3600.0, 1)
  FROM inquiries i
  LEFT JOIN properties p ON p.id = i.property_id
  WHERE i.respondedAt IS NOT NULL
    AND (i.agent_id = ap.userId OR p.ownerId = ap.userId)
)
WHERE EXISTS (
  SELECT 1 FROM inquiries i2
  LEFT JOIN properties p2 ON p2.id = i2.property_id
  WHERE i2.respondedAt IS NOT NULL
    AND (i2.agent_id = ap.userId OR p2.ownerId = ap.userId)
);
