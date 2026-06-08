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

SET @has_review_incident_id := (
  SELECT COUNT(*) FROM INFORMATION_SCHEMA.COLUMNS
  WHERE TABLE_SCHEMA = DATABASE()
    AND TABLE_NAME = 'reviews'
    AND COLUMN_NAME = 'incident_id'
);
SET @sql := IF(@has_review_incident_id = 0,
  'ALTER TABLE reviews ADD COLUMN incident_id BIGINT UNSIGNED DEFAULT NULL AFTER id',
  'SELECT 1'
);
PREPARE stmt FROM @sql; EXECUTE stmt; DEALLOCATE PREPARE stmt;

SET @has_review_reviewer_id := (
  SELECT COUNT(*) FROM INFORMATION_SCHEMA.COLUMNS
  WHERE TABLE_SCHEMA = DATABASE()
    AND TABLE_NAME = 'reviews'
    AND COLUMN_NAME = 'reviewer_id'
);
SET @sql := IF(@has_review_reviewer_id = 0,
  'ALTER TABLE reviews ADD COLUMN reviewer_id BIGINT UNSIGNED DEFAULT NULL AFTER incident_id',
  'SELECT 1'
);
PREPARE stmt FROM @sql; EXECUTE stmt; DEALLOCATE PREPARE stmt;

SET @has_review_volunteer_id := (
  SELECT COUNT(*) FROM INFORMATION_SCHEMA.COLUMNS
  WHERE TABLE_SCHEMA = DATABASE()
    AND TABLE_NAME = 'reviews'
    AND COLUMN_NAME = 'volunteer_id'
);
SET @sql := IF(@has_review_volunteer_id = 0,
  'ALTER TABLE reviews ADD COLUMN volunteer_id BIGINT UNSIGNED DEFAULT NULL AFTER reviewer_id',
  'SELECT 1'
);
PREPARE stmt FROM @sql; EXECUTE stmt; DEALLOCATE PREPARE stmt;

SET @has_review_unique := (
  SELECT COUNT(*) FROM INFORMATION_SCHEMA.STATISTICS
  WHERE TABLE_SCHEMA = DATABASE()
    AND TABLE_NAME = 'reviews'
    AND INDEX_NAME = 'uq_incident_reviewer_volunteer'
);
DELETE r1 FROM reviews r1
JOIN reviews r2
  ON r1.incident_id = r2.incident_id
 AND r1.reviewer_id = r2.reviewer_id
 AND r1.volunteer_id = r2.volunteer_id
 AND r1.id > r2.id
WHERE @has_review_unique = 0
  AND r1.incident_id IS NOT NULL
  AND r1.reviewer_id IS NOT NULL
  AND r1.volunteer_id IS NOT NULL;
SET @sql := IF(@has_review_unique = 0,
  'ALTER TABLE reviews ADD UNIQUE KEY uq_incident_reviewer_volunteer (incident_id, reviewer_id, volunteer_id)',
  'SELECT 1'
);
PREPARE stmt FROM @sql; EXECUTE stmt; DEALLOCATE PREPARE stmt;
