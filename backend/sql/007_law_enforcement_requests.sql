USE resqher_db;

INSERT IGNORE INTO roles (role_name) VALUES ('law_enforcement');

CREATE TABLE IF NOT EXISTS police_profiles (
  user_id BIGINT UNSIGNED NOT NULL,
  police_station_or_unit VARCHAR(255) NOT NULL,
  badge_number VARCHAR(120) NOT NULL,
  nid_card_url TEXT DEFAULT NULL,
  selfie_url TEXT DEFAULT NULL,
  job_id_card_url TEXT DEFAULT NULL,
  verification_status ENUM('PENDING','APPROVED','REJECTED') NOT NULL DEFAULT 'PENDING',
  rejection_reason TEXT DEFAULT NULL,
  submitted_at TIMESTAMP NULL DEFAULT NULL,
  reviewed_by BIGINT UNSIGNED DEFAULT NULL,
  reviewed_at TIMESTAMP NULL DEFAULT NULL,
  created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  PRIMARY KEY (user_id),
  UNIQUE KEY uq_police_profiles_badge_number (badge_number),
  KEY idx_police_profiles_status (verification_status),
  CONSTRAINT fk_police_profiles_user FOREIGN KEY (user_id)
    REFERENCES users(id) ON UPDATE CASCADE ON DELETE CASCADE,
  CONSTRAINT fk_police_profiles_reviewed_by FOREIGN KEY (reviewed_by)
    REFERENCES users(id) ON UPDATE CASCADE ON DELETE SET NULL
);

SET @has_police_nid_card_url := (
  SELECT COUNT(*)
  FROM INFORMATION_SCHEMA.COLUMNS
  WHERE TABLE_SCHEMA = DATABASE()
    AND TABLE_NAME = 'police_profiles'
    AND COLUMN_NAME = 'nid_card_url'
);
SET @sql := IF(@has_police_nid_card_url = 0,
  'ALTER TABLE police_profiles ADD COLUMN nid_card_url TEXT DEFAULT NULL AFTER badge_number',
  'SELECT 1'
);
PREPARE stmt FROM @sql;
EXECUTE stmt;
DEALLOCATE PREPARE stmt;

SET @has_police_selfie_url := (
  SELECT COUNT(*)
  FROM INFORMATION_SCHEMA.COLUMNS
  WHERE TABLE_SCHEMA = DATABASE()
    AND TABLE_NAME = 'police_profiles'
    AND COLUMN_NAME = 'selfie_url'
);
SET @sql := IF(@has_police_selfie_url = 0,
  'ALTER TABLE police_profiles ADD COLUMN selfie_url TEXT DEFAULT NULL AFTER nid_card_url',
  'SELECT 1'
);
PREPARE stmt FROM @sql;
EXECUTE stmt;
DEALLOCATE PREPARE stmt;

SET @police_job_id_nullable := (
  SELECT COUNT(*)
  FROM INFORMATION_SCHEMA.COLUMNS
  WHERE TABLE_SCHEMA = DATABASE()
    AND TABLE_NAME = 'police_profiles'
    AND COLUMN_NAME = 'job_id_card_url'
    AND IS_NULLABLE = 'YES'
);
SET @sql := IF(@police_job_id_nullable = 0,
  'ALTER TABLE police_profiles MODIFY COLUMN job_id_card_url TEXT DEFAULT NULL',
  'SELECT 1'
);
PREPARE stmt FROM @sql;
EXECUTE stmt;
DEALLOCATE PREPARE stmt;

SET @has_police_submitted_at := (
  SELECT COUNT(*)
  FROM INFORMATION_SCHEMA.COLUMNS
  WHERE TABLE_SCHEMA = DATABASE()
    AND TABLE_NAME = 'police_profiles'
    AND COLUMN_NAME = 'submitted_at'
);
SET @sql := IF(@has_police_submitted_at = 0,
  'ALTER TABLE police_profiles ADD COLUMN submitted_at TIMESTAMP NULL DEFAULT NULL AFTER rejection_reason',
  'SELECT 1'
);
PREPARE stmt FROM @sql;
EXECUTE stmt;
DEALLOCATE PREPARE stmt;

CREATE TABLE IF NOT EXISTS law_enforcement_requests (
  id BIGINT UNSIGNED NOT NULL AUTO_INCREMENT,
  incident_id BIGINT UNSIGNED NOT NULL,
  requested_by_user_id BIGINT UNSIGNED NOT NULL,
  requested_by_role VARCHAR(50) NOT NULL,
  status ENUM(
    'PENDING_ADMIN_REVIEW',
    'ASSIGNED_TO_POLICE',
    'ACCEPTED_BY_POLICE',
    'REJECTED_BY_POLICE',
    'RESOLVED',
    'CANCELLED'
  ) NOT NULL DEFAULT 'PENDING_ADMIN_REVIEW',
  assigned_police_id BIGINT UNSIGNED DEFAULT NULL,
  admin_id BIGINT UNSIGNED DEFAULT NULL,
  request_note TEXT DEFAULT NULL,
  rejection_reason TEXT DEFAULT NULL,
  cancel_reason TEXT DEFAULT NULL,
  created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  PRIMARY KEY (id),
  KEY idx_law_requests_incident_status (incident_id, status),
  KEY idx_law_requests_assigned_status (assigned_police_id, status),
  KEY idx_law_requests_status_created (status, created_at),
  CONSTRAINT fk_law_requests_incident FOREIGN KEY (incident_id)
    REFERENCES incidents(id) ON UPDATE CASCADE ON DELETE CASCADE,
  CONSTRAINT fk_law_requests_requester FOREIGN KEY (requested_by_user_id)
    REFERENCES users(id) ON UPDATE CASCADE ON DELETE RESTRICT,
  CONSTRAINT fk_law_requests_police FOREIGN KEY (assigned_police_id)
    REFERENCES users(id) ON UPDATE CASCADE ON DELETE SET NULL,
  CONSTRAINT fk_law_requests_admin FOREIGN KEY (admin_id)
    REFERENCES users(id) ON UPDATE CASCADE ON DELETE SET NULL
);

SET @has_law_request_note := (
  SELECT COUNT(*)
  FROM INFORMATION_SCHEMA.COLUMNS
  WHERE TABLE_SCHEMA = DATABASE()
    AND TABLE_NAME = 'law_enforcement_requests'
    AND COLUMN_NAME = 'request_note'
);
SET @sql := IF(@has_law_request_note = 0,
  'ALTER TABLE law_enforcement_requests ADD COLUMN request_note TEXT DEFAULT NULL',
  'SELECT 1'
);
PREPARE stmt FROM @sql;
EXECUTE stmt;
DEALLOCATE PREPARE stmt;

SET @has_law_rejection_reason := (
  SELECT COUNT(*)
  FROM INFORMATION_SCHEMA.COLUMNS
  WHERE TABLE_SCHEMA = DATABASE()
    AND TABLE_NAME = 'law_enforcement_requests'
    AND COLUMN_NAME = 'rejection_reason'
);
SET @sql := IF(@has_law_rejection_reason = 0,
  'ALTER TABLE law_enforcement_requests ADD COLUMN rejection_reason TEXT DEFAULT NULL',
  'SELECT 1'
);
PREPARE stmt FROM @sql;
EXECUTE stmt;
DEALLOCATE PREPARE stmt;

SET @has_law_cancel_reason := (
  SELECT COUNT(*)
  FROM INFORMATION_SCHEMA.COLUMNS
  WHERE TABLE_SCHEMA = DATABASE()
    AND TABLE_NAME = 'law_enforcement_requests'
    AND COLUMN_NAME = 'cancel_reason'
);
SET @sql := IF(@has_law_cancel_reason = 0,
  'ALTER TABLE law_enforcement_requests ADD COLUMN cancel_reason TEXT DEFAULT NULL',
  'SELECT 1'
);
PREPARE stmt FROM @sql;
EXECUTE stmt;
DEALLOCATE PREPARE stmt;

SET @has_law_assigned_police_id := (
  SELECT COUNT(*)
  FROM INFORMATION_SCHEMA.COLUMNS
  WHERE TABLE_SCHEMA = DATABASE()
    AND TABLE_NAME = 'law_enforcement_requests'
    AND COLUMN_NAME = 'assigned_police_id'
);
SET @sql := IF(@has_law_assigned_police_id = 0,
  'ALTER TABLE law_enforcement_requests ADD COLUMN assigned_police_id BIGINT UNSIGNED DEFAULT NULL',
  'SELECT 1'
);
PREPARE stmt FROM @sql;
EXECUTE stmt;
DEALLOCATE PREPARE stmt;

SET @has_law_admin_id := (
  SELECT COUNT(*)
  FROM INFORMATION_SCHEMA.COLUMNS
  WHERE TABLE_SCHEMA = DATABASE()
    AND TABLE_NAME = 'law_enforcement_requests'
    AND COLUMN_NAME = 'admin_id'
);
SET @sql := IF(@has_law_admin_id = 0,
  'ALTER TABLE law_enforcement_requests ADD COLUMN admin_id BIGINT UNSIGNED DEFAULT NULL',
  'SELECT 1'
);
PREPARE stmt FROM @sql;
EXECUTE stmt;
DEALLOCATE PREPARE stmt;

SET @has_law_updated_at := (
  SELECT COUNT(*)
  FROM INFORMATION_SCHEMA.COLUMNS
  WHERE TABLE_SCHEMA = DATABASE()
    AND TABLE_NAME = 'law_enforcement_requests'
    AND COLUMN_NAME = 'updated_at'
);
SET @sql := IF(@has_law_updated_at = 0,
  'ALTER TABLE law_enforcement_requests ADD COLUMN updated_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP',
  'SELECT 1'
);
PREPARE stmt FROM @sql;
EXECUTE stmt;
DEALLOCATE PREPARE stmt;

CREATE TABLE IF NOT EXISTS law_enforcement_request_candidates (
  request_id BIGINT UNSIGNED NOT NULL,
  police_id BIGINT UNSIGNED NOT NULL,
  status ENUM('OFFERED','REJECTED','ACCEPTED','EXPIRED') NOT NULL DEFAULT 'OFFERED',
  rejection_reason TEXT DEFAULT NULL,
  created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  PRIMARY KEY (request_id, police_id),
  KEY idx_law_candidates_police_status (police_id, status),
  KEY idx_law_candidates_request_status (request_id, status),
  CONSTRAINT fk_law_candidates_request FOREIGN KEY (request_id)
    REFERENCES law_enforcement_requests(id) ON UPDATE CASCADE ON DELETE CASCADE,
  CONSTRAINT fk_law_candidates_police FOREIGN KEY (police_id)
    REFERENCES users(id) ON UPDATE CASCADE ON DELETE CASCADE
);
