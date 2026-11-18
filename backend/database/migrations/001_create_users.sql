-- Copied from the documented schema in features/auth/data/auth-service.ts. NOT executed or wired to anything.
CREATE TABLE users (
  id CHAR(36) PRIMARY KEY,
  role ENUM('student','instructor'),
  full_name VARCHAR(80),
  email VARCHAR(254) NOT NULL,
  password_hash VARCHAR(255) NULL,
  google_id VARCHAR(64) NULL UNIQUE,
  section VARCHAR(20) NULL,
  department VARCHAR(80) NULL,
  phone VARCHAR(13) NULL,
  email_verified TINYINT(1) DEFAULT 0,
  status ENUM('active','pending_approval') DEFAULT 'active',
  created_at DATETIME,
  UNIQUE KEY uq_users_email (email) -- duplicate-email guard
);
