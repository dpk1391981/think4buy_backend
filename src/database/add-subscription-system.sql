-- ============================================================
-- Migration: Subscription System Enhancement
-- Date: 2026-03-28
-- Description:
--   1. Convert startsAt/expiresAt from TIMESTAMP to DATETIME
--   2. Add usedListings column to agent_subscriptions
--   3. Seed Basic Plan (499 listings / 499 tokens — 1 token = ₹1)
--   4. Backfill existing users without an active subscription
--   5. Sync agentFreeQuota and wallet tokens
--   6. Seed DEFAULT_REGISTRATION_TOKENS system config (499)
-- ============================================================

-- ── Step 1: Convert TIMESTAMP columns to DATETIME ────────────────────────────
-- TIMESTAMP max is 2038-01-19. DATETIME supports up to 9999-12-31.
-- Safe to re-run — MODIFY is idempotent when column is already DATETIME.

ALTER TABLE agent_subscriptions
  MODIFY COLUMN startsAt  DATETIME NOT NULL,
  MODIFY COLUMN expiresAt DATETIME NOT NULL;

-- ── Step 2: Add usedListings column ──────────────────────────────────────────
-- Wrapped in a procedure so re-running is safe (no ADD COLUMN IF NOT EXISTS in older MySQL).

DROP PROCEDURE IF EXISTS _add_used_listings_col;
DELIMITER $$
CREATE PROCEDURE _add_used_listings_col()
BEGIN
  IF NOT EXISTS (
    SELECT 1
    FROM   information_schema.COLUMNS
    WHERE  TABLE_SCHEMA = DATABASE()
      AND  TABLE_NAME   = 'agent_subscriptions'
      AND  COLUMN_NAME  = 'usedListings'
  ) THEN
    ALTER TABLE agent_subscriptions
      ADD COLUMN usedListings INT NOT NULL DEFAULT 0
        COMMENT 'Property listings consumed in this subscription period';
  END IF;
END$$
DELIMITER ;
CALL _add_used_listings_col();
DROP PROCEDURE IF EXISTS _add_used_listings_col;

-- ── Step 3: Seed Free Plan (default registration plan) ───────────────────────
-- INSERT IGNORE is safe to re-run (skips on duplicate unique key).

INSERT IGNORE INTO subscription_plans
  (id, name, type, price, durationDays, tokensIncluded, maxListings, features,
   isActive, sortOrder, agentBadge, createdAt, updatedAt)
VALUES (
  UUID(),
  'Free Plan',
  'free',
  0.00,
  30,
  0,
  2000,
  JSON_ARRAY('2000 property listings', 'Basic visibility', 'Email support'),
  1,
  0,
  'none',
  NOW(),
  NOW()
);

-- ── Step 4: Backfill — give every existing user a Free Plan subscription ──────
-- Only inserts for users with NO active subscription.

INSERT INTO agent_subscriptions
  (id, agentId, planId, status, startsAt, expiresAt, tokensDeducted, usedListings,
   planSnapshot, createdAt)
SELECT
  UUID(),
  u.id,
  (SELECT id FROM subscription_plans
     WHERE type = 'free' AND isActive = 1
     ORDER BY createdAt ASC LIMIT 1),
  'active',
  NOW(),
  DATE_ADD(NOW(), INTERVAL 30 DAY),
  0,
  COALESCE(u.agentUsedQuota, 0),
  JSON_OBJECT(
    'name',           'Free Plan',
    'type',           'free',
    'price',          0,
    'durationDays',   30,
    'maxListings',    2000,
    'tokensIncluded', 0,
    'features',       JSON_ARRAY('2000 property listings', 'Basic visibility', 'Email support'),
    'assignedBy',     'migration'
  ),
  NOW()
FROM users u
WHERE u.role IN ('owner', 'agent', 'buyer', 'broker')
  AND NOT EXISTS (
    SELECT 1 FROM agent_subscriptions sub
    WHERE sub.agentId = u.id
      AND sub.status = 'active'
  );

-- ── Step 5: Sync agentFreeQuota ───────────────────────────────────────────────

UPDATE users
SET agentFreeQuota = 2000
WHERE agentFreeQuota < 2000
  AND role IN ('owner', 'agent', 'buyer', 'broker');

-- ── Step 6: No wallet top-up needed ──────────────────────────────────────────
-- Free Plan has 0 tokens. Users keep their 100-token welcome bonus.
-- No wallet_transactions insert required for migration backfill.

-- ── Step 7: Seed DEFAULT_REGISTER_PLAN system config ─────────────────────────
-- Controls which plan type is assigned to new registrations.
-- Tokens credited = plan.tokensIncluded (no separate token config needed).
-- Admin can change to 'basic', 'premium', etc. from Admin → System Config.

INSERT IGNORE INTO system_configs
  (id, `key`, value, valueType, description, `group`, isSecret, createdAt, updatedAt)
VALUES (
  UUID(),
  'DEFAULT_REGISTER_PLAN',
  'free',
  'string',
  'Plan type assigned on new user registration (free|basic|premium|featured|enterprise). Tokens credited = plan.tokensIncluded.',
  'billing',
  0,
  NOW(),
  NOW()
);

-- Clean up old DEFAULT_REGISTRATION_TOKENS if it exists (superseded by DEFAULT_REGISTER_PLAN)
DELETE FROM system_configs WHERE `key` = 'DEFAULT_REGISTRATION_TOKENS';
