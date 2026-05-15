-- ──────────────────────────────────────────────────────────────────────────
-- migration_add_profile_and_modules.sql
-- Idempotent: safe to re-run. Uses SELECT-based conditional ALTER for MySQL 8.
-- Note: mysql2 Node driver does NOT support DELIMITER, so we use prepared
-- statements via a helper query approach.
-- ──────────────────────────────────────────────────────────────────────────

-- ── 1. Conditionally add profile columns to users table ─────────────────
-- We use a SELECT-check-then-ALTER approach that is safe with mysql2.
-- If the column already exists, the ALTER will fail silently in the migration runner.

-- Helper: check and add photo_url
SET @col_exists = (SELECT COUNT(*) FROM INFORMATION_SCHEMA.COLUMNS WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = 'users' AND COLUMN_NAME = 'photo_url');
SET @sql = IF(@col_exists = 0, 'ALTER TABLE users ADD COLUMN photo_url VARCHAR(500) DEFAULT NULL', 'SELECT 1');
PREPARE stmt FROM @sql; EXECUTE stmt; DEALLOCATE PREPARE stmt;

-- Helper: check and add dob
SET @col_exists = (SELECT COUNT(*) FROM INFORMATION_SCHEMA.COLUMNS WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = 'users' AND COLUMN_NAME = 'dob');
SET @sql = IF(@col_exists = 0, 'ALTER TABLE users ADD COLUMN dob DATE DEFAULT NULL', 'SELECT 1');
PREPARE stmt FROM @sql; EXECUTE stmt; DEALLOCATE PREPARE stmt;

-- Helper: check and add gender
SET @col_exists = (SELECT COUNT(*) FROM INFORMATION_SCHEMA.COLUMNS WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = 'users' AND COLUMN_NAME = 'gender');
SET @sql = IF(@col_exists = 0, "ALTER TABLE users ADD COLUMN gender ENUM('Male','Female') DEFAULT NULL", 'SELECT 1');
PREPARE stmt FROM @sql; EXECUTE stmt; DEALLOCATE PREPARE stmt;

-- Helper: check and add blood_group
SET @col_exists = (SELECT COUNT(*) FROM INFORMATION_SCHEMA.COLUMNS WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = 'users' AND COLUMN_NAME = 'blood_group');
SET @sql = IF(@col_exists = 0, "ALTER TABLE users ADD COLUMN blood_group ENUM('A+','A-','B+','B-','AB+','AB-','O+','O-') DEFAULT NULL", 'SELECT 1');
PREPARE stmt FROM @sql; EXECUTE stmt; DEALLOCATE PREPARE stmt;

-- Helper: check and add medical_info
SET @col_exists = (SELECT COUNT(*) FROM INFORMATION_SCHEMA.COLUMNS WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = 'users' AND COLUMN_NAME = 'medical_info');
SET @sql = IF(@col_exists = 0, 'ALTER TABLE users ADD COLUMN medical_info JSON DEFAULT NULL', 'SELECT 1');
PREPARE stmt FROM @sql; EXECUTE stmt; DEALLOCATE PREPARE stmt;

-- Helper: check and add home_address
SET @col_exists = (SELECT COUNT(*) FROM INFORMATION_SCHEMA.COLUMNS WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = 'users' AND COLUMN_NAME = 'home_address');
SET @sql = IF(@col_exists = 0, 'ALTER TABLE users ADD COLUMN home_address VARCHAR(500) DEFAULT NULL', 'SELECT 1');
PREPARE stmt FROM @sql; EXECUTE stmt; DEALLOCATE PREPARE stmt;


-- ── 2. Emergency Contacts ───────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS emergency_contacts (
  id            BIGINT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
  user_id       BIGINT UNSIGNED NOT NULL,
  name          VARCHAR(150)    NOT NULL,
  phone         VARCHAR(30)     NOT NULL,
  relationship  VARCHAR(100)    DEFAULT '',
  priority      ENUM('Primary','Secondary') DEFAULT 'Secondary',
  created_at    TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  updated_at    TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE,
  UNIQUE KEY uq_user_phone (user_id, phone)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;


-- ── 3. Safety Settings ──────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS safety_settings (
  id                        BIGINT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
  user_id                   BIGINT UNSIGNED NOT NULL UNIQUE,
  sos_cancel_timer_sec      TINYINT UNSIGNED DEFAULT 10,
  notify_emergency_contacts BOOLEAN DEFAULT TRUE,
  push_notifications        BOOLEAN DEFAULT TRUE,
  sms_backup_alert          BOOLEAN DEFAULT FALSE,
  max_responders            TINYINT UNSIGNED DEFAULT 5,
  updated_at                TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;


-- ── 4. Volunteer Verifications ──────────────────────────────────────────
CREATE TABLE IF NOT EXISTS volunteer_verifications (
  id               BIGINT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
  user_id          BIGINT UNSIGNED NOT NULL,
  status           ENUM('draft','pending','verified','rejected') DEFAULT 'draft',
  id_card_url      VARCHAR(500) DEFAULT NULL,
  selfie_url       VARCHAR(500) DEFAULT NULL,
  certificate_url  VARCHAR(500) DEFAULT NULL,
  rejection_reason VARCHAR(500) DEFAULT NULL,
  submitted_at     TIMESTAMP NULL,
  reviewed_at      TIMESTAMP NULL,
  created_at       TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE,
  INDEX idx_user_status (user_id, status)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;
