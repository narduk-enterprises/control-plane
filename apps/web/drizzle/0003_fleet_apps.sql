-- Fleet Apps registry table: single source of truth for all narduk-enterprises fleet apps.
-- Replaces the hardcoded arrays previously in server/data/fleet-registry.ts.
CREATE TABLE IF NOT EXISTS `fleet_apps` (
  `name`             TEXT PRIMARY KEY NOT NULL,
  `url`              TEXT NOT NULL,
  `doppler_project`  TEXT NOT NULL,
  `ga_property_id`   TEXT,
  `posthog_app_name` TEXT,
  `github_repo`      TEXT,
  `is_active`        INTEGER NOT NULL DEFAULT 1,
  `created_at`       TEXT NOT NULL,
  `updated_at`       TEXT NOT NULL
);
