USE resqher_db;

SET @has_accept_sos_requests := (
  SELECT COUNT(*)
  FROM INFORMATION_SCHEMA.COLUMNS
  WHERE TABLE_SCHEMA = DATABASE()
    AND TABLE_NAME = 'users'
    AND COLUMN_NAME = 'accept_sos_requests'
);

SET @sql := IF(@has_accept_sos_requests = 0,
  'ALTER TABLE users ADD COLUMN accept_sos_requests BOOLEAN NOT NULL DEFAULT TRUE AFTER last_seen_at',
  'SELECT 1'
);
PREPARE stmt FROM @sql;
EXECUTE stmt;
DEALLOCATE PREPARE stmt;

CREATE TABLE IF NOT EXISTS notifications (
  id BIGINT UNSIGNED NOT NULL AUTO_INCREMENT,
  user_id BIGINT UNSIGNED NOT NULL,
  type VARCHAR(64) NOT NULL,
  title VARCHAR(160) NOT NULL,
  body TEXT NULL,
  incident_id BIGINT UNSIGNED NULL,
  chat_id BIGINT UNSIGNED NULL,
  data_json JSON NULL,
  read_at TIMESTAMP NULL DEFAULT NULL,
  seen_at TIMESTAMP NULL DEFAULT NULL,
  shown_in_app_at TIMESTAMP NULL DEFAULT NULL,
  created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  PRIMARY KEY (id),
  KEY idx_notifications_user_created (user_id, created_at, id),
  KEY idx_notifications_user_read (user_id, read_at),
  KEY idx_notifications_user_shown (user_id, shown_in_app_at),
  CONSTRAINT fk_notifications_user
    FOREIGN KEY (user_id) REFERENCES users(id)
    ON DELETE CASCADE
);

CREATE TABLE IF NOT EXISTS user_push_tokens (
  id BIGINT UNSIGNED NOT NULL AUTO_INCREMENT,
  user_id BIGINT UNSIGNED NOT NULL,
  expo_push_token VARCHAR(255) NOT NULL,
  platform VARCHAR(32) NULL,
  device_id VARCHAR(128) NULL,
  is_active BOOLEAN NOT NULL DEFAULT TRUE,
  created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  last_seen_at TIMESTAMP NULL DEFAULT NULL,
  PRIMARY KEY (id),
  UNIQUE KEY uq_user_push_token (expo_push_token),
  KEY idx_user_push_tokens_user_active (user_id, is_active),
  CONSTRAINT fk_user_push_tokens_user
    FOREIGN KEY (user_id) REFERENCES users(id)
    ON DELETE CASCADE
);
