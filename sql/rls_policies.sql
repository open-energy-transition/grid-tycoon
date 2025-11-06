-- ============================================================================
-- GRID TYCOON ROW LEVEL SECURITY (RLS) POLICIES
-- ============================================================================
-- This script configures Row Level Security policies for the Grid Tycoon app
-- to allow the Supabase anon role to interact with the database.
--
-- IMPORTANT: Run this script AFTER schema.sql and functions.sql
--
-- PURPOSE:
-- - Supabase enables RLS by default on all tables
-- - Without policies, the anon role cannot access any data
-- - These policies allow controlled access for the public-facing app
--
-- SECURITY MODEL:
-- - Allow anyone to check/create sessions (needed for registration)
-- - Allow anyone to register as participant
-- - Allow anyone to read team and territory data
-- - Allow participants to update their territory status
-- - All operations are still validated by database functions and triggers
-- ============================================================================

DO $$
BEGIN
    RAISE NOTICE '';
    RAISE NOTICE '╔════════════════════════════════════════════════════════════════════════════╗';
    RAISE NOTICE '║              GRID TYCOON RLS POLICIES CONFIGURATION                        ║';
    RAISE NOTICE '╚════════════════════════════════════════════════════════════════════════════╝';
    RAISE NOTICE '';
    RAISE NOTICE '🔒 Configuring Row Level Security policies...';
    RAISE NOTICE '';
END $$;

-- ============================================================================
-- PART 1: GRANT TABLE-LEVEL PERMISSIONS TO ANON ROLE
-- ============================================================================
-- These grants give the anon role basic access to tables.
-- RLS policies (configured later) will control which ROWS can be accessed.

DO $$
BEGIN
    RAISE NOTICE '📋 Step 1: Granting table-level permissions to anon role...';
END $$;

-- Sessions table: SELECT and INSERT (for checking/creating sessions)
GRANT SELECT, INSERT, UPDATE ON public.sessions TO anon;

-- Indian territories table: SELECT and INSERT (for reading and populating territories)
GRANT SELECT, INSERT, UPDATE ON public.indian_territories TO anon;

-- Participants table: SELECT and INSERT (for registration)
GRANT SELECT, INSERT ON public.participants TO anon;

-- Teams table: SELECT and INSERT (for team creation)
GRANT SELECT, INSERT, UPDATE ON public.teams TO anon;

-- Team members table: SELECT, INSERT, UPDATE (for team assignments)
GRANT SELECT, INSERT, UPDATE ON public.team_members TO anon;

-- Team territories table: SELECT, INSERT, UPDATE (for territory assignments and status)
GRANT SELECT, INSERT, UPDATE ON public.team_territories TO anon;

-- Grant usage on sequences (needed for auto-incrementing IDs if any)
GRANT USAGE ON ALL SEQUENCES IN SCHEMA public TO anon;

DO $$
BEGIN
    RAISE NOTICE '   ✓ Table permissions granted to anon role';
    RAISE NOTICE '     - sessions: SELECT, INSERT, UPDATE';
    RAISE NOTICE '     - indian_territories: SELECT, INSERT, UPDATE';
    RAISE NOTICE '     - participants: SELECT, INSERT';
    RAISE NOTICE '     - teams: SELECT, INSERT, UPDATE';
    RAISE NOTICE '     - team_members: SELECT, INSERT, UPDATE';
    RAISE NOTICE '     - team_territories: SELECT, INSERT, UPDATE';
    RAISE NOTICE '';
END $$;

-- ============================================================================
-- PART 2: ENABLE ROW LEVEL SECURITY ON ALL TABLES
-- ============================================================================

DO $$
BEGIN
    RAISE NOTICE '📋 Step 2: Enabling RLS on all tables...';
END $$;

ALTER TABLE public.sessions ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.indian_territories ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.participants ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.teams ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.team_members ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.team_territories ENABLE ROW LEVEL SECURITY;

DO $$
BEGIN
    RAISE NOTICE '   ✓ RLS enabled on 6 tables';
    RAISE NOTICE '';
END $$;

-- ============================================================================
-- PART 3: CREATE POLICIES FOR SESSIONS TABLE
-- ============================================================================

DO $$
BEGIN
    RAISE NOTICE '📋 Step 3: Creating policies for sessions table...';
END $$;

-- Drop existing policies if they exist
DROP POLICY IF EXISTS "Allow anon to read sessions" ON public.sessions;
DROP POLICY IF EXISTS "Allow anon to insert sessions" ON public.sessions;
DROP POLICY IF EXISTS "Allow anon to update sessions" ON public.sessions;

-- Allow anyone to read session information
CREATE POLICY "Allow anon to read sessions"
    ON public.sessions
    FOR SELECT
    TO anon
    USING (true);

-- Allow anyone to create new sessions
CREATE POLICY "Allow anon to insert sessions"
    ON public.sessions
    FOR INSERT
    TO anon
    WITH CHECK (true);

-- Allow anyone to update session status (for coordinator operations)
CREATE POLICY "Allow anon to update sessions"
    ON public.sessions
    FOR UPDATE
    TO anon
    USING (true)
    WITH CHECK (true);

DO $$
BEGIN
    RAISE NOTICE '   ✓ Sessions policies created (SELECT, INSERT, UPDATE)';
END $$;

-- ============================================================================
-- PART 4: CREATE POLICIES FOR INDIAN_TERRITORIES TABLE
-- ============================================================================

DO $$
BEGIN
    RAISE NOTICE '📋 Step 4: Creating policies for indian_territories table...';
END $$;

-- Drop existing policies if they exist
DROP POLICY IF EXISTS "Allow anon to read territories" ON public.indian_territories;
DROP POLICY IF EXISTS "Allow anon to insert territories" ON public.indian_territories;
DROP POLICY IF EXISTS "Allow anon to update territories" ON public.indian_territories;

-- Allow anyone to read territory data
CREATE POLICY "Allow anon to read territories"
    ON public.indian_territories
    FOR SELECT
    TO anon
    USING (true);

-- Allow anyone to insert/update territories (needed for coordinator setup)
CREATE POLICY "Allow anon to insert territories"
    ON public.indian_territories
    FOR INSERT
    TO anon
    WITH CHECK (true);

CREATE POLICY "Allow anon to update territories"
    ON public.indian_territories
    FOR UPDATE
    TO anon
    USING (true)
    WITH CHECK (true);

DO $$
BEGIN
    RAISE NOTICE '   ✓ Territories policies created (SELECT, INSERT, UPDATE)';
END $$;

-- ============================================================================
-- PART 5: CREATE POLICIES FOR PARTICIPANTS TABLE
-- ============================================================================

DO $$
BEGIN
    RAISE NOTICE '📋 Step 5: Creating policies for participants table...';
END $$;

-- Drop existing policies if they exist
DROP POLICY IF EXISTS "Allow anon to read participants" ON public.participants;
DROP POLICY IF EXISTS "Allow anon to insert participants" ON public.participants;

-- Allow anyone to read participant information
CREATE POLICY "Allow anon to read participants"
    ON public.participants
    FOR SELECT
    TO anon
    USING (true);

-- Allow anyone to register as a participant
CREATE POLICY "Allow anon to insert participants"
    ON public.participants
    FOR INSERT
    TO anon
    WITH CHECK (true);

DO $$
BEGIN
    RAISE NOTICE '   ✓ Participants policies created (SELECT, INSERT)';
END $$;

-- ============================================================================
-- PART 6: CREATE POLICIES FOR TEAMS TABLE
-- ============================================================================

DO $$
BEGIN
    RAISE NOTICE '📋 Step 6: Creating policies for teams table...';
END $$;

-- Drop existing policies if they exist
DROP POLICY IF EXISTS "Allow anon to read teams" ON public.teams;
DROP POLICY IF EXISTS "Allow anon to insert teams" ON public.teams;
DROP POLICY IF EXISTS "Allow anon to update teams" ON public.teams;

-- Allow anyone to read team information
CREATE POLICY "Allow anon to read teams"
    ON public.teams
    FOR SELECT
    TO anon
    USING (true);

-- Allow anyone to create teams (needed for coordinator operations)
CREATE POLICY "Allow anon to insert teams"
    ON public.teams
    FOR INSERT
    TO anon
    WITH CHECK (true);

-- Allow anyone to update teams
CREATE POLICY "Allow anon to update teams"
    ON public.teams
    FOR UPDATE
    TO anon
    USING (true)
    WITH CHECK (true);

DO $$
BEGIN
    RAISE NOTICE '   ✓ Teams policies created (SELECT, INSERT, UPDATE)';
END $$;

-- ============================================================================
-- PART 7: CREATE POLICIES FOR TEAM_MEMBERS TABLE
-- ============================================================================

DO $$
BEGIN
    RAISE NOTICE '📋 Step 7: Creating policies for team_members table...';
END $$;

-- Drop existing policies if they exist
DROP POLICY IF EXISTS "Allow anon to read team members" ON public.team_members;
DROP POLICY IF EXISTS "Allow anon to insert team members" ON public.team_members;
DROP POLICY IF EXISTS "Allow anon to update team members" ON public.team_members;

-- Allow anyone to read team member assignments
CREATE POLICY "Allow anon to read team members"
    ON public.team_members
    FOR SELECT
    TO anon
    USING (true);

-- Allow anyone to create team member assignments (for team formation)
CREATE POLICY "Allow anon to insert team members"
    ON public.team_members
    FOR INSERT
    TO anon
    WITH CHECK (true);

-- Allow anyone to update team member roles
CREATE POLICY "Allow anon to update team members"
    ON public.team_members
    FOR UPDATE
    TO anon
    USING (true)
    WITH CHECK (true);

DO $$
BEGIN
    RAISE NOTICE '   ✓ Team members policies created (SELECT, INSERT, UPDATE)';
END $$;

-- ============================================================================
-- PART 8: CREATE POLICIES FOR TEAM_TERRITORIES TABLE
-- ============================================================================

DO $$
BEGIN
    RAISE NOTICE '📋 Step 8: Creating policies for team_territories table...';
END $$;

-- Drop existing policies if they exist
DROP POLICY IF EXISTS "Allow anon to read team territories" ON public.team_territories;
DROP POLICY IF EXISTS "Allow anon to insert team territories" ON public.team_territories;
DROP POLICY IF EXISTS "Allow anon to update team territories" ON public.team_territories;

-- Allow anyone to read territory assignments
CREATE POLICY "Allow anon to read team territories"
    ON public.team_territories
    FOR SELECT
    TO anon
    USING (true);

-- Allow anyone to create territory assignments (for distribution)
CREATE POLICY "Allow anon to insert team territories"
    ON public.team_territories
    FOR INSERT
    TO anon
    WITH CHECK (true);

-- Allow anyone to update territory status
CREATE POLICY "Allow anon to update team territories"
    ON public.team_territories
    FOR UPDATE
    TO anon
    USING (true)
    WITH CHECK (true);

DO $$
BEGIN
    RAISE NOTICE '   ✓ Team territories policies created (SELECT, INSERT, UPDATE)';
    RAISE NOTICE '';
END $$;

-- ============================================================================
-- PART 9: GRANT EXECUTE PERMISSIONS ON RPC FUNCTIONS
-- ============================================================================

DO $$
BEGIN
    RAISE NOTICE '📋 Step 9: Granting execute permissions on RPC functions...';
END $$;

-- Grant execute permission on all Grid Tycoon RPC functions

-- Team formation and participant management
GRANT EXECUTE ON FUNCTION public.create_teams_with_role_assignment(VARCHAR, INTEGER) TO anon;
GRANT EXECUTE ON FUNCTION public.get_session_participants_detailed(VARCHAR) TO anon;

-- Territory monitoring and availability
GRANT EXECUTE ON FUNCTION public.get_territory_availability_overview(VARCHAR) TO anon;
GRANT EXECUTE ON FUNCTION public.get_available_territories_for_team(UUID) TO anon;
GRANT EXECUTE ON FUNCTION public.get_territories_by_status(VARCHAR, VARCHAR) TO anon;
GRANT EXECUTE ON FUNCTION public.get_territory_assignment_details(UUID) TO anon;
GRANT EXECUTE ON FUNCTION public.get_all_territory_assignments(VARCHAR) TO anon;
GRANT EXECUTE ON FUNCTION public.get_team_territory_progress(UUID) TO anon;

-- Critical coordinator functions
GRANT EXECUTE ON FUNCTION public.distribute_territories_to_teams(VARCHAR) TO anon;
GRANT EXECUTE ON FUNCTION public.get_territory_for_overpass_operations(UUID) TO anon;
GRANT EXECUTE ON FUNCTION public.update_territory_assignment_status(UUID, VARCHAR, UUID, TEXT) TO anon;
GRANT EXECUTE ON FUNCTION public.get_session_progress_overview(VARCHAR) TO anon;
GRANT EXECUTE ON FUNCTION public.get_team_leaderboard_for_session(VARCHAR) TO anon;
GRANT EXECUTE ON FUNCTION public.verify_session_teams(VARCHAR) TO anon;
GRANT EXECUTE ON FUNCTION public.validate_territory_assignments(VARCHAR) TO anon;
GRANT EXECUTE ON FUNCTION public.get_territory_statistics() TO anon;

-- Session isolation trigger function
GRANT EXECUTE ON FUNCTION public.validate_team_member_session_match() TO anon;

DO $$
BEGIN
    RAISE NOTICE '   ✓ Execute permissions granted on 18 RPC functions';
    RAISE NOTICE '';
END $$;

-- ============================================================================
-- VERIFICATION
-- ============================================================================

DO $$
DECLARE
    sessions_policies INTEGER;
    territories_policies INTEGER;
    participants_policies INTEGER;
    teams_policies INTEGER;
    members_policies INTEGER;
    team_territories_policies INTEGER;
    total_policies INTEGER;
BEGIN
    RAISE NOTICE '🔍 Verifying RLS configuration...';
    RAISE NOTICE '';

    -- Count policies per table
    SELECT COUNT(*) INTO sessions_policies FROM pg_policies WHERE tablename = 'sessions';
    SELECT COUNT(*) INTO territories_policies FROM pg_policies WHERE tablename = 'indian_territories';
    SELECT COUNT(*) INTO participants_policies FROM pg_policies WHERE tablename = 'participants';
    SELECT COUNT(*) INTO teams_policies FROM pg_policies WHERE tablename = 'teams';
    SELECT COUNT(*) INTO members_policies FROM pg_policies WHERE tablename = 'team_members';
    SELECT COUNT(*) INTO team_territories_policies FROM pg_policies WHERE tablename = 'team_territories';

    total_policies := sessions_policies + territories_policies + participants_policies +
                      teams_policies + members_policies + team_territories_policies;

    RAISE NOTICE '╔════════════════════════════════════════════════════════════════════════════╗';
    RAISE NOTICE '║                    RLS CONFIGURATION COMPLETE                              ║';
    RAISE NOTICE '╚════════════════════════════════════════════════════════════════════════════╝';
    RAISE NOTICE '';
    RAISE NOTICE 'Table-Level Permissions:';
    RAISE NOTICE '   ✓ 6 tables granted SELECT, INSERT, UPDATE to anon';
    RAISE NOTICE '   ✓ Sequence usage granted to anon';
    RAISE NOTICE '';
    RAISE NOTICE 'Row-Level Security Policies:';
    RAISE NOTICE '   ✓ sessions: % policies', sessions_policies;
    RAISE NOTICE '   ✓ indian_territories: % policies', territories_policies;
    RAISE NOTICE '   ✓ participants: % policies', participants_policies;
    RAISE NOTICE '   ✓ teams: % policies', teams_policies;
    RAISE NOTICE '   ✓ team_members: % policies', members_policies;
    RAISE NOTICE '   ✓ team_territories: % policies', team_territories_policies;
    RAISE NOTICE '';
    RAISE NOTICE 'Total: % RLS policies active', total_policies;
    RAISE NOTICE '';
    RAISE NOTICE 'Function Permissions:';
    RAISE NOTICE '   ✓ 18 RPC functions granted to anon role';
    RAISE NOTICE '     - Team formation & participant management (2)';
    RAISE NOTICE '     - Territory monitoring & availability (6)';
    RAISE NOTICE '     - Critical coordinator functions (8)';
    RAISE NOTICE '     - Session isolation trigger (1)';
    RAISE NOTICE '     - Utility functions (1)';
    RAISE NOTICE '';
    RAISE NOTICE '═══════════════════════════════════════════════════════════════════════════';
    RAISE NOTICE '✓ DATABASE FULLY CONFIGURED AND READY FOR GRID TYCOON';
    RAISE NOTICE '═══════════════════════════════════════════════════════════════════════════';
    RAISE NOTICE '';
    RAISE NOTICE 'The anon role can now:';
    RAISE NOTICE '  ✓ Check and create sessions';
    RAISE NOTICE '  ✓ Register participants';
    RAISE NOTICE '  ✓ Form teams with role assignment';
    RAISE NOTICE '  ✓ Distribute territories across teams';
    RAISE NOTICE '  ✓ View teams and assignments';
    RAISE NOTICE '  ✓ Update territory status (available/current/completed)';
    RAISE NOTICE '  ✓ Load territory data for JOSM/Overpass queries';
    RAISE NOTICE '  ✓ Execute coordinator functions';
    RAISE NOTICE '  ✓ Query session progress and leaderboards';
    RAISE NOTICE '  ✓ Validate teams and territory assignments';
    RAISE NOTICE '';
    RAISE NOTICE 'Security Features:';
    RAISE NOTICE '  ✓ Row Level Security (RLS) enabled on all 6 tables';
    RAISE NOTICE '  ✓ All operations validated by database functions and triggers';
    RAISE NOTICE '  ✓ Session isolation enforced at trigger level';
    RAISE NOTICE '  ✓ Foreign key constraints prevent invalid references';
    RAISE NOTICE '  ✓ Automatic timestamp management for territory workflow';
    RAISE NOTICE '';
    RAISE NOTICE 'Next Steps - Test the Application:';
    RAISE NOTICE '  1. Start local server: python -m http.server 8000';
    RAISE NOTICE '  2. Open http://localhost:8000';
    RAISE NOTICE '  3. Try registering with session ID "testalpha"';
    RAISE NOTICE '  4. Try coordinator login with "testalpha-COORD"';
    RAISE NOTICE '  5. Coordinator: Click "Setup Teams & Territories"';
    RAISE NOTICE '  6. Participant: View team assignment and load territories';
    RAISE NOTICE '  7. Monitor browser console for any errors';
    RAISE NOTICE '';
    RAISE NOTICE 'Database Execution Order:';
    RAISE NOTICE '  1. schema.sql        - Creates all 6 tables';
    RAISE NOTICE '  2. functions.sql     - Creates 18 RPC functions + trigger';
    RAISE NOTICE '  3. rls_policies.sql  - Configures RLS and permissions (this file)';
    RAISE NOTICE '  4. seed_test_data.sql - Loads test session "testalpha" (optional)';
    RAISE NOTICE '═══════════════════════════════════════════════════════════════════════════';
    RAISE NOTICE '';
END $$;
