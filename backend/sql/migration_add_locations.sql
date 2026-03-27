USE resqher_db;

CREATE TABLE IF NOT EXISTS user_locations (
  id BIGINT UNSIGNED NOT NULL AUTO_INCREMENT,
  user_id BIGINT UNSIGNED NOT NULL,
  latitude DECIMAL(10,7) NOT NULL,
  longitude DECIMAL(10,7) NOT NULL,
  address VARCHAR(500) DEFAULT NULL,
  recorded_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
  PRIMARY KEY (id),
  KEY idx_user_locations_user_id (user_id),
  CONSTRAINT fk_user_locations_user_id FOREIGN KEY (user_id)
    REFERENCES users (id) ON UPDATE CASCADE ON DELETE CASCADE
);
