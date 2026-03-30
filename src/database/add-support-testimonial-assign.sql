-- Migration: Extend support_tickets with testimonial, assignment and ticket-number columns
-- Each statement wrapped in a procedure to safely skip already-existing columns

DROP PROCEDURE IF EXISTS add_support_columns;

DELIMITER $$
CREATE PROCEDURE add_support_columns()
BEGIN
  -- showAsTestimonial
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_schema = DATABASE() AND table_name = 'support_tickets' AND column_name = 'showAsTestimonial'
  ) THEN
    ALTER TABLE support_tickets
      ADD COLUMN showAsTestimonial TINYINT(1) NOT NULL DEFAULT 0
        COMMENT 'Feedback only — 1 = published on homepage testimonials';
  END IF;

  -- assignedToId
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_schema = DATABASE() AND table_name = 'support_tickets' AND column_name = 'assignedToId'
  ) THEN
    ALTER TABLE support_tickets
      ADD COLUMN assignedToId VARCHAR(36) NULL
        COMMENT 'Staff/admin user id this complaint is assigned to';
  END IF;

  -- assignedToName
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_schema = DATABASE() AND table_name = 'support_tickets' AND column_name = 'assignedToName'
  ) THEN
    ALTER TABLE support_tickets
      ADD COLUMN assignedToName VARCHAR(100) NULL
        COMMENT 'Denormalized display name of assigned member';
  END IF;

  -- ticketNumber
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_schema = DATABASE() AND table_name = 'support_tickets' AND column_name = 'ticketNumber'
  ) THEN
    ALTER TABLE support_tickets
      ADD COLUMN ticketNumber VARCHAR(30) NULL
        COMMENT 'Human-readable ticket ref: TKT-YYYYMMDD-NNNN';
  END IF;

  -- resolvedAt
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_schema = DATABASE() AND table_name = 'support_tickets' AND column_name = 'resolvedAt'
  ) THEN
    ALTER TABLE support_tickets
      ADD COLUMN resolvedAt DATETIME NULL
        COMMENT 'Timestamp when ticket was resolved or closed';
  END IF;

  -- Unique index on ticketNumber
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.statistics
    WHERE table_schema = DATABASE() AND table_name = 'support_tickets' AND index_name = 'idx_support_ticket_number'
  ) THEN
    ALTER TABLE support_tickets
      ADD UNIQUE INDEX idx_support_ticket_number (ticketNumber);
  END IF;

  -- Index for fast testimonial lookups
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.statistics
    WHERE table_schema = DATABASE() AND table_name = 'support_tickets' AND index_name = 'idx_support_testimonial'
  ) THEN
    ALTER TABLE support_tickets
      ADD INDEX idx_support_testimonial (type, showAsTestimonial);
  END IF;
END$$
DELIMITER ;

CALL add_support_columns();
DROP PROCEDURE IF EXISTS add_support_columns;
