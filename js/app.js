/**
 * Grid Tycoon Application - Main Controller v3.0
 *
 * Manages all user interactions, team formation, territory mapping,
 * and JOSM integration for the Grid Tycoon power infrastructure mapping game.
 *
 * @version 3.0
 * @author Grid Tycoon Team
 */

class GridTycoonApp {
    constructor() {
        // Component instances
        this.overpassAPI = null;
        this.supabaseManager = null;
        this.territoryMap = null;
        this.josmIntegration = null;

        // Configuration from global config
        this.config = window.GRID_TYCOON_CONFIG || this.getDefaultConfig();

        // UI state management
        this.currentSection = 'registration';
        this.statusTimeout = null;

        console.log('GridTycoonApp v3.3 initializing...');
        this.init();
    }

// ================================
// INITIALIZATION
// ================================

async init() {
    try {
        console.log('Initializing Grid Tycoon application...');
        
        await this.initializeComponents();
        this.setupEventHandlers();
        this.checkSavedSession();
        
        console.log('Grid Tycoon application ready');
        
    } catch (error) {
        console.error('Application initialization failed:', error);
        this.showStatus('error', `Initialization failed: ${error.message}. Please refresh the page.`);
    }
}

async initializeComponents() {
    // Initialize Overpass API
    try {
        this.overpassAPI = new OverpassAPI(this.config.overpass);
        console.log('OverpassAPI initialized');
    } catch (error) {
        console.error('OverpassAPI initialization failed:', error);
        throw new Error(`OverpassAPI failed to initialize: ${error.message}`);
    }
    
    // Initialize Supabase integration
    if (!this.config.app.mockMode) {
        try {
            this.supabaseManager = new SupabaseTeamManager(this.config.database);
            
            const connectionTest = await this.supabaseManager.testConnection();
            if (!connectionTest.success) {
                throw new Error(connectionTest.error);
            }
            
            console.log('Supabase integration initialized and tested');
            
        } catch (error) {
            console.error('Supabase initialization failed:', error);
            
            if (this.config.app.fallbackToIndividualMode) {
                console.log('Falling back to individual mode');
                this.showStatus('warning', 'Database unavailable. Running in offline mode.');
                this.config.app.mockMode = true;
            } else {
                throw error;
            }
        }
    } else {
        console.log('Running in mock mode - database features disabled');
        this.showStatus('info', 'Running in demo mode. Database features disabled.');
    }
    
    // Initialize JOSM integration
    try {
        this.josmIntegration = new JOSMIntegration();
        console.log('JOSM integration initialized');
    } catch (error) {
        console.warn('JOSM integration initialization failed:', error);
    }
}

setupEventHandlers() {
    const form = document.getElementById('registrationSection');
    if (form) {
        const inputs = form.querySelectorAll('input');
        inputs.forEach(input => {
            input.addEventListener('keypress', (e) => {
                if (e.key === 'Enter') {
                    this.checkUserStatus();
                }
            });
        });
    }
    
    document.addEventListener('keydown', (e) => {
        if (e.key === 'Escape') {
            this.closeModal();
        }
    });
    
    console.log('Event handlers configured');
}

checkSavedSession() {
    try {
        const savedUser = sessionStorage.getItem('gridTycoonUser');
        if (savedUser) {
            const userData = JSON.parse(savedUser);
            console.log(`Restored session for: ${userData.firstName}`);
            
            if (userData.firstName && userData.osmUsername && userData.sessionId) {
                this.currentUser = userData;
                this.isCoordinator = userData.isCoordinator || false;
                
                this.showStatus('info', `Welcome back, ${userData.firstName}! Click "Check Status" to continue.`);
            }
        }
    } catch (error) {
        console.warn('Error checking saved session:', error);
        sessionStorage.removeItem('gridTycoonUser');
    }
}

// ================================
// USER REGISTRATION & LOGIN
// ================================

async checkUserStatus() {
    const userData = this.validateUserInput();
    if (!userData.success) {
        this.showStatus('error', userData.error);
        return;
    }
    
    const { firstName, osmUsername, sessionId } = userData.data;
    
    this.isCoordinator = this.determineCoordinatorStatus(firstName, sessionId);
    const cleanSessionId = this.cleanSessionId(sessionId);

    this.currentUser = { 
        firstName, 
        osmUsername, 
        sessionId: cleanSessionId, 
        isCoordinator: this.isCoordinator 
    };
    
    sessionStorage.setItem('gridTycoonUser', JSON.stringify(this.currentUser));

    const loadingMessage = this.isCoordinator ? 
        'Checking coordinator access...' : 
        'Checking your team assignment...';
    this.showStatus('info', loadingMessage, true);

    if (this.config.app.mockMode) {
        this.handleMockMode();
        return;
    }

    try {
        if (this.isCoordinator) {
            await this.handleCoordinatorLogin();
        } else {
            await this.handleParticipantLogin();
        }
    } catch (error) {
        console.error('Error in user status check:', error);
        this.showStatus('error', `Error: ${error.message}`);
    }
}

validateUserInput() {
    const firstName = document.getElementById('firstNameInput')?.value?.trim();
    const osmUsername = document.getElementById('osmUsernameInput')?.value?.trim();
    const sessionId = document.getElementById('sessionIdInput')?.value?.trim().toUpperCase();
    
    if (!firstName || !osmUsername || !sessionId) {
        return {
            success: false,
            error: 'Please fill in all fields: First Name, OSM Username, and Session ID!'
        };
    }

    if (sessionId.length < 3) {
        return {
            success: false,
            error: 'Session ID must be at least 3 characters long!'
        };
    }

    return {
        success: true,
        data: { firstName, osmUsername, sessionId }
    };
}

determineCoordinatorStatus(firstName, sessionId) {
    return sessionId.includes('COORD') || 
           sessionId.includes('ADMIN') || 
           firstName.toLowerCase().includes('coord');
}

cleanSessionId(sessionId) {
    return sessionId.replace('-COORD', '').replace('-ADMIN', '');
}

// ================================
// COORDINATOR WORKFLOW
// ================================

async handleCoordinatorLogin() {
    try {
        const sessionId = this.currentUser.sessionId;
        
        const sessionResult = await this.supabaseManager.ensureSessionExists(sessionId);
        if (!sessionResult.success) {
            throw new Error(sessionResult.error);
        }
        
        await this.showCoordinatorDashboard();
        
    } catch (error) {
        console.error('Coordinator login failed:', error);
        this.showStatus('error', `Coordinator login failed: ${error.message}`);
    }
}

async showCoordinatorDashboard() {
    const sessionId = this.currentUser.sessionId;
    
    this.showStatus('info', 'Loading coordinator dashboard...', true);
    
    try {
        const [participantsResult, progressResult] = await Promise.all([
            this.supabaseManager.getSessionParticipants(sessionId),
            this.supabaseManager.getSessionProgress(sessionId)
        ]);

        const participants = participantsResult.success ? participantsResult.data.participants : [];
        const progress = progressResult.success ? progressResult.data : { 
            teamCount: 0, totalTerritories: 0, completedTerritories: 0, 
            completionPercentage: 0, teams: [], leaderboard: []
        };

        const teamFormationInfo = this.getTeamFormationInfo(participants.length);

        const dashboardHtml = this.renderCoordinatorDashboard({
            sessionId,
            user: this.currentUser,
            participants,
            progress,
            teamFormationInfo
        });
        
        this.showSection('coordinatorSection', dashboardHtml);
        this.showStatus('success', `Coordinator dashboard loaded for session ${sessionId}`);
        
    } catch (error) {
        console.error('Error loading coordinator dashboard:', error);
        this.showStatus('error', `Error loading dashboard: ${error.message}`);
    }
}

async setupCompleteSession() {
    const sessionId = this.currentUser.sessionId;
    
    this.showStatus('info', 'Setting up teams and distributing territories... This may take several minutes.', true);
    
    try {
        console.log('Starting complete session setup...');
        
        const result = await this.supabaseManager.coordinatorSetupSession(sessionId, this.overpassAPI);
        
        if (result.success) {
            this.showStatus('success', 
                `Session setup complete! ${result.data.teamsCreated} teams formed, ${result.data.territoriesDistributed} territories distributed.`
            );
            await this.refreshCoordinatorDashboard();
        } else {
            throw new Error(result.error);
        }
        
    } catch (error) {
        console.error('Session setup failed:', error);
        this.showStatus('error', `Failed to setup session: ${error.message}`);
    }
}

// ================================
// PARTICIPANT WORKFLOW
// ================================

async handleParticipantLogin() {
    const { firstName, osmUsername, sessionId } = this.currentUser;
    
    try {
        const userResult = await this.supabaseManager.getUserByOSMUsername(osmUsername, sessionId);
        
        if (userResult.success && userResult.data.user) {
            const teamResult = await this.supabaseManager.getUserTeamInfo(userResult.data.user.id);
            
            if (teamResult.success && teamResult.data.teamInfo) {
                this.currentTeam = teamResult.data.teamInfo;
                await this.showParticipantDashboard();
            } else {
                this.showWaitingForTeam();
            }
        } else {
            await this.registerNewParticipant();
        }
    } catch (error) {
        console.error('Error handling participant login:', error);
        this.showStatus('error', `Error: ${error.message}`);
    }
}

async registerNewParticipant() {
    const { firstName, osmUsername, sessionId } = this.currentUser;
    
    try {
        const result = await this.supabaseManager.registerParticipant(firstName, osmUsername, sessionId);
        
        if (result.success) {
            this.showWaitingForTeam();
            this.showStatus('success', 'Registration successful! Waiting for team assignment.');
        } else {
            throw new Error(result.error);
        }
    } catch (error) {
        console.error('Registration error:', error);
        this.showStatus('error', `Registration failed: ${error.message}`);
    }
}

showWaitingForTeam() {
    const waitingHtml = `
        <div class="participant-waiting">
            <h2>Registration Complete!</h2>
            <div class="user-info" style="background: rgba(52, 152, 219, 0.1); padding: 20px; border-radius: 15px; margin: 20px 0;">
                <p><strong>Name:</strong> ${this.currentUser.firstName}</p>
                <p><strong>OSM Username:</strong> ${this.currentUser.osmUsername}</p>
                <p><strong>Session ID:</strong> ${this.currentUser.sessionId}</p>
            </div>
            <div class="waiting-message" style="text-align: center; margin: 30px 0;">
                <div class="spinner"></div>
                <p style="margin: 20px 0; font-size: 1.2rem;">Waiting for team assignment...</p>
                <p>You'll be able to start mapping when teams are formed and territories are assigned.</p>
            </div>
            <div class="waiting-actions" style="text-align: center;">
                <button class="btn btn-secondary" onclick="app.refreshParticipantStatus()">
                    Refresh Status
                </button>
                <button class="btn btn-warning" onclick="app.logout()">
                    Back to Registration
                </button>
            </div>
        </div>
    `;
    
    this.showSection('teamSection', waitingHtml);
}

async showParticipantDashboard() {
    if (!this.currentTeam) return;
    
    try {
        const territoriesResult = await this.supabaseManager.getTeamTerritories(this.currentTeam.id);
        this.currentTerritories = territoriesResult.success ? territoriesResult.data.territories : [];
        
        const userRole = this.getUserRole();
        const completedCount = this.getCompletedCount();
        const progressPercentage = this.getProgressPercentage();
        
        const participantHtml = `
            <div class="participant-dashboard">
                <div class="current-team team-active team-color-${this.currentTeam.team_index % 6}">
                    <h2>Welcome to ${this.currentTeam.team_name}!</h2>
                    
                    <div class="user-role-display" style="background: rgba(255,255,255,0.1); padding: 20px; border-radius: 15px; margin: 20px 0;">
                        <h3>Your Role: ${userRole.role_icon} ${userRole.role_name}</h3>
                        <p class="role-description">${userRole.role_description}</p>
                    </div>
                    
                    <div class="team-members-display" style="background: rgba(255,255,255,0.05); padding: 15px; border-radius: 10px; margin: 15px 0;">
                        <h4>Team Members:</h4>
                        ${this.currentTeam.members.map(member => {
                            const isYou = member.participants.osm_username === this.currentUser.osmUsername;
                            return `
                                <div class="team-member-compact" style="display: flex; align-items: center; margin: 8px 0; padding: 8px; border-radius: 5px; ${isYou ? 'background: rgba(255,215,0,0.2); font-weight: bold;' : 'background: rgba(255,255,255,0.05);'}">
                                    <span class="role-icon" style="margin-right: 10px; font-size: 1.2em;">${member.role_icon}</span>
                                    <strong>${member.participants.first_name}</strong> (${member.role_name})
                                    ${isYou ? ' - YOU' : ''}
                                </div>
                            `;
                        }).join('')}
                    </div>
                    
                    <div class="team-progress-info" style="margin: 20px 0;">
                        <h4>Team Progress:</h4>
                        <p><strong>${completedCount}/${this.currentTerritories.length}</strong> territories completed</p>
                        <div class="progress-bar" style="background: #eee; height: 25px; border-radius: 10px; margin: 10px 0; overflow: hidden;">
                            <div class="progress-fill" style="width: ${progressPercentage}%; height: 100%; background: linear-gradient(45deg, #27ae60, #2ecc71); display: flex; align-items: center; justify-content: center; color: white; font-weight: bold; transition: width 0.3s;">
                                ${Math.round(progressPercentage)}% Complete
                            </div>
                        </div>
                    </div>
                    
                    <div class="participant-actions" style="text-align: center;">
                        <button class="btn btn-success" onclick="app.showMappingInterface()">
                            Start Mapping
                        </button>
                        <button class="btn btn-secondary" onclick="app.refreshParticipantStatus()">
                            Refresh Status
                        </button>
                        <button class="btn btn-warning" onclick="app.logout()">
                            Logout
                        </button>
                    </div>
                </div>
            </div>
        `;
        
        this.showSection('teamSection', participantHtml);
        
        const roleMessage = `Welcome to ${this.currentTeam.team_name}! Your role: ${userRole.role_name}`;
        this.showStatus('success', roleMessage);
        
    } catch (error) {
        console.error('Error showing participant dashboard:', error);
        this.showStatus('error', `Error loading dashboard: ${error.message}`);
    }
}

// ================================
// TERRITORY MAPPING INTERFACE WITH MAP
// ================================

async showMappingInterface() {
    if (!this.currentTeam || !this.currentTerritories) return;

    this.showStatus('info', 'Loading mapping interface...', true);

    const completedCount = this.getCompletedCount();
    const availableCount = this.getAvailableCount();
    const progressPercentage = this.getProgressPercentage();

    const mappingHtml = `
        <div class="mapping-interface">
            <!-- Subheader with Team Name and Navigation -->
            <div class="mapping-subheader" style="background: rgba(37, 99, 235, 0.05); padding: 15px 20px; border-radius: 8px; margin-bottom: 20px; display: flex; justify-content: space-between; align-items: center; border: 1px solid rgba(37, 99, 235, 0.1);">
                <h2 style="margin: 0; color: #1F2937; font-size: 1.5rem;">${this.currentTeam.team_name}</h2>
                <div style="display: flex; gap: 10px;">
                    <button class="btn btn-primary" onclick="app.showTeammatesModal()">
                        View Teammates
                    </button>
                    <button class="btn btn-secondary" onclick="app.showParticipantDashboard()">
                        Back to Dashboard
                    </button>
                    <button class="btn btn-info" onclick="app.refreshTerritories()">
                        Refresh Territories
                    </button>
                </div>
            </div>

            <!-- Territory Map at Top -->
            <div class="territory-map-container">
                <h3 style="margin-bottom: 15px; color: #1F2937;">Territory Map</h3>
                <div id="territoryMap" style="height: 500px; border-radius: 10px; border: 2px solid #ddd;"></div>
            </div>

            <div class="team-progress-summary">
                <h3>Team Progress Summary</h3>
                <div style="display: grid; grid-template-columns: repeat(auto-fit, minmax(200px, 1fr)); gap: 15px; margin: 15px 0;">
                    <div style="text-align: center;">
                        <div style="font-size: 2em; font-weight: bold; color: #3498db;">${this.currentTerritories.length}</div>
                        <div>Total Territories</div>
                    </div>
                    <div style="text-align: center;">
                        <div style="font-size: 2em; font-weight: bold; color: #27ae60;">${completedCount}</div>
                        <div>Completed</div>
                    </div>
                    <div style="text-align: center;">
                        <div style="font-size: 2em; font-weight: bold; color: #f39c12;">${availableCount}</div>
                        <div>Available</div>
                    </div>
                    <div style="text-align: center;">
                        <div style="font-size: 2em; font-weight: bold; color: #3498db;">${Math.round(progressPercentage)}%</div>
                        <div>Progress</div>
                    </div>
                </div>
            </div>

            <div class="territories-list-container" id="territoriesListContainer">
                <h3>Your Assigned Territories</h3>

                ${this.currentTerritories.length === 0 ? `
                    <div class="no-territories">
                        <p>No territories assigned yet. Wait for coordinator to assign territories.</p>
                    </div>
                ` : `
                    <div class="territories-list">
                        ${this.currentTerritories.map(territory => this.renderTerritoryCard(territory)).join('')}
                    </div>
                `}
            </div>
        </div>
    `;

    this.showSection('mappingSection', mappingHtml);

    // Initialize map after DOM is ready
    setTimeout(() => {
        this.initializeTerritoryMap();
    }, 100);

    this.showStatus('success', `Loaded ${this.currentTerritories.length} territories for your team.`);
}

initializeTerritoryMap() {
    try {
        if (!this.territoryMap) {
            this.territoryMap = new TerritoryMap();
        }
        
        const initialized = this.territoryMap.initializeMap('territoryMap', {
            zoom: 5,
            minZoom: 4,
            maxZoom: 12
        });
        
        if (initialized) {
            this.territoryMap.displayTeamTerritories(
                this.currentTerritories,
                this.currentTeam
            );
            console.log('Territory map initialized successfully');
        }
    } catch (error) {
        console.error('Map initialization failed:', error);
        this.showStatus('warning', 'Map display failed. Using list view.');
    }
}

toggleMapView() {
    const mapContainer = document.querySelector('.territory-map-container');
    const listContainer = document.getElementById('territoriesListContainer');
    
    if (mapContainer && listContainer) {
        const mapVisible = mapContainer.style.display !== 'none';
        
        if (mapVisible) {
            mapContainer.style.display = 'none';
            listContainer.style.display = 'block';
        } else {
            mapContainer.style.display = 'block';
            listContainer.style.display = 'none';
            if (this.territoryMap) {
                this.territoryMap.refresh();
            }
        }
    }
}

renderTerritoryCard(territory) {
    return `
        <div class="territory-item ${territory.status}" data-territory-id="${territory.id}">
            <div class="territory-header">
                <h4>${territory.territory_name}</h4>
                <span class="territory-status-badge status-${territory.status}" style="${this.getStatusBadgeStyle(territory.status)}">
                    ${this.getStatusText(territory.status)}
                </span>
            </div>
            ${territory.notes ? `
            <div class="territory-details">
                <p><strong>Notes:</strong> ${territory.notes}</p>
            </div>
            ` : ''}
            <div class="territory-actions">
                ${this.renderTerritoryActions(territory)}
            </div>
        </div>
    `;
}

renderTerritoryActions(territory) {
    if (territory.status === 'completed') {
        return `
            <button class="btn btn-secondary" onclick="app.viewTerritoryDetails('${territory.id}')">
                View Details
            </button>
        `;
    }
    
    return `
        <button class="btn btn-success" onclick="app.loadTerritoryInJOSM('${territory.id}')" 
                ${!territory.overpass_ready ? 'disabled title="Territory not ready for JOSM"' : ''}>
            Load in JOSM
        </button>
        ${territory.status === 'available' ? `
            <button class="btn btn-warning" onclick="app.startWorkingOnTerritory('${territory.id}')">
                Start Working
            </button>
        ` : ''}
        <button class="btn btn-danger" onclick="app.markTerritoryComplete('${territory.id}')">
            Mark Complete
        </button>
    `;
}

// ================================
// ENHANCED JOSM OPERATIONS
// ================================

async loadTerritoryInJOSM(assignmentId) {
    if (!this.josmIntegration) {
        this.showStatus('error', 'JOSM integration not available');
        return;
    }

    this.showStatus('info', 'Preparing territory data for JOSM...', true);

    try {
        const territoryResult = await this.supabaseManager.getTerritoryForOverpass(assignmentId);
        
        if (!territoryResult.success) {
            throw new Error(territoryResult.error);
        }
        
        const territory = territoryResult.data;
        
        if (!territory.iso_code) {
            throw new Error('Territory does not have ISO code for JOSM loading');
        }

        if (!territory.overpass_query_ready) {
            throw new Error('Territory is not ready for JOSM import');
        }

        const query = this.overpassAPI.generatePowerQuery(territory.iso_code);
        
        const result = await this.josmIntegration.loadOverpassData(
            query,
            territory.territory_name,
            {
                changesetTags: {
                    comment: '#mapyourgrid'
                },
                loadImagery: true
            }
        );

        if (result.success) {
            this.showStatus('success', 
                `✅ ${territory.territory_name} loaded into JOSM with imagery layers!`
            );
            
            if (this.territoryMap && this.territoryMap.isReady()) {
                this.territoryMap.focusOnTerritory(assignmentId);
            }
        } else {
            throw new Error(result.error);
        }

    } catch (error) {
        console.error('Error loading territory in JOSM:', error);
        this.showStatus('error', `Error loading JOSM: ${error.message}`);
        this.showJOSMTroubleshootingModal(error.message);
    }
}

showJOSMTroubleshootingModal(errorMessage) {
    const modalContent = `
        <div style="max-width: 600px;">
            <h3 style="color: #e74c3c;">JOSM Connection Issue</h3>
            
            <div style="background: #fff3cd; padding: 15px; border-radius: 8px; margin: 15px 0; border-left: 4px solid #f39c12;">
                <strong>Error:</strong> ${errorMessage}
            </div>
            
            <div style="background: #e8f4f8; padding: 20px; border-radius: 10px; margin: 20px 0;">
                <h4>Troubleshooting Steps:</h4>
                <ol style="line-height: 1.8;">
                    <li><strong>Is JOSM running?</strong> Make sure JOSM is open on your computer.</li>
                    <li><strong>Enable Remote Control:</strong>
                        <ul>
                            <li>In JOSM, go to <code>Edit → Preferences</code></li>
                            <li>Click on "Remote Control" (globe icon)</li>
                            <li>Check "Enable remote control"</li>
                            <li>Click OK</li>
                        </ul>
                    </li>
                    <li><strong>Check port 8111:</strong> Make sure nothing else is using port 8111</li>
                    <li><strong>Firewall:</strong> Allow JOSM through your firewall</li>
                    <li><strong>Browser permissions:</strong> Allow this page to connect to localhost</li>
                </ol>
            </div>
            
            <div style="text-align: center; margin: 20px 0;">
                <button class="btn btn-primary" onclick="app.checkJOSMStatus()">
                    Test JOSM Connection
                </button>
                <button class="btn btn-secondary" onclick="app.closeModal()">
                    Close
                </button>
            </div>
            
            <div style="background: #f8f9fa; padding: 15px; border-radius: 8px; margin-top: 20px;">
                <small>
                    <strong>Still having issues?</strong> Ask your coordinator for help or check the 
                    <a href="https://josm.openstreetmap.de/wiki/Help/RemoteControl" target="_blank">JOSM Remote Control documentation</a>
                </small>
            </div>
        </div>
    `;
    
    this.showModal(modalContent);
}

async checkJOSMStatus() {
    if (!this.josmIntegration) {
        this.showStatus('error', 'JOSM integration not available');
        return;
    }

    this.showStatus('info', 'Checking JOSM connection...', true);

    try {
        const status = await this.josmIntegration.checkJOSMStatus(true);
        
        if (status.running && status.remoteControlEnabled) {
            this.showStatus('success', 
                `✅ JOSM is running and ready! (Version: ${status.version || 'Unknown'})`
            );
        } else {
            this.showStatus('error', 
                '❌ JOSM is not running or Remote Control is not enabled'
            );
            this.showJOSMTroubleshootingModal('JOSM not detected');
        }
    } catch (error) {
        this.showStatus('error', `❌ Cannot connect to JOSM: ${error.message}`);
    }
}

async startWorkingOnTerritory(assignmentId) {
    try {
        const result = await this.supabaseManager.updateTerritoryStatus(
            assignmentId, 
            'current', 
            `Started working on ${new Date().toISOString()}`
        );

        if (result.success) {
            this.showStatus('success', 'Started working on territory');
            await this.refreshTerritories();
        } else {
            throw new Error(result.error);
        }
    } catch (error) {
        console.error('Error starting work on territory:', error);
        this.showStatus('error', `Error: ${error.message}`);
    }
}

async markTerritoryComplete(assignmentId) {
    if (!confirm('Mark this territory as complete? This action cannot be easily undone.')) {
        return;
    }
    
    try {
        const result = await this.supabaseManager.updateTerritoryStatus(
            assignmentId, 
            'completed', 
            `Completed by ${this.currentUser.firstName} on ${new Date().toISOString()}`
        );

        if (result.success) {
            this.showStatus('success', 'Territory marked as complete!');
            await this.refreshTerritories();
        } else {
            throw new Error(result.error);
        }
    } catch (error) {
        console.error('Error marking territory complete:', error);
        this.showStatus('error', `Error: ${error.message}`);
    }
}

// ================================
// MOCK MODE HANDLING
// ================================

handleMockMode() {
    const mockTeam = {
        id: 'mock-team-1',
        team_name: 'Mock Team Alpha',
        team_index: 0,
        members: [
            {
                participants: {
                    first_name: this.currentUser.firstName,
                    osm_username: this.currentUser.osmUsername
                },
                role_name: 'Pioneer',
                role_description: 'In charge of traditional style mapping',
                role_icon: '🗺️'
            }
        ]
    };

    this.currentTeam = mockTeam;
    this.currentTerritories = [
        { 
            id: 't1', 
            territory_name: 'Maharashtra', 
            status: 'available', 
            territory_osm_id: 1656179, 
            overpass_ready: true,
            iso_code: 'IN-MH',
            place_type: 'state'
        },
        { 
            id: 't2', 
            territory_name: 'Karnataka', 
            status: 'available', 
            territory_osm_id: 1656160, 
            overpass_ready: true,
            iso_code: 'IN-KA',
            place_type: 'state'
        }
    ];
    
    this.showParticipantDashboard();
    this.showStatus('success', 'Mock registration successful! Test the mapping interface.');
}

// ================================
// UTILITY METHODS
// ================================

getUserRole() {
    if (!this.currentTeam || !this.currentTeam.members) {
        return { role_name: 'Unknown', role_icon: '?', role_description: 'Role not assigned' };
    }
    
    return this.currentTeam.members.find(m => 
        m.participants.osm_username === this.currentUser.osmUsername
    ) || this.currentTeam.userRole || { 
        role_name: 'Unknown', 
        role_icon: '?', 
        role_description: 'Role not assigned' 
    };
}

getCompletedCount() {
    return this.currentTerritories.filter(t => t.status === 'completed').length;
}

getAvailableCount() {
    return this.currentTerritories.filter(t => t.status === 'available').length;
}

getProgressPercentage() {
    if (this.currentTerritories.length === 0) return 0;
    return (this.getCompletedCount() / this.currentTerritories.length) * 100;
}

getTeamFormationInfo(participantCount) {
    if (participantCount === 0) {
        return {
            title: 'No Participants Registered',
            description: 'Waiting for participants to register for this session.',
            details: 'Each team requires exactly 3 members: one Pioneer, one Technician, and one Seeker.',
            canFormTeams: false
        };
    } else if (participantCount < 3) {
        return {
            title: 'Insufficient Participants',
            description: `Need ${3 - participantCount} more participants to form the first team.`,
            details: 'Minimum 3 participants required for team formation.',
            canFormTeams: false
        };
    } else if (participantCount % 3 !== 0) {
        const excess = participantCount % 3;
        const needed = 3 - excess;
        return {
            title: 'Incomplete Team Formation',
            description: `${participantCount} participants registered. Need ${needed} more for complete teams.`,
            details: `Current: ${Math.floor(participantCount / 3)} complete teams possible, ${excess} participants would be unassigned.`,
            canFormTeams: false
        };
    } else {
        const possibleTeams = participantCount / 3;
        return {
            title: 'Ready for Team Formation',
            description: `${participantCount} participants can form ${possibleTeams} complete teams.`,
            details: 'All participants will be assigned to teams with balanced roles.',
            canFormTeams: true
        };
    }
}

getStatusBadgeStyle(status) {
    switch (status) {
        case 'completed':
            return 'background: #27ae60; color: white;';
        case 'current':
            return 'background: #3498db; color: white;';
        case 'available':
        default:
            return 'background: #f39c12; color: white;';
    }
}

getStatusText(status) {
    switch (status) {
        case 'completed':
            return 'Completed';
        case 'current':
            return 'In Progress';
        case 'available':
        default:
            return 'Available';
    }
}

// ================================
// REFRESH METHODS
// ================================

async refreshParticipantStatus() {
    await this.handleParticipantLogin();
}

async refreshTerritories() {
    if (this.currentTeam) {
        this.showStatus('info', 'Refreshing territories...', true);
        await this.showMappingInterface();
    }
}

async refreshCoordinatorDashboard() {
    if (this.isCoordinator) {
        await this.showCoordinatorDashboard();
    }
}

// ================================
// UI MANAGEMENT
// ================================

showSection(sectionId, content = null) {
    const sections = ['registrationSection', 'coordinatorSection', 'teamSection', 'mappingSection'];
    sections.forEach(id => {
        const element = document.getElementById(id);
        if (element) {
            element.style.display = 'none';
        }
    });
    
    const targetSection = document.getElementById(sectionId);
    if (targetSection) {
        targetSection.style.display = 'block';
        this.currentSection = sectionId;
        
        if (content) {
            const contentContainer = targetSection.querySelector('div') || targetSection;
            contentContainer.innerHTML = content;
        }
    }
}

showModal(content) {
    const modal = document.getElementById('infoModal');
    const modalContent = document.getElementById('infoModalContent');
    
    if (modal && modalContent) {
        modalContent.innerHTML = content;
        modal.style.display = 'block';
        modal.setAttribute('aria-hidden', 'false');
    }
}

closeModal() {
    const modals = ['infoModal', 'josmModal'];
    modals.forEach(modalId => {
        const modal = document.getElementById(modalId);
        if (modal) {
            modal.style.display = 'none';
            modal.setAttribute('aria-hidden', 'true');
        }
    });
}

showStatus(type, message, loading = false) {
    const statusDiv = document.getElementById('statusDiv');
    if (!statusDiv) return;
    
    if (this.statusTimeout) {
        clearTimeout(this.statusTimeout);
        this.statusTimeout = null;
    }
    
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
        this.statusTimeout = setTimeout(() => {
            statusDiv.style.display = 'none';
        }, 5000);
    }
}

logout() {
    sessionStorage.removeItem('gridTycoonUser');
    this.currentUser = null;
    this.currentTeam = null;
    this.currentTerritories = [];
    this.isCoordinator = false;
    
    if (this.territoryMap) {
        this.territoryMap.destroy();
        this.territoryMap = null;
    }
    
    this.showSection('registrationSection');
    
    const inputs = ['firstNameInput', 'osmUsernameInput', 'sessionIdInput'];
    inputs.forEach(id => {
        const input = document.getElementById(id);
        if (input) input.value = '';
    });
    
    const statusDiv = document.getElementById('statusDiv');
    if (statusDiv) statusDiv.style.display = 'none';
    
    this.showStatus('info', 'Logged out successfully.');
}

getDefaultConfig() {
    return {
        database: {
            url: 'YOUR_SUPABASE_URL_HERE',
            anonKey: 'YOUR_ANON_KEY_HERE'
        },
        overpass: {
            servers: ['https://overpass-api.de/api/interpreter'],
            timeout: 180
        },
        app: {
            mockMode: true,
            debugMode: false,
            fallbackToIndividualMode: true,
            version: '3.3'
        }
    };
}

// ================================
// COORDINATOR DASHBOARD RENDERING
// ================================

renderCoordinatorDashboard({ sessionId, user, participants, progress, teamFormationInfo }) {
    return `
        <div class="coordinator-dashboard">
            <h2>Coordinator Dashboard</h2>
            <div class="session-info">
                <h3>Session: ${sessionId}</h3>
                <p><strong>Coordinator:</strong> ${user.firstName} (@${user.osmUsername})</p>
                <p><strong>Status:</strong> ${progress.sessionStatus || 'Not Started'}</p>
                <p><strong>Participants:</strong> ${participants.length}</p>
                <p><strong>Teams:</strong> ${progress.teamCount || 0}</p>
                <p><strong>Progress:</strong> ${progress.completedTerritories || 0}/${progress.totalTerritories || 0} territories (${progress.completionPercentage || 0}%)</p>
            </div>

            <div class="team-formation-status">
                <h4>Team Formation Status</h4>
                <div class="status-card ${teamFormationInfo.canFormTeams ? 'status-ready' : 'status-waiting'}" style="background: ${teamFormationInfo.canFormTeams ? 'rgba(39, 174, 96, 0.1)' : 'rgba(243, 156, 18, 0.1)'}; padding: 15px; border-radius: 10px; margin: 15px 0;">
                    <p><strong>${teamFormationInfo.title}</strong></p>
                    <p>${teamFormationInfo.description}</p>
                    ${teamFormationInfo.details ? `<small>${teamFormationInfo.details}</small>` : ''}
                </div>
            </div>

            <div class="coordinator-actions">
                <h4>Session Management</h4>
                <button class="btn btn-primary" onclick="app.viewParticipants()" ${participants.length === 0 ? 'disabled' : ''}>
                    View Participants (${participants.length})
                </button>
                <button class="btn btn-success" onclick="app.setupCompleteSession()" ${!teamFormationInfo.canFormTeams ? 'disabled' : ''}>
                    Setup Teams & Territories
                </button>
                <button class="btn btn-secondary" onclick="app.refreshCoordinatorDashboard()">
                    Refresh Dashboard
                </button>
                <button class="btn btn-warning" onclick="app.logout()">
                    Logout
                </button>
            </div>

            ${progress.teamCount > 0 ? this.renderTeamsOverview(progress.teams_data) : ''}
            ${progress.leaderboard && progress.leaderboard.length > 0 ? this.renderLeaderboard(progress.leaderboard) : ''}
        </div>
    `;
}

renderTeamsOverview(teams) {
    if (!teams || teams.length === 0) return '';
    
    return `
        <div class="teams-overview">
            <h4>Teams Overview</h4>
            <div class="teams-grid">
                ${teams.map((team, index) => `
                    <div class="team-card team-color-${index % 6}">
                        <h5>${team.team_name}</h5>
                        <p><strong>Progress:</strong> ${team.territories_completed}/${team.territories_assigned} (${team.completion_percentage}%)</p>
                        <p><strong>Members:</strong> ${team.member_count}</p>
                    </div>
                `).join('')}
            </div>
        </div>
    `;
}

renderLeaderboard(leaderboard) {
    if (!leaderboard || leaderboard.length === 0) return '';
    
    return `
        <div class="leaderboard-section">
            <h4>Team Leaderboard</h4>
            <div class="leaderboard">
                ${leaderboard.map((team, index) => {
                    const medal = index === 0 ? '🥇' : index === 1 ? '🥈' : index === 2 ? '🥉' : '🏅';
                    return `
                        <div class="leaderboard-item rank-${index + 1}" style="display: flex; justify-content: space-between; padding: 10px; margin: 5px 0; background: rgba(255,255,255,0.1); border-radius: 5px;">
                            <span>${medal} #${team.rank}</span>
                            <span>${team.team_name}</span>
                            <span>${team.completed_territories}/${team.total_territories}</span>
                            <span>${team.completion_percentage}%</span>
                        </div>
                    `;
                }).join('')}
            </div>
        </div>
    `;
}

async viewParticipants() {
    if (!this.supabaseManager) {
        this.showStatus('error', 'Database not available');
        return;
    }

    try {
        this.showStatus('info', 'Loading participants...', true);
        
        const result = await this.supabaseManager.getSessionParticipantsDetailed(this.currentUser.sessionId);
        
        if (!result.success) {
            throw new Error(result.error);
        }

        const data = result.data;
        const participants = data.participants || [];

        const modalContent = `
            <div style="max-width: 800px;">
                <h3>Session Participants - ${this.currentUser.sessionId}</h3>
                
                <div style="background: #f8f9fa; padding: 15px; border-radius: 8px; margin: 15px 0;">
                    <div style="display: grid; grid-template-columns: repeat(auto-fit, minmax(150px, 1fr)); gap: 15px; text-align: center;">
                        <div>
                            <div style="font-size: 1.5em; font-weight: bold; color: #3498db;">${participants.length}</div>
                            <div>Total Participants</div>
                        </div>
                        <div>
                            <div style="font-size: 1.5em; font-weight: bold; color: ${data.team_formation_ready ? '#27ae60' : '#e74c3c'};">
                                ${data.team_formation_ready ? 'Ready' : 'Not Ready'}
                            </div>
                            <div>Team Formation</div>
                        </div>
                        <div>
                            <div style="font-size: 1.5em; font-weight: bold; color: #f39c12;">${Math.floor(participants.length / 3)}</div>
                            <div>Complete Teams</div>
                        </div>
                        <div>
                            <div style="font-size: 1.5em; font-weight: bold; color: #9b59b6;">${participants.filter(p => p.team_assigned).length}</div>
                            <div>Assigned</div>
                        </div>
                    </div>
                </div>

                <div style="margin: 20px 0;">
                    <h4>All Participants</h4>
                    ${participants.length === 0 ? `
                        <div style="text-align: center; padding: 40px; background: #fff3cd; border-radius: 8px; color: #856404;">
                            No participants registered yet.
                        </div>
                    ` : `
                        <div style="max-height: 400px; overflow-y: auto; border: 1px solid #ddd; border-radius: 8px;">
                            <table style="width: 100%; border-collapse: collapse;">
                                <thead style="background: #f8f9fa; position: sticky; top: 0;">
                                    <tr>
                                        <th style="padding: 10px; text-align: left; border-bottom: 1px solid #ddd;">#</th>
                                        <th style="padding: 10px; text-align: left; border-bottom: 1px solid #ddd;">Name</th>
                                        <th style="padding: 10px; text-align: left; border-bottom: 1px solid #ddd;">OSM Username</th>
                                        <th style="padding: 10px; text-align: left; border-bottom: 1px solid #ddd;">Team</th>
                                        <th style="padding: 10px; text-align: left; border-bottom: 1px solid #ddd;">Role</th>
                                        <th style="padding: 10px; text-align: left; border-bottom: 1px solid #ddd;">Registered</th>
                                    </tr>
                                </thead>
                                <tbody>
                                    ${participants.map((participant, index) => `
                                        <tr style="border-bottom: 1px solid #eee;">
                                            <td style="padding: 8px;">${index + 1}</td>
                                            <td style="padding: 8px; font-weight: 500;">${participant.first_name}</td>
                                            <td style="padding: 8px; font-family: monospace; color: #666;">@${participant.osm_username}</td>
                                            <td style="padding: 8px;">
                                                ${participant.team_assigned ? 
                                                    `<span style="background: #27ae60; color: white; padding: 2px 8px; border-radius: 12px; font-size: 0.8em;">${participant.team_name}</span>` : 
                                                    '<span style="color: #999;">Unassigned</span>'
                                                }
                                            </td>
                                            <td style="padding: 8px;">
                                                ${participant.team_assigned ? 
                                                    `${participant.role_icon} ${participant.role_name}` : 
                                                    '<span style="color: #999;">-</span>'
                                                }
                                            </td>
                                            <td style="padding: 8px; font-size: 0.9em; color: #666;">
                                                ${new Date(participant.created_at).toLocaleDateString()}
                                            </td>
                                        </tr>
                                    `).join('')}
                                </tbody>
                            </table>
                        </div>
                    `}
                </div>
                
                <div style="text-align: center; margin: 20px 0;">
                    <button class="btn btn-secondary" onclick="app.closeModal()">Close</button>
                </div>
            </div>
        `;
        
        this.showModal(modalContent);
        this.showStatus('success', `Loaded ${participants.length} participants`);
        
    } catch (error) {
        console.error('Error loading participants:', error);
        this.showStatus('error', `Error loading participants: ${error.message}`);
    }
}

async viewTerritoryDetails(assignmentId) {
    this.showModal('<h3>Territory details - Implementation in progress</h3>');
}

showTeammatesModal() {
    if (!this.currentTeam || !this.currentTeam.members) {
        this.showStatus('warning', 'No team information available');
        return;
    }

    const modalContent = `
        <div style="max-width: 600px;">
            <h3 style="color: #2c3e50; border-bottom: 2px solid #3498db; padding-bottom: 10px;">
                👥 ${this.currentTeam.team_name} Members
            </h3>

            <div style="background: #f8f9fa; padding: 15px; border-radius: 8px; margin: 20px 0;">
                <p style="margin: 5px 0;"><strong>Team:</strong> ${this.currentTeam.team_name}</p>
                <p style="margin: 5px 0;"><strong>Members:</strong> ${this.currentTeam.members.length}</p>
                <p style="margin: 5px 0;"><strong>Territories:</strong> ${this.currentTerritories.length}</p>
                <p style="margin: 5px 0;"><strong>Completed:</strong> ${this.getCompletedCount()}/${this.currentTerritories.length}</p>
            </div>

            <div style="margin: 20px 0;">
                <h4 style="margin-bottom: 15px;">Team Members</h4>
                ${this.currentTeam.members.map(member => {
                    const isYou = member.participants.osm_username === this.currentUser.osmUsername;
                    return `
                        <div style="background: ${isYou ? 'rgba(52, 152, 219, 0.1)' : 'white'};
                                    padding: 15px;
                                    margin: 10px 0;
                                    border-radius: 8px;
                                    border-left: 4px solid ${isYou ? '#3498db' : '#ddd'};
                                    ${isYou ? 'box-shadow: 0 2px 4px rgba(0,0,0,0.1);' : ''}">
                            <div style="display: flex; align-items: center; justify-content: space-between;">
                                <div style="display: flex; align-items: center; gap: 10px;">
                                    <span style="font-size: 1.8em;">${member.role_icon}</span>
                                    <div>
                                        <div style="font-weight: bold; font-size: 1.1em;">
                                            ${member.participants.first_name}
                                            ${isYou ? '<span style="background: #3498db; color: white; padding: 2px 8px; border-radius: 12px; font-size: 0.7em; margin-left: 8px;">YOU</span>' : ''}
                                        </div>
                                        <div style="color: #666; font-size: 0.9em;">@${member.participants.osm_username}</div>
                                    </div>
                                </div>
                                <div style="text-align: right;">
                                    <div style="font-weight: bold; color: #3498db;">${member.role_name}</div>
                                    <div style="font-size: 0.85em; color: #666;">${member.role_description}</div>
                                </div>
                            </div>
                        </div>
                    `;
                }).join('')}
            </div>

            <div style="text-align: center; margin: 20px 0;">
                <button class="btn btn-secondary" onclick="app.closeModal()">Close</button>
            </div>
        </div>
    `;

    this.showModal(modalContent);
}
}

// Export for global use
if (typeof window !== 'undefined') {
    window.GridTycoonApp = GridTycoonApp;
}

// Export for Node.js environments (optional)
if (typeof module !== 'undefined' && module.exports) {
    module.exports = GridTycoonApp;
}