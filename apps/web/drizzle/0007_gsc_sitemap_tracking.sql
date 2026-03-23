ALTER TABLE app_status ADD COLUMN gsc_sitemap_fingerprint TEXT;
ALTER TABLE app_status ADD COLUMN gsc_sitemap_checked_at TEXT;
ALTER TABLE app_status ADD COLUMN gsc_sitemap_last_submitted_at TEXT;
ALTER TABLE app_status ADD COLUMN gsc_sitemap_total_submissions INTEGER NOT NULL DEFAULT 0;

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
