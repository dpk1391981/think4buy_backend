-- ─────────────────────────────────────────────────────────────────────────────
--  footer_seo_links.url — index for the SEO page resolver
-- ─────────────────────────────────────────────────────────────────────────────
--
--  SeoService.resolveListingPageSeo() looks up a page by URL on every listing
--  render. The column had no index, so each render full-scanned the whole
--  table — tens of thousands of rows, on every request.
--
--  Run once against production (synchronize is off there):
--    mysql -u USER -p DBNAME < migrations/2026-08-13_footer_seo_links_url_index.sql
--
--  Safe to re-run: it checks for the index first.
--  varchar(500) utf8mb4 = 2000 bytes, within InnoDB's 3072-byte key limit.

SET @exists := (
  SELECT COUNT(*) FROM information_schema.STATISTICS
  WHERE TABLE_SCHEMA = DATABASE()
    AND TABLE_NAME   = 'footer_seo_links'
    AND INDEX_NAME   = 'IDX_footer_seo_links_url'
);

SET @ddl := IF(
  @exists = 0,
  'CREATE INDEX IDX_footer_seo_links_url ON footer_seo_links (url)',
  'SELECT "IDX_footer_seo_links_url already exists" AS note'
);

PREPARE stmt FROM @ddl;
EXECUTE stmt;
DEALLOCATE PREPARE stmt;
