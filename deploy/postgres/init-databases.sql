-- Runs once, on first container start, against the default POSTGRES_DB.
-- Creates one database per service so each keeps its own schema, sharing a single
-- Postgres instance for local dev per the Step 1 architecture decision.
CREATE DATABASE auraevents_identity;
CREATE DATABASE auraevents_events;
CREATE DATABASE auraevents_cms;
