-- Migration to add IndexNow tracking columns to app_status table
ALTER TABLE `app_status` ADD `indexnow_last_submission` text;
ALTER TABLE `app_status` ADD `indexnow_total_submissions` integer DEFAULT 0 NOT NULL;
ALTER TABLE `app_status` ADD `indexnow_last_submitted_count` integer;
