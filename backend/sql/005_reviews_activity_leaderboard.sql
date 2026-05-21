-- Adds real SOS responder reviews used by review cards, volunteer activity, and leaderboard.
-- Safe to run more than once.

CREATE TABLE IF NOT EXISTS reviews (
  id BIGINT UNSIGNED NOT NULL AUTO_INCREMENT,
  incident_id BIGINT UNSIGNED NOT NULL,
  reviewer_id BIGINT UNSIGNED NOT NULL,
  volunteer_id BIGINT UNSIGNED NOT NULL,
  rating TINYINT UNSIGNED NOT NULL,
  feedback TEXT DEFAULT NULL,
  created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  PRIMARY KEY (id),
  UNIQUE KEY uq_incident_reviewer_volunteer (incident_id, reviewer_id, volunteer_id),
  KEY idx_reviews_volunteer (volunteer_id),
  KEY idx_reviews_reviewer (reviewer_id),
  CONSTRAINT fk_reviews_incident FOREIGN KEY (incident_id)
    REFERENCES incidents(id) ON UPDATE CASCADE ON DELETE CASCADE,
  CONSTRAINT fk_reviews_reviewer FOREIGN KEY (reviewer_id)
    REFERENCES users(id) ON UPDATE CASCADE ON DELETE CASCADE,
  CONSTRAINT fk_reviews_volunteer FOREIGN KEY (volunteer_id)
    REFERENCES users(id) ON UPDATE CASCADE ON DELETE CASCADE
);
