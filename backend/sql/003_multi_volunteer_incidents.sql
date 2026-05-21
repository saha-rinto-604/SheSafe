USE resqher_db;

SET @has_legacy_volunteer := (
  SELECT COUNT(*)
  FROM INFORMATION_SCHEMA.COLUMNS
  WHERE TABLE_SCHEMA = DATABASE()
    AND TABLE_NAME = 'incidents'
    AND COLUMN_NAME = 'volunteer_id'
);
SET @sql := IF(@has_legacy_volunteer = 0,
  'ALTER TABLE incidents ADD COLUMN volunteer_id BIGINT UNSIGNED DEFAULT NULL AFTER user_id',
  'SELECT 1'
);
PREPARE stmt FROM @sql;
EXECUTE stmt;
DEALLOCATE PREPARE stmt;

SET @has_accepted_at := (
  SELECT COUNT(*)
  FROM INFORMATION_SCHEMA.COLUMNS
  WHERE TABLE_SCHEMA = DATABASE()
    AND TABLE_NAME = 'incidents'
    AND COLUMN_NAME = 'accepted_at'
);
SET @sql := IF(@has_accepted_at = 0,
  'ALTER TABLE incidents ADD COLUMN accepted_at TIMESTAMP NULL DEFAULT NULL AFTER created_at',
  'SELECT 1'
);
PREPARE stmt FROM @sql;
EXECUTE stmt;
DEALLOCATE PREPARE stmt;

ALTER TABLE incidents
  MODIFY COLUMN status ENUM('ACTIVE','IN_PROGRESS','RESOLVED','CANCELLED') NOT NULL DEFAULT 'ACTIVE';

SET @has_updated_at := (
  SELECT COUNT(*)
  FROM INFORMATION_SCHEMA.COLUMNS
  WHERE TABLE_SCHEMA = DATABASE()
    AND TABLE_NAME = 'incidents'
    AND COLUMN_NAME = 'updated_at'
);
SET @sql := IF(@has_updated_at = 0,
  'ALTER TABLE incidents ADD COLUMN updated_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP AFTER created_at',
  'SELECT 1'
);
PREPARE stmt FROM @sql;
EXECUTE stmt;
DEALLOCATE PREPARE stmt;

SET @has_case_details := (
  SELECT COUNT(*)
  FROM INFORMATION_SCHEMA.COLUMNS
  WHERE TABLE_SCHEMA = DATABASE()
    AND TABLE_NAME = 'incidents'
    AND COLUMN_NAME = 'volunteer_case_details'
);
SET @sql := IF(@has_case_details = 0,
  'ALTER TABLE incidents ADD COLUMN volunteer_case_details JSON DEFAULT NULL AFTER accepted_at',
  'SELECT 1'
);
PREPARE stmt FROM @sql;
EXECUTE stmt;
DEALLOCATE PREPARE stmt;

CREATE TABLE IF NOT EXISTS incident_volunteers (
  id BIGINT UNSIGNED NOT NULL AUTO_INCREMENT,
  incident_id BIGINT UNSIGNED NOT NULL,
  volunteer_id BIGINT UNSIGNED NOT NULL,
  accepted_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
  status ENUM('ACCEPTED','LEFT','REMOVED') NOT NULL DEFAULT 'ACCEPTED',
  created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  PRIMARY KEY (id),
  UNIQUE KEY uq_incident_volunteer (incident_id, volunteer_id),
  KEY idx_incident_volunteers_incident_status (incident_id, status),
  KEY idx_incident_volunteers_volunteer_status (volunteer_id, status),
  CONSTRAINT fk_incident_volunteers_incident FOREIGN KEY (incident_id)
    REFERENCES incidents(id) ON UPDATE CASCADE ON DELETE CASCADE,
  CONSTRAINT fk_incident_volunteers_volunteer FOREIGN KEY (volunteer_id)
    REFERENCES users(id) ON UPDATE CASCADE ON DELETE CASCADE
);

INSERT IGNORE INTO incident_volunteers (incident_id, volunteer_id, accepted_at, status)
SELECT id, volunteer_id, COALESCE(accepted_at, created_at), 'ACCEPTED'
FROM incidents
WHERE volunteer_id IS NOT NULL;
