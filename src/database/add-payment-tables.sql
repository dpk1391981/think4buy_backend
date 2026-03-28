-- ============================================================
-- Payment System Migration
-- Run this script ONCE on production after deploying the code.
-- Development uses synchronize:true so TypeORM handles it.
-- ============================================================

-- ─── payment_gateways ─────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS `payment_gateways` (
  `id`           VARCHAR(36)  NOT NULL DEFAULT (UUID()),
  `name`         ENUM('razorpay','stripe','paypal') NOT NULL,
  `displayName`  VARCHAR(100) NOT NULL,
  `status`       ENUM('active','inactive') NOT NULL DEFAULT 'inactive',
  `config`       LONGTEXT     NOT NULL COMMENT 'AES-256-GCM encrypted JSON of gateway credentials',
  `priority`     INT          NOT NULL DEFAULT 10,
  `isTestMode`   TINYINT(1)   NOT NULL DEFAULT 0,
  `createdAt`    DATETIME(6)  NOT NULL DEFAULT CURRENT_TIMESTAMP(6),
  `updatedAt`    DATETIME(6)  NOT NULL DEFAULT CURRENT_TIMESTAMP(6) ON UPDATE CURRENT_TIMESTAMP(6),
  PRIMARY KEY (`id`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- ─── payment_transactions ──────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS `payment_transactions` (
  `id`                  VARCHAR(36)     NOT NULL DEFAULT (UUID()),
  `idempotencyKey`      VARCHAR(64)     NOT NULL,
  `user_id`             VARCHAR(36)     NULL,
  `gateway_id`          VARCHAR(36)     NULL,
  `gatewayOrderId`      VARCHAR(255)    NULL COMMENT 'Razorpay order_id / Stripe PaymentIntent id',
  `gatewayPaymentId`    VARCHAR(255)    NULL COMMENT 'Payment confirmation id from gateway',
  `amount`              DECIMAL(10,2)   NOT NULL,
  `currency`            VARCHAR(3)      NOT NULL DEFAULT 'INR',
  `status`              ENUM('initiated','pending','success','failed','refunded','cancelled') NOT NULL DEFAULT 'initiated',
  `type`                ENUM('subscription','token_purchase','boost','property_listing') NOT NULL,
  `mode`                ENUM('real_money','tokens') NOT NULL DEFAULT 'tokens',
  `referenceId`         VARCHAR(255)    NULL,
  `referenceType`       VARCHAR(100)    NULL,
  `metadata`            JSON            NULL,
  `failureReason`       LONGTEXT        NULL,
  `processedAt`         DATETIME        NULL,
  `retryCount`          INT             NOT NULL DEFAULT 0,
  `createdAt`           DATETIME(6)     NOT NULL DEFAULT CURRENT_TIMESTAMP(6),
  `updatedAt`           DATETIME(6)     NOT NULL DEFAULT CURRENT_TIMESTAMP(6) ON UPDATE CURRENT_TIMESTAMP(6),
  PRIMARY KEY (`id`),
  UNIQUE KEY `IDX_PT_idempotency` (`idempotencyKey`),
  KEY `IDX_PT_user`   (`user_id`),
  KEY `IDX_PT_status` (`status`),
  KEY `IDX_PT_gateway` (`gateway_id`),
  CONSTRAINT `FK_PT_user`    FOREIGN KEY (`user_id`)    REFERENCES `users`(`id`)             ON DELETE SET NULL,
  CONSTRAINT `FK_PT_gateway` FOREIGN KEY (`gateway_id`) REFERENCES `payment_gateways`(`id`) ON DELETE SET NULL
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- ─── payment_logs ──────────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS `payment_logs` (
  `id`              VARCHAR(36)     NOT NULL DEFAULT (UUID()),
  `transaction_id`  VARCHAR(36)     NULL,
  `event`           VARCHAR(100)    NOT NULL,
  `source`          ENUM('system','webhook','admin','queue') NOT NULL DEFAULT 'system',
  `level`           ENUM('info','success','warning','error') NOT NULL DEFAULT 'info',
  `payload`         LONGTEXT        NULL COMMENT 'Raw webhook or event payload',
  `signatureValid`  TINYINT(1)      NULL COMMENT 'NULL for non-webhook; true/false for webhook signature',
  `message`         TEXT            NULL,
  `ipAddress`       VARCHAR(64)     NULL,
  `createdAt`       DATETIME(6)     NOT NULL DEFAULT CURRENT_TIMESTAMP(6),
  PRIMARY KEY (`id`),
  KEY `IDX_PL_transaction` (`transaction_id`),
  KEY `IDX_PL_created`     (`createdAt`),
  CONSTRAINT `FK_PL_tx` FOREIGN KEY (`transaction_id`) REFERENCES `payment_transactions`(`id`) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- ─── refunds ───────────────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS `refunds` (
  `id`                 VARCHAR(36)   NOT NULL DEFAULT (UUID()),
  `transaction_id`     VARCHAR(36)   NOT NULL,
  `user_id`            VARCHAR(36)   NULL,
  `amount`             DECIMAL(10,2) NOT NULL,
  `reason`             TEXT          NOT NULL,
  `status`             ENUM('initiated','processing','completed','failed') NOT NULL DEFAULT 'initiated',
  `gatewayRefundId`    VARCHAR(255)  NULL,
  `initiatedBy`        ENUM('admin','system','user') NOT NULL DEFAULT 'admin',
  `initiatorAdminId`   VARCHAR(36)   NULL,
  `failureReason`      LONGTEXT      NULL,
  `processedAt`        DATETIME      NULL,
  `gatewayResponse`    LONGTEXT      NULL COMMENT 'Raw JSON response from gateway',
  `createdAt`          DATETIME(6)   NOT NULL DEFAULT CURRENT_TIMESTAMP(6),
  `updatedAt`          DATETIME(6)   NOT NULL DEFAULT CURRENT_TIMESTAMP(6) ON UPDATE CURRENT_TIMESTAMP(6),
  PRIMARY KEY (`id`),
  KEY `IDX_RF_transaction` (`transaction_id`),
  KEY `IDX_RF_user`        (`user_id`),
  CONSTRAINT `FK_RF_tx`   FOREIGN KEY (`transaction_id`) REFERENCES `payment_transactions`(`id`) ON DELETE RESTRICT,
  CONSTRAINT `FK_RF_user` FOREIGN KEY (`user_id`)        REFERENCES `users`(`id`)               ON DELETE SET NULL
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- ─── Extend users_wallet with real money balance ──────────────────────────────
-- Adds realBalance column to existing wallet table for hybrid token+money tracking
ALTER TABLE `wallets`
  ADD COLUMN IF NOT EXISTS `realBalance`   DECIMAL(10,2) NOT NULL DEFAULT 0.00 COMMENT 'Real money balance (INR)',
  ADD COLUMN IF NOT EXISTS `totalRealEarned` DECIMAL(10,2) NOT NULL DEFAULT 0.00,
  ADD COLUMN IF NOT EXISTS `totalRealSpent`  DECIMAL(10,2) NOT NULL DEFAULT 0.00;

-- ─── Seed: RBAC permissions for payment management ────────────────────────────
INSERT IGNORE INTO `permissions` (`id`, `key`, `name`, `module`, `description`, `isActive`)
VALUES
  (UUID(), 'payment.view',           'View Payments',          'payment', 'View all payment transactions',    1),
  (UUID(), 'payment.refund',         'Issue Refunds',          'payment', 'Initiate refunds for payments',    1),
  (UUID(), 'payment.gateway_manage', 'Manage Payment Gateways','payment', 'Add/update/activate gateways',     1),
  (UUID(), 'payment.export',         'Export Payment Reports', 'payment', 'Export transaction data as CSV',   1),
  (UUID(), 'payment.webhook_view',   'View Webhook Logs',      'payment', 'View gateway webhook event logs',  1);

-- Done.
SELECT 'Payment tables created successfully' AS status;
