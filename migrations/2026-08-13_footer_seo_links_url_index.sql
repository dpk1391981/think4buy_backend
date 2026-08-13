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

-- ── Step 1: normalise the stored URLs ────────────────────────────────────────
--
--  Some rows were written with surrounding whitespace or a trailing slash. The
--  resolver used to absorb that with LOWER(TRIM(TRIM(BOTH '/' ...))) around the
--  column, which no index can serve — it cost a full table scan on every page
--  view. Cleaning the data once means the lookup below stays an index seek and
--  those rows still resolve.
--
--  Every URL ends up as exactly '/slug': trimmed, one leading slash, no
--  trailing slash. Matches what SeoService writes via generateQuickSlug().

--  Order matters: strip whitespace, then slashes, then whitespace again, so
--  '/ page /' ends up '/page' and not '/ page '. Same sequence the resolver
--  applies to the incoming slug, so the two always meet.

UPDATE footer_seo_links
   SET url = CONCAT('/', TRIM(TRIM(BOTH '/' FROM TRIM(url))))
 WHERE url <> CONCAT('/', TRIM(TRIM(BOTH '/' FROM TRIM(url))));

-- A duplicate can only appear if two rows differed *only* by whitespace or a
-- trailing slash, in which case they were always the same page. Report them so
-- they can be merged by hand; the index below is non-unique, so they do no harm.
SELECT url, COUNT(*) AS duplicates
  FROM footer_seo_links
 GROUP BY url
HAVING COUNT(*) > 1;

-- ── Step 2: the index ────────────────────────────────────────────────────────

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
