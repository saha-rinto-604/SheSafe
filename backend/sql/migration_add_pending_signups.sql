USE resqher_db;

CREATE TABLE IF NOT EXISTS pending_signups (
  id BIGINT UNSIGNED NOT NULL AUTO_INCREMENT,
  phone_number VARCHAR(30) NOT NULL,
  role VARCHAR(50) NOT NULL,
  first_name VARCHAR(100) NOT NULL,
  last_name VARCHAR(100) NOT NULL,
  password_hash VARCHAR(255) NOT NULL,
  payload_json JSON NULL,
  expires_at DATETIME NOT NULL,
  created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
  PRIMARY KEY (id),
  UNIQUE KEY uq_pending_signups_phone_number (phone_number),
  KEY idx_pending_signups_expires_at (expires_at)
);
