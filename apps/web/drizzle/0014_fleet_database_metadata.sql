ALTER TABLE fleet_apps ADD COLUMN database_backend TEXT;
ALTER TABLE fleet_apps ADD COLUMN d1_database_name TEXT;

UPDATE fleet_apps
SET d1_database_name = COALESCE(d1_database_name, name || '-db')
WHERE COALESCE(database_backend, 'd1') = 'd1';
