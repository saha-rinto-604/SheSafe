/**
 * migrations/001_profile_and_modules.sql
 * ───────────────────────────────────────────────────────────────────────
 * ResQher Database Migration #001
 *
 * Architecture Decision — Why Reference Pattern for Images:
 *   Storing image URLs (VARCHAR) instead of BLOBs keeps the database lean,
 *   enables CDN-level caching via Cloudinary, and decouples storage concerns
 *   from the relational layer.
 *
 * Architecture Decision — Why JSON for medical_info:
 *   The frontend stores medical conditions as a simple string[]. A JSON column
 *   preserves this structure without requiring a junction table.
 */

-- ── 1. Extend users table with profile columns ─────────────────────────────
ALTER TABLE users
  ADD COLUMN photo_url VARCHAR(500) DEFAULT NULL,
  ADD COLUMN dob DATE DEFAULT NULL,
  ADD COLUMN gender ENUM('Male','Female') DEFAULT NULL,
  ADD COLUMN blood_group ENUM('A+','A-','B+','B-','AB+','AB-','O+','O-') DEFAULT NULL,
  ADD COLUMN medical_info JSON DEFAULT NULL,
  ADD COLUMN home_address VARCHAR(500) DEFAULT NULL;


-- ── 2. Emergency Contacts ───────────────────────────────────────────────────
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


-- ── 3. Safety Settings ──────────────────────────────────────────────────────
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


-- ── 4. Volunteer Verifications ──────────────────────────────────────────────
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
