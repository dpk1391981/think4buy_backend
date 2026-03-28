-- ============================================================
-- Fix: Update subscription plans to correct values
-- Date: 2026-03-28
-- Run this after add-subscription-system.sql
-- ============================================================

-- ── Basic Plan — update all existing basic rows ───────────────────────────────
UPDATE subscription_plans
SET
  name           = 'Basic Plan',
  price          = 0,
  durationDays   = 36500,
  tokensIncluded = 2000,
  maxListings    = 2000,
  features       = JSON_ARRAY(
                     '2000 property listings',
                     '2000 tokens included',
                     'Standard visibility',
                     'Email support'
                   ),
  isActive       = 1,
  sortOrder      = 0,
  agentBadge     = 'verified',
  updatedAt      = NOW()
WHERE type = 'basic';

-- ── Premium Plan ──────────────────────────────────────────────────────────────
UPDATE subscription_plans
SET
  name           = 'Premium Plan',
  price          = 1999,
  durationDays   = 90,
  tokensIncluded = 5000,
  maxListings    = 5000,
  features       = JSON_ARRAY(
                     '5000 property listings',
                     '5000 tokens included',
                     'Priority listing in search results',
                     'Bronze agent badge',
                     'Email & chat support'
                   ),
  isActive       = 1,
  sortOrder      = 1,
  agentBadge     = 'bronze',
  updatedAt      = NOW()
WHERE type = 'premium';

-- Insert Premium if it didn't exist yet
INSERT INTO subscription_plans
  (id, name, type, price, durationDays, tokensIncluded, maxListings,
   features, isActive, sortOrder, agentBadge, createdAt, updatedAt)
SELECT
  UUID(), 'Premium Plan', 'premium', 1999, 90, 5000, 5000,
  JSON_ARRAY(
    '5000 property listings',
    '5000 tokens included',
    'Priority listing in search results',
    'Bronze agent badge',
    'Email & chat support'
  ),
  1, 1, 'bronze', NOW(), NOW()
WHERE NOT EXISTS (SELECT 1 FROM subscription_plans WHERE type = 'premium');

-- ── Featured Plan ─────────────────────────────────────────────────────────────
UPDATE subscription_plans
SET
  name           = 'Featured Plan',
  price          = 4999,
  durationDays   = 180,
  tokensIncluded = 10000,
  maxListings    = 10000,
  features       = JSON_ARRAY(
                     '10000 property listings',
                     '10000 tokens included',
                     'Top priority in search results',
                     'Featured badge on all listings',
                     'Silver agent badge',
                     'Dedicated support'
                   ),
  isActive       = 1,
  sortOrder      = 2,
  agentBadge     = 'silver',
  updatedAt      = NOW()
WHERE type = 'featured';

INSERT INTO subscription_plans
  (id, name, type, price, durationDays, tokensIncluded, maxListings,
   features, isActive, sortOrder, agentBadge, createdAt, updatedAt)
SELECT
  UUID(), 'Featured Plan', 'featured', 4999, 180, 10000, 10000,
  JSON_ARRAY(
    '10000 property listings',
    '10000 tokens included',
    'Top priority in search results',
    'Featured badge on all listings',
    'Silver agent badge',
    'Dedicated support'
  ),
  1, 2, 'silver', NOW(), NOW()
WHERE NOT EXISTS (SELECT 1 FROM subscription_plans WHERE type = 'featured');

-- ── Enterprise Plan ───────────────────────────────────────────────────────────
UPDATE subscription_plans
SET
  name           = 'Enterprise Plan',
  price          = 9999,
  durationDays   = 365,
  tokensIncluded = 25000,
  maxListings    = 25000,
  features       = JSON_ARRAY(
                     'Unlimited property listings',
                     '25000 tokens included',
                     'Highest priority placement',
                     'Featured badge on all listings',
                     'Gold agent badge',
                     'Personal account manager'
                   ),
  isActive       = 1,
  sortOrder      = 3,
  agentBadge     = 'gold',
  updatedAt      = NOW()
WHERE type = 'enterprise';

INSERT INTO subscription_plans
  (id, name, type, price, durationDays, tokensIncluded, maxListings,
   features, isActive, sortOrder, agentBadge, createdAt, updatedAt)
SELECT
  UUID(), 'Enterprise Plan', 'enterprise', 9999, 365, 25000, 25000,
  JSON_ARRAY(
    'Unlimited property listings',
    '25000 tokens included',
    'Highest priority placement',
    'Featured badge on all listings',
    'Gold agent badge',
    'Personal account manager'
  ),
  1, 3, 'gold', NOW(), NOW()
WHERE NOT EXISTS (SELECT 1 FROM subscription_plans WHERE type = 'enterprise');
