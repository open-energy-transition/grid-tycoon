/**
 * Territory Map Component for Grid Tycoon v3.0
 *
 * Handles Leaflet map visualization of Indian territories with team assignments
 * and status tracking for the Grid Tycoon mapping application.
 *
 * @version 3.0
 * @requires Leaflet.js (https://leafletjs.com/)
 * @author Grid Tycoon Team
 */

class TerritoryMap {
    constructor() {
        // Dependency check
        if (typeof L === 'undefined') {
            throw new Error('Leaflet library (L) is not loaded. Please include Leaflet.js before territoryMap.js');
        }

        // Map instance and layers
        this.map = null;
        this.territoriesLayer = null;
        this.markers = new Map(); // territoryId -> marker instance

        // State tracking
        this.currentTerritories = [];
        this.currentTeam = null;
        this.teamColor = null;
        this.mapInitialized = false;

        // India-specific configuration
        this.indiaCenter = [22.5937, 78.9629];
        this.indiaZoom = 5;

        // Map bounds for India
        this.indiaBounds = [
            [6.5, 68.0],  // Southwest
            [35.5, 97.5]  // Northeast
        ];

        console.log('TerritoryMap component initialized');
    }

    // ================================
    // MAP INITIALIZATION
    // ================================

    /**
     * Initialize Leaflet map in a container
     * @param {string} containerId - DOM element ID for map
     * @param {object} options - Map configuration options
     * @returns {boolean} Success status
     */
    initializeMap(containerId, options = {}) {
        try {
            const container = document.getElementById(containerId);
            if (!container) {
                console.error(`Map container ${containerId} not found`);
                return false;
            }

            // Clear any existing map
            if (this.map) {
                this.map.remove();
                this.markers.clear();
            }

            // Default options
            const mapOptions = {
                center: options.center || this.indiaCenter,
                zoom: options.zoom || this.indiaZoom,
                minZoom: options.minZoom || 4,
                maxZoom: options.maxZoom || 12,
                zoomControl: options.zoomControl !== false,
                attributionControl: options.attributionControl !== false,
                maxBounds: options.maxBounds || this.indiaBounds,
                maxBoundsViscosity: options.maxBoundsViscosity !== undefined ? options.maxBoundsViscosity : 1.0
            };

            // Create map
            this.map = L.map(containerId, {
                center: mapOptions.center,
                zoom: mapOptions.zoom,
                minZoom: mapOptions.minZoom,
                maxZoom: mapOptions.maxZoom,
                zoomControl: mapOptions.zoomControl,
                maxBounds: mapOptions.maxBounds,
                maxBoundsViscosity: mapOptions.maxBoundsViscosity
            });

            // Add base tile layer
            L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', {
                maxZoom: 18,
                attribution: '© <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors'
            }).addTo(this.map);

            // Initialize territories layer
            this.territoriesLayer = L.featureGroup().addTo(this.map);

            this.mapInitialized = true;
            console.log('Map initialized successfully');

            return true;

        } catch (error) {
            console.error('Map initialization failed:', error);
            return false;
        }
    }

    /**
     * Check if map is ready
     * @returns {boolean}
     */
    isReady() {
        return this.mapInitialized && this.map !== null;
    }

    // ================================
    // TERRITORY DISPLAY
    // ================================

    /**
     * Display territories on the map (team's assigned territories)
     * @param {Array} territories - Territory assignment data from database
     * @param {object} teamInfo - Team information for styling
     */
    displayTeamTerritories(territories, teamInfo = {}) {
        if (!this.isReady()) {
            console.error('Map not initialized');
            return;
        }

        console.log(`Displaying ${territories.length} territories for team`, teamInfo.team_name || 'Unknown');

        this.currentTerritories = territories;
        this.teamColor = this.getTeamColor(teamInfo.team_index || 0);

        // Clear existing territories
        this.territoriesLayer.clearLayers();
        this.markers.clear();

        // Add each territory as a marker
        let markersAdded = 0;
        territories.forEach(territory => {
            if (this.addTerritoryMarker(territory, teamInfo)) {
                markersAdded++;
            }
        });

        // Fit map to show all territories if any were added
        if (this.territoriesLayer.getLayers().length > 0) {
            try {
                this.map.fitBounds(this.territoriesLayer.getBounds(), {
                    padding: [50, 50],
                    maxZoom: 6
                });
            } catch (error) {
                console.warn('Could not fit bounds:', error);
                // Fallback to India center
                this.map.setView(this.indiaCenter, this.indiaZoom);
            }
        } else {
            // No markers, center on India
            this.map.setView(this.indiaCenter, this.indiaZoom);
        }

        console.log(`Successfully displayed ${markersAdded}/${territories.length} territories on map`);
    }

    /**
     * Add a single territory marker to the map
     * @private
     * @param {object} territory - Territory data
     * @param {object} teamInfo - Team information
     * @returns {boolean} Success status
     */
    addTerritoryMarker(territory, teamInfo = {}) {
        // Get coordinates for this territory
        const coords = this.getTerritoryCoordinates(territory.iso_code);

        if (!coords) {
            console.warn(`No coordinates found for ${territory.territory_name} (${territory.iso_code})`);
            return false;
        }

        // Create marker with status-based styling
        const marker = L.circleMarker(coords, {
            radius: this.getMarkerRadius(territory.status),
            fillColor: this.getStatusColor(territory.status),
            color: this.teamColor || '#3388ff',
            weight: 3,
            opacity: 1,
            fillOpacity: 0.6
        });

        // Bind popup with territory information
        const popupContent = this.createTerritoryPopup(territory, teamInfo);
        marker.bindPopup(popupContent, {
            maxWidth: 300,
            className: 'territory-popup-container'
        });

        // Note: JOSM loading from map not yet implemented
        // Markers are for visualization only

        // Add tooltip for quick info
        marker.bindTooltip(
            `<strong>${territory.territory_name}</strong><br>${this.getStatusText(territory.status)}`,
            {
                direction: 'top',
                offset: [0, -10]
            }
        );

        // Add to layer
        marker.addTo(this.territoriesLayer);

        // Store marker reference
        marker.territoryId = territory.id;
        this.markers.set(territory.id, marker);

        return true;
    }

    /**
     * Create popup content for territory
     * @private
     * @param {object} territory - Territory data
     * @param {object} teamInfo - Team information
     * @returns {string} HTML content for popup
     */
    createTerritoryPopup(territory, teamInfo = {}) {
        const statusIcon = this.getStatusIcon(territory.status);
        const statusText = this.getStatusText(territory.status);
        const statusColor = this.getStatusColor(territory.status);

        let popupHtml = `
            <div class="territory-popup">
                <h4 style="margin: 0 0 10px 0; color: #2c3e50; border-bottom: 2px solid ${this.teamColor || '#3388ff'}; padding-bottom: 5px;">
                    ${territory.territory_name}
                </h4>

                <div style="margin: 8px 0;">
                    <strong>Status:</strong>
                    <span style="color: ${statusColor}; font-weight: bold;">
                        ${statusIcon} ${statusText}
                    </span>
                </div>

                <div style="margin: 8px 0;">
                    <strong>ISO Code:</strong>
                    <code style="background: #f0f0f0; padding: 2px 6px; border-radius: 3px;">${territory.iso_code}</code>
                </div>

                <div style="margin: 8px 0;">
                    <strong>Type:</strong> ${this.formatPlaceType(territory.place_type)}
                </div>
        `;

        // Add team name if provided
        if (teamInfo.team_name) {
            popupHtml += `
                <div style="margin: 8px 0;">
                    <strong>Team:</strong>
                    <span style="color: ${this.teamColor}; font-weight: bold;">${teamInfo.team_name}</span>
                </div>
            `;
        }

        // Add completion info if completed
        if (territory.status === 'completed' && territory.completed_at) {
            const completedDate = new Date(territory.completed_at);
            popupHtml += `
                <div style="margin: 8px 0;">
                    <strong>Completed:</strong> ${completedDate.toLocaleDateString()}
                </div>
            `;
        }

        // Add notes if present
        if (territory.notes) {
            popupHtml += `
                <div style="margin: 8px 0; padding: 8px; background: #f8f9fa; border-radius: 5px; font-size: 0.9em;">
                    <strong>Notes:</strong><br>
                    ${territory.notes}
                </div>
            `;
        }

        popupHtml += `</div>`;

        return popupHtml;
    }

    // ================================
    // COORDINATOR MAP VIEW
    // ================================

    /**
     * Display all session territories with team assignments (coordinator view)
     * @param {Array} allTeamsData - Array of team objects with their territories
     */
    displaySessionOverview(allTeamsData) {
        if (!this.isReady()) {
            console.error('Map not initialized');
            return;
        }

        console.log(`Displaying coordinator overview for ${allTeamsData.length} teams`);

        this.territoriesLayer.clearLayers();
        this.markers.clear();

        let totalTerritories = 0;
        let successfulMarkers = 0;

        allTeamsData.forEach((team, teamIndex) => {
            const teamColor = this.getTeamColor(team.team_index !== undefined ? team.team_index : teamIndex);

            if (team.territories && team.territories.length > 0) {
                team.territories.forEach(territory => {
                    const coords = this.getTerritoryCoordinates(territory.iso_code);
                    if (!coords) {
                        console.warn(`No coordinates for ${territory.territory_name}`);
                        return;
                    }

                    totalTerritories++;

                    // Create marker
                    const marker = L.circleMarker(coords, {
                        radius: 8,
                        fillColor: this.getStatusColor(territory.status),
                        color: teamColor,
                        weight: 3,
                        opacity: 1,
                        fillOpacity: 0.7
                    });

                    // Create popup with team information
                    const popupContent = `
                        <div class="territory-popup">
                            <h4 style="margin: 0 0 10px 0; color: ${teamColor}; border-bottom: 2px solid ${teamColor}; padding-bottom: 5px;">
                                ${territory.territory_name}
                            </h4>

                            <div style="margin: 8px 0;">
                                <strong>Team:</strong>
                                <span style="color: ${teamColor}; font-weight: bold;">${team.team_name}</span>
                            </div>

                            <div style="margin: 8px 0;">
                                <strong>Status:</strong>
                                <span style="color: ${this.getStatusColor(territory.status)}; font-weight: bold;">
                                    ${this.getStatusIcon(territory.status)} ${this.getStatusText(territory.status)}
                                </span>
                            </div>

                            <div style="margin: 8px 0;">
                                <strong>ISO Code:</strong>
                                <code style="background: #f0f0f0; padding: 2px 6px; border-radius: 3px;">${territory.iso_code}</code>
                            </div>

                            ${team.completed_count !== undefined && team.total_count !== undefined ? `
                                <div style="margin-top: 10px; padding-top: 8px; border-top: 1px solid #ddd;">
                                    <strong>Team Progress:</strong> ${team.completed_count}/${team.total_count}
                                    (${Math.round((team.completed_count / team.total_count) * 100)}%)
                                </div>
                            ` : ''}
                        </div>
                    `;

                    marker.bindPopup(popupContent, {
                        maxWidth: 300,
                        className: 'territory-popup-container'
                    });

                    // Tooltip
                    marker.bindTooltip(
                        `<strong>${territory.territory_name}</strong><br>${team.team_name}`,
                        { direction: 'top', offset: [0, -10] }
                    );

                    marker.addTo(this.territoriesLayer);
                    successfulMarkers++;
                });
            }
        });

        // Fit to bounds if markers exist
        if (this.territoriesLayer.getLayers().length > 0) {
            try {
                this.map.fitBounds(this.territoriesLayer.getBounds(), {
                    padding: [50, 50],
                    maxZoom: 6
                });
            } catch (error) {
                console.warn('Could not fit bounds:', error);
                this.map.setView(this.indiaCenter, this.indiaZoom);
            }
        } else {
            this.map.setView(this.indiaCenter, this.indiaZoom);
        }

        console.log(`Coordinator view: Displayed ${successfulMarkers}/${totalTerritories} territories from ${allTeamsData.length} teams`);
    }

    // ================================
    // STYLING HELPERS
    // ================================

    /**
     * Get color for team based on index
     * @private
     * @param {number} teamIndex - Team index (0-based)
     * @returns {string} Hex color code
     */
    getTeamColor(teamIndex) {
        const colors = [
            '#ff6b6b', // Red
            '#4ecdc4', // Teal
            '#45b7d1', // Blue
            '#96ceb4', // Green
            '#ffeaa7', // Yellow
            '#dda0dd', // Purple
            '#ff8c42', // Orange
            '#6c5ce7', // Indigo
            '#fd79a8', // Pink
            '#a29bfe'  // Light purple
        ];
        return colors[teamIndex % colors.length];
    }

    /**
     * Get color based on territory status
     * @private
     * @param {string} status - Territory status (available/current/completed)
     * @returns {string} Hex color code
     */
    getStatusColor(status) {
        switch (status) {
            case 'completed':
                return '#27ae60'; // Green
            case 'current':
                return '#3498db'; // Blue
            case 'available':
            default:
                return '#f39c12'; // Orange
        }
    }

    /**
     * Get marker size based on status
     * @private
     * @param {string} status - Territory status
     * @returns {number} Radius in pixels
     */
    getMarkerRadius(status) {
        switch (status) {
            case 'current':
                return 12; // Larger for current work
            case 'completed':
                return 8;  // Smaller for completed
            case 'available':
            default:
                return 10; // Medium for available
        }
    }

    /**
     * Get status icon emoji
     * @private
     * @param {string} status - Territory status
     * @returns {string} Emoji icon
     */
    getStatusIcon(status) {
        switch (status) {
            case 'completed':
                return '✅';
            case 'current':
                return '🔄';
            case 'available':
            default:
                return '📍';
        }
    }

    /**
     * Get human-readable status text
     * @private
     * @param {string} status - Territory status
     * @returns {string} Status text
     */
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

    /**
     * Format place type for display
     * @private
     * @param {string} placeType - Place type from database
     * @returns {string} Formatted place type
     */
    formatPlaceType(placeType) {
        if (!placeType) return 'State';

        return placeType
            .split('_')
            .map(word => word.charAt(0).toUpperCase() + word.slice(1))
            .join(' ');
    }

    // ================================
    // COORDINATE MAPPING
    // ================================

    /**
     * Get approximate center coordinates for Indian territories
     * @private
     * @param {string} isoCode - ISO 3166-2 code (e.g., 'IN-MH')
     * @returns {Array|null} [latitude, longitude] or null if not found
     *
     * Note: These are approximate centers. For production with actual boundaries,
     * you could load GeoJSON files for each territory.
     */
    getTerritoryCoordinates(isoCode) {
        const coordinates = {
            // States (28)
            'IN-AP': [15.9129, 79.7400],  // Andhra Pradesh
            'IN-AR': [28.2180, 94.7278],  // Arunachal Pradesh
            'IN-AS': [26.2006, 92.9376],  // Assam
            'IN-BR': [25.0961, 85.3131],  // Bihar
            'IN-CT': [21.2787, 81.8661],  // Chhattisgarh
            'IN-GA': [15.2993, 74.1240],  // Goa
            'IN-GJ': [22.2587, 71.1924],  // Gujarat
            'IN-HR': [29.0588, 76.0856],  // Haryana
            'IN-HP': [31.1048, 77.1734],  // Himachal Pradesh
            'IN-JH': [23.6102, 85.2799],  // Jharkhand
            'IN-KA': [15.3173, 75.7139],  // Karnataka
            'IN-KL': [10.8505, 76.2711],  // Kerala
            'IN-MP': [22.9734, 78.6569],  // Madhya Pradesh
            'IN-MH': [19.7515, 75.7139],  // Maharashtra
            'IN-MN': [24.6637, 93.9063],  // Manipur
            'IN-ML': [25.4670, 91.3662],  // Meghalaya
            'IN-MZ': [23.1645, 92.9376],  // Mizoram
            'IN-NL': [26.1584, 94.5624],  // Nagaland
            'IN-OR': [20.9517, 85.0985],  // Odisha
            'IN-PB': [31.1471, 75.3412],  // Punjab
            'IN-RJ': [27.0238, 74.2179],  // Rajasthan
            'IN-SK': [27.5330, 88.5122],  // Sikkim
            'IN-TN': [11.1271, 78.6569],  // Tamil Nadu
            'IN-TG': [18.1124, 79.0193],  // Telangana
            'IN-TR': [23.9408, 91.9882],  // Tripura
            'IN-UP': [26.8467, 80.9462],  // Uttar Pradesh
            'IN-UT': [30.0668, 79.0193],  // Uttarakhand
            'IN-WB': [22.9868, 87.8550],  // West Bengal

            // Union Territories (8)
            'IN-AN': [11.7401, 92.6586],  // Andaman and Nicobar Islands
            'IN-CH': [30.7333, 76.7794],  // Chandigarh
            'IN-DH': [20.3974, 72.8328],  // Dadra and Nagar Haveli and Daman and Diu
            'IN-DL': [28.7041, 77.1025],  // Delhi (National Capital Territory)
            'IN-JK': [33.7782, 76.5762],  // Jammu and Kashmir
            'IN-LA': [34.1526, 77.5771],  // Ladakh
            'IN-LD': [10.5667, 72.6417],  // Lakshadweep
            'IN-PY': [11.9416, 79.8083]   // Puducherry
        };

        const coord = coordinates[isoCode];
        return coord ? coord : null;
    }

    // ================================
    // MAP CONTROLS & UPDATES
    // ================================

    /**
     * Focus map on specific territory and open its popup
     * @param {string} territoryId - Territory assignment ID
     */
    focusOnTerritory(territoryId) {
        if (!this.isReady()) {
            console.warn('Map not ready for focusing');
            return;
        }

        const marker = this.markers.get(territoryId);

        if (marker) {
            // Zoom to territory
            this.map.setView(marker.getLatLng(), 7, {
                animate: true,
                duration: 0.5
            });

            // Open popup after a brief delay
            setTimeout(() => {
                marker.openPopup();
            }, 300);

            console.log(`Focused on territory: ${territoryId}`);
        } else {
            console.warn(`Territory marker not found: ${territoryId}`);
        }
    }

    /**
     * Update territory status on map (visual update only)
     * @param {string} territoryId - Territory assignment ID
     * @param {string} newStatus - New status (available/current/completed)
     */
    updateTerritoryStatus(territoryId, newStatus) {
        if (!this.isReady()) {
            console.warn('Map not ready for status update');
            return;
        }

        const marker = this.markers.get(territoryId);

        if (marker) {
            // Update marker styling
            marker.setStyle({
                fillColor: this.getStatusColor(newStatus),
                radius: this.getMarkerRadius(newStatus)
            });

            // Update tooltip
            const territory = this.currentTerritories.find(t => t.id === territoryId);
            if (territory) {
                territory.status = newStatus;
                marker.setTooltipContent(
                    `<strong>${territory.territory_name}</strong><br>${this.getStatusText(newStatus)}`
                );

                // Update popup if it's open
                if (marker.isPopupOpen()) {
                    const teamInfo = { team_name: this.currentTeam?.team_name };
                    marker.setPopupContent(this.createTerritoryPopup(territory, teamInfo));
                }
            }

            console.log(`Updated territory ${territoryId} to status: ${newStatus}`);
        } else {
            console.warn(`Territory marker not found for update: ${territoryId}`);
        }
    }

    /**
     * Refresh/invalidate map size (call after container resize)
     */
    refresh() {
        if (this.isReady()) {
            this.map.invalidateSize();
            console.log('Map refreshed');
        }
    }

    /**
     * Clear all territories from map
     */
    clearTerritories() {
        if (this.isReady() && this.territoriesLayer) {
            this.territoriesLayer.clearLayers();
            this.markers.clear();
            this.currentTerritories = [];
            console.log('Territories cleared from map');
        }
    }

    /**
     * Get map statistics
     * @returns {object} Map statistics
     */
    getStats() {
        return {
            initialized: this.mapInitialized,
            territoriesDisplayed: this.markers.size,
            currentZoom: this.map ? this.map.getZoom() : null,
            currentCenter: this.map ? this.map.getCenter() : null,
            teamColor: this.teamColor
        };
    }

    // ================================
    // CLEANUP
    // ================================

    /**
     * Destroy map instance and clean up resources
     */
    destroy() {
        if (this.map) {
            console.log('Destroying map instance');
            this.map.remove();
            this.map = null;
            this.territoriesLayer = null;
            this.markers.clear();
            this.currentTerritories = [];
            this.mapInitialized = false;
        }
    }
}

// Export for global use
if (typeof window !== 'undefined') {
    window.TerritoryMap = TerritoryMap;
}

// Export for Node.js environments (optional)
if (typeof module !== 'undefined' && module.exports) {
    module.exports = TerritoryMap;
}
