-- Seed listing_filter_configs table
-- Run AFTER the server has restarted (so TypeORM creates the table via synchronize)
-- Usage: mysql -u dpk1391981 -pDpk1391981! realestate_db < seed-listing-filters.sql

DELETE FROM listing_filter_configs;

INSERT INTO listing_filter_configs
  (id, filterKey, label, icon, widgetType, optionsJson, categories, defaultOpen, showOnMobile, isActive, sortOrder, createdAt, updatedAt)
VALUES
  (UUID(), 'budget',           'Budget',              '₹',  'price_range',    NULL, '[]',                                  1, 1, 1,  1, NOW(), NOW()),
  (UUID(), 'bedrooms',         'BHK / Bedrooms',      '🛏️', 'bedroom_select', NULL, '["buy","rent","pg"]',                 1, 1, 1,  2, NOW(), NOW()),
  (UUID(), 'type',             'Property Type',       '🏠', 'property_type',  NULL, '[]',                                  1, 1, 1,  3, NOW(), NOW()),
  (UUID(), 'area',             'Area (sqft)',          '📐', 'area_range',     NULL, '[]',                                  0, 1, 1,  4, NOW(), NOW()),
  (UUID(), 'furnishingStatus', 'Furnishing',          '🛋️', 'option_select',
    '[{"value":"furnished","label":"Furnished"},{"value":"semi_furnished","label":"Semi-Furnished"},{"value":"unfurnished","label":"Unfurnished"}]',
    '["buy","rent","pg"]', 0, 1, 1, 5, NOW(), NOW()),
  (UUID(), 'possessionStatus', 'Possession',          '🔑', 'option_select',
    '[{"value":"ready_to_move","label":"Ready to Move"},{"value":"under_construction","label":"Under Construction"}]',
    '["buy","builder_project","investment"]', 0, 1, 1, 6, NOW(), NOW()),
  (UUID(), 'listedBy',         'Posted By',           '👤', 'option_select',
    '[{"value":"owner","label":"Owner"},{"value":"agent","label":"Agent"},{"value":"builder","label":"Builder"}]',
    '[]', 0, 1, 1, 7, NOW(), NOW()),
  (UUID(), 'amenityIds',       'Amenities',           '✨', 'amenity_picker', NULL, '[]',                                  0, 1, 1,  8, NOW(), NOW()),
  (UUID(), 'builderName',      'Builder / Developer', '🏗️', 'text_input',     NULL, '["buy","builder_project","investment"]', 0, 0, 1, 9, NOW(), NOW()),
  (UUID(), 'isVerified',       'Verified Only',       '✅', 'toggle_boolean', NULL, '[]',                                  0, 1, 1, 10, NOW(), NOW()),
  (UUID(), 'isNewProject',     'New Projects',        '⭐', 'toggle_boolean', NULL, '["buy","builder_project","investment"]', 0, 1, 1, 11, NOW(), NOW());

SELECT filterKey, label, widgetType, isActive, sortOrder FROM listing_filter_configs ORDER BY sortOrder;
