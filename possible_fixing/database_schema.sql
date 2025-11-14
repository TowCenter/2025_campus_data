-- database/migrations/001_initial_schema.sql
-- Database schema for University Response Tracker

-- Create responses table
CREATE TABLE IF NOT EXISTS responses (
    id SERIAL PRIMARY KEY,
    title TEXT,
    org VARCHAR(255) NOT NULL,
    url TEXT,
    date TIMESTAMP,
    content TEXT,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- Create indexes for better query performance
CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_responses_org ON responses(org);
CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_responses_date ON responses(date DESC);
CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_responses_date_month ON responses(date_trunc('month', date));
CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_responses_created_at ON responses(created_at DESC);

-- Create full-text search index for content
CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_responses_content_search 
ON responses USING gin(to_tsvector('english', COALESCE(title, '') || ' ' || COALESCE(content, '')));

-- Create composite indexes for common query patterns
CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_responses_org_date ON responses(org, date DESC);
CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_responses_date_org ON responses(date DESC, org);

-- Create function to automatically update updated_at timestamp
CREATE OR REPLACE FUNCTION update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = CURRENT_TIMESTAMP;
    RETURN NEW;
END;
$$ language 'plpgsql';

-- Create trigger to automatically update updated_at
DROP TRIGGER IF EXISTS update_responses_updated_at ON responses;
CREATE TRIGGER update_responses_updated_at
    BEFORE UPDATE ON responses
    FOR EACH ROW
    EXECUTE FUNCTION update_updated_at_column();

-- Create view for common queries
CREATE OR REPLACE VIEW response_summary AS
SELECT 
    org,
    COUNT(*) as total_responses,
    MIN(date) as first_response,
    MAX(date) as last_response,
    COUNT(CASE WHEN date >= CURRENT_DATE - INTERVAL '30 days' THEN 1 END) as recent_responses
FROM responses
WHERE org IS NOT NULL
GROUP BY org
ORDER BY total_responses DESC;

-- Create materialized view for monthly statistics (refresh periodically)
CREATE MATERIALIZED VIEW IF NOT EXISTS monthly_stats AS
SELECT 
    date_trunc('month', date) as month,
    TO_CHAR(date, 'Month YYYY') as month_year,
    org,
    COUNT(*) as response_count
FROM responses
WHERE date IS NOT NULL
GROUP BY date_trunc('month', date), TO_CHAR(date, 'Month YYYY'), org
ORDER BY month DESC, org;

-- Create index on materialized view
CREATE UNIQUE INDEX IF NOT EXISTS idx_monthly_stats_month_org ON monthly_stats(month, org);

-- Grant permissions (adjust as needed for your setup)
-- GRANT SELECT, INSERT, UPDATE, DELETE ON responses TO app_user;
-- GRANT USAGE, SELECT ON SEQUENCE responses_id_seq TO app_user;