USE resqher_db;

CREATE TABLE IF NOT EXISTS chat_messages (
  id BIGINT UNSIGNED NOT NULL AUTO_INCREMENT,
  incident_id BIGINT UNSIGNED NOT NULL,
  sender_id BIGINT UNSIGNED NOT NULL,
  content TEXT NOT NULL,
  message_type ENUM('TEXT','IMAGE','AUDIO','SYSTEM','VIDEO') NOT NULL DEFAULT 'TEXT',
  media_url VARCHAR(500) DEFAULT NULL,
  media_public_id VARCHAR(255) DEFAULT NULL,
  media_mime_type VARCHAR(100) DEFAULT NULL,
  media_filename VARCHAR(255) DEFAULT NULL,
  media_size_bytes BIGINT UNSIGNED DEFAULT NULL,
  system_event_key VARCHAR(100) DEFAULT NULL,
  created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
  PRIMARY KEY (id),
  KEY idx_chat_incident_id (incident_id),
  KEY idx_chat_incident_created (incident_id, created_at, id),
  KEY idx_chat_sender_id (sender_id),
  UNIQUE KEY uq_chat_system_event_key (system_event_key),
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

SET @has_chat_incident_created := (
  SELECT COUNT(*) FROM INFORMATION_SCHEMA.STATISTICS
  WHERE TABLE_SCHEMA = DATABASE()
    AND TABLE_NAME = 'chat_messages'
    AND INDEX_NAME = 'idx_chat_incident_created'
);
SET @sql := IF(@has_chat_incident_created = 0,
  'ALTER TABLE chat_messages ADD KEY idx_chat_incident_created (incident_id, created_at, id)',
  'SELECT 1'
);
PREPARE stmt FROM @sql; EXECUTE stmt; DEALLOCATE PREPARE stmt;

ALTER TABLE chat_messages
  MODIFY COLUMN message_type ENUM('TEXT','IMAGE','AUDIO','SYSTEM','VIDEO') NOT NULL DEFAULT 'TEXT';

SET @has_chat_media_public_id := (
  SELECT COUNT(*) FROM INFORMATION_SCHEMA.COLUMNS
  WHERE TABLE_SCHEMA = DATABASE()
    AND TABLE_NAME = 'chat_messages'
    AND COLUMN_NAME = 'media_public_id'
);
SET @sql := IF(@has_chat_media_public_id = 0,
  'ALTER TABLE chat_messages ADD COLUMN media_public_id VARCHAR(255) DEFAULT NULL AFTER media_url',
  'SELECT 1'
);
PREPARE stmt FROM @sql; EXECUTE stmt; DEALLOCATE PREPARE stmt;

SET @has_chat_media_mime_type := (
  SELECT COUNT(*) FROM INFORMATION_SCHEMA.COLUMNS
  WHERE TABLE_SCHEMA = DATABASE()
    AND TABLE_NAME = 'chat_messages'
    AND COLUMN_NAME = 'media_mime_type'
);
SET @sql := IF(@has_chat_media_mime_type = 0,
  'ALTER TABLE chat_messages ADD COLUMN media_mime_type VARCHAR(100) DEFAULT NULL AFTER media_public_id',
  'SELECT 1'
);
PREPARE stmt FROM @sql; EXECUTE stmt; DEALLOCATE PREPARE stmt;

SET @has_chat_media_filename := (
  SELECT COUNT(*) FROM INFORMATION_SCHEMA.COLUMNS
  WHERE TABLE_SCHEMA = DATABASE()
    AND TABLE_NAME = 'chat_messages'
    AND COLUMN_NAME = 'media_filename'
);
SET @sql := IF(@has_chat_media_filename = 0,
  'ALTER TABLE chat_messages ADD COLUMN media_filename VARCHAR(255) DEFAULT NULL AFTER media_mime_type',
  'SELECT 1'
);
PREPARE stmt FROM @sql; EXECUTE stmt; DEALLOCATE PREPARE stmt;

SET @has_chat_media_size_bytes := (
  SELECT COUNT(*) FROM INFORMATION_SCHEMA.COLUMNS
  WHERE TABLE_SCHEMA = DATABASE()
    AND TABLE_NAME = 'chat_messages'
    AND COLUMN_NAME = 'media_size_bytes'
);
SET @sql := IF(@has_chat_media_size_bytes = 0,
  'ALTER TABLE chat_messages ADD COLUMN media_size_bytes BIGINT UNSIGNED DEFAULT NULL AFTER media_filename',
  'SELECT 1'
);
PREPARE stmt FROM @sql; EXECUTE stmt; DEALLOCATE PREPARE stmt;

SET @has_chat_system_event_key := (
  SELECT COUNT(*) FROM INFORMATION_SCHEMA.COLUMNS
  WHERE TABLE_SCHEMA = DATABASE()
    AND TABLE_NAME = 'chat_messages'
    AND COLUMN_NAME = 'system_event_key'
);
SET @sql := IF(@has_chat_system_event_key = 0,
  'ALTER TABLE chat_messages ADD COLUMN system_event_key VARCHAR(100) DEFAULT NULL AFTER media_url',
  'SELECT 1'
);
PREPARE stmt FROM @sql; EXECUTE stmt; DEALLOCATE PREPARE stmt;

SET @has_chat_system_event_index := (
  SELECT COUNT(*) FROM INFORMATION_SCHEMA.STATISTICS
  WHERE TABLE_SCHEMA = DATABASE()
    AND TABLE_NAME = 'chat_messages'
    AND INDEX_NAME = 'uq_chat_system_event_key'
);
SET @sql := IF(@has_chat_system_event_index = 0,
  'ALTER TABLE chat_messages ADD UNIQUE KEY uq_chat_system_event_key (system_event_key)',
  'SELECT 1'
);
PREPARE stmt FROM @sql; EXECUTE stmt; DEALLOCATE PREPARE stmt;

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
