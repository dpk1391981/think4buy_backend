-- ============================================================================
-- Repair orphan rows in property_status_history
-- ============================================================================
-- Symptom: the backend cannot connect to the database at all. TypeORM
-- `synchronize` (on whenever NODE_ENV !== 'production', see app.module.ts)
-- tries to add the FK that the entity declares:
--
--   ALTER TABLE property_status_history
--     ADD CONSTRAINT FK_719a3ff5337146817e9cb785a8a
--     FOREIGN KEY (propertyId) REFERENCES properties(id) ON DELETE CASCADE
--
-- and MySQL rejects it:
--
--   Cannot add or update a child row: a foreign key constraint fails
--
-- Cause: rows whose propertyId points at a property that no longer exists.
-- The properties were hard-deleted back when this table had no FK, so nothing
-- cascaded. Because the constraint is declared ON DELETE CASCADE, these rows
-- would never have survived had the FK been in place — deleting them restores
-- exactly the state the schema intends, it does not discard live audit history.
--
-- Rollback: the rows are dumped before deletion, see the backup note below.
--
--   mysql -u <user> -p <db> < migrations/2026-08-13_fix_orphan_status_history.sql
--
-- Safe to re-run: a second run deletes nothing.
-- ============================================================================

-- ── 1. What is about to be removed ──────────────────────────────────────────
-- Inspect before committing. Take a dump of anything listed here that you want
-- to keep:
--   mysqldump -u <user> -p <db> property_status_history > psh.backup.sql

SELECT h.id, h.propertyId, h.oldStatus, h.newStatus, h.updatedByRole, h.createdAt
FROM property_status_history h
LEFT JOIN properties p ON p.id = h.propertyId
WHERE p.id IS NULL;

-- ── 2. Delete the orphans ───────────────────────────────────────────────────

DELETE h FROM property_status_history h
LEFT JOIN properties p ON p.id = h.propertyId
WHERE p.id IS NULL;

-- ── 3. Confirm none remain ──────────────────────────────────────────────────
-- Must report 0. If it does not, the FK will still fail to apply.

SELECT COUNT(*) AS remaining_orphans
FROM property_status_history h
LEFT JOIN properties p ON p.id = h.propertyId
WHERE p.id IS NULL;
