-- ============================================================================
-- FIXED TEAM CREATION FUNCTION - GROUP BY ISSUE RESOLVED
-- ============================================================================

-- Drop and recreate the function with corrected GROUP BY clause
DROP FUNCTION IF EXISTS create_teams_with_role_assignment(VARCHAR);

CREATE OR REPLACE FUNCTION create_teams_with_role_assignment(session_id_param VARCHAR(50))
RETURNS JSON
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
    participant_count INTEGER;
    team_count INTEGER;
    current_team_id UUID;
    shuffled_participants UUID[];
    participant_idx INTEGER;
    current_role_idx INTEGER;
    result JSON;
    role_names VARCHAR[] := ARRAY['Pioneer', 'Technician', 'Seeker'];
    role_descriptions VARCHAR[] := ARRAY[
        'In charge of traditional style mapping of annotating on a map',
        'Ensures assets are correctly named and missing voltages are added', 
        'Seeks out missing Power Plants, good first lines and available credible information sources, checks industries as well'
    ];
    role_icons VARCHAR[] := ARRAY['🗺️', '⚡', '🔍'];
BEGIN
    -- Validate session exists
    IF NOT EXISTS (SELECT 1 FROM sessions WHERE id = session_id_param) THEN
        RAISE EXCEPTION 'Session % does not exist', session_id_param;
    END IF;

    -- Check if teams already exist for this session
    SELECT COUNT(*) INTO team_count FROM teams WHERE session_id = session_id_param;
    IF team_count > 0 THEN
        RAISE EXCEPTION 'Teams already exist for session %. Cannot recreate teams.', session_id_param;
    END IF;

    -- Get participant count
    SELECT COUNT(*) INTO participant_count 
    FROM participants 
    WHERE session_id = session_id_param;
    
    RAISE NOTICE 'Found % participants for session %', participant_count, session_id_param;
    
    -- Validate participant count for team formation
    IF participant_count < 3 THEN
        RAISE EXCEPTION 'Need at least 3 participants to form teams, found %', participant_count;
    END IF;
    
    IF participant_count % 3 != 0 THEN
        RAISE EXCEPTION 'Cannot form complete teams with % participants. Need a number divisible by 3 (current remainder: %)', 
                        participant_count, participant_count % 3;
    END IF;
    
    -- Calculate number of complete teams
    team_count := participant_count / 3;
    RAISE NOTICE 'Will create % teams', team_count;
    
    -- Get shuffled list of participant IDs
    SELECT ARRAY(
        SELECT id FROM participants 
        WHERE session_id = session_id_param 
        ORDER BY RANDOM()
    ) INTO shuffled_participants;
    
    RAISE NOTICE 'Shuffled % participants', array_length(shuffled_participants, 1);
    
    -- Create teams and assign members with roles
    participant_idx := 1;
    
    FOR team_idx IN 0..(team_count - 1) LOOP
        -- Create team
        INSERT INTO teams (session_id, team_name, team_index)
        VALUES (session_id_param, 'Team ' || CASE 
            WHEN team_idx = 0 THEN 'Alpha'
            WHEN team_idx = 1 THEN 'Beta'
            WHEN team_idx = 2 THEN 'Gamma'
            WHEN team_idx = 3 THEN 'Delta'
            WHEN team_idx = 4 THEN 'Epsilon'
            WHEN team_idx = 5 THEN 'Zeta'
            WHEN team_idx = 6 THEN 'Eta'
            WHEN team_idx = 7 THEN 'Theta'
            WHEN team_idx = 8 THEN 'Iota'
            WHEN team_idx = 9 THEN 'Kappa'
            ELSE 'Team ' || (team_idx + 1)::TEXT
        END, team_idx)
        RETURNING id INTO current_team_id;
        
        RAISE NOTICE 'Created team % with ID %', team_idx + 1, current_team_id;
        
        -- Assign exactly 3 members to this team with sequential roles
        FOR member_idx IN 0..2 LOOP
            current_role_idx := (member_idx % 3) + 1; -- This ensures 1, 2, 3
            
            -- Validate indices
            IF participant_idx > array_length(shuffled_participants, 1) THEN
                RAISE EXCEPTION 'Not enough participants for team assignment';
            END IF;
            
            IF current_role_idx < 1 OR current_role_idx > 3 THEN
                RAISE EXCEPTION 'Invalid role index: %', current_role_idx;
            END IF;
            
            RAISE NOTICE 'Assigning participant % to team % as role %', 
                         participant_idx, team_idx + 1, role_names[current_role_idx];
            
            -- Insert team member
            INSERT INTO team_members (
                team_id, 
                participant_id, 
                role_name, 
                role_description, 
                role_icon
            ) VALUES (
                current_team_id,
                shuffled_participants[participant_idx],
                role_names[current_role_idx],
                role_descriptions[current_role_idx],
                role_icons[current_role_idx]
            );
            
            participant_idx := participant_idx + 1;
        END LOOP;
    END LOOP;
    
    -- Update session status
    UPDATE sessions 
    SET status = 'teams_formed', teams_formed_at = NOW()
    WHERE id = session_id_param;
    
    RAISE NOTICE 'Team formation completed successfully';
    
    -- Return comprehensive result with FIXED GROUP BY clause
    SELECT json_build_object(
        'success', true,
        'session_id', session_id_param,
        'teams_created', team_count,
        'participants_assigned', team_count * 3,
        'unassigned_participants', 0,
        'role_distribution_balanced', true,
        'team_details', (
            SELECT json_agg(
                json_build_object(
                    'team_id', t.id,
                    'team_name', t.team_name,
                    'team_index', t.team_index,
                    'member_count', team_member_counts.member_count,
                    'members', team_members_json.members_json
                )
                ORDER BY t.team_index
            )
            FROM teams t
            -- Get member count for each team
            LEFT JOIN (
                SELECT team_id, COUNT(*) as member_count
                FROM team_members
                GROUP BY team_id
            ) team_member_counts ON team_member_counts.team_id = t.id
            -- Get members JSON for each team
            LEFT JOIN (
                SELECT 
                    tm.team_id,
                    json_agg(
                        json_build_object(
                            'participant_id', p.id,
                            'first_name', p.first_name,
                            'osm_username', p.osm_username,
                            'role_name', tm.role_name,
                            'role_icon', tm.role_icon
                        ) ORDER BY tm.role_name
                    ) as members_json
                FROM team_members tm
                JOIN participants p ON p.id = tm.participant_id
                GROUP BY tm.team_id
            ) team_members_json ON team_members_json.team_id = t.id
            WHERE t.session_id = session_id_param
        )
    ) INTO result;
    
    RETURN result;
END;
$$;

-- Grant permissions
GRANT EXECUTE ON FUNCTION create_teams_with_role_assignment(VARCHAR) TO anon, authenticated;

-- ============================================================================
-- TEST THE FIXED FUNCTION
-- ============================================================================

-- Clean up any existing teams and test
DO $$
DECLARE
    test_result JSON;
BEGIN
    -- Clear existing teams for clean test
    DELETE FROM team_members WHERE team_id IN (SELECT id FROM teams WHERE session_id = 'GRID2025');
    DELETE FROM teams WHERE session_id = 'GRID2025';
    
    -- Reset session status
    UPDATE sessions SET status = 'registering' WHERE id = 'GRID2025';
    
    RAISE NOTICE 'Testing fixed team creation function...';
    
    -- Test the function
    SELECT create_teams_with_role_assignment('GRID2025') INTO test_result;
    
    RAISE NOTICE 'SUCCESS: Team creation completed!';
    
EXCEPTION WHEN OTHERS THEN
    RAISE NOTICE 'ERROR: %', SQLERRM;
END $$;

-- ============================================================================
-- VERIFICATION QUERIES
-- ============================================================================

-- Check if teams were created successfully
SELECT 
    'Teams Created: ' || COUNT(*) as status
FROM teams 
WHERE session_id = 'GRID2025';

-- Verify team composition
SELECT 
    t.team_name,
    COUNT(tm.id) as member_count,
    STRING_AGG(p.first_name || ' (' || tm.role_name || ')', ', ' ORDER BY tm.role_name) as members
FROM teams t
LEFT JOIN team_members tm ON tm.team_id = t.id
LEFT JOIN participants p ON p.id = tm.participant_id
WHERE t.session_id = 'GRID2025'
GROUP BY t.id, t.team_name, t.team_index
ORDER BY t.team_index;

-- Check role distribution
SELECT 
    tm.role_name,
    COUNT(*) as count,
    tm.role_icon
FROM team_members tm
JOIN teams t ON t.id = tm.team_id
WHERE t.session_id = 'GRID2025'
GROUP BY tm.role_name, tm.role_icon
ORDER BY tm.role_name;