USE resqher_db;

SET @has_incident_summary := (
  SELECT COUNT(*)
  FROM INFORMATION_SCHEMA.COLUMNS
  WHERE TABLE_SCHEMA = DATABASE()
    AND TABLE_NAME = 'law_enforcement_requests'
    AND COLUMN_NAME = 'incident_summary'
);
SET @sql := IF(@has_incident_summary = 0,
  'ALTER TABLE law_enforcement_requests ADD COLUMN incident_summary TEXT DEFAULT NULL AFTER request_note',
  'SELECT 1'
);
PREPARE stmt FROM @sql;
EXECUTE stmt;
DEALLOCATE PREPARE stmt;

SET @has_severity := (
  SELECT COUNT(*)
  FROM INFORMATION_SCHEMA.COLUMNS
  WHERE TABLE_SCHEMA = DATABASE()
    AND TABLE_NAME = 'law_enforcement_requests'
    AND COLUMN_NAME = 'severity'
);
SET @sql := IF(@has_severity = 0,
  'ALTER TABLE law_enforcement_requests ADD COLUMN severity VARCHAR(20) DEFAULT NULL AFTER incident_summary',
  'SELECT 1'
);
PREPARE stmt FROM @sql;
EXECUTE stmt;
DEALLOCATE PREPARE stmt;

SET @has_severity_reason := (
  SELECT COUNT(*)
  FROM INFORMATION_SCHEMA.COLUMNS
  WHERE TABLE_SCHEMA = DATABASE()
    AND TABLE_NAME = 'law_enforcement_requests'
    AND COLUMN_NAME = 'severity_reason'
);
SET @sql := IF(@has_severity_reason = 0,
  'ALTER TABLE law_enforcement_requests ADD COLUMN severity_reason TEXT DEFAULT NULL AFTER severity',
  'SELECT 1'
);
PREPARE stmt FROM @sql;
EXECUTE stmt;
DEALLOCATE PREPARE stmt;

SET @has_summary_generated_at := (
  SELECT COUNT(*)
  FROM INFORMATION_SCHEMA.COLUMNS
  WHERE TABLE_SCHEMA = DATABASE()
    AND TABLE_NAME = 'law_enforcement_requests'
    AND COLUMN_NAME = 'summary_generated_at'
);
SET @sql := IF(@has_summary_generated_at = 0,
  'ALTER TABLE law_enforcement_requests ADD COLUMN summary_generated_at DATETIME DEFAULT NULL AFTER severity_reason',
  'SELECT 1'
);
PREPARE stmt FROM @sql;
EXECUTE stmt;
DEALLOCATE PREPARE stmt;

SET @has_reviewed_by_admin_id := (
  SELECT COUNT(*)
  FROM INFORMATION_SCHEMA.COLUMNS
  WHERE TABLE_SCHEMA = DATABASE()
    AND TABLE_NAME = 'law_enforcement_requests'
    AND COLUMN_NAME = 'reviewed_by_admin_id'
);
SET @sql := IF(@has_reviewed_by_admin_id = 0,
  'ALTER TABLE law_enforcement_requests ADD COLUMN reviewed_by_admin_id BIGINT UNSIGNED DEFAULT NULL AFTER summary_generated_at',
  'SELECT 1'
);
PREPARE stmt FROM @sql;
EXECUTE stmt;
DEALLOCATE PREPARE stmt;

SET @has_reviewed_at := (
  SELECT COUNT(*)
  FROM INFORMATION_SCHEMA.COLUMNS
  WHERE TABLE_SCHEMA = DATABASE()
    AND TABLE_NAME = 'law_enforcement_requests'
    AND COLUMN_NAME = 'reviewed_at'
);
SET @sql := IF(@has_reviewed_at = 0,
  'ALTER TABLE law_enforcement_requests ADD COLUMN reviewed_at DATETIME DEFAULT NULL AFTER reviewed_by_admin_id',
  'SELECT 1'
);
PREPARE stmt FROM @sql;
EXECUTE stmt;
DEALLOCATE PREPARE stmt;

SET @has_idx_law_requests_severity := (
  SELECT COUNT(*)
  FROM INFORMATION_SCHEMA.STATISTICS
  WHERE TABLE_SCHEMA = DATABASE()
    AND TABLE_NAME = 'law_enforcement_requests'
    AND INDEX_NAME = 'idx_law_requests_severity'
);
SET @sql := IF(@has_idx_law_requests_severity = 0,
  'ALTER TABLE law_enforcement_requests ADD KEY idx_law_requests_severity (severity)',
  'SELECT 1'
);
PREPARE stmt FROM @sql;
EXECUTE stmt;
DEALLOCATE PREPARE stmt;
