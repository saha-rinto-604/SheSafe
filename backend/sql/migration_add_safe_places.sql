USE resqher_db;

CREATE TABLE IF NOT EXISTS safe_places (
  id BIGINT UNSIGNED NOT NULL AUTO_INCREMENT,
  reported_by BIGINT UNSIGNED NOT NULL,
  latitude DECIMAL(10,7) NOT NULL,
  longitude DECIMAL(10,7) NOT NULL,
  name VARCHAR(255) NOT NULL,
  address VARCHAR(500) DEFAULT NULL,
  description TEXT NOT NULL,
  status ENUM('PENDING','CONFIRMED','REJECTED') NOT NULL DEFAULT 'PENDING',
  created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
  PRIMARY KEY (id),
  KEY idx_safe_places_status (status),
  KEY idx_safe_places_reported_by (reported_by),
  CONSTRAINT fk_safe_places_user FOREIGN KEY (reported_by)
    REFERENCES users (id) ON UPDATE CASCADE ON DELETE CASCADE
);
