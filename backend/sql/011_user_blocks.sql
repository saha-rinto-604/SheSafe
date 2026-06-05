USE resqher_db;

CREATE TABLE IF NOT EXISTS user_blocks (
  id BIGINT UNSIGNED NOT NULL AUTO_INCREMENT,
  blocker_user_id BIGINT UNSIGNED NOT NULL,
  blocked_user_id BIGINT UNSIGNED NOT NULL,
  reason VARCHAR(255) DEFAULT NULL,
  created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP NULL DEFAULT NULL ON UPDATE CURRENT_TIMESTAMP,
  PRIMARY KEY (id),
  UNIQUE KEY uq_user_blocks_pair (blocker_user_id, blocked_user_id),
  KEY idx_user_blocks_blocker_created (blocker_user_id, created_at),
  KEY idx_user_blocks_blocked (blocked_user_id),
  CONSTRAINT fk_user_blocks_blocker FOREIGN KEY (blocker_user_id)
    REFERENCES users(id) ON UPDATE CASCADE ON DELETE CASCADE,
  CONSTRAINT fk_user_blocks_blocked FOREIGN KEY (blocked_user_id)
    REFERENCES users(id) ON UPDATE CASCADE ON DELETE CASCADE
);
