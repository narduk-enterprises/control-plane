ALTER TABLE `fleet_apps` ADD COLUMN `forgejo_repo` text;
ALTER TABLE `fleet_apps` ADD COLUMN `repo_primary` text NOT NULL DEFAULT 'github';
UPDATE `fleet_apps`
SET
  `forgejo_repo` = COALESCE(`forgejo_repo`, `github_repo`),
  `repo_primary` = COALESCE(NULLIF(`repo_primary`, ''), 'github');

ALTER TABLE `provision_jobs` ADD COLUMN `forgejo_repo` text;
ALTER TABLE `provision_jobs` ADD COLUMN `repo_primary` text NOT NULL DEFAULT 'github';
UPDATE `provision_jobs`
SET
  `forgejo_repo` = COALESCE(`forgejo_repo`, `github_repo`),
  `repo_primary` = COALESCE(NULLIF(`repo_primary`, ''), 'github');
