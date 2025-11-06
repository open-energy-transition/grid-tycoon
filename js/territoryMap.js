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
        this.osmoseLayer = null; // Layer for Osmose quality assurance issues
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
     * Two-phase loading: show circles immediately, then upgrade to polygons
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
        this.currentTeam = teamInfo;
        this.teamColor = this.getTeamColor(teamInfo.team_index || 0);

        // Clear existing territories
        this.territoriesLayer.clearLayers();
        this.markers.clear();

        // PHASE 1: Add circle markers immediately (fast, synchronous)
        let markersAdded = 0;
        territories.forEach(territory => {
            const coords = this.getTerritoryCoordinates(territory.iso_code);

            if (!coords) {
                console.warn(`No coordinates found for ${territory.territory_name}`);
                return;
            }

            // Create circle marker
            const marker = L.circleMarker(coords, {
                radius: this.getMarkerRadius(territory.status),
                fillColor: this.getStatusColor(territory.status),
                color: this.teamColor || '#3388ff',
                weight: 3,
                opacity: 1,
                fillOpacity: 0.6
            });

            // Bind popup and tooltip
            const popupContent = this.createTerritoryPopup(territory, teamInfo);
            marker.bindPopup(popupContent, {
                maxWidth: 300,
                className: 'territory-popup-container'
            });

            marker.bindTooltip(
                `<strong>${territory.territory_name}</strong><br>${this.getStatusText(territory.status)}`,
                { direction: 'top', offset: [0, -10] }
            );

            marker.addTo(this.territoriesLayer);
            marker.territoryId = territory.id;
            this.markers.set(territory.id, marker);
            markersAdded++;
        });

        // Fit map to show all territories
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

        console.log(`Phase 1: Displayed ${markersAdded}/${territories.length} circle markers`);

        // PHASE 2: Upgrade to polygons in background (async, non-blocking)
        this.upgradeToPolygons(territories, teamInfo);
    }

    /**
     * Upgrade circle markers to polygon boundaries (background process)
     * @private
     * @param {Array} territories - Territory assignment data
     * @param {object} teamInfo - Team information
     */
    async upgradeToPolygons(territories, teamInfo = {}) {
        console.log('Phase 2: Starting background polygon upgrades...');

        // Fetch all boundaries in parallel with timeout
        const boundaryPromises = territories.map(territory =>
            this.fetchTerritoryBoundaryWithTimeout(
                territory.territory_osm_id,
                territory.territory_name,
                10000 // 10 second timeout per territory
            )
        );

        const results = await Promise.allSettled(boundaryPromises);

        let upgraded = 0;
        let failed = 0;

        results.forEach((result, index) => {
            const territory = territories[index];

            if (result.status === 'fulfilled' && result.value) {
                // Successfully fetched boundary - replace marker with polygon
                const success = this.replaceMarkerWithPolygon(territory, result.value, teamInfo);
                if (success) {
                    upgraded++;
                } else {
                    failed++;
                }
            } else {
                // Failed to fetch - keep circle marker
                failed++;
                console.log(`Keeping circle marker for ${territory.territory_name}`);
            }
        });

        console.log(`Phase 2 complete: ${upgraded} polygons, ${failed} markers`);
    }

    /**
     * Fetch territory boundary with timeout
     * @private
     * @param {string} osmRelationId - OSM relation ID
     * @param {string} territoryName - Territory name
     * @param {number} timeout - Timeout in milliseconds
     * @returns {Promise<object|null>} GeoJSON or null
     */
    async fetchTerritoryBoundaryWithTimeout(osmRelationId, territoryName, timeout = 10000) {
        return Promise.race([
            this.fetchTerritoryBoundary(osmRelationId, territoryName),
            new Promise(resolve => setTimeout(() => resolve(null), timeout))
        ]);
    }

    /**
     * Replace a circle marker with a polygon
     * @private
     * @param {object} territory - Territory data
     * @param {object} geoJSON - GeoJSON boundary data
     * @param {object} teamInfo - Team information
     * @returns {boolean} Success status
     */
    replaceMarkerWithPolygon(territory, geoJSON, teamInfo) {
        try {
            // Remove existing circle marker
            const existingMarker = this.markers.get(territory.id);
            if (existingMarker) {
                this.territoriesLayer.removeLayer(existingMarker);
                this.markers.delete(territory.id);
            }

            // Create polygon layer
            const polygonLayer = L.geoJSON(geoJSON, {
                style: {
                    fillColor: this.getStatusColor(territory.status),
                    fillOpacity: this.getPolygonFillOpacity(territory.status),
                    color: this.teamColor || '#3388ff',
                    weight: 2,
                    opacity: 0.8
                }
            });

            // Bind popup and tooltip
            const popupContent = this.createTerritoryPopup(territory, teamInfo);
            polygonLayer.bindPopup(popupContent, {
                maxWidth: 300,
                className: 'territory-popup-container'
            });

            polygonLayer.bindTooltip(
                `<strong>${territory.territory_name}</strong><br>${this.getStatusText(territory.status)}`,
                { direction: 'top', offset: [0, -10] }
            );

            polygonLayer.addTo(this.territoriesLayer);
            polygonLayer.territoryId = territory.id;
            this.markers.set(territory.id, polygonLayer);

            console.log(`Upgraded ${territory.territory_name} to polygon`);
            return true;

        } catch (error) {
            console.error(`Failed to upgrade ${territory.territory_name}:`, error);
            return false;
        }
    }

    /**
     * Get polygon fill opacity based on status
     * @private
     * @param {string} status - Territory status
     * @returns {number} Opacity value (0-1)
     */
    getPolygonFillOpacity(status) {
        switch (status) {
            case 'completed':
                return 0.5; // More transparent for completed
            case 'current':
                return 0.6; // Medium for in progress
            case 'available':
            default:
                return 0.4; // Light for available
        }
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
     * Two-phase loading like displayTeamTerritories
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

        // PHASE 1: Show circle markers immediately
        allTeamsData.forEach(team => {
            const teamColor = this.getTeamColor(team.team_index || 0);

            if (team.territories && team.territories.length > 0) {
                team.territories.forEach(territory => {
                    const coords = this.getTerritoryCoordinates(territory.iso_code);
                    if (!coords) {
                        console.warn(`No coordinates for ${territory.territory_name}`);
                        return;
                    }

                    totalTerritories++;

                    // Create circle marker
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

                    marker.bindTooltip(
                        `<strong>${territory.territory_name}</strong><br>${team.team_name}`,
                        { direction: 'top', offset: [0, -10] }
                    );

                    marker.addTo(this.territoriesLayer);

                    // Store marker with metadata
                    marker.territoryId = territory.id;
                    marker.teamColor = teamColor;
                    marker.teamInfo = team;
                    this.markers.set(territory.id, marker);
                });
            }
        });

        // Fit to bounds
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

        console.log(`Coordinator Phase 1: Displayed ${totalTerritories} circle markers from ${allTeamsData.length} teams`);

        // PHASE 2: Upgrade to polygons in background
        this.upgradeCoordinatorPolygons(allTeamsData);
    }

    /**
     * Upgrade coordinator view markers to polygons (background)
     * @private
     * @param {Array} allTeamsData - All teams data
     */
    async upgradeCoordinatorPolygons(allTeamsData) {
        console.log('Coordinator Phase 2: Starting background polygon upgrades...');

        // Collect all territories from all teams
        const allTerritories = [];
        const territoryTeamMap = new Map();

        allTeamsData.forEach(team => {
            if (team.territories) {
                team.territories.forEach(territory => {
                    allTerritories.push(territory);
                    territoryTeamMap.set(territory.id, {
                        teamColor: this.getTeamColor(team.team_index || 0),
                        teamInfo: team
                    });
                });
            }
        });

        // Fetch all boundaries in parallel
        const boundaryPromises = allTerritories.map(territory =>
            this.fetchTerritoryBoundaryWithTimeout(
                territory.territory_osm_id,
                territory.territory_name,
                10000
            )
        );

        const results = await Promise.allSettled(boundaryPromises);

        let upgraded = 0;
        results.forEach((result, index) => {
            const territory = allTerritories[index];
            const teamData = territoryTeamMap.get(territory.id);

            if (result.status === 'fulfilled' && result.value && teamData) {
                const success = this.replaceCoordinatorMarkerWithPolygon(
                    territory,
                    result.value,
                    teamData.teamColor,
                    teamData.teamInfo
                );
                if (success) upgraded++;
            }
        });

        console.log(`Coordinator Phase 2 complete: ${upgraded}/${allTerritories.length} polygons`);
    }

    /**
     * Replace coordinator marker with polygon
     * @private
     */
    replaceCoordinatorMarkerWithPolygon(territory, geoJSON, teamColor, teamInfo) {
        try {
            const existingMarker = this.markers.get(territory.id);
            if (existingMarker) {
                this.territoriesLayer.removeLayer(existingMarker);
            }

            const polygonLayer = L.geoJSON(geoJSON, {
                style: {
                    fillColor: this.getStatusColor(territory.status),
                    fillOpacity: this.getPolygonFillOpacity(territory.status),
                    color: teamColor,
                    weight: 2,
                    opacity: 0.8
                }
            });

            // Recreate popup for polygon
            const popupContent = `
                <div class="territory-popup">
                    <h4 style="margin: 0 0 10px 0; color: ${teamColor}; border-bottom: 2px solid ${teamColor}; padding-bottom: 5px;">
                        ${territory.territory_name}
                    </h4>
                    <div style="margin: 8px 0;">
                        <strong>Team:</strong>
                        <span style="color: ${teamColor}; font-weight: bold;">${teamInfo.team_name}</span>
                    </div>
                    <div style="margin: 8px 0;">
                        <strong>Status:</strong>
                        <span style="color: ${this.getStatusColor(territory.status)}; font-weight: bold;">
                            ${this.getStatusIcon(territory.status)} ${this.getStatusText(territory.status)}
                        </span>
                    </div>
                </div>
            `;

            polygonLayer.bindPopup(popupContent, {
                maxWidth: 300,
                className: 'territory-popup-container'
            });

            polygonLayer.bindTooltip(
                `<strong>${territory.territory_name}</strong><br>${teamInfo.team_name}`,
                { direction: 'top', offset: [0, -10] }
            );

            polygonLayer.addTo(this.territoriesLayer);
            polygonLayer.territoryId = territory.id;
            this.markers.set(territory.id, polygonLayer);

            return true;
        } catch (error) {
            console.error(`Failed to upgrade coordinator marker for ${territory.territory_name}:`, error);
            return false;
        }
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
    // BOUNDARY FETCHING
    // ================================

    /**
     * Fetch territory boundary from Overpass API
     * @private
     * @param {string} osmRelationId - OSM relation ID for the territory
     * @param {string} territoryName - Territory name for logging
     * @returns {Promise<object|null>} GeoJSON object or null if failed
     */
    async fetchTerritoryBoundary(osmRelationId, territoryName) {
        if (!osmRelationId) {
            console.warn(`No OSM relation ID for ${territoryName}`);
            return null;
        }

        const overpassServers = [
            'https://overpass-api.de/api/interpreter',
            'https://overpass.kumi.systems/api/interpreter',
            'https://overpass.openstreetmap.fr/api/interpreter'
        ];

        // Overpass query to get boundary geometry
        const query = `
[out:json][timeout:25];
relation(${osmRelationId});
out geom;
        `.trim();

        // Try each server
        for (const server of overpassServers) {
            try {
                console.log(`Fetching boundary for ${territoryName} from ${server}`);

                const response = await fetch(server, {
                    method: 'POST',
                    body: query,
                    headers: {
                        'Content-Type': 'application/x-www-form-urlencoded'
                    }
                });

                if (!response.ok) {
                    throw new Error(`HTTP ${response.status}`);
                }

                const data = await response.json();

                if (!data.elements || data.elements.length === 0) {
                    throw new Error('No boundary data returned');
                }

                // Convert Overpass data to GeoJSON
                const geoJSON = this.overpassToGeoJSON(data.elements[0]);

                if (geoJSON) {
                    console.log(`Successfully fetched boundary for ${territoryName}`);
                    return geoJSON;
                }

            } catch (error) {
                console.warn(`Failed to fetch from ${server}:`, error.message);
                continue;
            }
        }

        console.error(`All servers failed for ${territoryName}`);
        return null;
    }

    /**
     * Convert Overpass API relation data to GeoJSON
     * @private
     * @param {object} element - Overpass relation element
     * @returns {object|null} GeoJSON Feature or null
     */
    overpassToGeoJSON(element) {
        if (!element || !element.members) {
            return null;
        }

        // Extract outer way coordinates
        const coordinates = [];

        for (const member of element.members) {
            if (member.role === 'outer' && member.geometry) {
                const wayCoords = member.geometry.map(node => [node.lon, node.lat]);
                coordinates.push(wayCoords);
            }
        }

        if (coordinates.length === 0) {
            return null;
        }

        return {
            type: 'Feature',
            properties: {
                name: element.tags?.name || 'Unknown',
                osmId: element.id
            },
            geometry: {
                type: 'Polygon',
                coordinates: coordinates
            }
        };
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

        const layer = this.markers.get(territoryId);

        if (layer) {
            // Get bounds or position to zoom to
            if (layer.getBounds) {
                // For polygon layers (GeoJSON)
                this.map.fitBounds(layer.getBounds(), {
                    padding: [50, 50],
                    maxZoom: 7,
                    animate: true,
                    duration: 0.5
                });
            } else if (layer.getLatLng) {
                // For circle markers
                this.map.setView(layer.getLatLng(), 7, {
                    animate: true,
                    duration: 0.5
                });
            }

            // Open popup after a brief delay
            setTimeout(() => {
                if (layer.openPopup) {
                    layer.openPopup();
                }
            }, 300);

            console.log(`Focused on territory: ${territoryId}`);
        } else {
            console.warn(`Territory layer not found: ${territoryId}`);
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

        const layer = this.markers.get(territoryId);

        if (layer) {
            // Update layer styling (works for both polygons and circle markers)
            if (layer.setStyle) {
                // For GeoJSON layers, we need to iterate through sublayers
                if (layer instanceof L.GeoJSON) {
                    layer.setStyle({
                        fillColor: this.getStatusColor(newStatus),
                        fillOpacity: this.getPolygonFillOpacity(newStatus)
                    });
                } else {
                    // For circle markers
                    layer.setStyle({
                        fillColor: this.getStatusColor(newStatus),
                        radius: this.getMarkerRadius(newStatus)
                    });
                }
            }

            // Update tooltip
            const territory = this.currentTerritories.find(t => t.id === territoryId);
            if (territory) {
                territory.status = newStatus;
                layer.setTooltipContent(
                    `<strong>${territory.territory_name}</strong><br>${this.getStatusText(newStatus)}`
                );

                // Update popup if it's open
                if (layer.isPopupOpen && layer.isPopupOpen()) {
                    const teamInfo = this.currentTeam || {};
                    layer.setPopupContent(this.createTerritoryPopup(territory, teamInfo));
                }
            }

            console.log(`Updated territory ${territoryId} to status: ${newStatus}`);
        } else {
            console.warn(`Territory layer not found for update: ${territoryId}`);
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
            teamColor: this.teamColor,
            osmoseIssuesDisplayed: this.osmoseLayer ? this.osmoseLayer.getLayers().length : 0
        };
    }

    // ================================
    // OSMOSE QUALITY ASSURANCE LAYER
    // ================================

    /**
     * Display Osmose QA issues on the map
     * @param {string} territoryName - Name of the territory
     * @param {object} geoJSON - GeoJSON FeatureCollection of Osmose issues
     * @param {number} issueCount - Number of issues
     */
    displayOsmoseIssues(territoryName, geoJSON, issueCount) {
        if (!this.isReady()) {
            console.error('Map not initialized');
            return false;
        }

        // Clear existing Osmose layer if present
        this.clearOsmoseLayer();

        console.log(`Displaying ${issueCount} Osmose issues for ${territoryName}`);

        // Create new Osmose layer
        this.osmoseLayer = L.featureGroup();

        // Add markers for each issue
        if (geoJSON && geoJSON.features && geoJSON.features.length > 0) {
            geoJSON.features.forEach(feature => {
                const coords = feature.geometry.coordinates;
                const props = feature.properties;

                // Create a red circle marker for Osmose issues
                const marker = L.circleMarker([coords[1], coords[0]], {
                    radius: 6,
                    fillColor: '#e74c3c',  // Red color for issues
                    color: '#c0392b',       // Darker red border
                    weight: 2,
                    opacity: 0.9,
                    fillOpacity: 0.7
                });

                // Create popup content
                const popupContent = `
                    <div style="max-width: 250px;">
                        <h4 style="margin: 0 0 8px 0; color: #e74c3c; font-size: 0.95em;">
                            🔍 Osmose Issue
                        </h4>
                        <div style="margin: 5px 0;">
                            <strong>Type:</strong> ${props.title || 'Quality Issue'}
                        </div>
                        ${props.subtitle ? `
                            <div style="margin: 5px 0; font-size: 0.9em; color: #666;">
                                ${props.subtitle}
                            </div>
                        ` : ''}
                        <div style="margin: 5px 0; font-size: 0.85em; color: #666;">
                            <strong>Issue ID:</strong> ${props.id}
                        </div>
                        <div style="margin: 5px 0; font-size: 0.85em; color: #666;">
                            <strong>Classification:</strong> Item ${props.item}, Class ${props.class}
                        </div>
                        <div style="margin-top: 8px; padding-top: 8px; border-top: 1px solid #ddd;">
                            <a href="https://osmose.openstreetmap.fr/en/map/#zoom=16&lat=${props.lat}&lon=${props.lon}&item=${props.item}"
                               target="_blank"
                               rel="noopener noreferrer"
                               style="color: #e74c3c; text-decoration: none; font-size: 0.85em;">
                                View on Osmose →
                            </a>
                        </div>
                    </div>
                `;

                marker.bindPopup(popupContent, {
                    maxWidth: 300,
                    className: 'osmose-popup'
                });

                marker.bindTooltip(
                    `🔍 ${props.title || 'Osmose Issue'}`,
                    { direction: 'top', offset: [0, -8] }
                );

                marker.addTo(this.osmoseLayer);
            });

            // Add the Osmose layer to the map
            this.osmoseLayer.addTo(this.map);

            console.log(`Successfully displayed ${geoJSON.features.length} Osmose markers`);

            return true;
        } else {
            console.log('No Osmose issues to display');
            return false;
        }
    }

    /**
     * Clear Osmose issues layer from map
     */
    clearOsmoseLayer() {
        if (this.osmoseLayer) {
            this.map.removeLayer(this.osmoseLayer);
            this.osmoseLayer = null;
            console.log('Osmose layer cleared');
        }
    }

    /**
     * Check if Osmose layer is currently displayed
     * @returns {boolean}
     */
    hasOsmoseLayer() {
        return this.osmoseLayer !== null && this.osmoseLayer.getLayers().length > 0;
    }

    /**
     * Toggle Osmose layer visibility
     */
    toggleOsmoseLayer() {
        if (!this.osmoseLayer) {
            console.warn('No Osmose layer to toggle');
            return;
        }

        if (this.map.hasLayer(this.osmoseLayer)) {
            this.map.removeLayer(this.osmoseLayer);
            console.log('Osmose layer hidden');
        } else {
            this.osmoseLayer.addTo(this.map);
            console.log('Osmose layer shown');
        }
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
            this.clearOsmoseLayer();
            this.map.remove();
            this.map = null;
            this.territoriesLayer = null;
            this.osmoseLayer = null;
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
