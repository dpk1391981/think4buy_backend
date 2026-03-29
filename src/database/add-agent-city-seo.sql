-- Migration: Add agent_city_seo table
-- Run once to add SEO management for /agents-in-[city] pages

CREATE TABLE IF NOT EXISTS `agent_city_seo` (
  `id`               VARCHAR(36)   NOT NULL DEFAULT (UUID()),
  `city_slug`        VARCHAR(150)  NOT NULL,
  `city_name`        VARCHAR(150)  NOT NULL,
  `slug`             VARCHAR(300)  NOT NULL,
  `h1_title`         VARCHAR(250)  NULL,
  `meta_title`       VARCHAR(250)  NULL,
  `meta_description` VARCHAR(500)  NULL,
  `meta_keywords`    VARCHAR(300)  NULL,
  `canonical_url`    VARCHAR(500)  NULL,
  `intro_content`    TEXT          NULL,
  `bottom_content`   TEXT          NULL,
  `faq_json`         JSON          NULL,
  `og_title`         VARCHAR(250)  NULL,
  `og_description`   VARCHAR(500)  NULL,
  `og_image`         VARCHAR(500)  NULL,
  `schema_json`      TEXT          NULL,
  `robots`           VARCHAR(100)  NULL DEFAULT 'index,follow',
  `is_active`        TINYINT(1)   NOT NULL DEFAULT 1,
  `created_at`       DATETIME(6)  NOT NULL DEFAULT CURRENT_TIMESTAMP(6),
  `updated_at`       DATETIME(6)  NOT NULL DEFAULT CURRENT_TIMESTAMP(6) ON UPDATE CURRENT_TIMESTAMP(6),
  PRIMARY KEY (`id`),
  UNIQUE KEY `UQ_agent_city_seo_city_slug` (`city_slug`),
  UNIQUE KEY `UQ_agent_city_seo_slug` (`slug`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
