USE resqher_db;

SET @has_final_location_snapshot := (
  SELECT COUNT(*)
  FROM INFORMATION_SCHEMA.COLUMNS
  WHERE TABLE_SCHEMA = DATABASE()
    AND TABLE_NAME = 'incidents'
    AND COLUMN_NAME = 'final_location_snapshot'
);

SET @sql := IF(@has_final_location_snapshot = 0,
  'ALTER TABLE incidents ADD COLUMN final_location_snapshot JSON DEFAULT NULL AFTER user_case_details',
  'SELECT 1'
);
PREPARE stmt FROM @sql;
EXECUTE stmt;
DEALLOCATE PREPARE stmt;
