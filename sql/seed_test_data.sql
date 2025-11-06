-- ============================================================================
-- GRID TYCOON TEST DATA SEED SCRIPT
-- ============================================================================
-- This script populates the database with:
-- 1. Test session 'testalpha'
-- 2. All 36 Indian territories with ISO codes
-- 3. 9 test participants for testing team formation
--
-- USAGE:
-- - Run this script after running schema.sql and functions.sql
-- - Safe to re-run (uses ON CONFLICT to handle duplicates)
-- - Provides a complete test environment for development
--
-- NEXT STEPS AFTER RUNNING:
-- 1. Login as coordinator with session ID 'testalpha-COORD'
-- 2. Form teams using the coordinator dashboard
-- 3. Test territory distribution and mapping workflows
-- ============================================================================

-- ============================================================================
-- PART 1: INSERT TEST SESSION
-- ============================================================================

DO $$
BEGIN
    RAISE NOTICE '';
    RAISE NOTICE '╔════════════════════════════════════════════════════════════════════════════╗';
    RAISE NOTICE '║                    GRID TYCOON TEST DATA SEEDING                           ║';
    RAISE NOTICE '╚════════════════════════════════════════════════════════════════════════════╝';
    RAISE NOTICE '';
    RAISE NOTICE '📊 Seeding test session...';
END $$;

INSERT INTO public.sessions (id, name, description, status, created_at)
VALUES (
    'testalpha',
    'Test Session Alpha',
    'Test session for development and testing with 9 participants',
    'registering',
    NOW()
)
ON CONFLICT (id) DO UPDATE
SET
    name = EXCLUDED.name,
    description = EXCLUDED.description,
    status = EXCLUDED.status;

DO $$
BEGIN
    RAISE NOTICE '   ✓ Test session "testalpha" created';
    RAISE NOTICE '';
END $$;

-- ============================================================================
-- PART 2: INSERT ALL 36 INDIAN TERRITORIES
-- ============================================================================

DO $$
BEGIN
    RAISE NOTICE '🗺️  Seeding Indian territories...';
END $$;

INSERT INTO public.indian_territories (name, name_en, iso_code, osm_relation_id, place_type, is_active)
VALUES
    -- STATES (28)
    ('Andhra Pradesh', 'Andhra Pradesh', 'IN-AP', 1656186, 'state', true),
    ('Arunachal Pradesh', 'Arunachal Pradesh', 'IN-AR', 1656183, 'state', true),
    ('Assam', 'Assam', 'IN-AS', 1656184, 'state', true),
    ('Bihar', 'Bihar', 'IN-BR', 1656168, 'state', true),
    ('Chhattisgarh', 'Chhattisgarh', 'IN-CT', 1656170, 'state', true),
    ('Goa', 'Goa', 'IN-GA', 1656929, 'state', true),
    ('Gujarat', 'Gujarat', 'IN-GJ', 1656190, 'state', true),
    ('Haryana', 'Haryana', 'IN-HR', 1656180, 'state', true),
    ('Himachal Pradesh', 'Himachal Pradesh', 'IN-HP', 1656178, 'state', true),
    ('Jharkhand', 'Jharkhand', 'IN-JH', 1656166, 'state', true),
    ('Karnataka', 'Karnataka', 'IN-KA', 1656160, 'state', true),
    ('Kerala', 'Kerala', 'IN-KL', 1656161, 'state', true),
    ('Madhya Pradesh', 'Madhya Pradesh', 'IN-MP', 1656172, 'state', true),
    ('Maharashtra', 'Maharashtra', 'IN-MH', 1656179, 'state', true),
    ('Manipur', 'Manipur', 'IN-MN', 1656227, 'state', true),
    ('Meghalaya', 'Meghalaya', 'IN-ML', 1656174, 'state', true),
    ('Mizoram', 'Mizoram', 'IN-MZ', 1656175, 'state', true),
    ('Nagaland', 'Nagaland', 'IN-NL', 1656176, 'state', true),
    ('Odisha', 'Odisha', 'IN-OR', 1656177, 'state', true),
    ('Punjab', 'Punjab', 'IN-PB', 1656181, 'state', true),
    ('Rajasthan', 'Rajasthan', 'IN-RJ', 1656182, 'state', true),
    ('Sikkim', 'Sikkim', 'IN-SK', 1656185, 'state', true),
    ('Tamil Nadu', 'Tamil Nadu', 'IN-TN', 1656187, 'state', true),
    ('Telangana', 'Telangana', 'IN-TG', 1656188, 'state', true),
    ('Tripura', 'Tripura', 'IN-TR', 1656189, 'state', true),
    ('Uttar Pradesh', 'Uttar Pradesh', 'IN-UP', 1656191, 'state', true),
    ('Uttarakhand', 'Uttarakhand', 'IN-UT', 1656192, 'state', true),
    ('West Bengal', 'West Bengal', 'IN-WB', 1656193, 'state', true),

    -- UNION TERRITORIES (8)
    ('Andaman and Nicobar Islands', 'Andaman and Nicobar Islands', 'IN-AN', 1656194, 'union_territory', true),
    ('Chandigarh', 'Chandigarh', 'IN-CH', 1656195, 'union_territory', true),
    ('Dadra and Nagar Haveli and Daman and Diu', 'Dadra and Nagar Haveli and Daman and Diu', 'IN-DH', 1656196, 'union_territory', true),
    ('Delhi', 'Delhi', 'IN-DL', 1656197, 'union_territory', true),
    ('Jammu and Kashmir', 'Jammu and Kashmir', 'IN-JK', 1656198, 'union_territory', true),
    ('Ladakh', 'Ladakh', 'IN-LA', 1656199, 'union_territory', true),
    ('Lakshadweep', 'Lakshadweep', 'IN-LD', 1656200, 'union_territory', true),
    ('Puducherry', 'Puducherry', 'IN-PY', 1656201, 'union_territory', true)
ON CONFLICT (iso_code) DO UPDATE
SET
    name = EXCLUDED.name,
    name_en = EXCLUDED.name_en,
    osm_relation_id = EXCLUDED.osm_relation_id,
    place_type = EXCLUDED.place_type,
    is_active = EXCLUDED.is_active;

DO $$
DECLARE
    territory_count INTEGER;
    state_count INTEGER;
    ut_count INTEGER;
BEGIN
    SELECT COUNT(*) INTO territory_count FROM public.indian_territories;
    SELECT COUNT(*) INTO state_count FROM public.indian_territories WHERE place_type = 'state';
    SELECT COUNT(*) INTO ut_count FROM public.indian_territories WHERE place_type = 'union_territory';

    RAISE NOTICE '   ✓ Inserted/Updated % territories', territory_count;
    RAISE NOTICE '     - % states', state_count;
    RAISE NOTICE '     - % union territories', ut_count;
    RAISE NOTICE '';
END $$;

-- ============================================================================
-- PART 3: INSERT TEST PARTICIPANTS
-- ============================================================================

DO $$
BEGIN
    RAISE NOTICE '👥 Seeding test participants...';
END $$;

INSERT INTO public.participants (first_name, osm_username, session_id, created_at)
VALUES
    ('Alice', 'alice_mapper', 'testalpha', NOW()),
    ('Bob', 'bob_osmuser', 'testalpha', NOW()),
    ('Charlie', 'charlie_grid', 'testalpha', NOW()),
    ('Diana', 'diana_maps', 'testalpha', NOW()),
    ('Eve', 'eve_osm', 'testalpha', NOW()),
    ('Frank', 'frank_power', 'testalpha', NOW()),
    ('Grace', 'grace_mapper', 'testalpha', NOW()),
    ('Henry', 'henry_osm', 'testalpha', NOW()),
    ('Ivy', 'ivy_gridmap', 'testalpha', NOW())
ON CONFLICT (id) DO NOTHING;

DO $$
DECLARE
    participant_count INTEGER;
BEGIN
    SELECT COUNT(*) INTO participant_count
    FROM public.participants
    WHERE session_id = 'testalpha';

    RAISE NOTICE '   ✓ Inserted % test participants', participant_count;
    RAISE NOTICE '';
END $$;

-- ============================================================================
-- VERIFICATION AND SUMMARY
-- ============================================================================

DO $$
DECLARE
    session_exists BOOLEAN;
    territory_count INTEGER;
    participant_count INTEGER;
    team_size INTEGER;
    expected_teams INTEGER;
BEGIN
    RAISE NOTICE '🔍 Verifying seed data...';
    RAISE NOTICE '';

    -- Check session
    SELECT EXISTS(SELECT 1 FROM public.sessions WHERE id = 'testalpha') INTO session_exists;

    -- Count territories
    SELECT COUNT(*) INTO territory_count FROM public.indian_territories;

    -- Count participants
    SELECT COUNT(*) INTO participant_count FROM public.participants WHERE session_id = 'testalpha';

    -- Calculate team info (default team size is 3)
    team_size := 3;
    expected_teams := CEIL(participant_count::FLOAT / team_size)::INTEGER;

    RAISE NOTICE '╔════════════════════════════════════════════════════════════════════════════╗';
    RAISE NOTICE '║                         SEEDING COMPLETE                                   ║';
    RAISE NOTICE '╚════════════════════════════════════════════════════════════════════════════╝';
    RAISE NOTICE '';

    IF session_exists THEN
        RAISE NOTICE '   ✓ Session "testalpha" ready';
    ELSE
        RAISE NOTICE '   ✗ Session creation failed';
    END IF;

    RAISE NOTICE '   ✓ % Indian territories loaded', territory_count;
    RAISE NOTICE '   ✓ % test participants registered', participant_count;
    RAISE NOTICE '';
    RAISE NOTICE '═══════════════════════════════════════════════════════════════════════════';
    RAISE NOTICE 'TEST ENVIRONMENT READY';
    RAISE NOTICE '';
    RAISE NOTICE 'Coordinator Login:';
    RAISE NOTICE '  Session ID: testalpha-COORD (or testalpha-ADMIN)';
    RAISE NOTICE '';
    RAISE NOTICE 'Team Formation:';
    RAISE NOTICE '  • % participants ready for team assignment', participant_count;
    RAISE NOTICE '  • With team size 3: will create % teams', expected_teams;
    RAISE NOTICE '  • % territories available for distribution', territory_count;
    RAISE NOTICE '';
    RAISE NOTICE 'Next Steps:';
    RAISE NOTICE '  1. Login as coordinator (testalpha-COORD)';
    RAISE NOTICE '  2. Click "Setup Teams & Territories"';
    RAISE NOTICE '  3. Test team formation and territory distribution';
    RAISE NOTICE '  4. Login as participant to test mapping workflow';
    RAISE NOTICE '';
    RAISE NOTICE 'Test Participants:';
    RAISE NOTICE '  alice_mapper, bob_osmuser, charlie_grid, diana_maps, eve_osm,';
    RAISE NOTICE '  frank_power, grace_mapper, henry_osm, ivy_gridmap';
    RAISE NOTICE '═══════════════════════════════════════════════════════════════════════════';
    RAISE NOTICE '';
END $$;
