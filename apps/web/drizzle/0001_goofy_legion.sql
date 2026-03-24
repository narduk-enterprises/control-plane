CREATE TABLE `api_keys` (
	`id` text PRIMARY KEY NOT NULL,
	`user_id` text NOT NULL,
	`name` text NOT NULL,
	`key_hash` text NOT NULL,
	`key_prefix` text NOT NULL,
	`last_used_at` text,
	`expires_at` integer,
	`created_at` text NOT NULL,
	FOREIGN KEY (`user_id`) REFERENCES `users`(`id`) ON UPDATE no action ON DELETE cascade
);
--> statement-breakpoint
CREATE TABLE `fleet_apps` (
	`name` text PRIMARY KEY NOT NULL,
	`url` text NOT NULL,
	`doppler_project` text NOT NULL,
	`nuxt_port` integer,
	`ga_property_id` text,
	`ga_measurement_id` text,
	`posthog_app_name` text,
	`github_repo` text,
	`app_description` text,
	`is_active` integer DEFAULT true NOT NULL,
	`created_at` text NOT NULL,
	`updated_at` text NOT NULL
);
--> statement-breakpoint
CREATE TABLE `gsc_sitemap_submit_log` (
	`id` text PRIMARY KEY NOT NULL,
	`app` text NOT NULL,
	`submitted_at` text NOT NULL,
	`ok` integer NOT NULL,
	`trigger` text NOT NULL,
	`sitemap_url` text,
	`gsc_property` text,
	`message` text
);
--> statement-breakpoint
CREATE TABLE `indexnow_ping_log` (
	`id` text PRIMARY KEY NOT NULL,
	`app` text NOT NULL,
	`pinged_at` text NOT NULL,
	`ok` integer NOT NULL,
	`downstream_status` integer,
	`url_count` integer,
	`target_url` text,
	`message` text
);
--> statement-breakpoint
CREATE TABLE `notifications` (
	`id` text PRIMARY KEY NOT NULL,
	`user_id` text NOT NULL,
	`kind` text NOT NULL,
	`title` text NOT NULL,
	`body` text NOT NULL,
	`icon` text,
	`action_url` text,
	`resource_type` text,
	`resource_id` text,
	`is_read` integer DEFAULT false NOT NULL,
	`read_at` text,
	`created_at` text NOT NULL,
	FOREIGN KEY (`user_id`) REFERENCES `users`(`id`) ON UPDATE no action ON DELETE cascade
);
--> statement-breakpoint
CREATE TABLE `provision_job_logs` (
	`id` text PRIMARY KEY NOT NULL,
	`provision_id` text NOT NULL,
	`level` text DEFAULT 'info' NOT NULL,
	`message` text NOT NULL,
	`step` text,
	`created_at` text NOT NULL,
	FOREIGN KEY (`provision_id`) REFERENCES `provision_jobs`(`id`) ON UPDATE no action ON DELETE cascade
);
--> statement-breakpoint
CREATE TABLE `provision_jobs` (
	`id` text PRIMARY KEY NOT NULL,
	`app_name` text NOT NULL,
	`display_name` text NOT NULL,
	`app_url` text NOT NULL,
	`github_repo` text NOT NULL,
	`nuxt_port` integer,
	`status` text DEFAULT 'pending' NOT NULL,
	`deployed_url` text,
	`ga_property_id` text,
	`dispatch_inputs_json` text,
	`error_message` text,
	`created_at` text NOT NULL,
	`updated_at` text NOT NULL
);
--> statement-breakpoint
CREATE TABLE `system_prompts` (
	`name` text PRIMARY KEY NOT NULL,
	`content` text NOT NULL,
	`description` text NOT NULL,
	`updated_at` text NOT NULL
);
--> statement-breakpoint
ALTER TABLE `app_status` ADD `indexnow_last_submission` text;--> statement-breakpoint
ALTER TABLE `app_status` ADD `indexnow_total_submissions` integer DEFAULT 0 NOT NULL;--> statement-breakpoint
ALTER TABLE `app_status` ADD `indexnow_last_submitted_count` integer;--> statement-breakpoint
ALTER TABLE `app_status` ADD `gsc_sitemap_fingerprint` text;--> statement-breakpoint
ALTER TABLE `app_status` ADD `gsc_sitemap_checked_at` text;--> statement-breakpoint
ALTER TABLE `app_status` ADD `gsc_sitemap_last_submitted_at` text;--> statement-breakpoint
ALTER TABLE `app_status` ADD `gsc_sitemap_total_submissions` integer DEFAULT 0 NOT NULL;