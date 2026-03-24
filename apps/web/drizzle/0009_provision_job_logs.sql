CREATE TABLE IF NOT EXISTS `provision_job_logs` (
  `id` text PRIMARY KEY NOT NULL,
  `provision_id` text NOT NULL REFERENCES `provision_jobs`(`id`) ON DELETE CASCADE,
  `level` text NOT NULL DEFAULT 'info',
  `message` text NOT NULL,
  `step` text,
  `created_at` text NOT NULL
);

CREATE INDEX IF NOT EXISTS `idx_provision_job_logs_provision_id` ON `provision_job_logs` (`provision_id`);
CREATE INDEX IF NOT EXISTS `idx_provision_job_logs_created_at` ON `provision_job_logs` (`created_at`);
