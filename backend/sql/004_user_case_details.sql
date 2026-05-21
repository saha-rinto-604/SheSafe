USE resqher_db;

SET @has_user_case_details := (
  SELECT COUNT(*)
  FROM INFORMATION_SCHEMA.COLUMNS
  WHERE TABLE_SCHEMA = DATABASE()
    AND TABLE_NAME = 'incidents'
    AND COLUMN_NAME = 'user_case_details'
);
SET @sql := IF(@has_user_case_details = 0,
  'ALTER TABLE incidents ADD COLUMN user_case_details JSON DEFAULT NULL AFTER volunteer_case_details',
  'SELECT 1'
);
PREPARE stmt FROM @sql;
EXECUTE stmt;
DEALLOCATE PREPARE stmt;
