-- =============================================================================
-- Underwriting Submission Intelligence: cleanup
-- Drops everything sql/setup.sql created. The database drop removes its tables, views,
-- stages, semantic view, Cortex Search service, Cortex Agent, and Git repository clone.
-- Objects are owned by USI_DEMO_ROLE, so they are dropped as that role first.
-- =============================================================================
USE ROLE ACCOUNTADMIN;

USE ROLE USI_DEMO_ROLE;
DROP DATABASE IF EXISTS UNDERWRITING_SUBMISSION_DEMO;
DROP WAREHOUSE IF EXISTS USI_WH;

USE ROLE ACCOUNTADMIN;
DROP INTEGRATION IF EXISTS USI_GIT_API;
DROP ROLE IF EXISTS USI_DEMO_ROLE;
