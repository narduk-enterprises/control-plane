-- provision_jobs: Tracks async app provisioning pipeline
CREATE TABLE IF NOT EXISTS provision_jobs (
  id TEXT PRIMARY KEY,
  app_name TEXT NOT NULL,
  display_name TEXT NOT NULL,
  app_url TEXT NOT NULL,
  github_repo TEXT NOT NULL,
  status TEXT NOT NULL DEFAULT 'pending',
  deployed_url TEXT,
  ga_property_id TEXT,
  error_message TEXT,
  created_at TEXT NOT NULL,
  updated_at TEXT NOT NULL
);

CREATE INDEX IF NOT EXISTS idx_provision_jobs_app_name ON provision_jobs(app_name);
CREATE INDEX IF NOT EXISTS idx_provision_jobs_status ON provision_jobs(status);
