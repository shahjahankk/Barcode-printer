-- LabelPress tables for cPanel DB: petzonep_barcode_printer
-- Use same MySQL user as queue-management. After tables exist: npm run seed

USE petzonep_barcode_printer;

CREATE TABLE IF NOT EXISTS bp_users (
  id            INT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
  username      VARCHAR(64) NOT NULL,
  password_hash VARCHAR(255) NOT NULL,
  role          ENUM('admin', 'warehouse', 'operator') NOT NULL DEFAULT 'operator',
  is_active     TINYINT(1) NOT NULL DEFAULT 1,
  created_at    DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at    DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  UNIQUE KEY uq_bp_users_username (username)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE IF NOT EXISTS bp_settings (
  user_id   INT UNSIGNED NOT NULL PRIMARY KEY,
  next_sku  INT UNSIGNED NOT NULL DEFAULT 1001,
  width_in  DECIMAL(4,2) NOT NULL DEFAULT 2.20,
  height_in DECIMAL(4,2) NOT NULL DEFAULT 1.00,
  updated_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  CONSTRAINT fk_bp_settings_user
    FOREIGN KEY (user_id) REFERENCES bp_users(id) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE IF NOT EXISTS bp_labels (
  id            BIGINT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
  user_id       INT UNSIGNED NOT NULL,
  client_id     VARCHAR(64) NULL,
  product_name  VARCHAR(255) NOT NULL,
  price         VARCHAR(64) NOT NULL DEFAULT '',
  code          VARCHAR(128) NOT NULL,
  format        ENUM('CODE128', 'EAN13', 'UPC') NOT NULL DEFAULT 'CODE128',
  width_in      DECIMAL(4,2) NOT NULL,
  height_in     DECIMAL(4,2) NOT NULL,
  sort_order    INT UNSIGNED NOT NULL DEFAULT 0,
  inventory_item_id VARCHAR(64) NULL,
  created_at    DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at    DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  KEY idx_bp_labels_user (user_id),
  KEY idx_bp_labels_user_code (user_id, code),
  CONSTRAINT fk_bp_labels_user
    FOREIGN KEY (user_id) REFERENCES bp_users(id) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE IF NOT EXISTS bp_sso_tokens (
  id           BIGINT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
  token_hash   CHAR(64) NOT NULL,
  user_id      INT UNSIGNED NOT NULL,
  pos_username VARCHAR(128) NULL,
  pos_role     VARCHAR(64) NULL,
  expires_at   DATETIME NOT NULL,
  used_at      DATETIME NULL,
  created_at   DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  UNIQUE KEY uq_bp_sso_token_hash (token_hash),
  KEY idx_bp_sso_expires (expires_at),
  CONSTRAINT fk_bp_sso_user
    FOREIGN KEY (user_id) REFERENCES bp_users(id) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
