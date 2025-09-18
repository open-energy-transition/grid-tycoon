-- Grid Tycoon Table Schema Creation
-- Creates all tables with proper relationships, indexes, and policies
-- No data insertion - just the structure

-- Drop existing tables if they exist (in reverse dependency order)
DROP TABLE IF EXISTS team_territories CASCADE;
DROP TABLE IF EXISTS team_members CASCADE;
DROP TABLE IF EXISTS teams CASCADE;
DROP TABLE IF EXISTS participants CASCADE;
DROP TABLE IF EXISTS sessions CASCADE;
DROP TABLE IF EXISTS administrative_divisions CASCADE;
DROP TABLE IF EXISTS countries CASCADE;

-- Drop existing views
DROP VIEW IF EXISTS team_overview CASCADE;
DROP VIEW IF EXISTS session_stats CASCADE;

-- ============================================================================
-- CREATE TABLES
-- ============================================================================

-- Countries table (no dependencies)
CREATE TABLE countries (
    id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
    name VARCHAR(100) NOT NULL UNIQUE,
    iso_code_2 CHAR(2) NOT NULL UNIQUE,
    iso_code_3 CHAR(3) NOT NULL UNIQUE,
    osm_relation_id BIGINT,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Administrative divisions table (depends on countries)
CREATE TABLE administrative_divisions (
    id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
    country_id UUID NOT NULL REFERENCES countries(id) ON DELETE CASCADE,
    name VARCHAR(200) NOT NULL,
    subdivision_type VARCHAR(50) NOT NULL,
    iso_code VARCHAR(10),
    osm_relation_id BIGINT,
    capital VARCHAR(100),
    area_km2 DECIMAL(10,2),
    population INTEGER,
    is_active BOOLEAN DEFAULT true,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    
    UNIQUE(country_id, name),
    UNIQUE(country_id, iso_code)
);

-- Sessions table (depends on countries)
CREATE TABLE sessions (
    id VARCHAR(50) PRIMARY KEY,
    name VARCHAR(200),
    description TEXT,
    country_id UUID REFERENCES countries(id),
    status VARCHAR(20) DEFAULT 'registering' CHECK (status IN ('registering', 'teams_formed', 'active', 'completed')),
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    teams_formed_at TIMESTAMP WITH TIME ZONE NULL
);

-- Participants table (depends on sessions and countries)
CREATE TABLE participants (
    id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
    first_name VARCHAR(100) NOT NULL,
    osm_username VARCHAR(100) NOT NULL,
    session_id VARCHAR(50) NOT NULL REFERENCES sessions(id) ON DELETE CASCADE,
    country_id UUID REFERENCES countries(id),
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    
    UNIQUE(osm_username, session_id)
);

-- Teams table (depends on sessions and countries)
CREATE TABLE teams (
    id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
    session_id VARCHAR(50) NOT NULL REFERENCES sessions(id) ON DELETE CASCADE,
    country_id UUID REFERENCES countries(id),
    team_name VARCHAR(100) NOT NULL,
    team_index INTEGER NOT NULL,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    
    UNIQUE(session_id, team_name)
);

-- Team members table (depends on teams and participants)
CREATE TABLE team_members (
    id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
    team_id UUID NOT NULL REFERENCES teams(id) ON DELETE CASCADE,
    participant_id UUID NOT NULL REFERENCES participants(id) ON DELETE CASCADE,
    role_name VARCHAR(50) NOT NULL,
    role_description TEXT NOT NULL,
    role_icon VARCHAR(10) NOT NULL,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    
    UNIQUE(participant_id)
);

-- Team territories table (depends on teams, administrative_divisions, and participants)
CREATE TABLE team_territories (
    id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
    team_id UUID NOT NULL REFERENCES teams(id) ON DELETE CASCADE,
    division_id UUID NOT NULL REFERENCES administrative_divisions(id) ON DELETE CASCADE,
    status VARCHAR(20) DEFAULT 'available' CHECK (status IN ('available', 'current', 'completed')),
    completed_at TIMESTAMP WITH TIME ZONE NULL,
    completed_by UUID REFERENCES participants(id),
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    
    UNIQUE(division_id)
);

-- ============================================================================
-- CREATE INDEXES
-- ============================================================================

CREATE INDEX idx_participants_session_id ON participants(session_id);
CREATE INDEX idx_teams_session_id ON teams(session_id);
CREATE INDEX idx_team_members_team_id ON team_members(team_id);
CREATE INDEX idx_administrative_divisions_country_id ON administrative_divisions(country_id);
CREATE INDEX idx_administrative_divisions_osm_id ON administrative_divisions(osm_relation_id);
CREATE INDEX idx_administrative_divisions_active ON administrative_divisions(is_active);
CREATE INDEX idx_team_territories_team_id ON team_territories(team_id);
CREATE INDEX idx_team_territories_division_id ON team_territories(division_id);
CREATE INDEX idx_team_territories_status ON team_territories(status);

-- ============================================================================
-- ROW LEVEL SECURITY
-- ============================================================================

ALTER TABLE participants ENABLE ROW LEVEL SECURITY;
ALTER TABLE teams ENABLE ROW LEVEL SECURITY;
ALTER TABLE team_members ENABLE ROW LEVEL SECURITY;
ALTER TABLE team_territories ENABLE ROW LEVEL SECURITY;
ALTER TABLE sessions ENABLE ROW LEVEL SECURITY;
ALTER TABLE countries ENABLE ROW LEVEL SECURITY;
ALTER TABLE administrative_divisions ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Allow all operations on participants" ON participants FOR ALL USING (true);
CREATE POLICY "Allow all operations on teams" ON teams FOR ALL USING (true);
CREATE POLICY "Allow all operations on team_members" ON team_members FOR ALL USING (true);
CREATE POLICY "Allow all operations on team_territories" ON team_territories FOR ALL USING (true);
CREATE POLICY "Allow all operations on sessions" ON sessions FOR ALL USING (true);
CREATE POLICY "Allow all operations on countries" ON countries FOR ALL USING (true);
CREATE POLICY "Allow all operations on administrative_divisions" ON administrative_divisions FOR ALL USING (true);

-- ============================================================================
-- VIEWS
-- ============================================================================

CREATE VIEW team_overview AS
SELECT 
    t.id as team_id,
    t.session_id,
    t.team_name,
    t.team_index,
    c.name as country_name,
    COUNT(tm.id) as member_count,
    COUNT(CASE WHEN tt.status = 'completed' THEN 1 END) as completed_territories,
    COUNT(tt.id) as total_territories
FROM teams t
LEFT JOIN team_members tm ON t.id = tm.team_id
LEFT JOIN team_territories tt ON t.id = tt.team_id
LEFT JOIN countries c ON t.country_id = c.id
GROUP BY t.id, t.session_id, t.team_name, t.team_index, c.name;

CREATE VIEW session_stats AS
SELECT 
    s.id as session_id,
    s.name as session_name,
    s.status,
    c.name as country_name,
    COUNT(DISTINCT p.id) as total_participants,
    COUNT(DISTINCT t.id) as total_teams,
    COUNT(CASE WHEN p.id IS NOT NULL AND tm.id IS NULL THEN 1 END) as unassigned_participants,
    COUNT(DISTINCT ad.id) as total_divisions_available
FROM sessions s
LEFT JOIN participants p ON s.id = p.session_id
LEFT JOIN team_members tm ON p.id = tm.participant_id
LEFT JOIN teams t ON s.id = t.session_id
LEFT JOIN countries c ON s.country_id = c.id
LEFT JOIN administrative_divisions ad ON c.id = ad.country_id AND ad.is_active = true
GROUP BY s.id, s.name, s.status, c.name;

-- ============================================================================
-- VERIFICATION
-- ============================================================================

-- Check that tables were created
SELECT table_name, table_type 
FROM information_schema.tables 
WHERE table_schema = 'public' 
  AND table_name IN ('countries', 'administrative_divisions', 'sessions', 'participants', 'teams', 'team_members', 'team_territories')
ORDER BY table_name;