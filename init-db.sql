-- Initialize EasyAsta database
-- This script will be executed when PostgreSQL container starts

-- Create database if it doesn't exist (handled by POSTGRES_DB env var)
-- CREATE DATABASE IF NOT EXISTS easyasta;

-- Grant privileges to the user
GRANT ALL PRIVILEGES ON DATABASE easyasta TO easyasta_user;

-- Set timezone
SET timezone = 'Europe/Rome';

-- Log database initialization
\echo 'EasyAsta database initialized successfully';