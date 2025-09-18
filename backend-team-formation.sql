-- Backend Functions for Team Formation and Territory Assignment
-- Run this in your Supabase SQL Editor

-- ============================================================================
-- STORED PROCEDURES FOR TEAM FORMATION
-- ============================================================================

-- Function to create random teams for a session
CREATE OR REPLACE FUNCTION create_random_teams(session_id_param VARCHAR(50))
RETURNS JSON
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
    participant_count INTEGER;
    team_count INTEGER;
    team_record RECORD;
    participant_record RECORD;
    role_names VARCHAR[] := ARRAY['Pioneer', 'Technician', 'Seeker'];
    role_descriptions VARCHAR[] := ARRAY[
        'In charge of traditional style mapping of annotating on a map',
        'Ensures assets are correctly named and missing voltages are added', 
        'Seeks out missing Power Plants, good first lines and available credible information sources, checks industries as well'
    ];
    role_icons VARCHAR[] := ARRAY['🗺️', '⚡', '🔍'];
    current_team_id UUID;
    current_team_index INTEGER := 0;
    current_member_index INTEGER;
    shuffled_participants UUID[];
    shuffled_roles INTEGER[];
    i INTEGER;
    result JSON;
BEGIN
    -- Check if teams already exist for this session
    SELECT COUNT(*) INTO team_count FROM teams WHERE session_id = session_id_param;
    IF team_count > 0 THEN
        RAISE EXCEPTION 'Teams already exist for session %', session_id_param;
    END IF;

    -- Get participant count
    SELECT COUNT(*) INTO participant_count 
    FROM participants 
    WHERE session_id = session_id_param;
    
    -- Need at least 3 participants
    IF participant_count < 3 THEN
        RAISE EXCEPTION 'Need at least 3 participants to form teams, found %', participant_count;
    END IF;
    
    -- Calculate number of complete teams (teams of 3)
    team_count := participant_count / 3;
    
    -- Get shuffled list of participant IDs
    SELECT ARRAY(
        SELECT id FROM participants 
        WHERE session_id = session_id_param 
        ORDER BY RANDOM()
    ) INTO shuffled_participants;
    
    -- Create teams and assign members
    FOR team_idx IN 0..(team_count - 1) LOOP
        -- Create team
        INSERT INTO teams (session_id, team_name, team_index)
        VALUES (session_id_param, 'Team ' || (team_idx + 1), team_idx)
        RETURNING id INTO current_team_id;
        
        -- Generate shuffled role indices for this team
        shuffled_roles := ARRAY[1, 2, 3];
        
        -- Fisher-Yates shuffle for roles
        FOR j IN REVERSE 3..2 LOOP
            i := 1 + (RANDOM() * j)::INTEGER;
            -- Swap elements
            shuffled_roles[j] := shuffled_roles[j] + shuffled_roles[i];
            shuffled_roles[i] := shuffled_roles[j] - shuffled_roles[i];
            shuffled_roles[j] := shuffled_roles[j] - shuffled_roles[i];
        END LOOP;
        
        -- Assign 3 members to this team with shuffled roles
        FOR member_idx IN 0..2 LOOP
            current_member_index := (team_idx * 3) + member_idx + 1;
            i := shuffled_roles[member_idx + 1]; -- PostgreSQL arrays are 1-indexed
            
            INSERT INTO team_members (
                team_id, 
                participant_id, 
                role_name, 
                role_description, 
                role_icon
            ) VALUES (
                current_team_id,
                shuffled_participants[current_member_index],
                role_names[i],
                role_descriptions[i],
                role_icons[i]
            );
        END LOOP;
    END LOOP;
    
    -- Update session status
    UPDATE sessions 
    SET status = 'teams_formed', teams_formed_at = NOW()
    WHERE id = session_id_param;
    
    -- Return result
    SELECT json_build_object(
        'success', true,
        'teams_created', team_count,
        'participants_assigned', team_count * 3,
        'unassigned_participants', participant_count - (team_count * 3)
    ) INTO result;
    
    RETURN result;
END;
$$;

-- ============================================================================
-- TERRITORY DISTRIBUTION FUNCTIONS
-- ============================================================================

-- Function to distribute territories among teams
CREATE OR REPLACE FUNCTION distribute_territories(
    session_id_param VARCHAR(50),
    territories JSON -- Array of territory objects with name and osm_id
)
RETURNS JSON
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
    team_record RECORD;
    territory_record JSON;
    territory_count INTEGER;
    team_count INTEGER;
    territories_per_team INTEGER;
    extra_territories INTEGER;
    territory_index INTEGER := 0;
    current_territories_for_team INTEGER;
    shuffled_territories JSON[];
    result JSON;
BEGIN
    -- Get team count for this session
    SELECT COUNT(*) INTO team_count FROM teams WHERE session_id = session_id_param;
    
    IF team_count = 0 THEN
        RAISE EXCEPTION 'No teams found for session %', session_id_param;
    END IF;
    
    -- Convert JSON to array and shuffle
    SELECT ARRAY(
        SELECT value 
        FROM json_array_elements(territories) 
        ORDER BY RANDOM()
    ) INTO shuffled_territories;
    
    territory_count := array_length(shuffled_territories, 1);
    territories_per_team := territory_count / team_count;
    extra_territories := territory_count % team_count;
    
    -- Distribute territories among teams
    FOR team_record IN 
        SELECT id, team_index FROM teams 
        WHERE session_id = session_id_param 
        ORDER BY team_index
    LOOP
        -- Calculate how many territories this team gets
        current_territories_for_team := territories_per_team;
        IF team_record.team_index < extra_territories THEN
            current_territories_for_team := current_territories_for_team + 1;
        END IF;
        
        -- Assign territories to this team
        FOR i IN 1..current_territories_for_team LOOP
            territory_index := territory_index + 1;
            territory_record := shuffled_territories[territory_index];
            
            INSERT INTO team_territories (
                team_id,
                territory_name,
                territory_osm_id,
                status
            ) VALUES (
                team_record.id,
                territory_record->>'name',
                (territory_record->>'id')::BIGINT,
                'available'
            );
        END LOOP;
    END LOOP;
    
    -- Update session status to active
    UPDATE sessions SET status = 'active' WHERE id = session_id_param;
    
    -- Return result
    SELECT json_build_object(
        'success', true,
        'territories_distributed', territory_count,
        'teams_assigned', team_count,
        'territories_per_team_min', territories_per_team,
        'territories_per_team_max', territories_per_team + (CASE WHEN extra_territories > 0 THEN 1 ELSE 0 END)
    ) INTO result;
    
    RETURN result;
END;
$$;

-- ============================================================================
-- COMPLETE SESSION SETUP FUNCTION
-- ============================================================================

-- Master function to set up complete session with teams and territories
CREATE OR REPLACE FUNCTION setup_complete_session(
    session_id_param VARCHAR(50),
    territories JSON
)
RETURNS JSON
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
    team_result JSON;
    territory_result JSON;
    final_result JSON;
BEGIN
    -- Step 1: Create teams
    SELECT create_random_teams(session_id_param) INTO team_result;
    
    -- Step 2: Distribute territories
    SELECT distribute_territories(session_id_param, territories) INTO territory_result;
    
    -- Step 3: Combine results
    SELECT json_build_object(
        'success', true,
        'session_id', session_id_param,
        'team_formation', team_result,
        'territory_distribution', territory_result,
        'timestamp', NOW()
    ) INTO final_result;
    
    RETURN final_result;
END;
$$;

-- ============================================================================
-- UTILITY FUNCTIONS
-- ============================================================================

-- Function to get session overview
CREATE OR REPLACE FUNCTION get_session_overview(session_id_param VARCHAR(50))
RETURNS JSON
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
    result JSON;
BEGIN
    SELECT json_build_object(
        'session_id', s.id,
        'session_name', s.name,
        'status', s.status,
        'teams', (
            SELECT json_agg(
                json_build_object(
                    'team_id', t.id,
                    'team_name', t.team_name,
                    'team_index', t.team_index,
                    'members', (
                        SELECT json_agg(
                            json_build_object(
                                'participant_id', p.id,
                                'first_name', p.first_name,
                                'osm_username', p.osm_username,
                                'role_name', tm.role_name,
                                'role_icon', tm.role_icon
                            )
                        )
                        FROM team_members tm
                        JOIN participants p ON p.id = tm.participant_id
                        WHERE tm.team_id = t.id
                    ),
                    'territories', (
                        SELECT json_agg(
                            json_build_object(
                                'territory_name', tt.territory_name,
                                'territory_osm_id', tt.territory_osm_id,
                                'status', tt.status,
                                'completed_at', tt.completed_at
                            )
                        )
                        FROM team_territories tt
                        WHERE tt.team_id = t.id
                    )
                )
            )
            FROM teams t
            WHERE t.session_id = s.id
            ORDER BY t.team_index
        )
    ) INTO result
    FROM sessions s
    WHERE s.id = session_id_param;
    
    RETURN result;
END;
$$;

-- Function to get team leaderboard
CREATE OR REPLACE FUNCTION get_team_leaderboard(session_id_param VARCHAR(50))
RETURNS JSON
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
    result JSON;
BEGIN
    SELECT json_agg(
        json_build_object(
            'team_name', team_name,
            'team_index', team_index,
            'completed_territories', completed_count,
            'total_territories', total_count,
            'completion_percentage', ROUND((completed_count::DECIMAL / NULLIF(total_count, 0)) * 100, 2)
        )
        ORDER BY completed_count DESC, team_index
    ) INTO result
    FROM (
        SELECT 
            t.team_name,
            t.team_index,
            COUNT(tt.id) as total_count,
            COUNT(CASE WHEN tt.status = 'completed' THEN 1 END) as completed_count
        FROM teams t
        LEFT JOIN team_territories tt ON tt.team_id = t.id
        WHERE t.session_id = session_id_param
        GROUP BY t.id, t.team_name, t.team_index
    ) team_stats;
    
    RETURN result;
END;
$$;

-- Grant execute permissions
GRANT EXECUTE ON FUNCTION create_random_teams(VARCHAR) TO anon, authenticated;
GRANT EXECUTE ON FUNCTION distribute_territories(VARCHAR, JSON) TO anon, authenticated;
GRANT EXECUTE ON FUNCTION setup_complete_session(VARCHAR, JSON) TO anon, authenticated;
GRANT EXECUTE ON FUNCTION get_session_overview(VARCHAR) TO anon, authenticated;
GRANT EXECUTE ON FUNCTION get_team_leaderboard(VARCHAR) TO anon, authenticated;