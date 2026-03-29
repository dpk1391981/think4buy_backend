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

-- ── Step 3: Seed Basic Plan ───────────────────────────────────────────────────
-- INSERT IGNORE is safe to re-run (skips on duplicate unique key).
-- Token amount = 499 (1 token = ₹1). Controlled via DEFAULT_REGISTRATION_TOKENS system config.

INSERT IGNORE INTO subscription_plans
  (id, name, type, price, durationDays, tokensIncluded, maxListings, features,
   isActive, sortOrder, agentBadge, createdAt, updatedAt)
VALUES (
  UUID(),
  'Basic Plan',
  'basic',
  0.00,
  36500,
  499,
  499,
  JSON_ARRAY('499 property listings', 'Basic visibility', 'Email support'),
  1,
  0,
  'verified',
  NOW(),
  NOW()
);

-- ── Step 4: Backfill — give every existing user a Basic Plan subscription ────
-- Only inserts for users with NO active subscription.
-- Uses '2099-12-31' as a safe far-future DATETIME value.

INSERT INTO agent_subscriptions
  (id, agentId, planId, status, startsAt, expiresAt, tokensDeducted, usedListings,
   planSnapshot, createdAt)
SELECT
  UUID(),
  u.id,
  (SELECT id FROM subscription_plans
     WHERE type = 'basic' AND isActive = 1
     ORDER BY createdAt ASC LIMIT 1),
  'active',
  NOW(),
  '2099-12-31 23:59:59',
  0,
  COALESCE(u.agentUsedQuota, 0),
  JSON_OBJECT(
    'name',           'Basic Plan',
    'type',           'basic',
    'price',          0,
    'durationDays',   36500,
    'maxListings',    499,
    'tokensIncluded', 499,
    'features',       JSON_ARRAY('499 property listings', 'Basic visibility', 'Email support'),
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
SET agentFreeQuota = 499
WHERE agentFreeQuota < 499
  AND role IN ('owner', 'agent', 'buyer', 'broker');

-- ── Step 6: Credit 399 tokens to wallets that only have the welcome bonus ────
-- Brings balance from 100 → 499 to match the Basic Plan allocation (1 token = ₹1).

INSERT INTO wallet_transactions
  (id, wallet_id, type, reason, amount, balanceBefore, balanceAfter,
   description, referenceType, createdAt)
SELECT
  UUID(),
  w.id,
  'bonus',
  'subscription',
  399,
  w.balance,
  w.balance + 399,
  'Basic Plan tokens (migration backfill)',
  'migration',
  NOW()
FROM wallets w
WHERE w.balance <= 100
  AND EXISTS (
    SELECT 1 FROM users u
    WHERE u.id = w.user_id
      AND u.role IN ('owner', 'agent', 'buyer', 'broker')
  );

UPDATE wallets w
SET
  balance     = balance + 399,
  totalEarned = totalEarned + 399
WHERE w.balance <= 100
  AND EXISTS (
    SELECT 1 FROM users u
    WHERE u.id = w.user_id
      AND u.role IN ('owner', 'agent', 'buyer', 'broker')
  );

-- ── Step 7: Seed DEFAULT_REGISTRATION_TOKENS system config ────────────────────
-- INSERT IGNORE is safe to re-run (unique key on `key` column).

INSERT IGNORE INTO system_configs
  (id, `key`, value, valueType, description, `group`, isSecret, createdAt, updatedAt)
VALUES (
  UUID(),
  'DEFAULT_REGISTRATION_TOKENS',
  '499',
  'number',
  'Tokens credited to Basic Plan on new user registration (1 token = ₹1)',
  'billing',
  0,
  NOW(),
  NOW()
);
