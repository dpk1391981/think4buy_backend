-- ─── Dynamic Fields Architecture Notes ───────────────────────────────────────
--
-- The system uses TWO storage mechanisms for property fields:
--
-- 1. STATIC COLUMNS — fields that exist as dedicated columns on the `properties` table:
--    society, builderName, reraNumber, bedrooms, bathrooms, price, area, city, locality, etc.
--    These are sent explicitly in the API payload and stored directly.
--
-- 2. DYNAMIC FIELDS (extraDetails JSON) — flexible key-value pairs for type-specific fields:
--    - Field definitions managed via `prop_type_fields` table (admin-configurable)
--    - Values stored in `properties.extraDetails` JSON column
--    - Examples: carpet_area, floor_number, project_name, plot_length, industrial specs, etc.
--
-- NO schema migration is needed for society/builderName/reraNumber — these columns
-- already exist on the `properties` table. The bug was that the frontend was not
-- including them in the API payload.
--
-- ─── Backfill: extract society/builderName from extraDetails if accidentally stored there ─────
--
-- If any properties had society_name stored in extraDetails instead of the society column,
-- run this to backfill:
--
UPDATE properties
SET society = JSON_UNQUOTE(JSON_EXTRACT(extraDetails, '$.society_name'))
WHERE
  (society IS NULL OR society = '')
  AND JSON_EXTRACT(extraDetails, '$.society_name') IS NOT NULL;

-- Remove the duplicate key from extraDetails after backfill:
UPDATE properties
SET extraDetails = JSON_REMOVE(extraDetails, '$.society_name')
WHERE
  society IS NOT NULL AND society != ''
  AND JSON_EXTRACT(extraDetails, '$.society_name') IS NOT NULL;

-- Similarly for builder_name if it ended up in extraDetails:
UPDATE properties
SET builderName = JSON_UNQUOTE(JSON_EXTRACT(extraDetails, '$.builder_name'))
WHERE
  (builderName IS NULL OR builderName = '')
  AND JSON_EXTRACT(extraDetails, '$.builder_name') IS NOT NULL;

UPDATE properties
SET extraDetails = JSON_REMOVE(extraDetails, '$.builder_name')
WHERE
  builderName IS NOT NULL AND builderName != ''
  AND JSON_EXTRACT(extraDetails, '$.builder_name') IS NOT NULL;

-- ─── Verify the prop_type_fields table has society_name (if used as a dynamic field) ─────
-- If society_name was added as a PropTypeField row, it would live in extraDetails.
-- After the fix, it now maps to the dedicated `society` column instead.
-- The admin should REMOVE any PropTypeField row with fieldName='society_name' to avoid
-- redundancy:
--
-- DELETE FROM prop_type_fields WHERE fieldName = 'society_name';
--
-- ─── Indexes already present ─────────────────────────────────────────────────
-- properties.society — used in search queries (LIKE), consider adding index if not present:
--
-- CREATE INDEX idx_properties_society ON properties (society(100));
-- CREATE INDEX idx_properties_builderName ON properties (builderName(100));
