ALTER TABLE fleet_apps ADD COLUMN auth_enabled INTEGER NOT NULL DEFAULT 1;
ALTER TABLE fleet_apps ADD COLUMN redirect_base_url TEXT;
ALTER TABLE fleet_apps ADD COLUMN login_path TEXT NOT NULL DEFAULT '/login';
ALTER TABLE fleet_apps ADD COLUMN callback_path TEXT NOT NULL DEFAULT '/auth/callback';
ALTER TABLE fleet_apps ADD COLUMN logout_path TEXT NOT NULL DEFAULT '/logout';
ALTER TABLE fleet_apps ADD COLUMN confirm_path TEXT NOT NULL DEFAULT '/auth/confirm';
ALTER TABLE fleet_apps ADD COLUMN reset_path TEXT NOT NULL DEFAULT '/reset-password';
ALTER TABLE fleet_apps ADD COLUMN public_signup INTEGER NOT NULL DEFAULT 1;
ALTER TABLE fleet_apps ADD COLUMN providers TEXT NOT NULL DEFAULT 'apple,email';
ALTER TABLE fleet_apps ADD COLUMN require_mfa INTEGER NOT NULL DEFAULT 0;

UPDATE fleet_apps
SET redirect_base_url = COALESCE(redirect_base_url, url)
WHERE redirect_base_url IS NULL;
