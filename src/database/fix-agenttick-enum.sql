-- ============================================================
-- Fix: Remap old badge enum values before schema sync
-- Run this ONCE on production before restarting the app.
--
-- Old values: diamond, blue  →  New values: gold, verified
-- ============================================================

-- ── users.agentTick ─────────────────────────────────────────

-- Step 1: Expand to include old values (safe - no rows dropped)
ALTER TABLE `users`
  CHANGE `agentTick` `agentTick`
  ENUM('none','verified','bronze','silver','gold','diamond','blue')
  NOT NULL DEFAULT 'none';

-- Step 2: Remap
UPDATE `users` SET `agentTick` = 'gold'     WHERE `agentTick` = 'diamond';
UPDATE `users` SET `agentTick` = 'verified' WHERE `agentTick` = 'blue';

-- Step 3: Shrink to final enum
ALTER TABLE `users`
  CHANGE `agentTick` `agentTick`
  ENUM('none','verified','bronze','silver','gold')
  NOT NULL DEFAULT 'none';


-- ── agent_profiles.tick ─────────────────────────────────────

-- Step 1: Expand
ALTER TABLE `agent_profiles`
  CHANGE `tick` `tick`
  ENUM('none','verified','bronze','silver','gold','diamond','blue')
  NOT NULL DEFAULT 'none';

-- Step 2: Remap
UPDATE `agent_profiles` SET `tick` = 'gold'     WHERE `tick` = 'diamond';
UPDATE `agent_profiles` SET `tick` = 'verified' WHERE `tick` = 'blue';

-- Step 3: Shrink
ALTER TABLE `agent_profiles`
  CHANGE `tick` `tick`
  ENUM('none','verified','bronze','silver','gold')
  NOT NULL DEFAULT 'none';


-- ── Verify ──────────────────────────────────────────────────
SELECT 'users.agentTick' AS tbl, agentTick AS val, COUNT(*) AS cnt FROM `users` GROUP BY agentTick
UNION ALL
SELECT 'agent_profiles.tick', tick, COUNT(*) FROM `agent_profiles` GROUP BY tick;
