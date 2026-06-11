CREATE TABLE IF NOT EXISTS incident_video_requests (
  id BIGINT UNSIGNED NOT NULL AUTO_INCREMENT,
  incident_id BIGINT UNSIGNED NOT NULL,
  requester_id BIGINT UNSIGNED NOT NULL,
  victim_id BIGINT UNSIGNED NOT NULL,
  status ENUM('PENDING','APPROVED','STREAMING','RECORDING','STOPPED','DECLINED','EXPIRED','FAILED','COMPLETED') NOT NULL DEFAULT 'PENDING',
  created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  expires_at TIMESTAMP NULL DEFAULT NULL,
  PRIMARY KEY (id),
  KEY idx_video_requests_incident_status (incident_id, status),
  KEY idx_video_requests_victim_status (victim_id, status),
  KEY idx_video_requests_requester_status (requester_id, status),
  CONSTRAINT fk_video_requests_incident FOREIGN KEY (incident_id)
    REFERENCES incidents (id) ON UPDATE CASCADE ON DELETE CASCADE,
  CONSTRAINT fk_video_requests_requester FOREIGN KEY (requester_id)
    REFERENCES users (id) ON UPDATE CASCADE ON DELETE CASCADE,
  CONSTRAINT fk_video_requests_victim FOREIGN KEY (victim_id)
    REFERENCES users (id) ON UPDATE CASCADE ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

ALTER TABLE incident_video_requests
  MODIFY COLUMN status
  ENUM('PENDING','APPROVED','STREAMING','RECORDING','STOPPED','DECLINED','EXPIRED','FAILED','COMPLETED')
  NOT NULL DEFAULT 'PENDING';

SET @chat_message_type := (
  SELECT COLUMN_TYPE FROM INFORMATION_SCHEMA.COLUMNS
  WHERE TABLE_SCHEMA = DATABASE()
    AND TABLE_NAME = 'chat_messages'
    AND COLUMN_NAME = 'message_type'
  LIMIT 1
);
SET @sql := IF(
  @chat_message_type IS NULL OR LOCATE('''VIDEO''', @chat_message_type) > 0,
  'SELECT 1',
  CONCAT(
    'ALTER TABLE chat_messages MODIFY COLUMN message_type ',
    LEFT(@chat_message_type, CHAR_LENGTH(@chat_message_type) - 1),
    ',''VIDEO'') NOT NULL DEFAULT ''TEXT'''
  )
);
PREPARE stmt FROM @sql; EXECUTE stmt; DEALLOCATE PREPARE stmt;

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

CREATE TABLE IF NOT EXISTS safety_settings (
  id                        BIGINT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
  user_id                   BIGINT UNSIGNED NOT NULL UNIQUE,
  sos_cancel_timer_sec      TINYINT UNSIGNED DEFAULT 10,
  notify_emergency_contacts BOOLEAN DEFAULT TRUE,
  push_notifications        BOOLEAN DEFAULT TRUE,
  sms_backup_alert          BOOLEAN DEFAULT FALSE,
  max_responders            TINYINT UNSIGNED DEFAULT 5,
  allow_emergency_auto_evidence_recording BOOLEAN NOT NULL DEFAULT FALSE,
  updated_at                TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

SET @has_auto_evidence_setting := (
  SELECT COUNT(*) FROM INFORMATION_SCHEMA.COLUMNS
  WHERE TABLE_SCHEMA = DATABASE()
    AND TABLE_NAME = 'safety_settings'
    AND COLUMN_NAME = 'allow_emergency_auto_evidence_recording'
);
SET @sql := IF(@has_auto_evidence_setting = 0,
  'ALTER TABLE safety_settings ADD COLUMN allow_emergency_auto_evidence_recording BOOLEAN NOT NULL DEFAULT FALSE AFTER max_responders',
  'SELECT 1'
);
PREPARE stmt FROM @sql; EXECUTE stmt; DEALLOCATE PREPARE stmt;

/*
Rollback note:
Do not alter chat_messages.message_type back to ENUM('TEXT','IMAGE','AUDIO','SYSTEM')
while any VIDEO rows exist. First archive or remap VIDEO messages, then alter the enum.
The incident_video_requests table and nullable media metadata columns can be dropped only
after confirming no Live Safety Video audit/history data is needed.
*/
