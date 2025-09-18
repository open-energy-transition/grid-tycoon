/**
 * Supabase Integration for Grid Tycoon - Enhanced with Backend Team Formation
 * Handles real-time team coordination via Supabase database
 */

class SupabaseTeamManager {
    constructor() {
        // Validate configuration
        if (!window.SUPABASE_CONFIG) {
            throw new Error('Supabase configuration not found. Please set window.SUPABASE_CONFIG');
        }
        
        this.supabaseUrl = window.SUPABASE_CONFIG.url;
        this.supabaseAnonKey = window.SUPABASE_CONFIG.anonKey;
        
        // Validate required fields
        if (!this.supabaseUrl || !this.supabaseAnonKey) {
            throw new Error('Missing Supabase URL or anon key in configuration');
        }
        
        if (this.supabaseUrl === 'YOUR_SUPABASE_URL_HERE' || 
            this.supabaseAnonKey === 'YOUR_ANON_KEY_HERE') {
            throw new Error('Please update SUPABASE_CONFIG with your actual Supabase credentials');
        }

        // Validate Supabase client availability
        if (!window.supabase) {
            throw new Error('Supabase client library not loaded. Please include the Supabase script.');
        }
        
        this.supabase = window.supabase.createClient(this.supabaseUrl, this.supabaseAnonKey);
        
        this.currentSessionId = null;
        this.currentUserId = null;
        this.isListening = false;
        
        // Team roles definition
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
        
        // Test connection
        this.testConnection();
    }

    /**
     * Test the Supabase connection
     */
    async testConnection() {
        try {
            console.log('Testing Supabase connection...');
            
            // Simple query to test connectivity - fixed syntax
            const { data, error } = await this.supabase
                .from('sessions')
                .select('id')
                .limit(1);
            
            if (error) {
                console.error('Supabase connection test failed:', error);
                
                // Provide specific error guidance
                if (error.message.includes('JWT')) {
                    throw new Error('Invalid Supabase anon key. Check your dashboard for the correct key.');
                }
                if (error.message.includes('relation') && error.message.includes('does not exist')) {
                    throw new Error('Database tables not found. Please run the SQL schema first.');
                }
                if (error.message.includes('Failed to fetch')) {
                    throw new Error('Cannot reach Supabase. Check your URL and internet connection.');
                }
                if (error.message.includes('permission denied')) {
                    throw new Error('Permission denied. Check that anon role has access to tables.');
                }
                
                throw new Error(`Connection failed: ${error.message}`);
            }
            
            console.log('Supabase connection successful!');
            return { success: true };
            
        } catch (error) {
            console.error('Database connection failed:', error);
            throw error;
        }
    }

    /**
     * Register a new participant for a session
     */
    async registerParticipant(firstName, osmUsername, sessionId) {
        try {
            console.log(`Registering participant: ${firstName} (${osmUsername}) for session ${sessionId}`);
            
            // First, ensure the session exists
            await this.ensureSessionExists(sessionId);
            
            // Insert the participant
            const { data, error } = await this.supabase
                .from('participants')
                .insert([
                    {
                        first_name: firstName,
                        osm_username: osmUsername,
                        session_id: sessionId
                    }
                ])
                .select()
                .single();

            if (error) {
                console.error('Registration error:', error);
                
                // Handle specific error cases
                if (error.code === '23505') { // Unique constraint violation
                    throw new Error('This OSM username is already registered for this session');
                }
                if (error.code === '23503') { // Foreign key violation
                    throw new Error('Invalid session ID. Please check with your coordinator.');
                }
                
                throw new Error(`Registration failed: ${error.message}`);
            }

            this.currentUserId = data.id;
            this.currentSessionId = sessionId;
            
            console.log('Registration successful:', data);
            return { success: true, participant: data };
            
        } catch (error) {
            console.error('Registration error:', error);
            return { success: false, error: error.message };
        }
    }

    /**
     * Ensure session exists, create if it doesn't
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
                throw checkError;
            }

            if (!existingSession) {
                // Create new session
                const { error: createError } = await this.supabase
                    .from('sessions')
                    .insert([
                        {
                            id: sessionId,
                            name: `Session ${sessionId}`,
                            status: 'registering'
                        }
                    ]);

                if (createError) {
                    console.error('Error creating session:', createError);
                    throw createError;
                }

                console.log(`Created new session: ${sessionId}`);
            }
        } catch (error) {
            console.error('Error ensuring session exists:', error);
            throw error;
        }
    }

    /**
     * Get user by OSM username and session
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
                    // No user found
                    return { success: true, user: null };
                }
                throw error;
            }

            return { success: true, user: data };
        } catch (error) {
            console.error('Error fetching user:', error);
            return { success: false, error: error.message };
        }
    }

    /**
     * Get user's team information
     */
    async getUserTeamInfo(participantId) {
        try {
            const { data, error } = await this.supabase
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

            if (error) {
                if (error.code === 'PGRST116') {
                    return { success: true, teamInfo: null }; // No team assignment yet
                }
                throw error;
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
                .eq('team_id', data.teams.id);

            if (membersError) throw membersError;

            return {
                success: true,
                teamInfo: {
                    ...data.teams,
                    members: teamMembers,
                    userRole: {
                        role_name: data.role_name,
                        role_description: data.role_description,
                        role_icon: data.role_icon
                    }
                }
            };
        } catch (error) {
            console.error('Error getting team info:', error);
            return { success: false, error: error.message };
        }
    }

    /**
     * Get all participants for a session
     */
    async getSessionParticipants(sessionId) {
        try {
            const { data, error } = await this.supabase
                .from('participants')
                .select('*')
                .eq('session_id', sessionId)
                .order('created_at');

            if (error) throw error;
            return { success: true, participants: data };
        } catch (error) {
            console.error('Error fetching participants:', error);
            return { success: false, error: error.message };
        }
    }

    /**
     * Get session statistics
     */
    async getSessionStats(sessionId) {
        try {
            const { data, error } = await this.supabase
                .from('session_stats')
                .select('*')
                .eq('session_id', sessionId)
                .single();

            if (error) {
                if (error.code === 'PGRST116') {
                    // No stats yet, return defaults
                    return {
                        success: true,
                        stats: {
                            total_participants: 0,
                            total_teams: 0,
                            unassigned_participants: 0
                        }
                    };
                }
                throw error;
            }

            return { success: true, stats: data };
        } catch (error) {
            console.error('Error getting session stats:', error);
            return { success: false, error: error.message };
        }
    }

    /**
     * Form teams from session participants (coordinator action)
     */
    async formTeamsForSession(sessionId) {
        try {
            // Get all participants for the session
            const participantsResult = await this.getSessionParticipants(sessionId);
            if (!participantsResult.success) {
                throw new Error(participantsResult.error);
            }

            const participants = participantsResult.participants;
            if (participants.length < 3) {
                throw new Error('Need at least 3 participants to form teams');
            }

            // Check if teams already exist for this session
            const { data: existingTeams } = await this.supabase
                .from('teams')
                .select('id')
                .eq('session_id', sessionId);

            if (existingTeams && existingTeams.length > 0) {
                throw new Error('Teams have already been formed for this session');
            }

            // Shuffle participants randomly
            const shuffledParticipants = [...participants].sort(() => Math.random() - 0.5);
            const teamCount = Math.floor(shuffledParticipants.length / 3);
            
            // Create teams
            const teams = [];
            for (let i = 0; i < teamCount; i++) {
                const teamData = {
                    session_id: sessionId,
                    team_name: `Team ${i + 1}`,
                    team_index: i
                };

                const { data: team, error: teamError } = await this.supabase
                    .from('teams')
                    .insert([teamData])
                    .select()
                    .single();

                if (teamError) throw teamError;
                teams.push(team);
            }

            // Assign team members with roles
            for (let i = 0; i < teamCount; i++) {
                const team = teams[i];
                const teamMembers = shuffledParticipants.slice(i * 3, (i + 1) * 3);
                
                // Shuffle roles for this team
                const shuffledRoles = [...this.teamRoles].sort(() => Math.random() - 0.5);

                for (let j = 0; j < teamMembers.length; j++) {
                    const member = teamMembers[j];
                    const role = shuffledRoles[j];

                    const memberData = {
                        team_id: team.id,
                        participant_id: member.id,
                        role_name: role.name,
                        role_description: role.description,
                        role_icon: role.icon
                    };

                    const { error: memberError } = await this.supabase
                        .from('team_members')
                        .insert([memberData]);

                    if (memberError) throw memberError;
                }
            }

            // Update session status
            await this.supabase
                .from('sessions')
                .update({
                    status: 'teams_formed',
                    teams_formed_at: new Date().toISOString()
                })
                .eq('id', sessionId);

            return { success: true, teamsCreated: teamCount };
        } catch (error) {
            console.error('Error forming teams:', error);
            return { success: false, error: error.message };
        }
    }

    /**
     * Get team territories
     */
    async getTeamTerritories(teamId) {
        try {
            const { data, error } = await this.supabase
                .from('team_territories')
                .select('*')
                .eq('team_id', teamId)
                .order('territory_name');

            if (error) throw error;

            return { success: true, territories: data || [] };
        } catch (error) {
            console.error('Error fetching territories:', error);
            return { success: false, error: error.message };
        }
    }

    /**
     * Update territory status
     */
    async updateTerritoryStatus(territoryId, status) {
        try {
            const updateData = { status };
            if (status === 'completed') {
                updateData.completed_at = new Date().toISOString();
                updateData.completed_by = this.currentUserId;
            }

            const { error } = await this.supabase
                .from('team_territories')
                .update(updateData)
                .eq('id', territoryId);

            if (error) throw error;
            return { success: true };
        } catch (error) {
            console.error('Error updating territory status:', error);
            return { success: false, error: error.message };
        }
    }

    /**
     * Create random teams for a session using backend function
     */
    async createRandomTeams(sessionId) {
        try {
            console.log(`Creating random teams for session: ${sessionId}`);
            
            const { data, error } = await this.supabase
                .rpc('create_random_teams', {
                    session_id_param: sessionId
                });

            if (error) {
                console.error('Error creating teams:', error);
                throw error;
            }

            console.log('Teams created successfully:', data);
            return { success: true, result: data };
            
        } catch (error) {
            console.error('Team creation failed:', error);
            return { success: false, error: error.message };
        }
    }

    /**
     * Distribute territories among teams using backend function
     */
    async distributeTerritoriesAmongTeams(sessionId, territories) {
        try {
            console.log(`Distributing ${territories.length} territories among teams for session: ${sessionId}`);
            
            // Format territories for SQL function
            const territoryData = territories.map(territory => ({
                name: territory.name,
                id: territory.id
            }));

            const { data, error } = await this.supabase
                .rpc('distribute_territories', {
                    session_id_param: sessionId,
                    territories: territoryData
                });

            if (error) {
                console.error('Error distributing territories:', error);
                throw error;
            }

            console.log('Territories distributed successfully:', data);
            return { success: true, result: data };
            
        } catch (error) {
            console.error('Territory distribution failed:', error);
            return { success: false, error: error.message };
        }
    }

    /**
     * Complete session setup: create teams and distribute territories
     */
    async setupCompleteSession(sessionId, territories) {
        try {
            console.log(`Setting up complete session: ${sessionId}`);
            
            // Format territories for SQL function
            const territoryData = territories.map(territory => ({
                name: territory.name,
                id: territory.id
            }));

            const { data, error } = await this.supabase
                .rpc('setup_complete_session', {
                    session_id_param: sessionId,
                    territories: territoryData
                });

            if (error) {
                console.error('Error setting up session:', error);
                throw error;
            }

            console.log('Session setup completed:', data);
            return { success: true, result: data };
            
        } catch (error) {
            console.error('Session setup failed:', error);
            return { success: false, error: error.message };
        }
    }

    /**
     * Get complete session overview with teams and territories
     */
    async getSessionOverview(sessionId) {
        try {
            const { data, error } = await this.supabase
                .rpc('get_session_overview', {
                    session_id_param: sessionId
                });

            if (error) throw error;
            return { success: true, overview: data };
            
        } catch (error) {
            console.error('Error getting session overview:', error);
            return { success: false, error: error.message };
        }
    }

    /**
     * Get team leaderboard for competition
     */
    async getTeamLeaderboard(sessionId) {
        try {
            const { data, error } = await this.supabase
                .rpc('get_team_leaderboard', {
                    session_id_param: sessionId
                });

            if (error) throw error;
            return { success: true, leaderboard: data };
            
        } catch (error) {
            console.error('Error getting leaderboard:', error);
            return { success: false, error: error.message };
        }
    }

    /**
     * Enhanced form teams method using backend functions
     */
    async formTeamsForSession(sessionId) {
        try {
            // Use the new backend function instead of manual team creation
            const result = await this.createRandomTeams(sessionId);
            
            if (result.success) {
                return { 
                    success: true, 
                    teamsCreated: result.result.teams_created,
                    participantsAssigned: result.result.participants_assigned,
                    unassignedParticipants: result.result.unassigned_participants
                };
            } else {
                throw new Error(result.error);
            }
        } catch (error) {
            console.error('Error forming teams:', error);
            return { success: false, error: error.message };
        }
    }

    /**
     * Coordinator workflow: Set up entire session from scratch
     */
    async coordinatorSetupSession(sessionId, territoriesFromAPI) {
        try {
            // Step 1: Check participant count
            const participantsResult = await this.getSessionParticipants(sessionId);
            if (!participantsResult.success) {
                throw new Error(participantsResult.error);
            }

            const participantCount = participantsResult.participants.length;
            if (participantCount < 3) {
                throw new Error(`Need at least 3 participants, found ${participantCount}`);
            }

            const teamCount = Math.floor(participantCount / 3);
            const unassigned = participantCount % 3;

            console.log(`Session ${sessionId}: ${participantCount} participants → ${teamCount} teams (${unassigned} unassigned)`);

            // Step 2: Setup complete session (teams + territories)
            const setupResult = await this.setupCompleteSession(sessionId, territoriesFromAPI);
            
            if (!setupResult.success) {
                throw new Error(setupResult.error);
            }

            // Step 3: Get final overview
            const overviewResult = await this.getSessionOverview(sessionId);
            
            return {
                success: true,
                sessionId: sessionId,
                participantsTotal: participantCount,
                participantsAssigned: teamCount * 3,
                participantsUnassigned: unassigned,
                teamsCreated: teamCount,
                territoriesDistributed: territoriesFromAPI.length,
                setupResult: setupResult.result,
                overview: overviewResult.success ? overviewResult.overview : null
            };
            
        } catch (error) {
            console.error('Coordinator setup failed:', error);
            return { success: false, error: error.message };
        }
    }

    /**
     * Real-time session monitoring for coordinators
     */
    async getSessionProgress(sessionId) {
        try {
            // Get both overview and leaderboard
            const [overviewResult, leaderboardResult] = await Promise.all([
                this.getSessionOverview(sessionId),
                this.getTeamLeaderboard(sessionId)
            ]);

            if (!overviewResult.success) {
                throw new Error(overviewResult.error);
            }

            const overview = overviewResult.overview;
            const leaderboard = leaderboardResult.success ? leaderboardResult.leaderboard : [];

            // Calculate session statistics
            let totalTerritories = 0;
            let completedTerritories = 0;
            
            if (overview.teams) {
                overview.teams.forEach(team => {
                    if (team.territories) {
                        totalTerritories += team.territories.length;
                        completedTerritories += team.territories.filter(t => t.status === 'completed').length;
                    }
                });
            }

            return {
                success: true,
                sessionId: sessionId,
                sessionStatus: overview.status,
                teamCount: overview.teams ? overview.teams.length : 0,
                totalTerritories: totalTerritories,
                completedTerritories: completedTerritories,
                completionPercentage: totalTerritories > 0 ? Math.round((completedTerritories / totalTerritories) * 100) : 0,
                teams: overview.teams || [],
                leaderboard: leaderboard || []
            };
            
        } catch (error) {
            console.error('Error getting session progress:', error);
            return { success: false, error: error.message };
        }
    }
}

// Export for use in other modules
window.SupabaseTeamManager = SupabaseTeamManager;