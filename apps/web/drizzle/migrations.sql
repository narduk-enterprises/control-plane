-- ─────────────────────────────────────────────────────────────
-- Consolidated D1 migrations — runs on every `pnpm run dev`
-- All statements are idempotent (CREATE TABLE IF NOT EXISTS).
-- ─────────────────────────────────────────────────────────────

-- ═══ Layer base tables ══════════════════════════════════════

CREATE TABLE IF NOT EXISTS `users` (
  `id` text PRIMARY KEY NOT NULL,
  `email` text NOT NULL,
  `password_hash` text,
  `name` text,
  `apple_id` text,
  `is_admin` integer DEFAULT false,
  `created_at` text NOT NULL,
  `updated_at` text NOT NULL
);

CREATE UNIQUE INDEX IF NOT EXISTS `users_email_unique` ON `users` (`email`);
CREATE UNIQUE INDEX IF NOT EXISTS `users_apple_id_unique` ON `users` (`apple_id`);

CREATE TABLE IF NOT EXISTS `sessions` (
  `id` text PRIMARY KEY NOT NULL,
  `user_id` text NOT NULL REFERENCES `users`(`id`) ON DELETE CASCADE,
  `expires_at` integer NOT NULL,
  `created_at` text NOT NULL
);

CREATE TABLE IF NOT EXISTS `todos` (
  `id` integer PRIMARY KEY AUTOINCREMENT,
  `user_id` text NOT NULL REFERENCES `users`(`id`) ON DELETE CASCADE,
  `title` text NOT NULL,
  `completed` integer DEFAULT false,
  `created_at` text NOT NULL
);

CREATE TABLE IF NOT EXISTS `kv_cache` (
  `key` text PRIMARY KEY NOT NULL,
  `value` text NOT NULL,
  `expires_at` integer NOT NULL
);

CREATE TABLE IF NOT EXISTS `api_keys` (
  `id` text PRIMARY KEY NOT NULL,
  `user_id` text NOT NULL REFERENCES `users`(`id`) ON DELETE CASCADE,
  `name` text NOT NULL,
  `key_hash` text NOT NULL,
  `key_prefix` text NOT NULL,
  `last_used_at` text,
  `expires_at` integer,
  `created_at` text NOT NULL
);

-- ═══ App-specific tables ════════════════════════════════════

CREATE TABLE IF NOT EXISTS `app_status` (
  `app` text PRIMARY KEY NOT NULL,
  `url` text NOT NULL,
  `status` text NOT NULL,
  `status_code` integer,
  `checked_at` text NOT NULL,
  `indexnow_last_submission` text,
  `indexnow_total_submissions` integer NOT NULL DEFAULT 0,
  `indexnow_last_submitted_count` integer,
  `gsc_sitemap_fingerprint` text,
  `gsc_sitemap_checked_at` text,
  `gsc_sitemap_last_submitted_at` text,
  `gsc_sitemap_total_submissions` integer NOT NULL DEFAULT 0
);

CREATE TABLE IF NOT EXISTS `fleet_apps` (
  `name`             TEXT PRIMARY KEY NOT NULL,
  `url`              TEXT NOT NULL,
  `doppler_project`  TEXT NOT NULL,
  `ga_property_id`   TEXT,
  `ga_measurement_id` TEXT,
  `posthog_app_name` TEXT,
  `github_repo`      TEXT,
  `is_active`        INTEGER NOT NULL DEFAULT 1,
  `created_at`       TEXT NOT NULL,
  `updated_at`       TEXT NOT NULL
);

-- provision_jobs: Tracks async app provisioning pipeline
CREATE TABLE IF NOT EXISTS `provision_jobs` (
  `id`             TEXT PRIMARY KEY NOT NULL,
  `app_name`       TEXT NOT NULL,
  `display_name`   TEXT NOT NULL,
  `app_url`        TEXT NOT NULL,
  `github_repo`    TEXT NOT NULL,
  `status`         TEXT NOT NULL DEFAULT 'pending',
  `deployed_url`   TEXT,
  `ga_property_id` TEXT,
  `error_message`  TEXT,
  `created_at`     TEXT NOT NULL,
  `updated_at`     TEXT NOT NULL
);

CREATE INDEX IF NOT EXISTS idx_provision_jobs_app_name ON provision_jobs(app_name);
CREATE INDEX IF NOT EXISTS idx_provision_jobs_status ON provision_jobs(status);

CREATE TABLE IF NOT EXISTS `indexnow_ping_log` (
  `id` text PRIMARY KEY NOT NULL,
  `app` text NOT NULL,
  `pinged_at` text NOT NULL,
  `ok` integer NOT NULL,
  `downstream_status` integer,
  `url_count` integer,
  `target_url` text,
  `message` text
);

CREATE INDEX IF NOT EXISTS idx_indexnow_ping_log_pinged_at ON indexnow_ping_log(pinged_at);

CREATE TABLE IF NOT EXISTS `gsc_sitemap_submit_log` (
  `id` text PRIMARY KEY NOT NULL,
  `app` text NOT NULL,
  `submitted_at` text NOT NULL,
  `ok` integer NOT NULL,
  `trigger` text NOT NULL,
  `sitemap_url` text,
  `gsc_property` text,
  `message` text
);

CREATE INDEX IF NOT EXISTS idx_gsc_sitemap_submit_log_submitted_at ON gsc_sitemap_submit_log(submitted_at);
