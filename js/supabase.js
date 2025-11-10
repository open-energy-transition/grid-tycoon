/**
 * Supabase Database Integration for Grid Tycoon
 * 
 * Complete implementation with ISO code support and coordinator functions
 * 
 * @version 3.2
 * @author Grid Tycoon Team
 */

class SupabaseTeamManager {
    constructor(config = null) {
        // Use provided config or global config
        this.config = config || window.GRID_TYCOON_CONFIG?.database || {};
        
        // Validate configuration
        if (!this.config.url || !this.config.anonKey) {
            throw new Error('Missing Supabase configuration. Please set database.url and database.anonKey in config');
        }
        
        if (this.config.url === 'YOUR_SUPABASE_URL_HERE' || 
            this.config.anonKey === 'YOUR_ANON_KEY_HERE') {
            throw new Error('Please update configuration with your actual Supabase credentials');
        }

        // Validate Supabase client availability
        if (!window.supabase) {
            throw new Error('Supabase client library not loaded. Please include the Supabase script.');
        }
        
        // Initialize Supabase client
        this.supabase = window.supabase.createClient(this.config.url, this.config.anonKey);
        
        // Current user session
        this.currentUserId = null;
        this.currentSessionId = null;
        
        // Team role definitions
        this.teamRoles = [
            {
                name: 'Pioneer',
                description: 'In charge of traditional style mapping of annotating on a map',
                icon: '🗺️'
            },
            {
                name: 'Technician', 
                description: 'Ensures assets are correctly named and missing voltages are added',
                icon: '⚡'
            },
            {
                name: 'Seeker',
                description: 'Seeks out missing Power Plants, good first lines and available credible information sources, checks industries as well',
                icon: '🔍'
            }
        ];
        
        console.log('SupabaseTeamManager v3.2 initialized successfully');
    }

    // ================================
    // CONNECTION TESTING
    // ================================

    /**
     * Test the Supabase connection and database access
     * @returns {Promise<{success: boolean, data?: object, error?: string}>}
     */
    async testConnection() {
        try {
            console.log('Testing Supabase connection...');
            
            const { data, error } = await this.supabase
                .from('sessions')
                .select('id')
                .limit(1);
            
            if (error) {
                console.error('Supabase connection test failed:', error);
                return this.handleDatabaseError(error, 'Connection test failed');
            }
            
            console.log('Supabase connection successful');
            return {
                success: true,
                data: { connected: true, tablesAccessible: true }
            };
            
        } catch (error) {
            console.error('Database connection failed:', error);
            return {
                success: false,
                error: error.message
            };
        }
    }

    // ================================
    // USER MANAGEMENT
    // ================================

    /**
     * Register a new participant for a session
     * @param {string} firstName - Participant's first name
     * @param {string} osmUsername - OSM username
     * @param {string} sessionId - Session identifier
     * @returns {Promise<{success: boolean, data?: object, error?: string}>}
     */
    async registerParticipant(firstName, osmUsername, sessionId) {
        try {
            console.log(`Registering participant: ${firstName} (@${osmUsername}) for session ${sessionId}`);
            
            // Validate inputs
            if (!firstName?.trim() || !osmUsername?.trim() || !sessionId?.trim()) {
                return {
                    success: false,
                    error: 'First name, OSM username, and session ID are required'
                };
            }
            
            // Ensure session exists
            const sessionResult = await this.ensureSessionExists(sessionId);
            if (!sessionResult.success) {
                return sessionResult;
            }
            
            // Insert participant
            const { data, error } = await this.supabase
                .from('participants')
                .insert([{
                    first_name: firstName.trim(),
                    osm_username: osmUsername.trim(),
                    session_id: sessionId.trim()
                }])
                .select()
                .single();

            if (error) {
                return this.handleDatabaseError(error, 'Registration failed');
            }

            this.currentUserId = data.id;
            this.currentSessionId = sessionId;
            
            console.log('Registration successful:', data.first_name);
            return {
                success: true,
                data: {
                    participant: data,
                    message: 'Registration successful'
                }
            };
            
        } catch (error) {
            console.error('Registration error:', error);
            return {
                success: false,
                error: error.message
            };
        }
    }

    /**
     * Get user by OSM username and optional session
     * @param {string} osmUsername - OSM username
     * @param {string} sessionId - Optional session ID filter
     * @returns {Promise<{success: boolean, data?: object, error?: string}>}
     */
    async getUserByOSMUsername(osmUsername, sessionId = null) {
        try {
            let query = this.supabase
                .from('participants')
                .select('*')
                .eq('osm_username', osmUsername);

            if (sessionId) {
                query = query.eq('session_id', sessionId);
            }

            const { data, error } = await query.single();

            if (error) {
                if (error.code === 'PGRST116') {
                    // No user found - this is not an error condition
                    return {
                        success: true,
                        data: { user: null }
                    };
                }
                return this.handleDatabaseError(error, 'Failed to fetch user');
            }

            return {
                success: true,
                data: { user: data }
            };
            
        } catch (error) {
            console.error('Error fetching user:', error);
            return {
                success: false,
                error: error.message
            };
        }
    }

    /**
     * Get user's team information with member details
     * @param {string} participantId - Participant UUID
     * @returns {Promise<{success: boolean, data?: object, error?: string}>}
     */
    async getUserTeamInfo(participantId) {
        try {
            // Get user's team assignment
            const { data: userTeamData, error: userError } = await this.supabase
                .from('team_members')
                .select(`
                    role_name,
                    role_description,
                    role_icon,
                    teams (
                        id,
                        team_name,
                        team_index,
                        session_id
                    )
                `)
                .eq('participant_id', participantId)
                .single();

            if (userError) {
                if (userError.code === 'PGRST116') {
                    // No team assignment yet
                    return {
                        success: true,
                        data: { teamInfo: null }
                    };
                }
                return this.handleDatabaseError(userError, 'Failed to get team info');
            }

            // Get all team members
            const { data: teamMembers, error: membersError } = await this.supabase
                .from('team_members')
                .select(`
                    role_name,
                    role_description,
                    role_icon,
                    participants (
                        id,
                        first_name,
                        osm_username
                    )
                `)
                .eq('team_id', userTeamData.teams.id);

            if (membersError) {
                return this.handleDatabaseError(membersError, 'Failed to get team members');
            }

            return {
                success: true,
                data: {
                    teamInfo: {
                        ...userTeamData.teams,
                        members: teamMembers,
                        userRole: {
                            role_name: userTeamData.role_name,
                            role_description: userTeamData.role_description,
                            role_icon: userTeamData.role_icon
                        }
                    }
                }
            };
            
        } catch (error) {
            console.error('Error getting team info:', error);
            return {
                success: false,
                error: error.message
            };
        }
    }

    // ================================
    // SESSION MANAGEMENT
    // ================================

    /**
     * Ensure session exists, create if it doesn't
     * @param {string} sessionId - Session identifier
     * @returns {Promise<{success: boolean, data?: object, error?: string}>}
     */
    async ensureSessionExists(sessionId) {
        try {
            // Check if session exists
            const { data: existingSession, error: checkError } = await this.supabase
                .from('sessions')
                .select('id')
                .eq('id', sessionId)
                .single();

            if (checkError && checkError.code !== 'PGRST116') {
                return this.handleDatabaseError(checkError, 'Failed to check session');
            }

            if (!existingSession) {
                // Create new session
                const { data: newSession, error: createError } = await this.supabase
                    .from('sessions')
                    .insert([{
                        id: sessionId,
                        name: `Session ${sessionId}`,
                        status: 'registering'
                    }])
                    .select()
                    .single();

                if (createError) {
                    return this.handleDatabaseError(createError, 'Failed to create session');
                }

                console.log(`Created new session: ${sessionId}`);
                return {
                    success: true,
                    data: { session: newSession, created: true }
                };
            }

            return {
                success: true,
                data: { session: existingSession, created: false }
            };
            
        } catch (error) {
            console.error('Error ensuring session exists:', error);
            return {
                success: false,
                error: error.message
            };
        }
    }

    /**
     * Get all participants for a session (basic)
     * @param {string} sessionId - Session identifier
     * @returns {Promise<{success: boolean, data?: object, error?: string}>}
     */
    async getSessionParticipants(sessionId) {
        try {
            const { data, error } = await this.supabase
                .from('participants')
                .select('*')
                .eq('session_id', sessionId)
                .order('created_at');

            if (error) {
                return this.handleDatabaseError(error, 'Failed to fetch participants');
            }

            return {
                success: true,
                data: { participants: data }
            };
            
        } catch (error) {
            console.error('Error fetching participants:', error);
            return {
                success: false,
                error: error.message
            };
        }
    }

    /**
     * Get detailed session participants for coordinator dashboard
     * @param {string} sessionId - Session identifier
     * @returns {Promise<{success: boolean, data?: object, error?: string}>}
     */
    async getSessionParticipantsDetailed(sessionId) {
        try {
            const { data, error } = await this.supabase
                .rpc('get_session_participants_detailed', {
                    session_id_param: sessionId
                });

            if (error) {
                return this.handleDatabaseError(error, 'Failed to fetch detailed participants');
            }

            return {
                success: true,
                data: data
            };
            
        } catch (error) {
            console.error('Error fetching detailed participants:', error);
            return {
                success: false,
                error: error.message
            };
        }
    }

    // ================================
    // TEAM MANAGEMENT
    // ================================

    /**
     * Create teams for a session with configurable team size
     * @param {string} sessionId - Session identifier
     * @param {number} teamSize - Desired team size (default: 3)
     * @returns {Promise<{success: boolean, data?: object, error?: string}>}
     */
    async createTeamsForSession(sessionId, teamSize = 3) {
        try {
            console.log(`Creating teams for session: ${sessionId} with target team size: ${teamSize}`);

            // Pre-flight validation: verify all participants belong to this session
            const participantsResult = await this.getSessionParticipants(sessionId);
            if (!participantsResult.success) {
                return {
                    success: false,
                    error: `Failed to verify participants: ${participantsResult.error}`
                };
            }

            const participants = participantsResult.data.participants;
            console.log(`Session isolation check: Found ${participants.length} participants for session "${sessionId}"`);

            // Verify no participants from other sessions
            const { data: otherSessionParticipants, error: checkError } = await this.supabase
                .from('participants')
                .select('id, session_id')
                .neq('session_id', sessionId)
                .in('id', participants.map(p => p.id));

            if (checkError) {
                console.warn('Session isolation pre-check failed:', checkError);
                // Continue anyway - the database trigger will catch any issues
            } else if (otherSessionParticipants && otherSessionParticipants.length > 0) {
                return {
                    success: false,
                    error: `Session isolation violation detected: ${otherSessionParticipants.length} participants belong to other sessions`
                };
            }

            const { data, error } = await this.supabase
                .rpc('create_teams_with_role_assignment', {
                    session_id_param: sessionId,
                    desired_team_size: teamSize
                });

            if (error) {
                return this.handleDatabaseError(error, 'Team creation failed');
            }

            console.log('Teams created successfully with session isolation enforced:', data);
            return {
                success: true,
                data: data
            };

        } catch (error) {
            console.error('Team creation failed:', error);
            return {
                success: false,
                error: error.message
            };
        }
    }

    /**
     * Update a team member's role
     * @param {string} participantId - Participant UUID
     * @param {string} newRoleName - New role name (Pioneer, Technician, or Seeker)
     * @returns {Promise<{success: boolean, data?: object, error?: string}>}
     */
    async updateTeamMemberRole(participantId, newRoleName) {
        try {
            console.log(`Updating role for participant ${participantId} to ${newRoleName}`);

            // Find the role details from teamRoles
            const roleDetails = this.teamRoles.find(r => r.name === newRoleName);

            if (!roleDetails) {
                return {
                    success: false,
                    error: `Invalid role: ${newRoleName}. Must be Pioneer, Technician, or Seeker.`
                };
            }

            // Update the team member's role
            const { data, error } = await this.supabase
                .from('team_members')
                .update({
                    role_name: roleDetails.name,
                    role_description: roleDetails.description,
                    role_icon: roleDetails.icon
                })
                .eq('participant_id', participantId)
                .select()
                .single();

            if (error) {
                return this.handleDatabaseError(error, 'Failed to update role');
            }

            console.log('Role updated successfully:', data);
            return {
                success: true,
                data: {
                    participant_id: participantId,
                    role_name: roleDetails.name,
                    role_description: roleDetails.description,
                    role_icon: roleDetails.icon
                }
            };

        } catch (error) {
            console.error('Error updating team member role:', error);
            return {
                success: false,
                error: error.message
            };
        }
    }

    /**
     * Get all teams for a session
     * @param {string} sessionId - Session identifier
     * @returns {Promise<{success: boolean, data?: object, error?: string}>}
     */
    async getSessionTeams(sessionId) {
        try {
            const { data, error } = await this.supabase
                .from('teams')
                .select('id, team_name, team_index')
                .eq('session_id', sessionId)
                .order('team_index');

            if (error) {
                return this.handleDatabaseError(error, 'Failed to fetch teams');
            }

            return {
                success: true,
                data: { teams: data }
            };

        } catch (error) {
            console.error('Error fetching teams:', error);
            return {
                success: false,
                error: error.message
            };
        }
    }

    /**
     * Get detailed team information including members and territories
     * @param {string} teamId - Team UUID
     * @returns {Promise<{success: boolean, data?: object, error?: string}>}
     */
    async getTeamDetails(teamId) {
        try {
            console.log(`Fetching detailed info for team: ${teamId}`);

            // Get team basic info
            const { data: teamData, error: teamError } = await this.supabase
                .from('teams')
                .select('id, team_name, team_index, session_id')
                .eq('id', teamId)
                .single();

            if (teamError) {
                return this.handleDatabaseError(teamError, 'Failed to fetch team info');
            }

            // Get team members with their roles
            const { data: membersData, error: membersError } = await this.supabase
                .from('team_members')
                .select(`
                    role_name,
                    role_description,
                    role_icon,
                    participants (
                        id,
                        first_name,
                        osm_username
                    )
                `)
                .eq('team_id', teamId)
                .order('role_name');

            if (membersError) {
                return this.handleDatabaseError(membersError, 'Failed to fetch team members');
            }

            // Get team territories with status
            const territoriesResult = await this.getTeamTerritories(teamId);
            if (!territoriesResult.success) {
                return territoriesResult;
            }

            return {
                success: true,
                data: {
                    team: teamData,
                    members: membersData || [],
                    territories: territoriesResult.data.territories || []
                }
            };

        } catch (error) {
            console.error('Error fetching team details:', error);
            return {
                success: false,
                error: error.message
            };
        }
    }

    /**
     * Update a team member's team assignment
     * @param {string} participantId - Participant UUID
     * @param {string} newTeamId - New team UUID
     * @returns {Promise<{success: boolean, data?: object, error?: string}>}
     */
    async updateTeamMemberTeam(participantId, newTeamId) {
        try {
            console.log(`Updating team for participant ${participantId} to team ${newTeamId}`);

            // Session isolation validation: verify participant and team share same session
            const { data: participant, error: participantError } = await this.supabase
                .from('participants')
                .select('session_id')
                .eq('id', participantId)
                .single();

            if (participantError) {
                return this.handleDatabaseError(participantError, 'Failed to fetch participant');
            }

            const { data: team, error: teamError } = await this.supabase
                .from('teams')
                .select('session_id')
                .eq('id', newTeamId)
                .single();

            if (teamError) {
                return this.handleDatabaseError(teamError, 'Failed to fetch team');
            }

            // Validate session match
            if (participant.session_id !== team.session_id) {
                return {
                    success: false,
                    error: `Session isolation violation: Participant belongs to session "${participant.session_id}" but team belongs to session "${team.session_id}". Cross-session team assignments are not allowed.`
                };
            }

            console.log(`Session isolation validated: Both participant and team belong to session "${participant.session_id}"`);

            // Update the team member's team assignment
            const { data, error } = await this.supabase
                .from('team_members')
                .update({
                    team_id: newTeamId
                })
                .eq('participant_id', participantId)
                .select()
                .single();

            if (error) {
                return this.handleDatabaseError(error, 'Failed to update team assignment');
            }

            console.log('Team assignment updated successfully with session isolation enforced:', data);
            return {
                success: true,
                data: {
                    participant_id: participantId,
                    team_id: newTeamId,
                    session_id: participant.session_id
                }
            };

        } catch (error) {
            console.error('Error updating team assignment:', error);
            return {
                success: false,
                error: error.message
            };
        }
    }

    /**
     * Assign an unassigned participant to a team (create new team_member record)
     * @param {string} participantId - Participant UUID
     * @param {string} teamId - Team UUID
     * @param {string} roleName - Role name (Pioneer, Technician, or Seeker)
     * @returns {Promise<{success: boolean, data?: object, error?: string}>}
     */
    async assignParticipantToTeam(participantId, teamId, roleName) {
        try {
            console.log(`Assigning participant ${participantId} to team ${teamId} with role ${roleName}`);

            // Find the role details from teamRoles
            const roleDetails = this.teamRoles.find(r => r.name === roleName);

            if (!roleDetails) {
                return {
                    success: false,
                    error: `Invalid role: ${roleName}. Must be Pioneer, Technician, or Seeker.`
                };
            }

            // Session isolation validation: verify participant and team share same session
            const { data: participant, error: participantError } = await this.supabase
                .from('participants')
                .select('session_id')
                .eq('id', participantId)
                .single();

            if (participantError) {
                return this.handleDatabaseError(participantError, 'Failed to fetch participant');
            }

            const { data: team, error: teamError } = await this.supabase
                .from('teams')
                .select('session_id')
                .eq('id', teamId)
                .single();

            if (teamError) {
                return this.handleDatabaseError(teamError, 'Failed to fetch team');
            }

            // Validate session match
            if (participant.session_id !== team.session_id) {
                return {
                    success: false,
                    error: `Session isolation violation: Participant belongs to session "${participant.session_id}" but team belongs to session "${team.session_id}". Cross-session team assignments are not allowed.`
                };
            }

            console.log(`Session isolation validated: Both participant and team belong to session "${participant.session_id}"`);

            // Insert new team member record
            const { data, error } = await this.supabase
                .from('team_members')
                .insert([{
                    participant_id: participantId,
                    team_id: teamId,
                    role_name: roleDetails.name,
                    role_description: roleDetails.description,
                    role_icon: roleDetails.icon
                }])
                .select()
                .single();

            if (error) {
                return this.handleDatabaseError(error, 'Failed to assign participant to team');
            }

            console.log('Participant assigned to team successfully with session isolation enforced:', data);
            return {
                success: true,
                data: {
                    participant_id: participantId,
                    team_id: teamId,
                    role_name: roleDetails.name,
                    role_description: roleDetails.description,
                    role_icon: roleDetails.icon,
                    session_id: participant.session_id
                }
            };

        } catch (error) {
            console.error('Error assigning participant to team:', error);
            return {
                success: false,
                error: error.message
            };
        }
    }

    // ================================
    // TERRITORY MANAGEMENT
    // ================================

    /**
     * Populate territories table with data from OverpassAPI
     * @param {Array} territories - Territory data from OverpassAPI
     * @returns {Promise<{success: boolean, data?: object, error?: string}>}
     */
    async populateTerritoriesTable(territories) {
        try {
            console.log(`Populating territories table with ${territories.length} territories...`);
            
            // Insert territories with conflict resolution on ISO code
            const { data, error } = await this.supabase
                .from('indian_territories')
                .upsert(territories, { 
                    onConflict: 'iso_code',
                    ignoreDuplicates: false // Update existing records
                })
                .select();

            if (error) {
                return this.handleDatabaseError(error, 'Territory population failed');
            }

            console.log(`Successfully populated ${territories.length} territories in database`);
            return {
                success: true,
                data: { territories: data, count: territories.length }
            };
            
        } catch (error) {
            console.error('Territory population failed:', error);
            return {
                success: false,
                error: error.message
            };
        }
    }

    /**
     * Assign territories to teams for a session
     * @param {string} sessionId - Session identifier
     * @returns {Promise<{success: boolean, data?: object, error?: string}>}
     */
    async assignTerritoriesToTeams(sessionId) {
        try {
            console.log(`Assigning territories to teams for session: ${sessionId}`);
            
            const { data, error } = await this.supabase
                .rpc('distribute_territories_to_teams', {
                    session_id_param: sessionId
                });

            if (error) {
                return this.handleDatabaseError(error, 'Territory distribution failed');
            }

            console.log('Territories distributed successfully:', data);
            return {
                success: true,
                data: data
            };
            
        } catch (error) {
            console.error('Territory distribution failed:', error);
            return {
                success: false,
                error: error.message
            };
        }
    }

    /**
     * Get territories assigned to a team
     * @param {string} teamId - Team UUID
     * @returns {Promise<{success: boolean, data?: object, error?: string}>}
     */
    async getTeamTerritories(teamId) {
        try {
            const { data, error } = await this.supabase
                .from('team_territories')
                .select(`
                    id,
                    status,
                    assigned_at,
                    started_at,
                    completed_at,
                    completed_by,
                    notes,
                    indian_territories (
                        name,
                        name_en,
                        iso_code,
                        osm_relation_id,
                        place_type
                    )
                `)
                .eq('team_id', teamId)
                .order('indian_territories(name)');

            if (error) {
                return this.handleDatabaseError(error, 'Failed to fetch team territories');
            }

            // Transform to expected format for frontend (with ISO code support)
            const territories = data.map(assignment => ({
                id: assignment.id, // This is the team_territories.id (assignmentId)
                territory_name: assignment.indian_territories.name,
                territory_osm_id: assignment.indian_territories.osm_relation_id, // For legacy compatibility
                iso_code: assignment.indian_territories.iso_code, // Primary for Overpass queries
                place_type: assignment.indian_territories.place_type,
                status: assignment.status,
                assigned_at: assignment.assigned_at,
                started_at: assignment.started_at,
                completed_at: assignment.completed_at,
                completed_by: assignment.completed_by,
                notes: assignment.notes,
                overpass_ready: assignment.indian_territories.iso_code && assignment.indian_territories.iso_code !== ''
            }));

            return {
                success: true,
                data: { territories }
            };
            
        } catch (error) {
            console.error('Error fetching team territories:', error);
            return {
                success: false,
                error: error.message
            };
        }
    }

    /**
     * Get territory data for Overpass API operations (ISO code based)
     * @param {string} assignmentId - team_territories.id (assignment record UUID)
     * @returns {Promise<{success: boolean, data?: object, error?: string}>}
     */
    async getTerritoryForOverpass(assignmentId) {
        try {
            const { data, error } = await this.supabase
                .rpc('get_territory_for_overpass_operations', {
                    assignment_id_param: assignmentId
                });

            if (error) {
                return this.handleDatabaseError(error, 'Failed to get territory data');
            }
            
            if (!data) {
                return {
                    success: false,
                    error: 'Territory assignment not found'
                };
            }

            return {
                success: true,
                data: data
            };
            
        } catch (error) {
            console.error('Error getting territory for Overpass:', error);
            return {
                success: false,
                error: error.message
            };
        }
    }

    /**
     * Update territory assignment status
     * @param {string} assignmentId - team_territories.id
     * @param {string} newStatus - New status ('available', 'current', 'completed')
     * @param {string} notes - Optional notes
     * @returns {Promise<{success: boolean, data?: object, error?: string}>}
     */
    async updateTerritoryStatus(assignmentId, newStatus, notes = null) {
        try {
            const { data, error } = await this.supabase
                .rpc('update_territory_assignment_status', {
                    assignment_id_param: assignmentId,
                    new_status_param: newStatus,
                    participant_id_param: this.currentUserId,
                    notes_param: notes
                });

            if (error) {
                return this.handleDatabaseError(error, 'Failed to update territory status');
            }
            
            console.log(`Territory status updated to: ${newStatus}`);
            return {
                success: true,
                data: data
            };
            
        } catch (error) {
            console.error('Error updating territory status:', error);
            return {
                success: false,
                error: error.message
            };
        }
    }

    // ================================
    // COORDINATOR OPERATIONS
    // ================================

    /**
     * Complete session setup - create teams and assign territories
     * @param {string} sessionId - Session identifier
     * @param {object} overpassAPI - OverpassAPI instance for fetching territories
     * @param {number} teamSize - Desired team size (default: 3)
     * @returns {Promise<{success: boolean, data?: object, error?: string}>}
     */
    async coordinatorSetupSession(sessionId, overpassAPI, teamSize = 3) {
        try {
            console.log(`Starting coordinator setup for session: ${sessionId} with team size: ${teamSize}`);

            // Step 1: Validate participant count
            const participantsResult = await this.getSessionParticipants(sessionId);
            if (!participantsResult.success) {
                throw new Error(participantsResult.error);
            }

            const participants = participantsResult.data.participants;
            const participantCount = participants.length;

            // Flexible validation for team formation
            if (participantCount < 1) {
                return {
                    success: false,
                    error: `Need at least 1 participant to form teams, found ${participantCount}`
                };
            }

            // Validate team size
            if (teamSize < 1) {
                return {
                    success: false,
                    error: `Team size must be at least 1, got ${teamSize}`
                };
            }

            // Calculate team count based on desired team size
            const teamCount = Math.ceil(participantCount / teamSize);

            console.log(`${participantCount} participants will be distributed across approximately ${teamCount} teams of size ${teamSize}`);

            // Step 2: Fetch and populate territories
            console.log('Fetching territories from Overpass API...');
            const territoriesResult = await overpassAPI.fetchIndianStates();
            
            if (!territoriesResult.success || !territoriesResult.data.length) {
                return {
                    success: false,
                    error: 'Failed to fetch territories from Overpass API'
                };
            }

            console.log(`Retrieved ${territoriesResult.data.length} territories from Overpass API`);

            // Step 3: Populate database with territories
            const populateResult = await this.populateTerritoriesTable(territoriesResult.data);
            if (!populateResult.success) {
                console.warn('Territory population had issues:', populateResult.error);
                // Continue anyway - territories might already exist
            }

            // Step 4: Create teams with specified team size
            const teamResult = await this.createTeamsForSession(sessionId, teamSize);
            if (!teamResult.success) {
                return {
                    success: false,
                    error: `Team creation failed: ${teamResult.error}`
                };
            }

            // Step 5: Distribute territories
            const distributionResult = await this.assignTerritoriesToTeams(sessionId);
            if (!distributionResult.success) {
                return {
                    success: false,
                    error: `Territory distribution failed: ${distributionResult.error}`
                };
            }

            console.log('Coordinator setup completed successfully');

            return {
                success: true,
                data: {
                    sessionId: sessionId,
                    participantsTotal: participantCount,
                    teamsCreated: teamCount,
                    territoriesDistributed: distributionResult.data.territories_distributed || 0,
                    teamDetails: teamResult.data,
                    territoryDetails: distributionResult.data
                }
            };
            
        } catch (error) {
            console.error('Coordinator setup failed:', error);
            return {
                success: false,
                error: error.message
            };
        }
    }

    /**
     * Get session progress and statistics
     * @param {string} sessionId - Session identifier
     * @returns {Promise<{success: boolean, data?: object, error?: string}>}
     */
    async getSessionProgress(sessionId) {
        try {
            const { data, error } = await this.supabase
                .rpc('get_session_progress_overview', {
                    session_id_param: sessionId
                });

            if (error) {
                return this.handleDatabaseError(error, 'Failed to get session progress');
            }

            // Get leaderboard
            const leaderboardResult = await this.getTeamLeaderboard(sessionId);
            
            return {
                success: true,
                data: {
                    sessionId: sessionId,
                    sessionStatus: data.session_status || 'unknown',
                    teamCount: data.team_count || 0,
                    totalTerritories: data.total_territories || 0,
                    completedTerritories: data.completed_territories || 0,
                    completionPercentage: data.completion_percentage || 0,
                    teams_data: data.teams_data || [],
                    leaderboard: leaderboardResult.success ? leaderboardResult.data.leaderboard : []
                }
            };
            
        } catch (error) {
            console.error('Error getting session progress:', error);
            return {
                success: false,
                error: error.message
            };
        }
    }

    /**
     * Get team leaderboard for a session
     * @param {string} sessionId - Session identifier  
     * @returns {Promise<{success: boolean, data?: object, error?: string}>}
     */
    async getTeamLeaderboard(sessionId) {
        try {
            const { data, error } = await this.supabase
                .rpc('get_team_leaderboard_for_session', {
                    session_id_param: sessionId
                });

            if (error) {
                return this.handleDatabaseError(error, 'Failed to get leaderboard');
            }

            return {
                success: true,
                data: { leaderboard: data }
            };
            
        } catch (error) {
            console.error('Error getting leaderboard:', error);
            return {
                success: false,
                error: error.message
            };
        }
    }

    // ================================
    // VALIDATION AND ADMIN FUNCTIONS
    // ================================

    /**
     * Verify session team composition
     * @param {string} sessionId - Session identifier
     * @returns {Promise<{success: boolean, data?: object, error?: string}>}
     */
    async verifySessionTeams(sessionId) {
        try {
            const { data, error } = await this.supabase
                .rpc('verify_session_teams', {
                    session_id_param: sessionId
                });

            if (error) {
                return this.handleDatabaseError(error, 'Failed to verify teams');
            }

            return {
                success: true,
                data: data
            };
            
        } catch (error) {
            console.error('Error verifying teams:', error);
            return {
                success: false,
                error: error.message
            };
        }
    }

    /**
     * Validate territory assignments
     * @param {string} sessionId - Session identifier
     * @returns {Promise<{success: boolean, data?: object, error?: string}>}
     */
    async validateTerritoryAssignments(sessionId) {
        try {
            const { data, error } = await this.supabase
                .rpc('validate_territory_assignments', {
                    session_id_param: sessionId
                });

            if (error) {
                return this.handleDatabaseError(error, 'Failed to validate territories');
            }

            return {
                success: true,
                data: data
            };
            
        } catch (error) {
            console.error('Error validating territories:', error);
            return {
                success: false,
                error: error.message
            };
        }
    }

    // ================================
    // UTILITY METHODS
    // ================================

    /**
     * Handle database errors with specific guidance
     * @private
     */
    handleDatabaseError(error, context) {
        console.error(`Database error in ${context}:`, error);
        
        let errorMessage = error.message;
        
        // Provide specific error guidance
        if (error.message.includes('JWT')) {
            errorMessage = 'Invalid Supabase credentials. Check your configuration.';
        } else if (error.message.includes('relation') && error.message.includes('does not exist')) {
            errorMessage = 'Database tables not found. Please run the SQL schema first.';
        } else if (error.message.includes('permission denied')) {
            errorMessage = 'Permission denied. Check that anon role has access to tables.';
        } else if (error.code === '23505') {
            errorMessage = 'Duplicate entry. This record already exists.';
        } else if (error.code === '23503') {
            errorMessage = 'Invalid reference. Check that referenced records exist.';
        }
        
        return {
            success: false,
            error: `${context}: ${errorMessage}`
        };
    }

    /**
     * Get database schema validation results
     * @returns {Promise<{success: boolean, data?: object, error?: string}>}
     */
    async validateDatabaseSchema() {
        try {
            console.log('Validating database schema...');
            
            const tableTests = [
                'sessions',
                'participants', 
                'teams',
                'team_members',
                'team_territories',
                'indian_territories'
            ];
            
            const results = {};
            
            for (const table of tableTests) {
                try {
                    const { data, error } = await this.supabase
                        .from(table)
                        .select('*')
                        .limit(1);
                    
                    results[table] = error ? `Error: ${error.message}` : 'Accessible';
                } catch (err) {
                    results[table] = `Error: ${err.message}`;
                }
            }
            
            return {
                success: true,
                data: {
                    tableAccess: results,
                    recommendation: 'Run the complete SQL schema if any tables show errors'
                }
            };
            
        } catch (error) {
            return {
                success: false,
                error: error.message
            };
        }
    }

    /**
     * Get territory statistics (if function exists)
     * @returns {Promise<{success: boolean, data?: object, error?: string}>}
     */
    async getTerritoryStatistics() {
        try {
            const { data, error } = await this.supabase
                .rpc('get_territory_statistics');

            if (error) {
                return this.handleDatabaseError(error, 'Failed to get territory statistics');
            }

            return {
                success: true,
                data: data
            };
            
        } catch (error) {
            console.error('Error getting territory statistics:', error);
            return {
                success: false,
                error: error.message
            };
        }
    }

    /**
     * Get manager statistics and configuration
     * @returns {object} Manager status and configuration
     */
    getManagerStats() {
        return {
            connected: !!this.supabase,
            currentUserId: this.currentUserId,
            currentSessionId: this.currentSessionId,
            databaseUrl: this.config.url,
            teamRoles: this.teamRoles.length,
            version: '3.2',
            features: [
                'ISO code support',
                'Detailed participant views',
                'Territory validation',
                'Team verification',
                'Session progress tracking',
                'Coordinator dashboard'
            ]
        };
    }
}

// Export for global use
if (typeof window !== 'undefined') {
    window.SupabaseTeamManager = SupabaseTeamManager;
}

// Export for Node.js environments
if (typeof module !== 'undefined' && module.exports) {
    module.exports = SupabaseTeamManager;
}