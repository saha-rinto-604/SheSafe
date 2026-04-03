USE resqher_db;

CREATE TABLE IF NOT EXISTS incidents (
  id BIGINT UNSIGNED NOT NULL AUTO_INCREMENT,
  user_id BIGINT UNSIGNED NOT NULL,
  latitude DECIMAL(10,7) NOT NULL,
  longitude DECIMAL(10,7) NOT NULL,
  address VARCHAR(500) DEFAULT NULL,
  status ENUM('ACTIVE','RESOLVED','CANCELLED') NOT NULL DEFAULT 'ACTIVE',
  created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
  PRIMARY KEY (id),
  KEY idx_incidents_user_id (user_id),
  KEY idx_incidents_status (status),
  KEY idx_incidents_lat_lng (latitude, longitude),
  CONSTRAINT fk_incidents_user_id FOREIGN KEY (user_id)
    REFERENCES users (id) ON UPDATE CASCADE ON DELETE CASCADE
);
