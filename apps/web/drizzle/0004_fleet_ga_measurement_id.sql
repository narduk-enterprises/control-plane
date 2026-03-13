-- Add ga_measurement_id column to fleet_apps.
-- ga_property_id is the numeric GA4 Property ID used for the Reporting API (e.g. "526233051").
-- ga_measurement_id is the G-XXXXXXXX string used in the gtag runtime config (e.g. "G-Z463980Z97").
ALTER TABLE `fleet_apps` ADD COLUMN `ga_measurement_id` TEXT;

