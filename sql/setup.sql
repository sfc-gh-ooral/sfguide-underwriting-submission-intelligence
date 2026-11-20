-- =============================================================================
-- Underwriting Submission Intelligence: setup
-- Runs top to bottom in one Snowsight worksheet (no find-and-replace) as ACCOUNTADMIN,
-- or as any role that can create roles, warehouses, databases, and API integrations.
--
-- Requirements: Cortex AI functions (AI_PARSE_DOCUMENT, AI_EXTRACT, AI_CLASSIFY,
-- AI_COMPLETE), Cortex Search, Cortex Analyst, and Cortex Agents available in your region
-- (or cross-region inference enabled). Any edition. All data is synthetic.
--
-- Creates (and changes nothing that already exists):
--   role        USI_DEMO_ROLE (least privilege: owns only the objects below)
--   warehouse   USI_WH (XSMALL, AUTO_SUSPEND = 60)
--   database    UNDERWRITING_SUBMISSION_DEMO (schemas UW and APP)
--   integration USI_GIT_API (read-only access to the public example repository)
-- Remove everything with sql/cleanup.sql.
-- =============================================================================

-- 1. Role, warehouse, database ------------------------------------------------
USE ROLE ACCOUNTADMIN;
SET my_user = CURRENT_USER();

CREATE ROLE IF NOT EXISTS USI_DEMO_ROLE COMMENT = 'Underwriting Submission Intelligence example (synthetic data)';
GRANT ROLE USI_DEMO_ROLE TO ROLE SYSADMIN;
GRANT ROLE USI_DEMO_ROLE TO USER IDENTIFIER($my_user);

CREATE WAREHOUSE IF NOT EXISTS USI_WH
  WAREHOUSE_SIZE = XSMALL AUTO_SUSPEND = 60 AUTO_RESUME = TRUE INITIALLY_SUSPENDED = TRUE
  COMMENT = 'Underwriting Submission Intelligence example';
GRANT OWNERSHIP ON WAREHOUSE USI_WH TO ROLE USI_DEMO_ROLE;

CREATE DATABASE IF NOT EXISTS UNDERWRITING_SUBMISSION_DEMO COMMENT = 'Underwriting Submission Intelligence example (synthetic data)';
GRANT OWNERSHIP ON DATABASE UNDERWRITING_SUBMISSION_DEMO TO ROLE USI_DEMO_ROLE;

-- Cortex AI functions, Cortex Search, Cortex Analyst, and Cortex Agents.
GRANT DATABASE ROLE SNOWFLAKE.CORTEX_USER TO ROLE USI_DEMO_ROLE;

-- Read-only access to the public GitHub repository that holds the synthetic files.
CREATE API INTEGRATION IF NOT EXISTS USI_GIT_API
  API_PROVIDER = git_https_api
  API_ALLOWED_PREFIXES = ('https://github.com/sfc-gh-ooral/')
  ENABLED = TRUE
  COMMENT = 'Underwriting Submission Intelligence example: public repository, no secret';
GRANT USAGE ON INTEGRATION USI_GIT_API TO ROLE USI_DEMO_ROLE;

-- Everything below runs as the least-privilege role.
USE ROLE USI_DEMO_ROLE;
USE WAREHOUSE USI_WH;
USE DATABASE UNDERWRITING_SUBMISSION_DEMO;
CREATE SCHEMA IF NOT EXISTS UW  COMMENT = 'Submissions, documents, extraction, scoring';
CREATE SCHEMA IF NOT EXISTS APP COMMENT = 'Underwriter decisions and AI drafts written by the app';
USE SCHEMA UW;

-- 2. Load synthetic files from the repository ----------------------------------
CREATE OR REPLACE GIT REPOSITORY USI_REPO
  API_INTEGRATION = USI_GIT_API
  ORIGIN = 'https://github.com/sfc-gh-ooral/sfguide-underwriting-submission-intelligence.git';

CREATE STAGE IF NOT EXISTS USI_DATA COMMENT = 'Synthetic CSVs (brokers, appetite guide, SOVs, portfolio)';
COPY FILES INTO @USI_DATA FROM @USI_REPO/branches/main/data/csv/;

-- Broker submission documents: one application PDF and one loss run PDF per submission.
-- Server-side encryption and a directory table are required for the AI file functions.
CREATE STAGE IF NOT EXISTS SUBMISSION_DOCS
  DIRECTORY = (ENABLE = TRUE) ENCRYPTION = (TYPE = 'SNOWFLAKE_SSE')
  COMMENT = 'Synthetic broker submission PDFs';
COPY FILES INTO @SUBMISSION_DOCS FROM @USI_REPO/branches/main/data/docs/;
ALTER STAGE SUBMISSION_DOCS REFRESH;

CREATE OR REPLACE FILE FORMAT USI_CSV TYPE = CSV SKIP_HEADER = 1 FIELD_OPTIONALLY_ENCLOSED_BY = '"' COMPRESSION = GZIP;

CREATE OR REPLACE TABLE BROKERS (broker_id STRING, broker_name STRING, tier STRING, region STRING, ytd_written_premium NUMBER(14,0), hit_ratio NUMBER(5,3));
CREATE OR REPLACE TABLE APPETITE_GUIDE (rule_id STRING, section STRING, class_code STRING, rule_type STRING, appetite STRING, max_tiv NUMBER(14,0), territory STRING, guidance_text STRING);
CREATE OR REPLACE TABLE SUBMISSIONS (
  submission_id STRING, broker_id STRING, received_at TIMESTAMP_NTZ, insured_name STRING, mailing_street STRING, mailing_city STRING, mailing_state STRING,
  declared_class STRING, operations_description STRING, years_in_business NUMBER, annual_revenue NUMBER(14,0), employees NUMBER,
  requested_limit NUMBER(14,0), deductible NUMBER(10,0), effective_date DATE, total_tiv NUMBER(14,0),
  has_application STRING, has_sov STRING, has_loss_runs STRING, status STRING);
CREATE OR REPLACE TABLE SOV_LOCATIONS (submission_id STRING, loc_no NUMBER, street STRING, city STRING, state STRING, latitude FLOAT, longitude FLOAT,
  construction STRING, year_built NUMBER, stories NUMBER, sprinklered STRING, tiv NUMBER(14,0));
CREATE OR REPLACE TABLE BROKER_EMAILS (submission_id STRING, sent_at TIMESTAMP_NTZ, from_name STRING, subject STRING, body STRING);
CREATE OR REPLACE TABLE BOUND_POLICIES (policy_id STRING, insured_name STRING, class_code STRING, state STRING, bound_date DATE, premium NUMBER(12,0), total_tiv NUMBER(14,0));
CREATE OR REPLACE TABLE PORTFOLIO_EXPOSURE (policy_id STRING, loc_no NUMBER, city STRING, state STRING, latitude FLOAT, longitude FLOAT, tiv NUMBER(14,0));
CREATE OR REPLACE TABLE QUOTES (quote_id STRING, submission_id STRING, quoted_at TIMESTAMP_NTZ, premium NUMBER(12,0), status STRING);
CREATE OR REPLACE TABLE COASTLINE_POINTS (point_id NUMBER, latitude FLOAT, longitude FLOAT);
-- The generator's own loss values, kept only to measure extraction accuracy (see README).
CREATE OR REPLACE TABLE LOSS_RUNS_KEYED (submission_id STRING, year NUMBER, carrier STRING, claims NUMBER, incurred NUMBER(12,0), paid NUMBER(12,0), open NUMBER, largest STRING);

COPY INTO BROKERS            FROM @USI_DATA/brokers.csv.gz            FILE_FORMAT = (FORMAT_NAME = USI_CSV);
COPY INTO APPETITE_GUIDE     FROM @USI_DATA/appetite_guide.csv.gz     FILE_FORMAT = (FORMAT_NAME = USI_CSV);
COPY INTO SUBMISSIONS        FROM @USI_DATA/submissions.csv.gz        FILE_FORMAT = (FORMAT_NAME = USI_CSV);
COPY INTO SOV_LOCATIONS      FROM @USI_DATA/sov_locations.csv.gz      FILE_FORMAT = (FORMAT_NAME = USI_CSV);
COPY INTO BROKER_EMAILS      FROM @USI_DATA/broker_emails.csv.gz      FILE_FORMAT = (FORMAT_NAME = USI_CSV);
COPY INTO BOUND_POLICIES     FROM @USI_DATA/bound_policies.csv.gz     FILE_FORMAT = (FORMAT_NAME = USI_CSV);
COPY INTO PORTFOLIO_EXPOSURE FROM @USI_DATA/portfolio_exposure.csv.gz FILE_FORMAT = (FORMAT_NAME = USI_CSV);
COPY INTO QUOTES             FROM @USI_DATA/quotes.csv.gz             FILE_FORMAT = (FORMAT_NAME = USI_CSV);
COPY INTO COASTLINE_POINTS   FROM @USI_DATA/coastline_points.csv.gz   FILE_FORMAT = (FORMAT_NAME = USI_CSV);
COPY INTO LOSS_RUNS_KEYED    FROM @USI_DATA/loss_runs_keyed.csv.gz    FILE_FORMAT = (FORMAT_NAME = USI_CSV);

-- Business clock, frozen so "this month" and days-waiting match the sample data.
CREATE OR REPLACE TABLE CONFIG (business_date DATE);
INSERT INTO CONFIG VALUES ('2026-11-18');

-- 3. Document AI: parse, extract, classify -------------------------------------
-- 3a. Full text of every application with AI_PARSE_DOCUMENT (OCR mode: fast text for search and review).
CREATE OR REPLACE TABLE DOC_TEXT AS
SELECT SPLIT_PART(relative_path, '_', 1) AS submission_id, relative_path,
       AI_PARSE_DOCUMENT(TO_FILE('@SUBMISSION_DOCS', relative_path), {'mode': 'OCR'}):content::STRING AS content
FROM DIRECTORY(@SUBMISSION_DOCS)
WHERE relative_path LIKE '%_application.pdf';

-- 3b. Application fields with AI_EXTRACT; citation => TRUE returns the page box of each answer.
CREATE OR REPLACE TABLE APP_EXTRACT AS
SELECT SPLIT_PART(relative_path, '_', 1) AS submission_id, relative_path,
       AI_EXTRACT(
         file => TO_FILE('@SUBMISSION_DOCS', relative_path),
         responseFormat => {
           'insured_name': 'What is the named insured?',
           'mailing_address': 'What is the mailing address?',
           'broker': 'Who is the producer or broker?',
           'effective_date': 'What is the proposed effective date?',
           'years_in_business': 'How many years in business?',
           'annual_revenue': 'What is the annual revenue?',
           'employees': 'What is the number of employees?',
           'requested_limit': 'What is the requested per-occurrence limit?',
           'deductible': 'What is the deductible?',
           'declared_business_type': 'What is the business type as declared?',
           'operations': 'What is the full nature of operations / description of business?',
           'location_count': 'What is the number of locations?',
           'total_tiv': 'What is the total insured value?'
         },
         citation => TRUE) AS result
FROM DIRECTORY(@SUBMISSION_DOCS)
WHERE relative_path LIKE '%_application.pdf';

-- 3c. Loss run tables with AI_EXTRACT table extraction.
CREATE OR REPLACE TABLE LOSS_EXTRACT AS
SELECT SPLIT_PART(relative_path, '_', 1) AS submission_id, relative_path,
       AI_EXTRACT(
         file => TO_FILE('@SUBMISSION_DOCS', relative_path),
         responseFormat => {'schema': {'type': 'object', 'properties': {'losses': {
           'description': 'Five-year loss history', 'type': 'object',
           'column_ordering': ['Policy Year', 'Carrier', 'Claims', 'Incurred', 'Paid', 'Open', 'Largest Loss'],
           'properties': {
             'Policy Year': {'description': 'Policy Year', 'type': 'array'}, 'Carrier': {'description': 'Carrier', 'type': 'array'},
             'Claims': {'description': 'Claims', 'type': 'array'}, 'Incurred': {'description': 'Incurred', 'type': 'array'},
             'Paid': {'description': 'Paid', 'type': 'array'}, 'Open': {'description': 'Open', 'type': 'array'},
             'Largest Loss': {'description': 'Largest Loss', 'type': 'array'}}}}}}) AS result
FROM DIRECTORY(@SUBMISSION_DOCS)
WHERE relative_path LIKE '%_loss_runs.pdf';

CREATE OR REPLACE VIEW LOSS_RUNS AS
SELECT e.submission_id,
       f.value::NUMBER AS policy_year,
       e.result:response:losses:"Carrier"[f.index]::STRING AS carrier,
       TRY_TO_NUMBER(e.result:response:losses:"Claims"[f.index]::STRING) AS claims,
       TRY_TO_NUMBER(REGEXP_REPLACE(e.result:response:losses:"Incurred"[f.index]::STRING, '[^0-9.]', '')) AS incurred,
       TRY_TO_NUMBER(REGEXP_REPLACE(e.result:response:losses:"Paid"[f.index]::STRING, '[^0-9.]', '')) AS paid,
       TRY_TO_NUMBER(e.result:response:losses:"Open"[f.index]::STRING) AS open_claims,
       e.result:response:losses:"Largest Loss"[f.index]::STRING AS largest_loss
FROM LOSS_EXTRACT e, LATERAL FLATTEN(input => e.result:response:losses:"Policy Year") f;

-- 3d. Class code from the operations description with AI_CLASSIFY. A hazardous activity
-- governs even when it is a minor part of the business, which is how hidden classes surface.
CREATE OR REPLACE TABLE CLASS_PREDICTIONS AS
SELECT s.submission_id,
       AI_CLASSIFY(
         a.result:response:operations::STRING,
         [ {'label': 'REST', 'description': 'Full-service or casual restaurant'},
           {'label': 'OFFC', 'description': 'Office building owner or lessor'},
           {'label': 'RETL', 'description': 'Retail store'},
           {'label': 'APTS', 'description': 'Apartment or habitational buildings'},
           {'label': 'MFGL', 'description': 'Light manufacturing or assembly'},
           {'label': 'WHSE', 'description': 'Warehouse or distribution of ordinary goods'},
           {'label': 'HOTL', 'description': 'Hotel or motel'},
           {'label': 'AUTO', 'description': 'Auto repair or collision shop'},
           {'label': 'CONT', 'description': 'Artisan contractor such as electrical or plumbing'},
           {'label': 'FIRE', 'description': 'Manufactures, stores, ships, or sells fireworks, explosives, or pyrotechnics, even seasonally'},
           {'label': 'NITE', 'description': 'Nightclub or bar with live entertainment'},
           {'label': 'ROOF', 'description': 'Roofing contractor'} ],
         {'task_description': 'Pick the underwriting class code that governs this commercial risk. If any hazardous activity is described, choose that class even if it is a small part of operations.'}
       ):labels[0]::STRING AS predicted_class
FROM SUBMISSIONS s JOIN APP_EXTRACT a ON a.submission_id = s.submission_id;

-- 4. Geospatial exposure -------------------------------------------------------
-- Distance to the nearest coastline point and the existing portfolio TIV within 25 km.
CREATE OR REPLACE TABLE LOCATION_EXPOSURE AS
WITH loc AS (SELECT l.*, ST_MAKEPOINT(longitude, latitude) AS pt FROM SOV_LOCATIONS l),
coast AS (SELECT MIN(ST_DISTANCE(l.pt, ST_MAKEPOINT(c.longitude, c.latitude))) / 1000 AS km, l.submission_id, l.loc_no
          FROM loc l CROSS JOIN COASTLINE_POINTS c GROUP BY l.submission_id, l.loc_no),
near AS (SELECT l.submission_id, l.loc_no, COUNT(p.policy_id) AS nearby_policies, COALESCE(SUM(p.tiv), 0) AS nearby_tiv
         FROM loc l LEFT JOIN PORTFOLIO_EXPOSURE p ON ST_DWITHIN(l.pt, ST_MAKEPOINT(p.longitude, p.latitude), 25000)
         GROUP BY l.submission_id, l.loc_no)
SELECT l.submission_id, l.loc_no, l.street, l.city, l.state, l.latitude, l.longitude, l.construction, l.year_built, l.sprinklered, l.tiv,
       ROUND(c.km, 1) AS km_to_coast,
       (c.km <= 16 AND l.state IN ('FL', 'TX', 'LA')) AS is_coastal,
       H3_LATLNG_TO_CELL_STRING(l.latitude, l.longitude, 5) AS h3_cell,
       n.nearby_policies, n.nearby_tiv
FROM loc l JOIN coast c USING (submission_id, loc_no) JOIN near n USING (submission_id, loc_no);

-- Portfolio exposure by H3 cell (resolution 5, roughly 250 km²) for the map.
CREATE OR REPLACE VIEW PORTFOLIO_CELLS AS
SELECT H3_LATLNG_TO_CELL_STRING(latitude, longitude, 5) AS h3_cell,
       ST_Y(H3_CELL_TO_POINT(H3_LATLNG_TO_CELL(latitude, longitude, 5))) AS lat,
       ST_X(H3_CELL_TO_POINT(H3_LATLNG_TO_CELL(latitude, longitude, 5))) AS lon,
       COUNT(*) AS locations, SUM(tiv) AS tiv
FROM PORTFOLIO_EXPOSURE GROUP BY 1, 2, 3;

-- 5. Appetite, completeness, and fit score --------------------------------------
CREATE OR REPLACE VIEW SUBMISSION_SCORES AS
WITH loss AS (SELECT submission_id, SUM(claims) AS claims_5y, SUM(incurred) AS incurred_5y, MAX(incurred) AS max_year_incurred, SUM(open_claims) AS open_claims
              FROM LOSS_RUNS GROUP BY 1),
geo AS (SELECT submission_id, COUNT(*) AS locations, SUM(IFF(is_coastal, 1, 0)) AS coastal_locations, SUM(IFF(is_coastal, tiv, 0)) AS coastal_tiv,
               MAX(IFF(is_coastal, tiv, 0)) AS max_coastal_loc_tiv, SUM(IFF(is_coastal, nearby_tiv, 0)) AS coastal_nearby_tiv, MIN(km_to_coast) AS min_km_to_coast
        FROM LOCATION_EXPOSURE GROUP BY 1),
base AS (
  SELECT s.submission_id, s.insured_name, s.received_at, s.mailing_state AS state, s.mailing_city AS city, s.status, s.total_tiv, s.requested_limit, s.annual_revenue,
         s.declared_class, cp.predicted_class, g.name AS class_name, g.appetite AS class_appetite, g.max_tiv AS class_max_tiv,
         b.broker_id, b.broker_name, b.tier AS broker_tier, b.hit_ratio,
         s.has_application, s.has_sov, s.has_loss_runs,
         geo.locations, geo.coastal_locations, geo.coastal_tiv, geo.max_coastal_loc_tiv, geo.coastal_nearby_tiv, geo.min_km_to_coast,
         loss.claims_5y, loss.incurred_5y, loss.open_claims,
         DATEDIFF('day', s.received_at, (SELECT business_date FROM CONFIG)) AS days_waiting,
         ROW_NUMBER() OVER (ORDER BY s.received_at) AS fifo_position
  FROM SUBMISSIONS s
  JOIN BROKERS b ON b.broker_id = s.broker_id
  LEFT JOIN CLASS_PREDICTIONS cp ON cp.submission_id = s.submission_id
  LEFT JOIN (SELECT class_code, appetite, max_tiv, REGEXP_SUBSTR(guidance_text, '^[^(]+') AS name FROM APPETITE_GUIDE WHERE rule_type = 'CLASS') g ON g.class_code = cp.predicted_class
  LEFT JOIN geo ON geo.submission_id = s.submission_id
  LEFT JOIN loss ON loss.submission_id = s.submission_id
  WHERE s.status = 'New'),
rules AS (
  SELECT *,
    CASE WHEN class_appetite = 'OUT' THEN 'OUT'
         WHEN class_appetite = 'REFER' OR coastal_locations > 0 OR state = 'LA' OR total_tiv > class_max_tiv
              OR incurred_5y > 250000 OR open_claims > 1 THEN 'REFER'
         ELSE 'IN' END AS appetite,
    ARRAY_COMPACT(ARRAY_CONSTRUCT(
      IFF(class_appetite = 'OUT', 'Class ' || predicted_class || ' (' || TRIM(class_name) || ') is outside appetite', NULL),
      IFF(predicted_class <> declared_class, 'Operations describe ' || predicted_class || ', but the application declares ' || declared_class, NULL),
      IFF(class_appetite = 'REFER', 'Class ' || predicted_class || ' requires referral', NULL),
      IFF(total_tiv > class_max_tiv AND class_appetite <> 'OUT', 'Total TIV exceeds the class maximum', NULL),
      IFF(coastal_locations > 0, coastal_locations || ' location(s) within 16 km of the coast', NULL),
      IFF(coastal_nearby_tiv > 25000000, 'Coastal accumulation: existing portfolio TIV within 25 km is high', NULL),
      IFF(state = 'LA', 'Louisiana accounts are referred', NULL),
      IFF(incurred_5y > 250000, 'Five-year incurred losses above $250K', NULL),
      IFF(open_claims > 1, 'More than one open claim', NULL))) AS appetite_reasons,
    ARRAY_COMPACT(ARRAY_CONSTRUCT(IFF(has_application = 'N', 'Application', NULL), IFF(has_sov = 'N', 'Statement of values', NULL), IFF(has_loss_runs = 'N', 'Loss runs (5 years)', NULL))) AS missing_items
  FROM base),
pts AS (
  SELECT *,
    CASE appetite WHEN 'IN' THEN 35 WHEN 'REFER' THEN 18 ELSE 0 END AS pts_appetite,
    ROUND(20 * (3 - ARRAY_SIZE(missing_items)) / 3, 1) AS pts_completeness,
    CASE broker_tier WHEN 'Top' THEN 15 WHEN 'Core' THEN 9 ELSE 4 END + ROUND(hit_ratio * 10, 1) AS pts_broker,
    IFF(has_loss_runs = 'N', 0, ROUND(15 * (1 - LEAST(1, COALESCE(incurred_5y, 0) / 250000)), 1)) AS pts_loss,
    ROUND(10 * (1 - LEAST(1, COALESCE(coastal_tiv, 0) / 40000000)), 1) AS pts_concentration
  FROM rules)
SELECT *,
  IFF(appetite = 'OUT', LEAST(15, pts_appetite + pts_completeness + pts_broker + pts_loss + pts_concentration),
      pts_appetite + pts_completeness + pts_broker + pts_loss + pts_concentration) AS fit_score,
  ARRAY_SIZE(missing_items) = 0 AS is_complete
FROM pts;

-- 6. Cortex Search over the appetite guide ---------------------------------------
CREATE OR REPLACE CORTEX SEARCH SERVICE APPETITE_SEARCH
  ON guidance_text
  ATTRIBUTES section, class_code, appetite
  WAREHOUSE = USI_WH
  TARGET_LAG = '1 day'
  AS SELECT rule_id, section, class_code, appetite, guidance_text FROM APPETITE_GUIDE;

-- 7. Semantic view for Cortex Analyst, and a Cortex Agent for the Ask screen ----
CREATE OR REPLACE SEMANTIC VIEW SUBMISSIONS_SV
  TABLES (
    sub AS SUBMISSIONS PRIMARY KEY (submission_id) COMMENT = 'Broker submissions received by commercial underwriting',
    sc  AS SUBMISSION_SCORES PRIMARY KEY (submission_id) COMMENT = 'Appetite check, completeness, and fit score for open submissions',
    br  AS BROKERS PRIMARY KEY (broker_id) COMMENT = 'Producing brokers'
  )
  RELATIONSHIPS (
    sc_to_sub AS sc (submission_id) REFERENCES sub,
    sub_to_br AS sub (broker_id) REFERENCES br
  )
  FACTS (
    sub.total_tiv AS total_tiv COMMENT = 'Total insured value across all locations, USD',
    sub.annual_revenue AS annual_revenue COMMENT = 'Applicant annual revenue, USD',
    sc.fit_score AS fit_score COMMENT = 'Fit score 0-100 (appetite, completeness, broker value, loss history, concentration)'
  )
  DIMENSIONS (
    sub.submission_id AS submission_id,
    sub.insured_name AS insured_name COMMENT = 'Named insured',
    sub.state AS mailing_state WITH SYNONYMS = ('state') COMMENT = 'Two-letter US state of the insured, e.g. FL',
    sub.city AS mailing_city COMMENT = 'City of the insured',
    sub.received_at AS received_at COMMENT = 'When the submission arrived',
    sub.received_date AS DATE(received_at) COMMENT = 'Date the submission arrived. The business date is 2026-11-18, so this month means November 2026',
    sub.status AS status COMMENT = 'New, Quoted',
    sub.declared_class AS declared_class COMMENT = 'Class code declared on the application',
    sc.predicted_class AS predicted_class WITH SYNONYMS = ('class', 'class code', 'line') COMMENT = 'Governing class code from AI_CLASSIFY. REST = restaurant, OFFC = office, RETL = retail, APTS = apartments, MFGL = light manufacturing, WHSE = warehouse, HOTL = hotel, AUTO = auto repair, CONT = contractor, FIRE = fireworks, NITE = nightclub, ROOF = roofing',
    sc.appetite AS appetite COMMENT = 'IN, REFER, or OUT of appetite',
    sc.is_complete AS is_complete COMMENT = 'True when application, SOV, and loss runs are all present',
    br.broker_name AS broker_name COMMENT = 'Broker firm',
    br.broker_tier AS tier COMMENT = 'Top, Core, or Emerging'
  )
  METRICS (
    sub.submission_count AS COUNT(sub.submission_id) COMMENT = 'Number of submissions',
    sub.sum_tiv AS SUM(sub.total_tiv) COMMENT = 'Total insured value, USD',
    sc.avg_fit_score AS AVG(sc.fit_score) COMMENT = 'Average fit score'
  )
  COMMENT = 'Commercial underwriting submissions (synthetic)';

CREATE OR REPLACE AGENT SUBMISSION_ASSISTANT
  COMMENT = 'Answers questions about the submission pipeline (synthetic data)'
  FROM SPECIFICATION
  $$
  models:
    orchestration: auto
  instructions:
    response: "You help commercial underwriters triage broker submissions. Today's business date is 2026-11-18, so 'this month' means November 2026. TIV means total insured value in USD. Answer briefly, list matching submissions with insured name, city, TIV, fit score, and appetite, and say the data is synthetic."
    orchestration: "Use the submissions tool for any question about submissions, brokers, TIV, classes, appetite, or fit scores. Use the appetite guide tool for questions about underwriting rules."
  tools:
    - tool_spec:
        type: "cortex_analyst_text_to_sql"
        name: "submissions"
        description: "Submission pipeline: insured, state, city, class code, TIV, received date, broker, appetite, fit score"
    - tool_spec:
        type: "cortex_search"
        name: "appetite_guide"
        description: "Underwriting appetite guide: target classes, territories, limits, referral rules"
  tool_resources:
    submissions:
      semantic_view: "UNDERWRITING_SUBMISSION_DEMO.UW.SUBMISSIONS_SV"
      execution_environment:
        type: "warehouse"
        warehouse: "USI_WH"
    appetite_guide:
      name: "UNDERWRITING_SUBMISSION_DEMO.UW.APPETITE_SEARCH"
      max_results: 4
  $$;

-- 8. App tables: underwriter decisions and AI drafts ----------------------------
CREATE OR REPLACE TABLE APP.DECISIONS (
  decision_id STRING DEFAULT UUID_STRING(), submission_id STRING, decision STRING, reason STRING,
  decided_by STRING DEFAULT CURRENT_USER(), decided_at TIMESTAMP_NTZ DEFAULT SYSDATE());  -- UTC
CREATE OR REPLACE TABLE APP.AI_DRAFTS (
  draft_id STRING DEFAULT UUID_STRING(), submission_id STRING, kind STRING, model STRING, prompt STRING, response STRING,
  sources VARIANT, latency_ms NUMBER, created_by STRING DEFAULT CURRENT_USER(), created_at TIMESTAMP_NTZ DEFAULT SYSDATE());  -- UTC

-- 9. Quick checks ---------------------------------------------------------------
SELECT appetite, COUNT(*) AS submissions, ROUND(AVG(fit_score), 1) AS avg_fit FROM SUBMISSION_SCORES GROUP BY 1 ORDER BY 1;
SELECT submission_id, insured_name, fit_score, fifo_position, appetite, missing_items, appetite_reasons
FROM SUBMISSION_SCORES ORDER BY fit_score DESC LIMIT 10;
