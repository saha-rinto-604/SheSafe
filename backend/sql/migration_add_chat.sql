USE resqher_db;

CREATE TABLE IF NOT EXISTS chat_messages (
  id BIGINT UNSIGNED NOT NULL AUTO_INCREMENT,
  incident_id BIGINT UNSIGNED NOT NULL,
  sender_id BIGINT UNSIGNED NOT NULL,
  content TEXT NOT NULL,
  message_type ENUM('TEXT','IMAGE','AUDIO','SYSTEM') NOT NULL DEFAULT 'TEXT',
  media_url VARCHAR(500) DEFAULT NULL,
  created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
  PRIMARY KEY (id),
  KEY idx_chat_incident_id (incident_id),
  KEY idx_chat_sender_id (sender_id),
  CONSTRAINT fk_chat_incident FOREIGN KEY (incident_id)
    REFERENCES incidents (id) ON UPDATE CASCADE ON DELETE CASCADE,
  CONSTRAINT fk_chat_sender FOREIGN KEY (sender_id)
    REFERENCES users (id) ON UPDATE CASCADE ON DELETE CASCADE
);

CREATE TABLE IF NOT EXISTS incident_participants (
  id BIGINT UNSIGNED NOT NULL AUTO_INCREMENT,
  incident_id BIGINT UNSIGNED NOT NULL,
  user_id BIGINT UNSIGNED NOT NULL,
  joined_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
  archived_at TIMESTAMP NULL DEFAULT NULL,
  deleted_for_user_at TIMESTAMP NULL DEFAULT NULL,
  left_at TIMESTAMP NULL DEFAULT NULL,
  PRIMARY KEY (id),
  UNIQUE KEY uq_participant (incident_id, user_id),
  KEY idx_participants_incident_id (incident_id),
  KEY idx_participants_user_visibility (user_id, archived_at, deleted_for_user_at),
  CONSTRAINT fk_part_incident FOREIGN KEY (incident_id)
    REFERENCES incidents (id) ON UPDATE CASCADE ON DELETE CASCADE,
  CONSTRAINT fk_part_user FOREIGN KEY (user_id)
    REFERENCES users (id) ON UPDATE CASCADE ON DELETE CASCADE
);

SET @has_archived_at := (
  SELECT COUNT(*) FROM INFORMATION_SCHEMA.COLUMNS
  WHERE TABLE_SCHEMA = DATABASE()
    AND TABLE_NAME = 'incident_participants'
    AND COLUMN_NAME = 'archived_at'
);
SET @sql := IF(@has_archived_at = 0,
  'ALTER TABLE incident_participants ADD COLUMN archived_at TIMESTAMP NULL DEFAULT NULL AFTER joined_at',
  'SELECT 1'
);
PREPARE stmt FROM @sql; EXECUTE stmt; DEALLOCATE PREPARE stmt;

SET @has_deleted_for_user_at := (
  SELECT COUNT(*) FROM INFORMATION_SCHEMA.COLUMNS
  WHERE TABLE_SCHEMA = DATABASE()
    AND TABLE_NAME = 'incident_participants'
    AND COLUMN_NAME = 'deleted_for_user_at'
);
SET @sql := IF(@has_deleted_for_user_at = 0,
  'ALTER TABLE incident_participants ADD COLUMN deleted_for_user_at TIMESTAMP NULL DEFAULT NULL AFTER archived_at',
  'SELECT 1'
);
PREPARE stmt FROM @sql; EXECUTE stmt; DEALLOCATE PREPARE stmt;

SET @has_left_at := (
  SELECT COUNT(*) FROM INFORMATION_SCHEMA.COLUMNS
  WHERE TABLE_SCHEMA = DATABASE()
    AND TABLE_NAME = 'incident_participants'
    AND COLUMN_NAME = 'left_at'
);
SET @sql := IF(@has_left_at = 0,
  'ALTER TABLE incident_participants ADD COLUMN left_at TIMESTAMP NULL DEFAULT NULL AFTER deleted_for_user_at',
  'SELECT 1'
);
PREPARE stmt FROM @sql; EXECUTE stmt; DEALLOCATE PREPARE stmt;
