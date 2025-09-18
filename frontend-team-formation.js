/**
 * Frontend functions to call backend team formation procedures
 * Add these to your SupabaseTeamManager class
 */

class TeamFormationManager extends SupabaseTeamManager {
    
    /**
     * Create random teams for a session (coordinator function)
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
     * Distribute territories among teams
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

    /**
     * Batch territory status update (for coordinators)
     */
    async batchUpdateTerritoryStatus(territoryUpdates) {
        try {
            const promises = territoryUpdates.map(update => 
                this.updateTerritoryStatus(update.territoryId, update.status)
            );
            
            const results = await Promise.all(promises);
            const failed = results.filter(r => !r.success);
            
            if (failed.length > 0) {
                console.warn(`${failed.length} territory updates failed`);
            }
            
            return {
                success: true,
                totalUpdates: territoryUpdates.length,
                successful: results.filter(r => r.success).length,
                failed: failed.length
            };
            
        } catch (error) {
            console.error('Batch update failed:', error);
            return { success: false, error: error.message };
        }
    }
}

// Example usage for coordinator interface
class CoordinatorInterface {
    constructor(teamManager) {
        this.teamManager = teamManager;
    }

    /**
     * Complete session setup workflow
     */
    async setupMappingSession(sessionId) {
        try {
            // Step 1: Get Indian states/territories from API
            const overpassAPI = new OverpassAPI();
            const territories = await overpassAPI.fetchIndianStates();
            
            console.log(`Fetched ${territories.length} territories for distribution`);

            // Step 2: Setup teams and distribute territories
            const result = await this.teamManager.coordinatorSetupSession(sessionId, territories);
            
            if (result.success) {
                console.log('Session setup complete:', result);
                
                // Display summary
                return {
                    success: true,
                    message: `Session "${sessionId}" ready! ${result.teamsCreated} teams formed, ${result.territoriesDistributed} territories distributed.`,
                    details: result
                };
            } else {
                throw new Error(result.error);
            }
            
        } catch (error) {
            console.error('Session setup failed:', error);
            return {
                success: false,
                message: `Failed to setup session: ${error.message}`,
                error: error.message
            };
        }
    }

    /**
     * Monitor ongoing session
     */
    async monitorSession(sessionId) {
        try {
            const progress = await this.teamManager.getSessionProgress(sessionId);
            
            if (progress.success) {
                console.log(`Session ${sessionId} Progress:`, progress);
                
                // Generate status report
                const report = {
                    sessionId: sessionId,
                    status: progress.sessionStatus,
                    completion: `${progress.completedTerritories}/${progress.totalTerritories} territories (${progress.completionPercentage}%)`,
                    leadingTeam: progress.leaderboard.length > 0 ? progress.leaderboard[0].team_name : 'None',
                    teams: progress.teams.length,
                    lastUpdated: new Date().toISOString()
                };
                
                return { success: true, report: report, fullData: progress };
            } else {
                throw new Error(progress.error);
            }
            
        } catch (error) {
            console.error('Session monitoring failed:', error);
            return { success: false, error: error.message };
        }
    }
}

// Global functions for coordinator dashboard
function createCoordinatorDashboard() {
    const teamManager = new TeamFormationManager();
    const coordinator = new CoordinatorInterface(teamManager);
    
    return {
        setupSession: (sessionId) => coordinator.setupMappingSession(sessionId),
        monitorSession: (sessionId) => coordinator.monitorSession(sessionId),
        getLeaderboard: (sessionId) => teamManager.getTeamLeaderboard(sessionId),
        getOverview: (sessionId) => teamManager.getSessionOverview(sessionId)
    };
}

// Export for use
if (typeof window !== 'undefined') {
    window.TeamFormationManager = TeamFormationManager;
    window.CoordinatorInterface = CoordinatorInterface;
    window.createCoordinatorDashboard = createCoordinatorDashboard;
}