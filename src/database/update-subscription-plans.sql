-- ============================================================
-- Fix: Update subscription plans to correct values
-- Date: 2026-03-29
-- Run this after add-subscription-system.sql
--
-- Plan structure (1 token = ₹1):
--   Free       → ₹0,    30 days,  0 tokens,    2000 listings,  badge: none
--   Basic      → ₹499,  30 days,  499 tokens,  5000 listings,  badge: verified
--   Premium    → ₹999,  90 days,  999 tokens,  10000 listings, badge: bronze
--   Featured   → ₹1999, 180 days, 1999 tokens, 10000 listings, badge: silver
--   Enterprise → ₹3999, 365 days, 3999 tokens, unlimited,      badge: gold
-- ============================================================

-- ── Step 1: Add FREE to subscription_plans type enum (if not already present) ──

DROP PROCEDURE IF EXISTS _add_free_plan_type;
DELIMITER $$
CREATE PROCEDURE _add_free_plan_type()
BEGIN
  -- Only ALTER if 'free' is not already in the enum
  IF NOT EXISTS (
    SELECT 1
    FROM   information_schema.COLUMNS
    WHERE  TABLE_SCHEMA  = DATABASE()
      AND  TABLE_NAME    = 'subscription_plans'
      AND  COLUMN_NAME   = 'type'
      AND  COLUMN_TYPE LIKE '%free%'
  ) THEN
    ALTER TABLE subscription_plans
      MODIFY COLUMN type ENUM('free','basic','premium','featured','enterprise') NOT NULL;
  END IF;
END$$
DELIMITER ;
CALL _add_free_plan_type();
DROP PROCEDURE IF EXISTS _add_free_plan_type;

-- ── Step 2: Free Plan ─────────────────────────────────────────────────────────

-- Update if exists
UPDATE subscription_plans
SET
  name           = 'Free Plan',
  price          = 0,
  durationDays   = 30,
  tokensIncluded = 0,
  maxListings    = 2000,
  features       = JSON_ARRAY(
                     '2000 property listings',
                     'Basic visibility',
                     'Email support'
                   ),
  isActive       = 1,
  sortOrder      = 0,
  agentBadge     = 'none',
  updatedAt      = NOW()
WHERE type = 'free';

-- Insert if not exists
INSERT INTO subscription_plans
  (id, name, type, price, durationDays, tokensIncluded, maxListings,
   features, isActive, sortOrder, agentBadge, createdAt, updatedAt)
SELECT
  UUID(), 'Free Plan', 'free', 0, 30, 0, 2000,
  JSON_ARRAY('2000 property listings', 'Basic visibility', 'Email support'),
  1, 0, 'none', NOW(), NOW()
WHERE NOT EXISTS (SELECT 1 FROM subscription_plans WHERE type = 'free');

-- ── Step 3: Basic Plan ────────────────────────────────────────────────────────

UPDATE subscription_plans
SET
  name           = 'Basic Plan',
  price          = 499,
  durationDays   = 30,
  tokensIncluded = 499,
  maxListings    = 5000,
  features       = JSON_ARRAY(
                     '5000 property listings',
                     '499 tokens included (₹499 value)',
                     'Standard visibility',
                     'Verified agent badge',
                     'Email support'
                   ),
  isActive       = 1,
  sortOrder      = 1,
  agentBadge     = 'verified',
  updatedAt      = NOW()
WHERE type = 'basic';

INSERT INTO subscription_plans
  (id, name, type, price, durationDays, tokensIncluded, maxListings,
   features, isActive, sortOrder, agentBadge, createdAt, updatedAt)
SELECT
  UUID(), 'Basic Plan', 'basic', 499, 30, 499, 5000,
  JSON_ARRAY(
    '5000 property listings',
    '499 tokens included (₹499 value)',
    'Standard visibility',
    'Verified agent badge',
    'Email support'
  ),
  1, 1, 'verified', NOW(), NOW()
WHERE NOT EXISTS (SELECT 1 FROM subscription_plans WHERE type = 'basic');

-- ── Step 4: Premium Plan ──────────────────────────────────────────────────────

UPDATE subscription_plans
SET
  name           = 'Premium Plan',
  price          = 999,
  durationDays   = 90,
  tokensIncluded = 999,
  maxListings    = 10000,
  features       = JSON_ARRAY(
                     '10000 property listings',
                     '999 tokens included (₹999 value)',
                     'Priority listing in search results',
                     'Bronze agent badge',
                     'Email & chat support'
                   ),
  isActive       = 1,
  sortOrder      = 2,
  agentBadge     = 'bronze',
  updatedAt      = NOW()
WHERE type = 'premium';

INSERT INTO subscription_plans
  (id, name, type, price, durationDays, tokensIncluded, maxListings,
   features, isActive, sortOrder, agentBadge, createdAt, updatedAt)
SELECT
  UUID(), 'Premium Plan', 'premium', 999, 90, 999, 10000,
  JSON_ARRAY(
    '10000 property listings',
    '999 tokens included (₹999 value)',
    'Priority listing in search results',
    'Bronze agent badge',
    'Email & chat support'
  ),
  1, 2, 'bronze', NOW(), NOW()
WHERE NOT EXISTS (SELECT 1 FROM subscription_plans WHERE type = 'premium');

-- ── Step 5: Featured Plan ─────────────────────────────────────────────────────

UPDATE subscription_plans
SET
  name           = 'Featured Plan',
  price          = 1999,
  durationDays   = 180,
  tokensIncluded = 1999,
  maxListings    = 10000,
  features       = JSON_ARRAY(
                     '10000 property listings',
                     '1999 tokens included (₹1999 value)',
                     'Top priority in search results',
                     'Featured badge on all listings',
                     'Silver agent badge',
                     'Dedicated support'
                   ),
  isActive       = 1,
  sortOrder      = 3,
  agentBadge     = 'silver',
  updatedAt      = NOW()
WHERE type = 'featured';

INSERT INTO subscription_plans
  (id, name, type, price, durationDays, tokensIncluded, maxListings,
   features, isActive, sortOrder, agentBadge, createdAt, updatedAt)
SELECT
  UUID(), 'Featured Plan', 'featured', 1999, 180, 1999, 10000,
  JSON_ARRAY(
    '10000 property listings',
    '1999 tokens included (₹1999 value)',
    'Top priority in search results',
    'Featured badge on all listings',
    'Silver agent badge',
    'Dedicated support'
  ),
  1, 3, 'silver', NOW(), NOW()
WHERE NOT EXISTS (SELECT 1 FROM subscription_plans WHERE type = 'featured');

-- ── Step 6: Enterprise Plan ───────────────────────────────────────────────────

UPDATE subscription_plans
SET
  name           = 'Enterprise Plan',
  price          = 3999,
  durationDays   = 365,
  tokensIncluded = 3999,
  maxListings    = 999999,
  features       = JSON_ARRAY(
                     'Unlimited property listings',
                     '3999 tokens included (₹3999 value)',
                     'Highest priority placement',
                     'Featured badge on all listings',
                     'Gold agent badge',
                     'Personal account manager'
                   ),
  isActive       = 1,
  sortOrder      = 4,
  agentBadge     = 'gold',
  updatedAt      = NOW()
WHERE type = 'enterprise';

INSERT INTO subscription_plans
  (id, name, type, price, durationDays, tokensIncluded, maxListings,
   features, isActive, sortOrder, agentBadge, createdAt, updatedAt)
SELECT
  UUID(), 'Enterprise Plan', 'enterprise', 3999, 365, 3999, 999999,
  JSON_ARRAY(
    'Unlimited property listings',
    '3999 tokens included (₹3999 value)',
    'Highest priority placement',
    'Featured badge on all listings',
    'Gold agent badge',
    'Personal account manager'
  ),
  1, 4, 'gold', NOW(), NOW()
WHERE NOT EXISTS (SELECT 1 FROM subscription_plans WHERE type = 'enterprise');

-- ── Step 7: Seed DEFAULT_REGISTER_PLAN system config ─────────────────────────
-- Replaces the old DEFAULT_REGISTRATION_TOKENS key.
-- Tokens credited on registration = plan.tokensIncluded of the configured plan.
-- Admin can change this in Admin → System Config without a deploy.

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

-- Remove old token-based config (superseded by DEFAULT_REGISTER_PLAN)
DELETE FROM system_configs WHERE `key` = 'DEFAULT_REGISTRATION_TOKENS';
