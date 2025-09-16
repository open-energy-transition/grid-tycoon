/**
 * Grid Tycoon Game Logic and UI Controller
 * Manages game state, UI interactions, and coordinates with Overpass API
 * Updated for GitHub Pages compatibility with improved JOSM integration
 */

class GridTycoon {
    constructor() {
        this.indianStates = [];
        this.completedStates = new Set();
        this.availableStates = [];
        this.currentState = null;
        this.isInitialized = false;
        this.overpassAPI = new OverpassAPI();
        this.usingFallbackData = false;
    }

    /**
     * Initialize the game by fetching all Indian states from OpenStreetMap
     */
    async initializeStates() {
        this.showStatus('info', 'Discovering power grid territories across India...', true);
        
        try {
            // Add extra error checking
            if (!this.overpassAPI) {
                throw new Error('Overpass API not initialized');
            }

            console.log('Calling overpassAPI.fetchIndianStates()...');
            const statesList = await this.overpassAPI.fetchIndianStates();
            
            console.log('Received states:', statesList);
            
            // Validate the response
            if (!statesList || !Array.isArray(statesList)) {
                throw new Error('Invalid states data received from API');
            }
            
            if (statesList.length === 0) {
                throw new Error('No states found in the data');
            }

            this.indianStates = statesList;
            this.availableStates = [...statesList];
            this.isInitialized = true;
            
            // Check if we're using fallback data
            this.usingFallbackData = statesList.length === this.overpassAPI.fallbackStates.length;
            
            const dataSource = this.usingFallbackData ? 
                '(using embedded data due to API limitations)' : 
                '(live data from OpenStreetMap)';
            
            this.showStatus('success', `Grid discovery complete! Found ${statesList.length} territories ready for power infrastructure mapping ${dataSource}`);
            
            // Show JOSM setup instructions
            this.showJOSMInstructions();
            
            // Transition to game mode
            this.showGameSection();
            this.renderStatesGrid();
            this.updateProgress();
            
        } catch (error) {
            console.error('Initialization error:', error);
            console.error('Error stack:', error.stack);
            this.showStatus('error', `Grid discovery failed: ${error.message}. Please check your network connection and try again.`);
        }
    }

    /**
     * Show JOSM setup instructions to users
     */
    showJOSMInstructions() {
        try {
            const instructions = this.overpassAPI.testJOSMAvailability();
            
            // Validate instructions object
            if (!instructions || !instructions.instructions || !Array.isArray(instructions.instructions)) {
                console.warn('Invalid instructions received from testJOSMAvailability');
                return;
            }
            
            const instructionsHtml = `
                <div class="josm-instructions">
                    <h4>JOSM Setup Required</h4>
                    <p>${instructions.message || 'Please set up JOSM for remote control.'}</p>
                    <ol>
                        ${instructions.instructions.map(step => `<li>${step}</li>`).join('')}
                    </ol>
                    <p><strong>Note:</strong> Due to browser security, you'll need to click JOSM links manually instead of automatic loading.</p>
                </div>
            `;
            
            // Add to the page or show in a modal
            const existingInstructions = document.getElementById('josmInstructions');
            if (existingInstructions) {
                existingInstructions.innerHTML = instructionsHtml;
                existingInstructions.style.display = 'block';
            }
        } catch (error) {
            console.error('Error showing JOSM instructions:', error);
        }
    }

    /**
     * Show the main game section and hide initialization
     */
    showGameSection() {
        document.getElementById('initSection').style.display = 'none';
        document.getElementById('gameSection').style.display = 'block';
    }

    /**
     * Select a random available state for the player to work on
     */
    drawRandomState() {
        if (!this.isInitialized) {
            this.showStatus('error', 'Please initialize the power grid network first!');
            return;
        }

        if (this.availableStates.length === 0) {
            this.showStatus('success', '🏆 LEGENDARY ACHIEVEMENT! All territories conquered! You are the ultimate Grid Tycoon!');
            this.celebrateCompletion();
            return;
        }

        const randomIndex = Math.floor(Math.random() * this.availableStates.length);
        this.currentState = this.availableStates[randomIndex];
        
        this.showCurrentState();
        this.enableStateActions();
        this.renderStatesGrid();
        this.showStatus('info', `🎯 Territory selected: ${this.currentState.name}. Ready for power grid deployment!`);
    }

    /**
     * Display the currently selected state information
     */
    showCurrentState() {
        const currentStateDiv = document.getElementById('currentState');
        const stateNameDiv = document.getElementById('currentStateName');
        const stateDetailsDiv = document.getElementById('stateDetails');
        
        currentStateDiv.style.display = 'block';
        stateNameDiv.textContent = this.currentState.name;
        
        const isoInfo = this.currentState.isoCode ? 
            `<p><strong>🏷️ Territory Code:</strong> ${this.currentState.isoCode}</p>` : '';
        
        const dataSource = this.usingFallbackData ? 
            '<p><strong>📊 Data Source:</strong> Embedded fallback data</p>' : 
            '<p><strong>📊 Data Source:</strong> Live OpenStreetMap data</p>';
        
        stateDetailsDiv.innerHTML = `
            <p><strong>🆔 Grid ID:</strong> ${this.currentState.id}</p>
            ${isoInfo}
            ${dataSource}
            <p><strong>⚡ Mission:</strong> Deploy high-voltage infrastructure (≥50kV)</p>
            <p><strong>🗺️ Status:</strong> Ready for JOSM deployment</p>
        `;
    }

    /**
     * Enable the action buttons for the current state
     */
    enableStateActions() {
        document.getElementById('loadBtn').disabled = false;
        document.getElementById('downloadBtn').disabled = false;
        document.getElementById('markCompleteBtn').disabled = false;
    }

    /**
     * Disable the action buttons
     */
    disableStateActions() {
        document.getElementById('loadBtn').disabled = true;
        document.getElementById('downloadBtn').disabled = true;
        document.getElementById('markCompleteBtn').disabled = true;
    }

    /**
     * Show JOSM loading instructions and link
     */
    showJOSMLink() {
        if (!this.currentState) {
            this.showStatus('error', 'No territory selected! Please draw a random territory first.');
            return;
        }

        const josmData = this.overpassAPI.generateSafeJOSMUrl(this.currentState.id);
        
        // Create a modal or section showing the JOSM link
        this.showJOSMModal(josmData, this.currentState.name);
    }

    /**
     * Show modal with JOSM loading instructions
     */
    showJOSMModal(josmData, stateName) {
        const modal = document.getElementById('josmModal');
        const modalContent = document.getElementById('josmModalContent');
        
        modalContent.innerHTML = `
            <h3>🔗 Load ${stateName} into JOSM</h3>
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
                <button class="btn btn-secondary" onclick="game.closeJOSMModal()">
                    ❌ Close
                </button>
            </div>
            <div class="josm-troubleshooting">
                <h4>Troubleshooting:</h4>
                <ul>
                    <li>If the link doesn't work, copy and paste it into your browser's address bar</li>
                    <li>Ensure JOSM is running and Remote Control is enabled</li>
                    <li>Check that no firewall is blocking port 8111</li>
                    <li>Try the download option if JOSM links continue to fail</li>
                </ul>
            </div>
        `;
        
        modal.style.display = 'block';
        this.showStatus('info', `📋 JOSM loading instructions displayed for ${stateName}`);
    }

    /**
     * Close the JOSM modal
     */
    closeJOSMModal() {
        document.getElementById('josmModal').style.display = 'none';
    }

    /**
     * Generate download link for OSM data
     */
    generateDownloadLink() {
        if (!this.currentState) {
            this.showStatus('error', 'No territory selected! Please draw a random territory first.');
            return;
        }

        const downloadUrl = this.overpassAPI.generateDownloadUrl(this.currentState.id);
        
        // Open download in new window
        const downloadLink = document.createElement('a');
        downloadLink.href = downloadUrl;
        downloadLink.download = `${this.currentState.name.replace(/\s+/g, '_')}_power_grid.osm`;
        downloadLink.target = '_blank';
        downloadLink.click();
        
        this.showStatus('success', `📥 Download started for ${this.currentState.name} power grid data. Open the file in JOSM when complete.`);
    }

    /**
     * Mark the current state as completed and remove it from available states
     */
    markCurrentComplete() {
        if (!this.currentState) return;

        this.completedStates.add(this.currentState.id);
        this.availableStates = this.availableStates.filter(state => state.id !== this.currentState.id);
        
        const completedTerritory = this.currentState.name;
        this.currentState = null;

        this.hideCurrentState();
        this.disableStateActions();
        this.renderStatesGrid();
        this.updateProgress();

        if (this.availableStates.length === 0) {
            this.showStatus('success', '🏆 ULTIMATE VICTORY! All territories conquered! You are the supreme Grid Tycoon of India!');
            document.getElementById('drawBtn').disabled = true;
            this.celebrateCompletion();
        } else {
            this.showStatus('success', `✅ Territory conquered! ${completedTerritory} power grid mapping complete. ${this.availableStates.length} territories remaining.`);
        }
    }

    /**
     * Hide the current state display
     */
    hideCurrentState() {
        document.getElementById('currentState').style.display = 'none';
    }

    /**
     * Add celebration effects when all states are completed
     */
    celebrateCompletion() {
        document.body.style.animation = 'celebration 2s ease-in-out infinite';
        
        if (!document.getElementById('celebration-styles')) {
            const style = document.createElement('style');
            style.id = 'celebration-styles';
            style.textContent = `
                @keyframes celebration {
                    0%, 100% { transform: scale(1); }
                    50% { transform: scale(1.02); }
                }
            `;
            document.head.appendChild(style);
        }
    }

    /**
     * Render the grid of all states with their current status
     */
    renderStatesGrid() {
        const grid = document.getElementById('statesGrid');
        grid.innerHTML = '';

        if (this.indianStates.length === 0) return;

        this.indianStates.forEach(state => {
            const card = document.createElement('div');
            card.className = 'state-card';
            
            if (this.completedStates.has(state.id)) {
                card.classList.add('state-completed');
                card.innerHTML = `<strong>${state.name}</strong><br/>⚡ CONQUERED ⚡`;
            } else if (this.currentState && this.currentState.id === state.id) {
                card.classList.add('state-current');
                card.innerHTML = `<strong>${state.name}</strong><br/>🎯 ACTIVE TARGET 🎯`;
            } else {
                card.classList.add('state-available');
                card.innerHTML = `<strong>${state.name}</strong><br/>🗺️ Available Territory`;
            }

            grid.appendChild(card);
        });
    }

    /**
     * Update the progress bar and statistics
     */
    updateProgress() {
        const completed = this.completedStates.size;
        const total = this.indianStates.length;
        const percentage = total > 0 ? (completed / total) * 100 : 0;

        document.getElementById('progressFill').style.width = `${percentage}%`;
        document.getElementById('progressText').textContent = 
            percentage === 100 ? 'GRID MASTER ACHIEVED!' : 
            percentage === 0 ? 'Grid Tycoon Campaign Ready' : 
            `${Math.round(percentage)}% Territory Conquered`;
        
        document.getElementById('progressStats').textContent = `${completed}/${total} Territories`;
    }

    /**
     * Reset the entire game to initial state
     */
    resetGame() {
        if (confirm('⚠️ Reset your Grid Tycoon campaign? All conquered territories will be lost!')) {
            this.completedStates.clear();
            this.availableStates = [...this.indianStates];
            this.currentState = null;
            
            this.hideCurrentState();
            this.disableStateActions();
            this.closeJOSMModal();
            document.getElementById('drawBtn').disabled = false;
            document.body.style.animation = '';
            
            this.renderStatesGrid();
            this.updateProgress();
            this.hideStatus();
            
            this.showStatus('info', '🔄 Grid Tycoon campaign reset! Ready to conquer India\'s power infrastructure again.');
        }
    }

    /**
     * Show a status message to the user
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
            setTimeout(() => this.hideStatus(), 8000);
        }
    }

    /**
     * Hide the status message
     */
    hideStatus() {
        document.getElementById('statusDiv').style.display = 'none';
    }

    /**
     * Get game statistics
     */
    getGameStats() {
        return {
            totalStates: this.indianStates.length,
            completedStates: this.completedStates.size,
            availableStates: this.availableStates.length,
            currentState: this.currentState ? this.currentState.name : null,
            completionPercentage: this.indianStates.length > 0 ? 
                (this.completedStates.size / this.indianStates.length) * 100 : 0,
            isInitialized: this.isInitialized,
            isCompleted: this.availableStates.length === 0 && this.indianStates.length > 0,
            usingFallbackData: this.usingFallbackData
        };
    }

    /**
     * Save game progress (memory-only for GitHub Pages)
     */
    saveGame() {
        const gameData = {
            completedStates: Array.from(this.completedStates),
            currentStateId: this.currentState ? this.currentState.id : null,
            indianStates: this.indianStates,
            isInitialized: this.isInitialized,
            usingFallbackData: this.usingFallbackData
        };
        
        // Store in sessionStorage as it's more appropriate for this use case
        try {
            sessionStorage.setItem('gridTycoonSave', JSON.stringify(gameData));
            this.showStatus('success', '💾 Game progress saved to browser session!');
        } catch (error) {
            this.showStatus('error', 'Failed to save game progress. Browser storage may be disabled.');
        }
    }

    /**
     * Load game progress from browser storage
     */
    loadGame() {
        try {
            const savedData = sessionStorage.getItem('gridTycoonSave');
            if (!savedData) {
                this.showStatus('error', 'No saved game found in browser session!');
                return;
            }

            const gameData = JSON.parse(savedData);
            
            this.completedStates = new Set(gameData.completedStates || []);
            this.indianStates = gameData.indianStates || [];
            this.isInitialized = gameData.isInitialized || false;
            this.usingFallbackData = gameData.usingFallbackData || false;
            
            if (this.isInitialized) {
                this.availableStates = this.indianStates.filter(
                    state => !this.completedStates.has(state.id)
                );
                
                if (gameData.currentStateId) {
                    this.currentState = this.indianStates.find(
                        state => state.id === gameData.currentStateId
                    );
                    if (this.currentState) {
                        this.showCurrentState();
                        this.enableStateActions();
                    }
                }
                
                this.showGameSection();
                this.renderStatesGrid();
                this.updateProgress();
                this.showStatus('success', '📂 Game progress loaded from browser session!');
            }
        } catch (error) {
            this.showStatus('error', 'Failed to load saved game data! The save might be corrupted.');
        }
    }

    /**
     * Show information about the power query
     */
    showQueryInfo() {
        const description = this.overpassAPI.getPowerQueryDescription();
        const stats = this.overpassAPI.getQueryStats();
        
        const infoHtml = `
            <div class="query-info">
                <h3>🔍 Power Infrastructure Query Details</h3>
                <div class="query-description">
                    <h4>Searched Infrastructure:</h4>
                    <pre>${description}</pre>
                </div>
                <div class="query-stats">
                    <h4>Query Statistics:</h4>
                    <ul>
                        <li>Infrastructure Types: ${stats.infrastructureTypes}</li>
                        <li>Minimum Voltage: ${stats.minimumVoltage}</li>
                        <li>Includes Construction: ${stats.includesConstruction ? 'Yes' : 'No'}</li>
                        <li>Includes Boundaries: ${stats.includesBoundaries ? 'Yes' : 'No'}</li>
                        <li>Query Timeout: ${stats.timeout} seconds</li>
                        <li>Output Format: ${stats.format}</li>
                        <li>Fallback States Available: ${stats.fallbackStatesAvailable}</li>
                    </ul>
                </div>
            </div>
        `;
        
        // Show in modal or dedicated section
        this.showInfoModal(infoHtml);
    }

    /**
     * Show information modal
     */
    showInfoModal(content) {
        const modal = document.getElementById('infoModal');
        const modalContent = document.getElementById('infoModalContent');
        
        modalContent.innerHTML = content + `
            <div style="text-align: center; margin-top: 20px;">
                <button class="btn btn-secondary" onclick="game.closeInfoModal()">
                    ❌ Close
                </button>
            </div>
        `;
        
        modal.style.display = 'block';
    }

    /**
     * Close information modal
     */
    closeInfoModal() {
        document.getElementById('infoModal').style.display = 'none';
    }
}

// Initialize Grid Tycoon Game
const game = new GridTycoon();

// Global functions for HTML onclick events
function initializeStates() { game.initializeStates(); }
function drawRandomState() { game.drawRandomState(); }
function showJOSMLink() { game.showJOSMLink(); }
function generateDownloadLink() { game.generateDownloadLink(); }
function markCurrentComplete() { game.markCurrentComplete(); }
function resetGame() { game.resetGame(); }
function saveGame() { game.saveGame(); }
function loadGame() { game.loadGame(); }
function showQueryInfo() { game.showQueryInfo(); }

// Handle clicking outside modals to close them
window.onclick = function(event) {
    const josmModal = document.getElementById('josmModal');
    const infoModal = document.getElementById('infoModal');
    
    if (event.target === josmModal) {
        game.closeJOSMModal();
    }
    if (event.target === infoModal) {
        game.closeInfoModal();
    }
}

// Load saved game on page load if available
document.addEventListener('DOMContentLoaded', () => {
    // Uncomment to auto-load saved games
    // game.loadGame();
});