/**
 * Grid Tycoon Game Logic - Enhanced with Backend Team Formation
 * Handles user registration, team assignment, and territory management
 */

class GridTycoon {
    constructor() {
        this.currentUser = null;
        this.currentTeam = null;
        this.currentTerritory = null;
        this.territories = [];
        this.isInitialized = false;
        this.overpassAPI = null;
        this.supabaseManager = null;
        this.isCoordinator = false; // Flag for coordinator privileges
        
        // Configuration
        this.config = window.GRID_TYCOON_CONFIG || {
            enableMockMode: false,
            fallbackToIndividualMode: true
        };
        
        this.init();
    }

    /**
     * Initialize the game
     */
    async init() {
        try {
            // Initialize Overpass API
            this.overpassAPI = new OverpassAPI();
            console.log('Overpass API initialized');
            
            // Initialize Supabase if configured
            if (this.config.enableMockMode) {
                console.log('Running in mock mode - Supabase disabled');
                this.showStatus('info', 'Running in demo mode. Database features disabled.');
            } else {
                try {
                    this.supabaseManager = new SupabaseTeamManager();
                    console.log('Supabase initialized successfully');
                } catch (error) {
                    console.warn('Supabase initialization failed:', error);
                    if (this.config.fallbackToIndividualMode) {
                        this.showStatus('warning', 'Database unavailable. Running in offline mode.');
                    } else {
                        throw error;
                    }
                }
            }
            
            // Check for saved user session
            this.checkSavedSession();
            
        } catch (error) {
            console.error('Game initialization failed:', error);
            this.showStatus('error', `Initialization failed: ${error.message}`);
        }
    }

    /**
     * Check for saved user session
     */
    checkSavedSession() {
        try {
            const savedUser = sessionStorage.getItem('gridTycoonUser');
            if (savedUser) {
                this.currentUser = JSON.parse(savedUser);
                this.showStatus('info', `Welcome back, ${this.currentUser.firstName}!`);
            }
        } catch (error) {
            console.warn('Error checking saved session:', error);
            sessionStorage.removeItem('gridTycoonUser');
        }
    }

    /**
     * Enhanced user status check with coordinator detection
     */
    async checkUserStatus() {
        const firstName = document.getElementById('firstNameInput').value.trim();
        const osmUsername = document.getElementById('osmUsernameInput').value.trim();
        const sessionId = document.getElementById('sessionIdInput').value.trim().toUpperCase();
        
        // Validate inputs
        if (!firstName || !osmUsername || !sessionId) {
            this.showStatus('error', 'Please fill in all fields: First Name, OSM Username, and Session ID!');
            return;
        }

        if (sessionId.length < 3) {
            this.showStatus('error', 'Session ID must be at least 3 characters long!');
            return;
        }

        // Check for coordinator keywords in session ID
        this.isCoordinator = sessionId.includes('COORD') || sessionId.includes('ADMIN') || firstName.toLowerCase().includes('coord');

        // Store user data
        this.currentUser = { firstName, osmUsername, sessionId };
        sessionStorage.setItem('gridTycoonUser', JSON.stringify(this.currentUser));

        this.showStatus('info', this.isCoordinator ? 'Checking coordinator status...' : 'Checking your status...', true);

        if (this.config.enableMockMode || !this.supabaseManager) {
            // Mock mode - simulate registration
            this.handleMockRegistration();
            return;
        }

        try {
            // Try to find user in database
            const result = await this.supabaseManager.getUserByOSMUsername(osmUsername, sessionId);
            
            if (result.success && result.user) {
                // User exists, check team assignment
                await this.handleExistingUser(result.user);
            } else {
                // User not found, register them
                await this.registerNewUser();
            }
        } catch (error) {
            console.error('Error checking user status:', error);
            this.showStatus('error', `Error checking status: ${error.message}`);
        }
    }

    /**
     * Enhanced existing user handling with coordinator features
     */
    async handleExistingUser(user) {
        try {
            if (this.isCoordinator) {
                // Show coordinator interface
                await this.showCoordinatorInterface();
                return;
            }

            const teamResult = await this.supabaseManager.getUserTeamInfo(user.id);
            
            if (teamResult.success && teamResult.teamInfo) {
                // User has team assignment
                this.currentTeam = teamResult.teamInfo;
                await this.loadUserTerritories();
                this.showTeamInterface();
                this.showStatus('success', `Welcome back to ${this.currentTeam.team_name}!`);
            } else {
                // User registered but no team yet
                this.showWaitingInterface();
            }
        } catch (error) {
            console.error('Error handling existing user:', error);
            this.showStatus('error', `Error loading user data: ${error.message}`);
        }
    }

    /**
     * Coordinator interface for session management
     */
    async showCoordinatorInterface() {
        const sessionId = this.currentUser.sessionId;
        
        this.showStatus('info', 'Loading coordinator dashboard...', true);
        
        try {
            // Get session progress and participants
            const [progressResult, participantsResult] = await Promise.all([
                this.supabaseManager.getSessionProgress(sessionId),
                this.supabaseManager.getSessionParticipants(sessionId)
            ]);

            const progress = progressResult.success ? progressResult : { teams: [], totalTerritories: 0, completedTerritories: 0 };
            const participants = participantsResult.success ? participantsResult.participants : [];

            const coordinatorHtml = `
                <div class="coordinator-dashboard">
                    <h2>🎯 Coordinator Dashboard</h2>
                    <div class="session-info">
                        <h3>Session: ${sessionId}</h3>
                        <p><strong>Status:</strong> ${progress.sessionStatus || 'Not Started'}</p>
                        <p><strong>Participants:</strong> ${participants.length}</p>
                        <p><strong>Teams:</strong> ${progress.teamCount || 0}</p>
                        <p><strong>Progress:</strong> ${progress.completedTerritories || 0}/${progress.totalTerritories || 0} territories (${progress.completionPercentage || 0}%)</p>
                    </div>

                    <div class="coordinator-actions">
                        <h4>Session Management</h4>
                        <button class="btn btn-primary" onclick="viewParticipants()" ${participants.length === 0 ? 'disabled' : ''}>
                            👥 View Participants (${participants.length})
                        </button>
                        <button class="btn btn-success" onclick="setupCompleteSession()" ${participants.length < 3 ? 'disabled' : ''}>
                            🚀 Setup Teams & Territories
                        </button>
                        <button class="btn btn-info" onclick="viewLeaderboard()" ${progress.teamCount === 0 ? 'disabled' : ''}>
                            🏆 View Leaderboard
                        </button>
                        <button class="btn btn-secondary" onclick="exportSessionData()">
                            📊 Export Data
                        </button>
                    </div>

                    ${progress.teamCount > 0 ? this.renderTeamOverview(progress.teams) : ''}
                    ${progress.leaderboard && progress.leaderboard.length > 0 ? this.renderLeaderboard(progress.leaderboard) : ''}
                </div>
            `;
            
            this.showSection('teamSection', coordinatorHtml);
            this.showStatus('success', `Coordinator dashboard loaded for ${sessionId}`);
            
        } catch (error) {
            console.error('Error loading coordinator interface:', error);
            this.showStatus('error', `Error loading coordinator dashboard: ${error.message}`);
        }
    }

    /**
     * Render team overview for coordinator
     */
    renderTeamOverview(teams) {
        if (!teams || teams.length === 0) return '';
        
        return `
            <div class="teams-overview">
                <h4>Teams Overview</h4>
                <div class="teams-grid">
                    ${teams.map((team, index) => {
                        const completedTerritories = team.territories ? team.territories.filter(t => t.status === 'completed').length : 0;
                        const totalTerritories = team.territories ? team.territories.length : 0;
                        const percentage = totalTerritories > 0 ? Math.round((completedTerritories / totalTerritories) * 100) : 0;
                        
                        return `
                            <div class="team-card team-color-${index % 6}">
                                <h5>${team.team_name}</h5>
                                <p><strong>Progress:</strong> ${completedTerritories}/${totalTerritories} (${percentage}%)</p>
                                <p><strong>Members:</strong> ${team.members ? team.members.length : 0}</p>
                                <div class="team-members-mini">
                                    ${team.members ? team.members.map(m => `
                                        <span class="member-mini">${m.role_icon} ${m.first_name}</span>
                                    `).join('') : ''}
                                </div>
                            </div>
                        `;
                    }).join('')}
                </div>
            </div>
        `;
    }

    /**
     * Render leaderboard for coordinator
     */
    renderLeaderboard(leaderboard) {
        if (!leaderboard || leaderboard.length === 0) return '';
        
        return `
            <div class="leaderboard-section">
                <h4>🏆 Team Leaderboard</h4>
                <div class="leaderboard">
                    ${leaderboard.map((team, index) => {
                        const medal = index === 0 ? '🥇' : index === 1 ? '🥈' : index === 2 ? '🥉' : '🏅';
                        return `
                            <div class="leaderboard-item rank-${index + 1}">
                                <span class="rank">${medal} #${index + 1}</span>
                                <span class="team-name">${team.team_name}</span>
                                <span class="progress">${team.completed_territories}/${team.total_territories}</span>
                                <span class="percentage">${team.completion_percentage}%</span>
                            </div>
                        `;
                    }).join('')}
                </div>
            </div>
        `;
    }

    /**
     * Handle mock registration for testing
     */
    handleMockRegistration() {
        const mockTeam = {
            team_id: 'mock-team-1',
            team_name: 'Mock Team Alpha',
            team_index: 0,
            members: [
                {
                    participants: {
                        first_name: this.currentUser.firstName,
                        osm_username: this.currentUser.osmUsername
                    },
                    role_name: 'Pioneer',
                    role_description: 'In charge of traditional style mapping of annotating on a map',
                    role_icon: '🗺️'
                }
            ]
        };

        this.currentTeam = mockTeam;
        this.generateMockTerritories();
        this.showTeamInterface();
        this.showStatus('success', 'Mock registration successful! You can now test the mapping interface.');
    }

    /**
     * Generate mock territories for testing
     */
    generateMockTerritories() {
        this.territories = [
            { id: 't1', territory_name: 'Maharashtra', status: 'available', osm_relation_id: 1656179 },
            { id: 't2', territory_name: 'Karnataka', status: 'available', osm_relation_id: 1656160 },
            { id: 't3', territory_name: 'Tamil Nadu', status: 'available', osm_relation_id: 1656187 }
        ];
    }

    /**
     * Handle existing user found in database
     */
    async handleExistingUser(user) {
        try {
            const teamResult = await this.supabaseManager.getUserTeamInfo(user.id);
            
            if (teamResult.success && teamResult.teamInfo) {
                // User has team assignment
                this.currentTeam = teamResult.teamInfo;
                await this.loadUserTerritories();
                this.showTeamInterface();
                this.showStatus('success', `Welcome back to ${this.currentTeam.team_name}!`);
            } else {
                // User registered but no team yet
                this.showWaitingInterface();
            }
        } catch (error) {
            console.error('Error handling existing user:', error);
            this.showStatus('error', `Error loading user data: ${error.message}`);
        }
    }

    /**
     * Register a new user
     */
    async registerNewUser() {
        try {
            const result = await this.supabaseManager.registerParticipant(
                this.currentUser.firstName,
                this.currentUser.osmUsername,
                this.currentUser.sessionId
            );
            
            if (result.success) {
                this.showWaitingInterface();
                this.showStatus('success', 'Registration successful! Waiting for team assignment.');
            } else {
                throw new Error(result.error);
            }
        } catch (error) {
            console.error('Registration error:', error);
            this.showStatus('error', `Registration failed: ${error.message}`);
        }
    }

    /**
     * Show waiting interface
     */
    showWaitingInterface() {
        const waitingHtml = `
            <div class="waiting-for-teams">
                <h3>Registration Complete!</h3>
                <div class="user-info">
                    <p><strong>Name:</strong> ${this.currentUser.firstName}</p>
                    <p><strong>OSM Username:</strong> ${this.currentUser.osmUsername}</p>
                    <p><strong>Session ID:</strong> ${this.currentUser.sessionId}</p>
                </div>
                <div class="waiting-message">
                    <div class="spinner"></div>
                    <p>Waiting for team assignment...</p>
                    <p>You'll be assigned to a team when the coordinator starts team formation.</p>
                </div>
                <div class="waiting-actions">
                    <button class="btn btn-secondary" onclick="refreshStatus()">
                        🔄 Refresh Status
                    </button>
                    <button class="btn btn-warning" onclick="logout()">
                        🚪 Back to Registration
                    </button>
                </div>
            </div>
        `;
        
        this.showSection('teamSection', waitingHtml);
    }

    /**
     * Show team interface
     */
    showTeamInterface() {
        const userRole = this.getUserRole();
        
        const teamHtml = `
            <div class="current-team team-active team-color-${this.currentTeam.team_index % 6}">
                <h2>Welcome to ${this.currentTeam.team_name}!</h2>
                
                <div class="user-role-display">
                    <h3>Your Role: ${userRole.role_icon} ${userRole.role_name}</h3>
                    <p class="role-description">${userRole.role_description}</p>
                </div>
                
                <div class="team-members-display">
                    <h4>Team Members:</h4>
                    ${this.currentTeam.members.map(member => {
                        const isYou = member.participants.osm_username === this.currentUser.osmUsername;
                        return `
                            <div class="team-member-compact ${isYou ? 'highlight-you' : ''}">
                                <span class="role-icon">${member.role_icon}</span>
                                <strong>${member.participants.first_name}</strong> (${member.role_name})
                                ${isYou ? ' - YOU' : ''}
                            </div>
                        `;
                    }).join('')}
                </div>
                
                <div class="team-progress-info">
                    <h4>Team Progress:</h4>
                    <p><strong>${this.getCompletedCount()}/${this.territories.length}</strong> territories completed</p>
                </div>
                
                <button class="btn btn-success power-effect" onclick="startMapping()">
                    🚀 Start Mapping
                </button>
            </div>
        `;
        
        this.showSection('teamSection', teamHtml);
    }

    /**
     * Get user's role in team
     */
    getUserRole() {
        if (!this.currentTeam || !this.currentTeam.members) {
            return { role_name: 'Unknown', role_icon: '❓', role_description: 'Role not assigned' };
        }
        
        return this.currentTeam.members.find(m => 
            m.participants.osm_username === this.currentUser.osmUsername
        ) || { role_name: 'Unknown', role_icon: '❓', role_description: 'Role not assigned' };
    }

    /**
     * Get count of completed territories
     */
    getCompletedCount() {
        return this.territories.filter(t => t.status === 'completed').length;
    }

    /**
     * Load user territories from database
     */
    async loadUserTerritories() {
        if (this.config.enableMockMode) {
            this.generateMockTerritories();
            return;
        }
        
        try {
            const result = await this.supabaseManager.getTeamTerritories(this.currentTeam.team_id);
            if (result.success) {
                this.territories = result.territories;
            } else {
                throw new Error(result.error);
            }
        } catch (error) {
            console.error('Error loading territories:', error);
            this.showStatus('error', `Error loading territories: ${error.message}`);
        }
    }

    /**
     * Start mapping interface
     */
    startMapping() {
        document.getElementById('teamSection').style.display = 'none';
        document.getElementById('gameSection').style.display = 'block';
        
        this.updateProgress();
        this.renderTerritoriesGrid();
        this.showStatus('success', 'Ready to start mapping! Select a territory to begin.');
    }

    /**
     * Draw random available territory
     */
    drawRandomTerritory() {
        const available = this.territories.filter(t => t.status === 'available');
        
        if (available.length === 0) {
            this.showStatus('success', 'All territories completed! Excellent work!');
            return;
        }
        
        const randomIndex = Math.floor(Math.random() * available.length);
        this.currentTerritory = available[randomIndex];
        
        this.showCurrentTerritory();
        this.enableTerritoryActions();
        this.renderTerritoriesGrid();
        
        this.showStatus('info', `Selected: ${this.currentTerritory.territory_name}. Ready for mapping!`);
    }

    /**
     * Show current territory details
     */
    showCurrentTerritory() {
        const div = document.getElementById('currentTerritory');
        const nameDiv = document.getElementById('currentTerritoryName');
        const detailsDiv = document.getElementById('territoryDetails');
        
        div.style.display = 'block';
        nameDiv.textContent = this.currentTerritory.territory_name;
        
        detailsDiv.innerHTML = `
            <p><strong>OSM ID:</strong> ${this.currentTerritory.osm_relation_id || 'Not available'}</p>
            <p><strong>Status:</strong> ${this.currentTerritory.status}</p>
            <p><strong>Your Role:</strong> ${this.getUserRole().role_icon} ${this.getUserRole().role_name}</p>
            <p><strong>Mission:</strong> Map high-voltage power infrastructure using JOSM</p>
        `;
    }

    /**
     * Enable territory action buttons
     */
    enableTerritoryActions() {
        document.getElementById('loadBtn').disabled = false;
        document.getElementById('downloadBtn').disabled = false;
        document.getElementById('markCompleteBtn').disabled = false;
    }

    /**
     * Disable territory action buttons
     */
    disableTerritoryActions() {
        document.getElementById('loadBtn').disabled = true;
        document.getElementById('downloadBtn').disabled = true;
        document.getElementById('markCompleteBtn').disabled = true;
    }

    /**
     * Show JOSM loading modal
     */
    showJOSMLink() {
        if (!this.currentTerritory) {
            this.showStatus('error', 'No territory selected!');
            return;
        }

        if (!this.overpassAPI) {
            this.showStatus('error', 'Overpass API not initialized!');
            return;
        }

        const josmData = this.overpassAPI.generateSafeJOSMUrl(this.currentTerritory.osm_relation_id);
        
        const modalContent = `
            <h3>Load ${this.currentTerritory.territory_name} into JOSM</h3>
            <div class="josm-instructions">
                <h4>Instructions:</h4>
                <ol>
                    ${josmData.instructions.map(instruction => `<li>${instruction}</li>`).join('')}
                </ol>
            </div>
            <div class="josm-links">
                <a href="${josmData.url}" target="_blank" class="btn btn-success josm-link">
                    📡 Load Data into JOSM
                </a>
                <button class="btn btn-secondary" onclick="closeJOSMModal()">
                    ❌ Close
                </button>
            </div>
        `;
        
        document.getElementById('josmModalContent').innerHTML = modalContent;
        document.getElementById('josmModal').style.display = 'block';
    }

    /**
     * Generate download link
     */
    generateDownloadLink() {
        if (!this.currentTerritory || !this.overpassAPI) {
            this.showStatus('error', 'Territory or API not available!');
            return;
        }

        const url = this.overpassAPI.generateDownloadUrl(this.currentTerritory.osm_relation_id);
        
        const link = document.createElement('a');
        link.href = url;
        link.download = `${this.currentTerritory.territory_name.replace(/\s+/g, '_')}_power.osm`;
        link.target = '_blank';
        link.click();
        
        this.showStatus('success', `Download started for ${this.currentTerritory.territory_name}`);
    }

    /**
     * Mark territory as complete
     */
    async markTerritoryComplete() {
        if (!this.currentTerritory) return;

        try {
            if (!this.config.enableMockMode && this.supabaseManager) {
                const result = await this.supabaseManager.updateTerritoryStatus(
                    this.currentTerritory.id,
                    'completed'
                );
                
                if (!result.success) {
                    throw new Error(result.error);
                }
            }
            
            // Update local data
            const index = this.territories.findIndex(t => t.id === this.currentTerritory.id);
            if (index !== -1) {
                this.territories[index].status = 'completed';
                this.territories[index].completed_at = new Date().toISOString();
            }
            
            const completedName = this.currentTerritory.territory_name;
            this.currentTerritory = null;
            
            this.hideCurrentTerritory();
            this.disableTerritoryActions();
            this.renderTerritoriesGrid();
            this.updateProgress();
            
            this.showStatus('success', `${completedName} marked as complete!`);
            
        } catch (error) {
            console.error('Error marking complete:', error);
            this.showStatus('error', `Error: ${error.message}`);
        }
    }

    /**
     * Hide current territory display
     */
    hideCurrentTerritory() {
        document.getElementById('currentTerritory').style.display = 'none';
    }

    /**
     * Update progress display
     */
    updateProgress() {
        const completed = this.getCompletedCount();
        const total = this.territories.length;
        const percentage = total > 0 ? (completed / total) * 100 : 0;

        document.getElementById('progressFill').style.width = `${percentage}%`;
        document.getElementById('progressText').textContent = 
            percentage === 100 ? 'ALL COMPLETE!' : 
            percentage === 0 ? 'Ready to Start' : 
            `${Math.round(percentage)}% Complete`;
        
        document.getElementById('progressStats').textContent = `${completed}/${total} Territories`;
    }

    /**
     * Render territories grid
     */
    renderTerritoriesGrid() {
        const grid = document.getElementById('territoriesGrid');
        if (!grid) return;
        
        grid.innerHTML = '';

        this.territories.forEach(territory => {
            const card = document.createElement('div');
            card.className = 'territory-card';
            
            if (territory.status === 'completed') {
                card.classList.add('territory-completed');
                card.innerHTML = `<strong>${territory.territory_name}</strong><br/>✅ COMPLETED`;
            } else if (this.currentTerritory && this.currentTerritory.id === territory.id) {
                card.classList.add('territory-current');
                card.innerHTML = `<strong>${territory.territory_name}</strong><br/>🎯 ACTIVE`;
            } else {
                card.classList.add('territory-available');
                card.innerHTML = `<strong>${territory.territory_name}</strong><br/>📍 Available`;
            }

            grid.appendChild(card);
        });
    }

    /**
     * Refresh team status
     */
    async refreshStatus() {
        if (!this.currentUser) return;
        
        this.showStatus('info', 'Refreshing status...', true);
        await this.checkUserStatus();
    }

    /**
     * Show team overview
     */
    showTeamOverview() {
        if (!this.currentTeam) return;
        
        const modalContent = `
            <h3>${this.currentTeam.team_name} Overview</h3>
            <div class="team-overview-content">
                <div class="team-members-section">
                    <h4>Team Members:</h4>
                    ${this.currentTeam.members.map(member => `
                        <div class="team-member-detail">
                            <span class="role-icon">${member.role_icon}</span>
                            <strong>${member.participants.first_name}</strong>
                            <div class="role-info">
                                <strong>${member.role_name}</strong>: ${member.role_description}
                            </div>
                        </div>
                    `).join('')}
                </div>
                
                <div class="territories-section">
                    <h4>Territory Progress:</h4>
                    <div class="progress-summary">
                        <p><strong>${this.getCompletedCount()}/${this.territories.length}</strong> territories completed</p>
                    </div>
                </div>
            </div>
            
            <div class="modal-actions">
                <button class="btn btn-secondary" onclick="closeTeamModal()">Close</button>
            </div>
        `;
        
        document.getElementById('teamModalContent').innerHTML = modalContent;
        document.getElementById('teamModal').style.display = 'block';
    }

    /**
     * Logout and return to registration
     */
    logout() {
        sessionStorage.removeItem('gridTycoonUser');
        this.currentUser = null;
        this.currentTeam = null;
        this.currentTerritory = null;
        this.territories = [];
        
        document.getElementById('gameSection').style.display = 'none';
        document.getElementById('teamSection').style.display = 'none';
        document.getElementById('registrationSection').style.display = 'block';
        
        // Clear form
        document.getElementById('firstNameInput').value = '';
        document.getElementById('osmUsernameInput').value = '';
        document.getElementById('sessionIdInput').value = '';
        
        this.hideStatus();
        this.showStatus('info', 'Logged out successfully.');
    }

    /**
     * Show a section and hide others
     */
    showSection(sectionId, content) {
        // Hide all sections
        document.getElementById('registrationSection').style.display = 'none';
        document.getElementById('teamSection').style.display = 'none';
        document.getElementById('gameSection').style.display = 'none';
        
        // Show target section
        const section = document.getElementById(sectionId);
        section.style.display = 'block';
        
        if (content) {
            section.querySelector('div').innerHTML = content;
        }
    }

    /**
     * Show status message
     */
    showStatus(type, message, loading = false) {
        const statusDiv = document.getElementById('statusDiv');
        statusDiv.style.display = 'block';
        statusDiv.className = `status status-${type}`;
        
        if (loading) {
            statusDiv.innerHTML = `
                <div class="loading">
                    <div class="spinner"></div>
                    <div>${message}</div>
                </div>
            `;
        } else {
            statusDiv.textContent = message;
        }

        if (type === 'success' || type === 'info') {
            setTimeout(() => this.hideStatus(), 5000);
        }
    }

    /**
     * Hide status message
     */
    hideStatus() {
        document.getElementById('statusDiv').style.display = 'none';
    }

    /**
     * Close modals
     */
    closeJOSMModal() {
        document.getElementById('josmModal').style.display = 'none';
    }

    closeTeamModal() {
        document.getElementById('teamModal').style.display = 'none';
    }
}

// Initialize game
const game = new GridTycoon();

// Global functions for HTML onclick events
function checkUserStatus() { game.checkUserStatus(); }
function startMapping() { game.startMapping(); }
function drawRandomTerritory() { game.drawRandomTerritory(); }
function showJOSMLink() { game.showJOSMLink(); }
function generateDownloadLink() { game.generateDownloadLink(); }
function markTerritoryComplete() { game.markTerritoryComplete(); }
function refreshTeamStatus() { game.refreshStatus(); }
function refreshStatus() { game.refreshStatus(); }
function showTeamOverview() { game.showTeamOverview(); }
function logout() { game.logout(); }
function closeJOSMModal() { game.closeJOSMModal(); }
function closeTeamModal() { game.closeTeamModal(); }

// Coordinator functions
function setupCompleteSession() { game.setupCompleteSession(); }
function viewParticipants() { game.viewParticipants(); }
function viewLeaderboard() { game.viewLeaderboard(); }
function exportSessionData() { game.exportSessionData(); }
function closeParticipantsView() { game.closeParticipantsView(); }
function closeLeaderboardView() { game.closeLeaderboardView(); }

// Handle modal clicks
window.onclick = function(event) {
    const josmModal = document.getElementById('josmModal');
    const teamModal = document.getElementById('teamModal');
    const infoModal = document.getElementById('infoModal');
    
    if (event.target === josmModal) game.closeJOSMModal();
    if (event.target === teamModal) game.closeTeamModal();
    if (event.target === infoModal) game.closeInfoModal();
}