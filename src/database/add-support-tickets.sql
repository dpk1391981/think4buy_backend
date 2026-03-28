-- Migration: Create support_tickets table
-- Safe to re-run (CREATE TABLE IF NOT EXISTS)

CREATE TABLE IF NOT EXISTS support_tickets (
  id          VARCHAR(36)  NOT NULL DEFAULT (UUID()),
  userId      VARCHAR(36)  NULL,
  name        VARCHAR(100) NOT NULL,
  email       VARCHAR(150) NULL,
  phone       VARCHAR(20)  NULL,
  type        ENUM('help','feedback') NOT NULL,
  category    VARCHAR(60)  NULL,
  subject     VARCHAR(200) NULL,
  message     TEXT         NOT NULL,
  rating      TINYINT UNSIGNED NULL COMMENT '1-5, only for feedback type',
  status      ENUM('open','in_review','resolved','closed') NOT NULL DEFAULT 'open',
  adminNotes  TEXT         NULL,
  createdAt   DATETIME(6)  NOT NULL DEFAULT CURRENT_TIMESTAMP(6),
  updatedAt   DATETIME(6)  NOT NULL DEFAULT CURRENT_TIMESTAMP(6) ON UPDATE CURRENT_TIMESTAMP(6),
  PRIMARY KEY (id),
  INDEX idx_support_status_created (status, createdAt),
  INDEX idx_support_userId (userId),
  INDEX idx_support_type (type)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
