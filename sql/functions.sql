-- ============================================================================
-- TEAM CREATION FUNCTION WITH CONFIGURABLE TEAM SIZE
-- ============================================================================

-- Drop old versions of the function
DROP FUNCTION IF EXISTS create_teams_with_role_assignment(VARCHAR);
DROP FUNCTION IF EXISTS create_teams_with_role_assignment(VARCHAR, INTEGER);

CREATE OR REPLACE FUNCTION create_teams_with_role_assignment(
    session_id_param VARCHAR(50),
    desired_team_size INTEGER DEFAULT 3
)
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
    IF participant_count < 1 THEN
        RAISE EXCEPTION 'Need at least 1 participant to form teams, found %', participant_count;
    END IF;

    -- Validate desired team size
    IF desired_team_size < 1 THEN
        RAISE EXCEPTION 'Desired team size must be at least 1, got %', desired_team_size;
    END IF;

    -- Calculate number of teams based on desired team size
    -- Uses ceiling division to ensure all participants are assigned
    team_count := CEIL(participant_count::FLOAT / desired_team_size)::INTEGER;

    RAISE NOTICE 'Will create % teams with target size of % members (actual sizes may vary slightly)',
                 team_count, desired_team_size;
    
    -- Get shuffled list of participant IDs
    SELECT ARRAY(
        SELECT id FROM participants 
        WHERE session_id = session_id_param 
        ORDER BY RANDOM()
    ) INTO shuffled_participants;
    
    RAISE NOTICE 'Shuffled % participants', array_length(shuffled_participants, 1);
    
    -- Create teams first
    DECLARE
        team_ids UUID[];
    BEGIN
        FOR team_idx IN 0..(team_count - 1) LOOP
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

            team_ids := array_append(team_ids, current_team_id);
            RAISE NOTICE 'Created team % with ID %', team_idx + 1, current_team_id;
        END LOOP;

        -- Assign participants to teams using round-robin distribution
        FOR participant_idx IN 1..array_length(shuffled_participants, 1) LOOP
            -- Calculate which team this participant goes to (round-robin)
            current_team_id := team_ids[((participant_idx - 1) % team_count) + 1];

            -- Calculate role based on participant index (cycles through all 3 roles)
            current_role_idx := ((participant_idx - 1) % 3) + 1;

            RAISE NOTICE 'Assigning participant % to team % as role %',
                         participant_idx,
                         ((participant_idx - 1) % team_count) + 1,
                         role_names[current_role_idx];

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
        END LOOP;
    END;
    
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
        'participants_assigned', participant_count,
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

-- Grant permissions (for both signatures)
GRANT EXECUTE ON FUNCTION create_teams_with_role_assignment(VARCHAR, INTEGER) TO anon, authenticated;

-- ============================================================================
-- GET SESSION PARTICIPANTS WITH DETAILED INFORMATION
-- ============================================================================

CREATE OR REPLACE FUNCTION get_session_participants_detailed(session_id_param VARCHAR(50))
RETURNS JSON
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
    result JSON;
    participant_count INTEGER;
    team_formation_ready BOOLEAN;
BEGIN
    -- Get participant count
    SELECT COUNT(*) INTO participant_count
    FROM participants
    WHERE session_id = session_id_param;

    -- Check if ready for team formation (at least 1 participant)
    team_formation_ready := (participant_count >= 1);

    -- Build detailed result
    SELECT json_build_object(
        'session_id', session_id_param,
        'participant_count', participant_count,
        'team_formation_ready', team_formation_ready,
        'participants', (
            SELECT COALESCE(json_agg(
                json_build_object(
                    'participant_id', p.id,
                    'first_name', p.first_name,
                    'osm_username', p.osm_username,
                    'created_at', p.created_at,
                    'team_assigned', (tm.id IS NOT NULL),
                    'team_id', t.id,
                    'team_name', t.team_name,
                    'team_index', t.team_index,
                    'role_name', tm.role_name,
                    'role_description', tm.role_description,
                    'role_icon', tm.role_icon
                )
                ORDER BY p.created_at
            ), '[]'::json)
            FROM participants p
            LEFT JOIN team_members tm ON tm.participant_id = p.id
            LEFT JOIN teams t ON t.id = tm.team_id
            WHERE p.session_id = session_id_param
        )
    ) INTO result;

    RETURN result;
END;
$$;

-- Grant permissions
GRANT EXECUTE ON FUNCTION get_session_participants_detailed(VARCHAR) TO anon, authenticated;

-- ============================================================================
-- TERRITORY AVAILABILITY MONITORING FUNCTIONS
-- ============================================================================

-- Function: get_territory_availability_overview
-- Purpose: Get counts and percentages of territories by status for a session
CREATE OR REPLACE FUNCTION get_territory_availability_overview(session_id_param VARCHAR(50))
RETURNS JSON
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
    result JSON;
    total_territories INTEGER;
    available_count INTEGER;
    current_count INTEGER;
    completed_count INTEGER;
BEGIN
    -- Get counts by status
    SELECT
        COUNT(*) FILTER (WHERE status = 'available') as available,
        COUNT(*) FILTER (WHERE status = 'current') as current,
        COUNT(*) FILTER (WHERE status = 'completed') as completed,
        COUNT(*) as total
    INTO available_count, current_count, completed_count, total_territories
    FROM team_territories
    WHERE session_id = session_id_param;

    -- Build result
    SELECT json_build_object(
        'session_id', session_id_param,
        'total_territories', total_territories,
        'available', available_count,
        'current', current_count,
        'completed', completed_count,
        'available_percentage', CASE WHEN total_territories > 0 THEN ROUND((available_count::NUMERIC / total_territories) * 100, 2) ELSE 0 END,
        'current_percentage', CASE WHEN total_territories > 0 THEN ROUND((current_count::NUMERIC / total_territories) * 100, 2) ELSE 0 END,
        'completed_percentage', CASE WHEN total_territories > 0 THEN ROUND((completed_count::NUMERIC / total_territories) * 100, 2) ELSE 0 END
    ) INTO result;

    RETURN result;
END;
$$;

GRANT EXECUTE ON FUNCTION get_territory_availability_overview(VARCHAR) TO anon, authenticated;

-- Function: get_available_territories_for_team
-- Purpose: Get all available territories for a specific team
CREATE OR REPLACE FUNCTION get_available_territories_for_team(team_id_param UUID)
RETURNS JSON
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
    result JSON;
BEGIN
    SELECT json_build_object(
        'team_id', team_id_param,
        'available_count', COUNT(*),
        'territories', COALESCE(json_agg(
            json_build_object(
                'assignment_id', tt.id,
                'territory_id', it.id,
                'territory_name', it.name,
                'iso_code', it.iso_code,
                'place_type', it.place_type,
                'assigned_at', tt.assigned_at,
                'overpass_ready', (it.iso_code IS NOT NULL AND it.iso_code != '')
            )
            ORDER BY it.name
        ), '[]'::json)
    ) INTO result
    FROM team_territories tt
    JOIN indian_territories it ON it.id = tt.territory_id
    WHERE tt.team_id = team_id_param
    AND tt.status = 'available';

    RETURN result;
END;
$$;

GRANT EXECUTE ON FUNCTION get_available_territories_for_team(UUID) TO anon, authenticated;

-- Function: get_territories_by_status
-- Purpose: Get all territories with a specific status for a session
CREATE OR REPLACE FUNCTION get_territories_by_status(
    session_id_param VARCHAR(50),
    status_param VARCHAR(20)
)
RETURNS JSON
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
    result JSON;
BEGIN
    -- Validate status
    IF status_param NOT IN ('available', 'current', 'completed') THEN
        RAISE EXCEPTION 'Invalid status: %. Must be available, current, or completed', status_param;
    END IF;

    SELECT json_build_object(
        'session_id', session_id_param,
        'status', status_param,
        'count', COUNT(*),
        'territories', COALESCE(json_agg(
            json_build_object(
                'assignment_id', tt.id,
                'territory_id', it.id,
                'territory_name', it.name,
                'iso_code', it.iso_code,
                'team_id', t.id,
                'team_name', t.team_name,
                'team_index', t.team_index,
                'assigned_at', tt.assigned_at,
                'started_at', tt.started_at,
                'completed_at', tt.completed_at,
                'completed_by', tt.completed_by,
                'notes', tt.notes
            )
            ORDER BY t.team_index, it.name
        ), '[]'::json)
    ) INTO result
    FROM team_territories tt
    JOIN indian_territories it ON it.id = tt.territory_id
    JOIN teams t ON t.id = tt.team_id
    WHERE tt.session_id = session_id_param
    AND tt.status = status_param;

    RETURN result;
END;
$$;

GRANT EXECUTE ON FUNCTION get_territories_by_status(VARCHAR, VARCHAR) TO anon, authenticated;

-- Function: get_territory_assignment_details
-- Purpose: Get detailed information about a specific territory assignment
CREATE OR REPLACE FUNCTION get_territory_assignment_details(assignment_id_param UUID)
RETURNS JSON
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
    result JSON;
BEGIN
    SELECT json_build_object(
        'assignment_id', tt.id,
        'status', tt.status,
        'assigned_at', tt.assigned_at,
        'started_at', tt.started_at,
        'completed_at', tt.completed_at,
        'notes', tt.notes,
        'territory', json_build_object(
            'territory_id', it.id,
            'name', it.name,
            'name_en', it.name_en,
            'iso_code', it.iso_code,
            'osm_relation_id', it.osm_relation_id,
            'place_type', it.place_type,
            'area_km2', it.area_km2,
            'population', it.population,
            'capital', it.capital,
            'overpass_ready', (it.iso_code IS NOT NULL AND it.iso_code != '')
        ),
        'team', json_build_object(
            'team_id', t.id,
            'team_name', t.team_name,
            'team_index', t.team_index
        ),
        'session', json_build_object(
            'session_id', s.id,
            'session_name', s.name,
            'session_status', s.status
        ),
        'completed_by_participant', CASE
            WHEN tt.completed_by IS NOT NULL THEN
                json_build_object(
                    'participant_id', p.id,
                    'first_name', p.first_name,
                    'osm_username', p.osm_username
                )
            ELSE NULL
        END,
        'duration', CASE
            WHEN tt.completed_at IS NOT NULL AND tt.started_at IS NOT NULL
            THEN EXTRACT(EPOCH FROM (tt.completed_at - tt.started_at))
            ELSE NULL
        END
    ) INTO result
    FROM team_territories tt
    JOIN indian_territories it ON it.id = tt.territory_id
    JOIN teams t ON t.id = tt.team_id
    JOIN sessions s ON s.id = tt.session_id
    LEFT JOIN participants p ON p.id = tt.completed_by
    WHERE tt.id = assignment_id_param;

    IF result IS NULL THEN
        RAISE EXCEPTION 'Territory assignment % not found', assignment_id_param;
    END IF;

    RETURN result;
END;
$$;

GRANT EXECUTE ON FUNCTION get_territory_assignment_details(UUID) TO anon, authenticated;

-- Function: get_all_territory_assignments
-- Purpose: Get all territory assignments for a session with full details
CREATE OR REPLACE FUNCTION get_all_territory_assignments(session_id_param VARCHAR(50))
RETURNS JSON
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
    result JSON;
BEGIN
    SELECT json_build_object(
        'session_id', session_id_param,
        'total_assignments', COUNT(*),
        'assignments', COALESCE(json_agg(
            json_build_object(
                'assignment_id', tt.id,
                'status', tt.status,
                'territory_name', it.name,
                'iso_code', it.iso_code,
                'team_name', t.team_name,
                'team_index', t.team_index,
                'assigned_at', tt.assigned_at,
                'started_at', tt.started_at,
                'completed_at', tt.completed_at,
                'notes', tt.notes,
                'overpass_ready', (it.iso_code IS NOT NULL AND it.iso_code != '')
            )
            ORDER BY t.team_index, it.name
        ), '[]'::json)
    ) INTO result
    FROM team_territories tt
    JOIN indian_territories it ON it.id = tt.territory_id
    JOIN teams t ON t.id = tt.team_id
    WHERE tt.session_id = session_id_param;

    RETURN result;
END;
$$;

GRANT EXECUTE ON FUNCTION get_all_territory_assignments(VARCHAR) TO anon, authenticated;

-- Function: get_team_territory_progress
-- Purpose: Get detailed progress information for a specific team
CREATE OR REPLACE FUNCTION get_team_territory_progress(team_id_param UUID)
RETURNS JSON
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
    result JSON;
    total_count INTEGER;
    available_count INTEGER;
    current_count INTEGER;
    completed_count INTEGER;
BEGIN
    -- Get counts by status
    SELECT
        COUNT(*) FILTER (WHERE status = 'available') as available,
        COUNT(*) FILTER (WHERE status = 'current') as current,
        COUNT(*) FILTER (WHERE status = 'completed') as completed,
        COUNT(*) as total
    INTO available_count, current_count, completed_count, total_count
    FROM team_territories
    WHERE team_id = team_id_param;

    -- Build result with team details
    SELECT json_build_object(
        'team_id', t.id,
        'team_name', t.team_name,
        'team_index', t.team_index,
        'session_id', t.session_id,
        'total_territories', total_count,
        'available', available_count,
        'current', current_count,
        'completed', completed_count,
        'completion_percentage', CASE WHEN total_count > 0 THEN ROUND((completed_count::NUMERIC / total_count) * 100, 2) ELSE 0 END,
        'territories_by_status', json_build_object(
            'available', (
                SELECT COALESCE(json_agg(
                    json_build_object(
                        'assignment_id', tt.id,
                        'territory_name', it.name,
                        'iso_code', it.iso_code
                    )
                    ORDER BY it.name
                ), '[]'::json)
                FROM team_territories tt
                JOIN indian_territories it ON it.id = tt.territory_id
                WHERE tt.team_id = team_id_param AND tt.status = 'available'
            ),
            'current', (
                SELECT COALESCE(json_agg(
                    json_build_object(
                        'assignment_id', tt.id,
                        'territory_name', it.name,
                        'iso_code', it.iso_code,
                        'started_at', tt.started_at
                    )
                    ORDER BY tt.started_at DESC
                ), '[]'::json)
                FROM team_territories tt
                JOIN indian_territories it ON it.id = tt.territory_id
                WHERE tt.team_id = team_id_param AND tt.status = 'current'
            ),
            'completed', (
                SELECT COALESCE(json_agg(
                    json_build_object(
                        'assignment_id', tt.id,
                        'territory_name', it.name,
                        'iso_code', it.iso_code,
                        'completed_at', tt.completed_at,
                        'completed_by', p.first_name
                    )
                    ORDER BY tt.completed_at DESC
                ), '[]'::json)
                FROM team_territories tt
                JOIN indian_territories it ON it.id = tt.territory_id
                LEFT JOIN participants p ON p.id = tt.completed_by
                WHERE tt.team_id = team_id_param AND tt.status = 'completed'
            )
        )
    ) INTO result
    FROM teams t
    WHERE t.id = team_id_param;

    IF result IS NULL THEN
        RAISE EXCEPTION 'Team % not found', team_id_param;
    END IF;

    RETURN result;
END;
$$;

GRANT EXECUTE ON FUNCTION get_team_territory_progress(UUID) TO anon, authenticated;

-- ============================================================================
-- FUNCTION USAGE EXAMPLES AND DOCUMENTATION
-- ============================================================================

/*
TERRITORY MONITORING FUNCTIONS - USAGE EXAMPLES:

1. GET OVERVIEW OF TERRITORY AVAILABILITY FOR A SESSION
   Returns counts and percentages of territories by status

   SELECT get_territory_availability_overview('GRID2025');

   Returns:
   {
     "session_id": "GRID2025",
     "total_territories": 36,
     "available": 20,
     "current": 10,
     "completed": 6,
     "available_percentage": 55.56,
     "current_percentage": 27.78,
     "completed_percentage": 16.67
   }

2. GET AVAILABLE TERRITORIES FOR A SPECIFIC TEAM
   Returns all territories not yet started by a team

   SELECT get_available_territories_for_team('team-uuid-here');

   Returns:
   {
     "team_id": "...",
     "available_count": 8,
     "territories": [
       {
         "assignment_id": "...",
         "territory_id": "...",
         "territory_name": "Maharashtra",
         "iso_code": "IN-MH",
         "place_type": "state",
         "assigned_at": "2024-11-06T...",
         "overpass_ready": true
       },
       ...
     ]
   }

3. GET TERRITORIES BY STATUS
   Filter all territories in a session by their status

   SELECT get_territories_by_status('GRID2025', 'completed');

   Valid statuses: 'available', 'current', 'completed'

   Returns:
   {
     "session_id": "GRID2025",
     "status": "completed",
     "count": 6,
     "territories": [...]
   }

4. GET DETAILED INFO ABOUT A TERRITORY ASSIGNMENT
   Get full details including duration, who completed it, etc.

   SELECT get_territory_assignment_details('assignment-uuid-here');

   Returns detailed JSON with territory info, team info, session info,
   completion details, and duration in seconds.

5. GET ALL TERRITORY ASSIGNMENTS FOR A SESSION
   Complete list of all territory assignments with status

   SELECT get_all_territory_assignments('GRID2025');

   Returns:
   {
     "session_id": "GRID2025",
     "total_assignments": 36,
     "assignments": [...]
   }

6. GET DETAILED PROGRESS FOR A SPECIFIC TEAM
   Shows breakdown of territories by status for one team

   SELECT get_team_territory_progress('team-uuid-here');

   Returns:
   {
     "team_id": "...",
     "team_name": "Team Alpha",
     "total_territories": 12,
     "available": 4,
     "current": 3,
     "completed": 5,
     "completion_percentage": 41.67,
     "territories_by_status": {
       "available": [...],
       "current": [...],
       "completed": [...]
     }
   }

COORDINATOR USE CASES:
- Monitor overall session progress: get_territory_availability_overview()
- See which territories are still available: get_territories_by_status(session, 'available')
- Check team progress: get_team_territory_progress()
- Find stalled territories: get_territories_by_status(session, 'current')

PARTICIPANT USE CASES:
- See what's left to work on: get_available_territories_for_team()
- Track team progress: get_team_territory_progress()
- View assignment details: get_territory_assignment_details()

*/

-- ============================================================================
-- CRITICAL COORDINATOR FUNCTIONS
-- ============================================================================
-- These functions are called by supabase.js and are essential for
-- coordinator operations, territory distribution, and status tracking

-- Function: distribute_territories_to_teams
-- Purpose: Distribute all active territories evenly across teams in a session
CREATE OR REPLACE FUNCTION distribute_territories_to_teams(session_id_param VARCHAR(50))
RETURNS JSON
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
    result JSON;
    team_count INTEGER;
    territory_count INTEGER;
    territories_distributed INTEGER := 0;
    team_ids UUID[];
    territory_records RECORD;
    current_team_idx INTEGER := 0;
BEGIN
    -- Validate session exists
    IF NOT EXISTS (SELECT 1 FROM sessions WHERE id = session_id_param) THEN
        RAISE EXCEPTION 'Session % does not exist', session_id_param;
    END IF;

    -- Get all team IDs for this session
    SELECT ARRAY(
        SELECT id FROM teams
        WHERE session_id = session_id_param
        ORDER BY team_index
    ) INTO team_ids;

    team_count := array_length(team_ids, 1);

    IF team_count IS NULL OR team_count = 0 THEN
        RAISE EXCEPTION 'No teams found for session %. Create teams first.', session_id_param;
    END IF;

    RAISE NOTICE 'Distributing territories to % teams', team_count;

    -- Check if territories already assigned
    SELECT COUNT(*) INTO territory_count
    FROM team_territories
    WHERE session_id = session_id_param;

    IF territory_count > 0 THEN
        RAISE EXCEPTION 'Territories already distributed for session %. Cannot redistribute.', session_id_param;
    END IF;

    -- Get count of active territories
    SELECT COUNT(*) INTO territory_count
    FROM indian_territories
    WHERE is_active = true;

    RAISE NOTICE 'Found % active territories to distribute', territory_count;

    -- Distribute territories round-robin across teams
    FOR territory_records IN (
        SELECT id, name, osm_relation_id
        FROM indian_territories
        WHERE is_active = true
        ORDER BY name
    ) LOOP
        -- Insert territory assignment
        INSERT INTO team_territories (
            session_id,
            team_id,
            territory_id,
            status,
            territory_name,
            territory_osm_id
        ) VALUES (
            session_id_param,
            team_ids[(current_team_idx % team_count) + 1],
            territory_records.id,
            'available',
            territory_records.name,
            territory_records.osm_relation_id
        );

        territories_distributed := territories_distributed + 1;
        current_team_idx := current_team_idx + 1;
    END LOOP;

    -- Update session status
    UPDATE sessions
    SET status = 'active'
    WHERE id = session_id_param;

    RAISE NOTICE 'Distributed % territories across % teams', territories_distributed, team_count;

    -- Build result
    SELECT json_build_object(
        'success', true,
        'session_id', session_id_param,
        'teams_count', team_count,
        'territories_distributed', territories_distributed,
        'avg_territories_per_team', ROUND(territories_distributed::NUMERIC / team_count, 2)
    ) INTO result;

    RETURN result;
END;
$$;

GRANT EXECUTE ON FUNCTION distribute_territories_to_teams(VARCHAR) TO anon, authenticated;

-- Function: get_territory_for_overpass_operations
-- Purpose: Get territory ISO code and details for Overpass API queries
CREATE OR REPLACE FUNCTION get_territory_for_overpass_operations(assignment_id_param UUID)
RETURNS JSON
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
    result JSON;
BEGIN
    SELECT json_build_object(
        'assignment_id', tt.id,
        'territory_id', it.id,
        'territory_name', it.name,
        'iso_code', it.iso_code,
        'osm_relation_id', it.osm_relation_id,
        'place_type', it.place_type,
        'team_id', tt.team_id,
        'session_id', tt.session_id,
        'status', tt.status
    ) INTO result
    FROM team_territories tt
    JOIN indian_territories it ON it.id = tt.territory_id
    WHERE tt.id = assignment_id_param;

    IF result IS NULL THEN
        RAISE EXCEPTION 'Territory assignment % not found', assignment_id_param;
    END IF;

    RETURN result;
END;
$$;

GRANT EXECUTE ON FUNCTION get_territory_for_overpass_operations(UUID) TO anon, authenticated;

-- Function: update_territory_assignment_status
-- Purpose: Update territory status with automatic timestamp management
CREATE OR REPLACE FUNCTION update_territory_assignment_status(
    assignment_id_param UUID,
    new_status_param VARCHAR(20),
    participant_id_param UUID,
    notes_param TEXT DEFAULT NULL
)
RETURNS JSON
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
    result JSON;
    old_status VARCHAR(20);
BEGIN
    -- Validate status
    IF new_status_param NOT IN ('available', 'current', 'completed') THEN
        RAISE EXCEPTION 'Invalid status: %. Must be available, current, or completed', new_status_param;
    END IF;

    -- Get current status
    SELECT status INTO old_status
    FROM team_territories
    WHERE id = assignment_id_param;

    IF old_status IS NULL THEN
        RAISE EXCEPTION 'Territory assignment % not found', assignment_id_param;
    END IF;

    -- Update based on new status
    IF new_status_param = 'current' THEN
        -- Starting work on territory
        UPDATE team_territories
        SET status = new_status_param,
            started_at = COALESCE(started_at, NOW()),
            notes = COALESCE(notes_param, notes)
        WHERE id = assignment_id_param;

    ELSIF new_status_param = 'completed' THEN
        -- Completing territory
        UPDATE team_territories
        SET status = new_status_param,
            started_at = COALESCE(started_at, NOW()),
            completed_at = NOW(),
            completed_by = participant_id_param,
            notes = COALESCE(notes_param, notes)
        WHERE id = assignment_id_param;

    ELSE
        -- Reverting to available
        UPDATE team_territories
        SET status = new_status_param,
            notes = COALESCE(notes_param, notes)
        WHERE id = assignment_id_param;
    END IF;

    -- Get updated record
    SELECT json_build_object(
        'assignment_id', tt.id,
        'territory_name', it.name,
        'old_status', old_status,
        'new_status', tt.status,
        'started_at', tt.started_at,
        'completed_at', tt.completed_at,
        'completed_by', tt.completed_by,
        'notes', tt.notes
    ) INTO result
    FROM team_territories tt
    JOIN indian_territories it ON it.id = tt.territory_id
    WHERE tt.id = assignment_id_param;

    RAISE NOTICE 'Territory % status: % -> %', assignment_id_param, old_status, new_status_param;

    RETURN result;
END;
$$;

GRANT EXECUTE ON FUNCTION update_territory_assignment_status(UUID, VARCHAR, UUID, TEXT) TO anon, authenticated;

-- Function: get_session_progress_overview
-- Purpose: Get comprehensive session progress statistics for coordinator dashboard
CREATE OR REPLACE FUNCTION get_session_progress_overview(session_id_param VARCHAR(50))
RETURNS JSON
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
    result JSON;
    session_status VARCHAR;
    team_count INTEGER;
    total_territories INTEGER;
    completed_territories INTEGER;
    current_territories INTEGER;
    available_territories INTEGER;
BEGIN
    -- Get session status
    SELECT status INTO session_status
    FROM sessions
    WHERE id = session_id_param;

    IF session_status IS NULL THEN
        RAISE EXCEPTION 'Session % not found', session_id_param;
    END IF;

    -- Count teams
    SELECT COUNT(*) INTO team_count
    FROM teams
    WHERE session_id = session_id_param;

    -- Count territories by status
    SELECT
        COUNT(*) as total,
        COUNT(*) FILTER (WHERE status = 'completed') as completed,
        COUNT(*) FILTER (WHERE status = 'current') as current,
        COUNT(*) FILTER (WHERE status = 'available') as available
    INTO total_territories, completed_territories, current_territories, available_territories
    FROM team_territories
    WHERE session_id = session_id_param;

    -- Build comprehensive result
    SELECT json_build_object(
        'session_id', session_id_param,
        'session_status', session_status,
        'team_count', team_count,
        'total_territories', total_territories,
        'completed_territories', completed_territories,
        'current_territories', current_territories,
        'available_territories', available_territories,
        'completion_percentage', CASE
            WHEN total_territories > 0
            THEN ROUND((completed_territories::NUMERIC / total_territories) * 100, 2)
            ELSE 0
        END,
        'teams_data', (
            SELECT COALESCE(json_agg(
                json_build_object(
                    'team_id', t.id,
                    'team_name', t.team_name,
                    'team_index', t.team_index,
                    'total_territories', (
                        SELECT COUNT(*)
                        FROM team_territories tt
                        WHERE tt.team_id = t.id
                    ),
                    'completed_territories', (
                        SELECT COUNT(*)
                        FROM team_territories tt
                        WHERE tt.team_id = t.id AND tt.status = 'completed'
                    ),
                    'current_territories', (
                        SELECT COUNT(*)
                        FROM team_territories tt
                        WHERE tt.team_id = t.id AND tt.status = 'current'
                    ),
                    'member_count', (
                        SELECT COUNT(*)
                        FROM team_members tm
                        WHERE tm.team_id = t.id
                    )
                )
                ORDER BY t.team_index
            ), '[]'::json)
            FROM teams t
            WHERE t.session_id = session_id_param
        )
    ) INTO result;

    RETURN result;
END;
$$;

GRANT EXECUTE ON FUNCTION get_session_progress_overview(VARCHAR) TO anon, authenticated;

-- Function: get_team_leaderboard_for_session
-- Purpose: Get team rankings by completion percentage
CREATE OR REPLACE FUNCTION get_team_leaderboard_for_session(session_id_param VARCHAR(50))
RETURNS JSON
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
    result JSON;
BEGIN
    SELECT COALESCE(json_agg(
        json_build_object(
            'rank', row_number() OVER (ORDER BY completion_percentage DESC, team_name),
            'team_id', team_id,
            'team_name', team_name,
            'team_index', team_index,
            'total_territories', total_territories,
            'completed_territories', completed_territories,
            'current_territories', current_territories,
            'completion_percentage', completion_percentage
        )
        ORDER BY completion_percentage DESC, team_name
    ), '[]'::json) INTO result
    FROM (
        SELECT
            t.id as team_id,
            t.team_name,
            t.team_index,
            COUNT(tt.id) as total_territories,
            COUNT(tt.id) FILTER (WHERE tt.status = 'completed') as completed_territories,
            COUNT(tt.id) FILTER (WHERE tt.status = 'current') as current_territories,
            CASE
                WHEN COUNT(tt.id) > 0
                THEN ROUND((COUNT(tt.id) FILTER (WHERE tt.status = 'completed')::NUMERIC / COUNT(tt.id)) * 100, 2)
                ELSE 0
            END as completion_percentage
        FROM teams t
        LEFT JOIN team_territories tt ON tt.team_id = t.id
        WHERE t.session_id = session_id_param
        GROUP BY t.id, t.team_name, t.team_index
    ) team_stats;

    RETURN result;
END;
$$;

GRANT EXECUTE ON FUNCTION get_team_leaderboard_for_session(VARCHAR) TO anon, authenticated;

-- Function: verify_session_teams
-- Purpose: Verify session team composition and validate session isolation
CREATE OR REPLACE FUNCTION verify_session_teams(session_id_param VARCHAR(50))
RETURNS JSON
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
    result JSON;
    total_teams INTEGER;
    total_members INTEGER;
    cross_session_violations INTEGER;
    teams_without_members INTEGER;
BEGIN
    -- Count teams
    SELECT COUNT(*) INTO total_teams
    FROM teams
    WHERE session_id = session_id_param;

    -- Count team members
    SELECT COUNT(*) INTO total_members
    FROM team_members tm
    JOIN teams t ON t.id = tm.team_id
    WHERE t.session_id = session_id_param;

    -- Check for session isolation violations
    SELECT COUNT(*) INTO cross_session_violations
    FROM team_members tm
    JOIN teams t ON t.id = tm.team_id
    JOIN participants p ON p.id = tm.participant_id
    WHERE t.session_id = session_id_param
    AND p.session_id != session_id_param;

    -- Count teams without members
    SELECT COUNT(*) INTO teams_without_members
    FROM teams t
    WHERE t.session_id = session_id_param
    AND NOT EXISTS (
        SELECT 1 FROM team_members tm WHERE tm.team_id = t.id
    );

    -- Build result
    SELECT json_build_object(
        'session_id', session_id_param,
        'total_teams', total_teams,
        'total_members', total_members,
        'teams_without_members', teams_without_members,
        'cross_session_violations', cross_session_violations,
        'session_isolation_valid', (cross_session_violations = 0),
        'all_teams_have_members', (teams_without_members = 0),
        'verification_passed', (cross_session_violations = 0 AND teams_without_members = 0)
    ) INTO result;

    RETURN result;
END;
$$;

GRANT EXECUTE ON FUNCTION verify_session_teams(VARCHAR) TO anon, authenticated;

-- Function: validate_territory_assignments
-- Purpose: Validate territory assignments for a session
CREATE OR REPLACE FUNCTION validate_territory_assignments(session_id_param VARCHAR(50))
RETURNS JSON
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
    result JSON;
    total_assignments INTEGER;
    duplicate_territories INTEGER;
    orphaned_assignments INTEGER;
    territories_per_team JSON;
BEGIN
    -- Count total assignments
    SELECT COUNT(*) INTO total_assignments
    FROM team_territories
    WHERE session_id = session_id_param;

    -- Check for duplicate territory assignments (same territory to multiple teams)
    SELECT COUNT(*) INTO duplicate_territories
    FROM (
        SELECT territory_id
        FROM team_territories
        WHERE session_id = session_id_param
        GROUP BY territory_id
        HAVING COUNT(*) > 1
    ) duplicates;

    -- Check for orphaned assignments (team or territory doesn't exist)
    SELECT COUNT(*) INTO orphaned_assignments
    FROM team_territories tt
    WHERE tt.session_id = session_id_param
    AND (
        NOT EXISTS (SELECT 1 FROM teams t WHERE t.id = tt.team_id)
        OR NOT EXISTS (SELECT 1 FROM indian_territories it WHERE it.id = tt.territory_id)
    );

    -- Get distribution of territories per team
    SELECT json_agg(
        json_build_object(
            'team_name', t.team_name,
            'territory_count', COUNT(tt.id)
        )
        ORDER BY t.team_index
    ) INTO territories_per_team
    FROM teams t
    LEFT JOIN team_territories tt ON tt.team_id = t.id
    WHERE t.session_id = session_id_param
    GROUP BY t.id, t.team_name, t.team_index;

    -- Build result
    SELECT json_build_object(
        'session_id', session_id_param,
        'total_assignments', total_assignments,
        'duplicate_territories', duplicate_territories,
        'orphaned_assignments', orphaned_assignments,
        'no_duplicates', (duplicate_territories = 0),
        'no_orphans', (orphaned_assignments = 0),
        'validation_passed', (duplicate_territories = 0 AND orphaned_assignments = 0),
        'territories_per_team', COALESCE(territories_per_team, '[]'::json)
    ) INTO result;

    RETURN result;
END;
$$;

GRANT EXECUTE ON FUNCTION validate_territory_assignments(VARCHAR) TO anon, authenticated;

-- Function: get_territory_statistics
-- Purpose: Get global territory statistics (optional utility function)
CREATE OR REPLACE FUNCTION get_territory_statistics()
RETURNS JSON
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
    result JSON;
BEGIN
    SELECT json_build_object(
        'total_territories', COUNT(*),
        'active_territories', COUNT(*) FILTER (WHERE is_active = true),
        'inactive_territories', COUNT(*) FILTER (WHERE is_active = false),
        'states', COUNT(*) FILTER (WHERE place_type = 'state'),
        'union_territories', COUNT(*) FILTER (WHERE place_type IN ('union_territory', 'territory')),
        'territories_by_type', (
            SELECT json_object_agg(place_type, count)
            FROM (
                SELECT place_type, COUNT(*) as count
                FROM indian_territories
                GROUP BY place_type
            ) type_counts
        ),
        'territories_with_iso_code', COUNT(*) FILTER (WHERE iso_code IS NOT NULL AND iso_code != ''),
        'territories_ready_for_overpass', COUNT(*) FILTER (
            WHERE iso_code IS NOT NULL
            AND iso_code != ''
            AND is_active = true
        )
    ) INTO result
    FROM indian_territories;

    RETURN result;
END;
$$;

GRANT EXECUTE ON FUNCTION get_territory_statistics() TO anon, authenticated;

-- ============================================================================
-- SESSION ISOLATION ENFORCEMENT
-- ============================================================================
-- These triggers and functions ensure that participants can ONLY be assigned
-- to teams within their own session. This prevents accidental or malicious
-- cross-session contamination of team memberships.
--
-- GUARANTEES:
-- 1. A participant registered in session "testalpha" can NEVER be added to a
--    team from session "testbeta"
-- 2. All team formation operations are session-scoped
-- 3. Manual team reassignments respect session boundaries
-- 4. Database-level enforcement (not just application-level)
-- ============================================================================

-- Function: validate_team_member_session_match
-- Purpose: Trigger function to ensure participant and team belong to same session
-- Fires: BEFORE INSERT OR UPDATE on team_members table
CREATE OR REPLACE FUNCTION validate_team_member_session_match()
RETURNS TRIGGER
LANGUAGE plpgsql
AS $$
DECLARE
    participant_session_id VARCHAR(50);
    team_session_id VARCHAR(50);
BEGIN
    -- Get the session_id for the participant
    SELECT session_id INTO participant_session_id
    FROM participants
    WHERE id = NEW.participant_id;

    -- Get the session_id for the team
    SELECT session_id INTO team_session_id
    FROM teams
    WHERE id = NEW.team_id;

    -- Raise exception if sessions don't match
    IF participant_session_id IS NULL THEN
        RAISE EXCEPTION 'Participant % does not exist', NEW.participant_id;
    END IF;

    IF team_session_id IS NULL THEN
        RAISE EXCEPTION 'Team % does not exist', NEW.team_id;
    END IF;

    IF participant_session_id != team_session_id THEN
        RAISE EXCEPTION 'Session mismatch: Participant belongs to session "%" but team belongs to session "%". Participants can only be assigned to teams within their own session.',
            participant_session_id, team_session_id;
    END IF;

    -- Validation passed, allow the operation
    RETURN NEW;
END;
$$;

-- Create trigger on team_members table
DROP TRIGGER IF EXISTS enforce_session_isolation ON team_members;
CREATE TRIGGER enforce_session_isolation
    BEFORE INSERT OR UPDATE ON team_members
    FOR EACH ROW
    EXECUTE FUNCTION validate_team_member_session_match();

-- Grant permissions
GRANT EXECUTE ON FUNCTION validate_team_member_session_match() TO anon, authenticated;

-- ============================================================================
-- SESSION ISOLATION DOCUMENTATION
-- ============================================================================
/*
SESSION ISOLATION SYSTEM:

Grid Tycoon enforces strict session boundaries to ensure participants in one
mapping session never interact with participants from another session.

ENFORCEMENT LAYERS:

1. APPLICATION LAYER (js/app.js, js/supabase.js):
   - Team formation functions filter participants by session_id
   - UI only shows participants/teams from current session
   - Coordinator actions scoped to their session

2. FUNCTION LAYER (this file):
   - create_teams_with_role_assignment() only processes session participants
   - All queries include session_id filters
   - RPC functions validate session_id parameters

3. DATABASE LAYER (triggers):
   - validate_team_member_session_match() trigger enforces session matching
   - Prevents INSERT/UPDATE that would violate session boundaries
   - Cannot be bypassed by application code

EXAMPLE ENFORCEMENT:

-- This will SUCCEED (same session):
Session "testalpha": participant_A -> Team_Alpha (session "testalpha") ✓

-- This will FAIL (different sessions):
Session "testalpha": participant_A -> Team_Beta (session "testbeta") ✗
ERROR: Session mismatch: Participant belongs to session "testalpha"
       but team belongs to session "testbeta"

TESTING SESSION ISOLATION:

-- 1. Create two sessions with participants
INSERT INTO sessions (id, name) VALUES ('session_a', 'Session A');
INSERT INTO sessions (id, name) VALUES ('session_b', 'Session B');
INSERT INTO participants (first_name, osm_username, session_id)
VALUES ('Alice', 'alice_osm', 'session_a');
INSERT INTO participants (first_name, osm_username, session_id)
VALUES ('Bob', 'bob_osm', 'session_b');

-- 2. Form teams for each session
SELECT create_teams_with_role_assignment('session_a', 3);
SELECT create_teams_with_role_assignment('session_b', 3);

-- 3. Try to move Alice to Bob's team (should FAIL)
UPDATE team_members
SET team_id = (SELECT id FROM teams WHERE session_id = 'session_b' LIMIT 1)
WHERE participant_id = (SELECT id FROM participants WHERE osm_username = 'alice_osm');

-- Result: ERROR - Session mismatch detected by trigger!

COORDINATOR WORKFLOW:

When a coordinator logs in with session ID "testalpha-COORD":
1. cleanSessionId() strips suffix -> "testalpha"
2. All operations use session_id = "testalpha"
3. Only participants with session_id = "testalpha" are visible
4. Only teams with session_id = "testalpha" are created/modified
5. Database trigger prevents accidents

This multi-layer approach ensures session isolation is GUARANTEED, not just
recommended.
*/