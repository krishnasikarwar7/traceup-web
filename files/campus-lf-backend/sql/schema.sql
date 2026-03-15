-- ═══════════════════════════════════════════════════════════════
--  Campus Lost & Found Portal — MySQL Schema
--  Run this file to set up the database:
--    mysql -u root -p < sql/schema.sql
-- ═══════════════════════════════════════════════════════════════

-- Create and select database
CREATE DATABASE IF NOT EXISTS campus_lost_found
  CHARACTER SET utf8mb4
  COLLATE utf8mb4_unicode_ci;

USE campus_lost_found;

-- ── Users ──────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS users (
  id          INT           NOT NULL AUTO_INCREMENT,
  name        VARCHAR(100)  NOT NULL,
  email       VARCHAR(150)  NOT NULL UNIQUE,
  password    VARCHAR(255)  NOT NULL,
  role        ENUM('user','admin') NOT NULL DEFAULT 'user',
  department  VARCHAR(100)  DEFAULT NULL,
  phone       VARCHAR(20)   DEFAULT NULL,
  created_at  DATETIME      NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at  DATETIME      NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  PRIMARY KEY (id),
  INDEX idx_email (email),
  INDEX idx_role  (role)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- ── Items ──────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS items (
  id          INT           NOT NULL AUTO_INCREMENT,
  title       VARCHAR(200)  NOT NULL,
  category    VARCHAR(100)  NOT NULL,
  description TEXT          DEFAULT NULL,
  location    VARCHAR(200)  NOT NULL,
  date_lost   DATE          NOT NULL,
  time_lost   TIME          DEFAULT NULL,
  image       VARCHAR(500)  DEFAULT NULL,
  color       VARCHAR(80)   DEFAULT NULL,
  brand       VARCHAR(100)  DEFAULT NULL,
  reward      VARCHAR(100)  DEFAULT NULL,
  type        ENUM('lost','found') NOT NULL DEFAULT 'lost',
  status      ENUM('lost','found','claimed','returned') NOT NULL DEFAULT 'lost',
  user_id     INT           NOT NULL,
  created_at  DATETIME      NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at  DATETIME      NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  PRIMARY KEY (id),
  INDEX idx_status    (status),
  INDEX idx_type      (type),
  INDEX idx_user      (user_id),
  INDEX idx_category  (category),
  INDEX idx_created   (created_at),
  FULLTEXT idx_search (title, description, location),
  CONSTRAINT fk_items_user FOREIGN KEY (user_id)
    REFERENCES users(id) ON DELETE CASCADE ON UPDATE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- ── Claims ─────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS claims (
  id           INT           NOT NULL AUTO_INCREMENT,
  item_id      INT           NOT NULL,
  claimant_id  INT           NOT NULL,
  message      TEXT          NOT NULL,
  contact      VARCHAR(100)  DEFAULT NULL,
  status       ENUM('pending','approved','rejected') NOT NULL DEFAULT 'pending',
  admin_note   VARCHAR(500)  DEFAULT NULL,
  created_at   DATETIME      NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at   DATETIME      NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  PRIMARY KEY (id),
  INDEX idx_item      (item_id),
  INDEX idx_claimant  (claimant_id),
  INDEX idx_status    (status),
  -- Prevent duplicate pending claim by same user on same item
  UNIQUE KEY uniq_pending_claim (item_id, claimant_id, status),
  CONSTRAINT fk_claims_item FOREIGN KEY (item_id)
    REFERENCES items(id) ON DELETE CASCADE ON UPDATE CASCADE,
  CONSTRAINT fk_claims_user FOREIGN KEY (claimant_id)
    REFERENCES users(id) ON DELETE CASCADE ON UPDATE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- ═══════════════════════════════════════════════════════════════
--  SEED DATA  (for development/demo)
-- ═══════════════════════════════════════════════════════════════

-- Admin user  (password: admin123)
-- Student user (password: pass1234)
INSERT IGNORE INTO users (name, email, password, role, department) VALUES
  ('Admin User',  'admin@university.edu', '$2a$12$LQv3c1yqBwEHFAWPpBRIOe6E0BOX0SnE3N7gQzPwFH5aaGaL2reoO', 'admin', 'Administration'),
  ('Priya Singh',  'priya@university.edu', '$2a$12$92IXUNpkjO0rOQ5byMi.Ye4oKoEa3Ro9llC/.og/at2.uheWG/igi', 'user',  'Computer Science'),
  ('Rohan Mehta',  'rohan@university.edu', '$2a$12$92IXUNpkjO0rOQ5byMi.Ye4oKoEa3Ro9llC/.og/at2.uheWG/igi', 'user',  'Mechanical Engineering'),
  ('Sneha Patil',  'sneha@university.edu', '$2a$12$92IXUNpkjO0rOQ5byMi.Ye4oKoEa3Ro9llC/.og/at2.uheWG/igi', 'user',  'MBA');

-- Sample items
INSERT IGNORE INTO items (title, category, description, location, date_lost, type, status, color, brand, reward, user_id) VALUES
  ('MacBook Pro 14"',      'Electronics', 'Space Grey MacBook Pro M3 chip. Has a scratch on lid and a "Property of Priya Singh" sticker on bottom.', 'Main Library, 2nd Floor',   '2026-03-10', 'lost',  'lost',     'Space Grey', 'Apple',  '₹2000', 2),
  ('Brown Leather Wallet', 'Accessories', 'Medium brown leather wallet with two card slots. Contains student ID card.',                                 'Cafeteria Block B',          '2026-03-09', 'lost',  'lost',     'Brown',      '',       '',      3),
  ('AirPods Pro Gen 2',    'Electronics', 'White AirPods Pro in white case with a small blue dot sticker on back.',                                     'Sports Complex',             '2026-03-08', 'lost',  'claimed',  'White',      'Apple',  '',      4),
  ('Blue University Hoodie','Clothing',   'Navy blue university hoodie size Large with university logo on front.',                                      'Lecture Hall A',             '2026-03-06', 'lost',  'returned', 'Navy Blue',  'UniStore','',     2),
  ('Black Compact Umbrella','Accessories','Small black folding umbrella found near admin block entrance.',                                              'Admin Block Entrance',       '2026-03-11', 'found', 'found',    'Black',      'Repel',  '',      1),
  ('Silver Digital Watch', 'Accessories', 'Silver digital watch found on the bench in the gymnasium locker room.',                                      'Gymnasium Locker Room',      '2026-03-10', 'found', 'found',    'Silver',     'Casio',  '',      3),
  ('Prescription Glasses', 'Personal',    'Black-framed prescription glasses found on a chair after the afternoon session.',                            'Seminar Hall 3',             '2026-03-09', 'found', 'found',    'Black',      '',       '',      4),
  ('Key Bundle (3 keys)',  'Keys',        'Three keys on a green keyring with a small rubber duck keychain.',                                           'Engineering Block',          '2026-03-07', 'lost',  'lost',     'Metal',      '',       '',      3);

-- Sample claim
INSERT IGNORE INTO claims (item_id, claimant_id, message, contact, status) VALUES
  (1, 4, 'This is my laptop. Serial number is C02X****LVDT. I can provide the original purchase invoice and box.', '+91 98765 43210', 'pending'),
  (3, 2, 'These are my AirPods. I can show the serial number on my iPhone in Settings.', '+91 87654 32109', 'approved');

-- ═══════════════════════════════════════════════════════════════
--  Verify tables were created
-- ═══════════════════════════════════════════════════════════════
SHOW TABLES;
SELECT 'Schema setup complete!' AS message;
