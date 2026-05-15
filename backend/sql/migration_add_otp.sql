USE resqher_db;

CREATE TABLE IF NOT EXISTS password_reset_otps (
  id BIGINT UNSIGNED NOT NULL AUTO_INCREMENT,
  phone_number VARCHAR(30) NOT NULL,
  otp_code CHAR(6) NOT NULL,
  expires_at TIMESTAMP NOT NULL,
  used TINYINT(1) NOT NULL DEFAULT 0,
  created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
  PRIMARY KEY (id),
  KEY idx_otp_phone (phone_number)
);
