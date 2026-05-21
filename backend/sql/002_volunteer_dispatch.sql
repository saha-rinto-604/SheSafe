/**
 * 002_volunteer_dispatch.sql
 * ─────────────────────────────────────────────────────────────────────
 * ResQher Database Migration #002 — Volunteer Assistance Workflow
 *
 * Changes:
 *   1. Expand incidents.status ENUM to include 'IN_PROGRESS'
 *   2. Add volunteer_id + accepted_at columns to incidents
 *   3. Add latest_latitude / latest_longitude + is_online to users
 *   4. Add composite index on user_locations for "latest position" queries
 */

USE resqher_db;

-- ── 1. Expand incident status to include the volunteer-accepted lock state ──
ALTER TABLE incidents
  MODIFY COLUMN status ENUM('ACTIVE','IN_PROGRESS','RESOLVED','CANCELLED') NOT NULL DEFAULT 'ACTIVE';

-- ── 2. Track which volunteer accepted and when ─────────────────────────────
ALTER TABLE incidents
  ADD COLUMN volunteer_id BIGINT UNSIGNED DEFAULT NULL AFTER user_id,
  ADD COLUMN accepted_at TIMESTAMP NULL DEFAULT NULL AFTER created_at,
  ADD KEY idx_incidents_volunteer (volunteer_id),
  ADD CONSTRAINT fk_incidents_volunteer FOREIGN KEY (volunteer_id)
    REFERENCES users(id) ON UPDATE CASCADE ON DELETE SET NULL;

-- ── 3. Quick-win: cache latest position on users for fast Haversine scans ──
ALTER TABLE users
  ADD COLUMN is_online BOOLEAN NOT NULL DEFAULT FALSE,
  ADD COLUMN last_seen_at TIMESTAMP NULL DEFAULT NULL,
  ADD COLUMN latest_latitude DECIMAL(10,7) DEFAULT NULL,
  ADD COLUMN latest_longitude DECIMAL(10,7) DEFAULT NULL;

-- ── 4. Composite index for fast "latest position" subquery fallback ────────
ALTER TABLE user_locations
  ADD KEY idx_user_locations_latest (user_id, recorded_at);
