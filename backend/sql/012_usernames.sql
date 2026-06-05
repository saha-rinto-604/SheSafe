USE resqher_db;

SET @col_exists = (
  SELECT COUNT(*)
  FROM INFORMATION_SCHEMA.COLUMNS
  WHERE TABLE_SCHEMA = DATABASE()
    AND TABLE_NAME = 'users'
    AND COLUMN_NAME = 'username'
);
SET @sql = IF(@col_exists = 0, 'ALTER TABLE users ADD COLUMN username VARCHAR(50) NULL AFTER last_name', 'SELECT 1');
PREPARE stmt FROM @sql;
EXECUTE stmt;
DEALLOCATE PREPARE stmt;

UPDATE users
SET username = LOWER(username)
WHERE username IS NOT NULL;

UPDATE users
SET username = NULL
WHERE username IS NULL
   OR username = ''
   OR username NOT REGEXP '^[a-z0-9_]{3,30}$';

UPDATE users
SET username = CONCAT(
  LOWER(REPLACE(REPLACE(REPLACE(first_name, ' ', ''), '-', ''), '.', '')),
  LPAD(MOD(id, 10000), 4, '0'),
  id
)
WHERE username IS NULL
   OR username = '';

UPDATE users
SET username = CONCAT('user', LPAD(MOD(id, 10000), 4, '0'), id)
WHERE username IS NULL
   OR username = ''
   OR username NOT REGEXP '^[a-z0-9_]{3,30}$';

UPDATE users u
JOIN (
  SELECT username, MIN(id) AS keep_id
  FROM users
  WHERE username IS NOT NULL
  GROUP BY username
  HAVING COUNT(*) > 1
) dupes ON dupes.username = u.username
SET u.username = CONCAT('user', LPAD(MOD(u.id, 10000), 4, '0'), u.id)
WHERE u.id <> dupes.keep_id;

SET @idx_exists = (
  SELECT COUNT(*)
  FROM INFORMATION_SCHEMA.STATISTICS
  WHERE TABLE_SCHEMA = DATABASE()
    AND TABLE_NAME = 'users'
    AND INDEX_NAME = 'uq_users_username'
);
SET @sql = IF(@idx_exists = 0, 'ALTER TABLE users ADD UNIQUE KEY uq_users_username (username)', 'SELECT 1');
PREPARE stmt FROM @sql;
EXECUTE stmt;
DEALLOCATE PREPARE stmt;
