USE resqher_db;

INSERT IGNORE INTO roles (role_name) VALUES ('admin');

SET @col_exists = (SELECT COUNT(*) FROM INFORMATION_SCHEMA.COLUMNS WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = 'users' AND COLUMN_NAME = 'account_status');
SET @sql = IF(@col_exists = 0, "ALTER TABLE users ADD COLUMN account_status ENUM('ACTIVE','WARNED','BLOCKED') NOT NULL DEFAULT 'ACTIVE'", 'SELECT 1');
PREPARE stmt FROM @sql; EXECUTE stmt; DEALLOCATE PREPARE stmt;

SET @col_exists = (SELECT COUNT(*) FROM INFORMATION_SCHEMA.COLUMNS WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = 'users' AND COLUMN_NAME = 'warning_count');
SET @sql = IF(@col_exists = 0, 'ALTER TABLE users ADD COLUMN warning_count INT UNSIGNED NOT NULL DEFAULT 0', 'SELECT 1');
PREPARE stmt FROM @sql; EXECUTE stmt; DEALLOCATE PREPARE stmt;

SET @col_exists = (SELECT COUNT(*) FROM INFORMATION_SCHEMA.COLUMNS WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = 'users' AND COLUMN_NAME = 'blocked_at');
SET @sql = IF(@col_exists = 0, 'ALTER TABLE users ADD COLUMN blocked_at TIMESTAMP NULL DEFAULT NULL', 'SELECT 1');
PREPARE stmt FROM @sql; EXECUTE stmt; DEALLOCATE PREPARE stmt;

SET @col_exists = (SELECT COUNT(*) FROM INFORMATION_SCHEMA.COLUMNS WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = 'users' AND COLUMN_NAME = 'blocked_reason');
SET @sql = IF(@col_exists = 0, 'ALTER TABLE users ADD COLUMN blocked_reason VARCHAR(500) DEFAULT NULL', 'SELECT 1');
PREPARE stmt FROM @sql; EXECUTE stmt; DEALLOCATE PREPARE stmt;

SET @col_exists = (SELECT COUNT(*) FROM INFORMATION_SCHEMA.COLUMNS WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = 'safe_places' AND COLUMN_NAME = 'reviewed_by');
SET @sql = IF(@col_exists = 0, 'ALTER TABLE safe_places ADD COLUMN reviewed_by BIGINT UNSIGNED NULL DEFAULT NULL', 'SELECT 1');
PREPARE stmt FROM @sql; EXECUTE stmt; DEALLOCATE PREPARE stmt;

SET @col_exists = (SELECT COUNT(*) FROM INFORMATION_SCHEMA.COLUMNS WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = 'safe_places' AND COLUMN_NAME = 'reviewed_at');
SET @sql = IF(@col_exists = 0, 'ALTER TABLE safe_places ADD COLUMN reviewed_at TIMESTAMP NULL DEFAULT NULL', 'SELECT 1');
PREPARE stmt FROM @sql; EXECUTE stmt; DEALLOCATE PREPARE stmt;

SET @col_exists = (SELECT COUNT(*) FROM INFORMATION_SCHEMA.COLUMNS WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = 'safe_places' AND COLUMN_NAME = 'rejection_reason');
SET @sql = IF(@col_exists = 0, 'ALTER TABLE safe_places ADD COLUMN rejection_reason VARCHAR(500) DEFAULT NULL', 'SELECT 1');
PREPARE stmt FROM @sql; EXECUTE stmt; DEALLOCATE PREPARE stmt;

SET @col_exists = (SELECT COUNT(*) FROM INFORMATION_SCHEMA.COLUMNS WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = 'volunteer_verifications' AND COLUMN_NAME = 'reviewed_by');
SET @sql = IF(@col_exists = 0, 'ALTER TABLE volunteer_verifications ADD COLUMN reviewed_by BIGINT UNSIGNED NULL DEFAULT NULL', 'SELECT 1');
PREPARE stmt FROM @sql; EXECUTE stmt; DEALLOCATE PREPARE stmt;

CREATE TABLE IF NOT EXISTS user_reports (
  id BIGINT UNSIGNED NOT NULL AUTO_INCREMENT,
  reported_user_id BIGINT UNSIGNED NOT NULL,
  reported_by_user_id BIGINT UNSIGNED NOT NULL,
  incident_id BIGINT UNSIGNED NULL,
  reason TEXT NOT NULL,
  status ENUM('PENDING','DISMISSED','WARNED','BLOCKED') NOT NULL DEFAULT 'PENDING',
  action_note VARCHAR(500) DEFAULT NULL,
  actioned_by BIGINT UNSIGNED NULL,
  actioned_at TIMESTAMP NULL DEFAULT NULL,
  created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
  PRIMARY KEY (id),
  KEY idx_user_reports_status (status),
  KEY idx_user_reports_reported_user (reported_user_id),
  KEY idx_user_reports_reporter (reported_by_user_id),
  CONSTRAINT fk_user_reports_reported_user FOREIGN KEY (reported_user_id)
    REFERENCES users(id) ON UPDATE CASCADE ON DELETE CASCADE,
  CONSTRAINT fk_user_reports_reporter FOREIGN KEY (reported_by_user_id)
    REFERENCES users(id) ON UPDATE CASCADE ON DELETE CASCADE,
  CONSTRAINT fk_user_reports_incident FOREIGN KEY (incident_id)
    REFERENCES incidents(id) ON UPDATE CASCADE ON DELETE SET NULL
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

CREATE TABLE IF NOT EXISTS admin_actions (
  id BIGINT UNSIGNED NOT NULL AUTO_INCREMENT,
  admin_id BIGINT UNSIGNED NOT NULL,
  action_type VARCHAR(80) NOT NULL,
  target_type VARCHAR(80) NOT NULL,
  target_id BIGINT UNSIGNED NOT NULL,
  reason VARCHAR(500) DEFAULT NULL,
  metadata JSON DEFAULT NULL,
  created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
  PRIMARY KEY (id),
  KEY idx_admin_actions_admin_created (admin_id, created_at),
  KEY idx_admin_actions_target (target_type, target_id),
  CONSTRAINT fk_admin_actions_admin FOREIGN KEY (admin_id)
    REFERENCES users(id) ON UPDATE CASCADE ON DELETE RESTRICT
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;
