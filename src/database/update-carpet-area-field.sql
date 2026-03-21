-- Migration: Change carpet_area dynamic field from NUMBER to DEPENDENT type
-- This enables dynamic unit selection (Sq.ft. / Sq.m. / Sq.yd.) per property listing
-- Run this on production after deploying the updated frontend

-- Update all carpet_area fields to DEPENDENT type with label options and unit options
-- labelOptions (optionsJson): Carpet Area, Built-up Area, Super Area
-- unitOptions (placeholder):  Sq.ft.|Sq.m.|Sq.yd.

UPDATE prop_type_fields
SET
  fieldType   = 'dependent',
  optionsJson = '["Carpet Area","Built-up Area","Super Area"]',
  placeholder = 'Sq.ft.|Sq.m.|Sq.yd.'
WHERE fieldName = 'carpet_area';

-- Verify
SELECT id, fieldName, fieldLabel, fieldType, placeholder, optionsJson
FROM prop_type_fields
WHERE fieldName = 'carpet_area';
