-- Add app_status table for cron-based fleet status checks
CREATE TABLE IF NOT EXISTS `app_status` (
  `app` text PRIMARY KEY NOT NULL,
  `url` text NOT NULL,
  `status` text NOT NULL,
  `status_code` integer,
  `checked_at` text NOT NULL
);
