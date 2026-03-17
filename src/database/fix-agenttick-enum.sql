-- ============================================================
-- Fix: Remap old agentTick enum values before schema sync
-- Run this ONCE on production before restarting the app.
--
-- Old enum: ('none','verified','bronze','silver','gold','diamond','blue')
-- New enum: ('none','verified','bronze','silver','gold')
-- ============================================================

-- Step 1: Expand enum to include ALL old + new values so ALTER is safe
ALTER TABLE `users`
  CHANGE `agentTick` `agentTick`
  ENUM('none','verified','bronze','silver','gold','diamond','blue')
  NOT NULL DEFAULT 'none';

-- Step 2: Remap old values to new equivalents
UPDATE `users` SET `agentTick` = 'gold'     WHERE `agentTick` = 'diamond';
UPDATE `users` SET `agentTick` = 'verified' WHERE `agentTick` = 'blue';

-- Step 3: Shrink enum back to final values (now all rows are compatible)
ALTER TABLE `users`
  CHANGE `agentTick` `agentTick`
  ENUM('none','verified','bronze','silver','gold')
  NOT NULL DEFAULT 'none';

SELECT 'agentTick fix complete.' AS status;
SELECT agentTick, COUNT(*) AS cnt FROM `users` GROUP BY agentTick;
