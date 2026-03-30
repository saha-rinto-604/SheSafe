CREATE DATABASE IF NOT EXISTS resqher_db;
USE resqher_db;

CREATE TABLE IF NOT EXISTS roles (
  id INT UNSIGNED NOT NULL AUTO_INCREMENT,
  role_name VARCHAR(50) NOT NULL,
  created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
  PRIMARY KEY (id),
  UNIQUE KEY uq_roles_role_name (role_name)
);

CREATE TABLE IF NOT EXISTS users (
  id BIGINT UNSIGNED NOT NULL AUTO_INCREMENT,
  role_id INT UNSIGNED NOT NULL,
  first_name VARCHAR(100) NOT NULL,
  last_name VARCHAR(100) NOT NULL,
  phone_number VARCHAR(30) NOT NULL,
  password_hash VARCHAR(255) NOT NULL,
  entry_time TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
  PRIMARY KEY (id),
  UNIQUE KEY uq_users_phone_number (phone_number),
  KEY idx_users_role_id (role_id),
  CONSTRAINT fk_users_role_id FOREIGN KEY (role_id)
    REFERENCES roles (id)
    ON UPDATE RESTRICT
    ON DELETE RESTRICT
);

INSERT IGNORE INTO roles (role_name) VALUES
  ('standard_user'),
  ('volunteer'),
  ('law_enforcement');
