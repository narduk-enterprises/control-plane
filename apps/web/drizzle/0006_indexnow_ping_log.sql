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
