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
  PRIMARY KEY (id),
  UNIQUE KEY uq_participant (incident_id, user_id),
  KEY idx_participants_incident_id (incident_id),
  CONSTRAINT fk_part_incident FOREIGN KEY (incident_id)
    REFERENCES incidents (id) ON UPDATE CASCADE ON DELETE CASCADE,
  CONSTRAINT fk_part_user FOREIGN KEY (user_id)
    REFERENCES users (id) ON UPDATE CASCADE ON DELETE CASCADE
);
