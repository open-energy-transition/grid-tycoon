/**
 * OpenStreetMap Overpass API Integration for Grid Tycoon
 * 
 * Updated to use ISO codes instead of OSM relation IDs
 * 
 * @version 3.2
 * @author Grid Tycoon Team
 */

class OverpassAPI {
    constructor(config = null) {
        // Use provided config or global config
        this.config = config || window.GRID_TYCOON_CONFIG?.overpass || {};
        
        // Overpass API configuration
        this.servers = this.config.servers || [
            'https://overpass-api.de/api/interpreter',
            'https://overpass.kumi.systems/api/interpreter',
            'https://overpass.openstreetmap.fr/api/interpreter'
        ];
        this.timeout = this.config.timeout || 300;
        this.currentServerIndex = 0;
        
        // Territory data with ISO codes as primary identifier
        this.territories = [
            {name: 'Andhra Pradesh', isoCode: 'IN-AP', osmRelationId: 1656186, placeType: 'state'},
            {name: 'Arunachal Pradesh', isoCode: 'IN-AR', osmRelationId: 1656183, placeType: 'state'},
            {name: 'Assam', isoCode: 'IN-AS', osmRelationId: 1656184, placeType: 'state'},
            {name: 'Bihar', isoCode: 'IN-BR', osmRelationId: 1656168, placeType: 'state'},
            {name: 'Chhattisgarh', isoCode: 'IN-CT', osmRelationId: 1656170, placeType: 'state'},
            {name: 'Goa', isoCode: 'IN-GA', osmRelationId: 1656929, placeType: 'state'},
            {name: 'Gujarat', isoCode: 'IN-GJ', osmRelationId: 1656190, placeType: 'state'},
            {name: 'Haryana', isoCode: 'IN-HR', osmRelationId: 1656180, placeType: 'state'},
            {name: 'Himachal Pradesh', isoCode: 'IN-HP', osmRelationId: 1656178, placeType: 'state'},
            {name: 'Jharkhand', isoCode: 'IN-JH', osmRelationId: 1656166, placeType: 'state'},
            {name: 'Karnataka', isoCode: 'IN-KA', osmRelationId: 1656160, placeType: 'state'},
            {name: 'Kerala', isoCode: 'IN-KL', osmRelationId: 1656161, placeType: 'state'},
            {name: 'Madhya Pradesh', isoCode: 'IN-MP', osmRelationId: 1656172, placeType: 'state'},
            {name: 'Maharashtra', isoCode: 'IN-MH', osmRelationId: 1656179, placeType: 'state'},
            {name: 'Manipur', isoCode: 'IN-MN', osmRelationId: 1656227, placeType: 'state'},
            {name: 'Meghalaya', isoCode: 'IN-ML', osmRelationId: 1656174, placeType: 'state'},
            {name: 'Mizoram', isoCode: 'IN-MZ', osmRelationId: 1656175, placeType: 'state'},
            {name: 'Nagaland', isoCode: 'IN-NL', osmRelationId: 1656176, placeType: 'state'},
            {name: 'Odisha', isoCode: 'IN-OR', osmRelationId: 1656177, placeType: 'state'},
            {name: 'Punjab', isoCode: 'IN-PB', osmRelationId: 1656181, placeType: 'state'},
            {name: 'Rajasthan', isoCode: 'IN-RJ', osmRelationId: 1656182, placeType: 'state'},
            {name: 'Sikkim', isoCode: 'IN-SK', osmRelationId: 1656185, placeType: 'state'},
            {name: 'Tamil Nadu', isoCode: 'IN-TN', osmRelationId: 1656187, placeType: 'state'},
            {name: 'Telangana', isoCode: 'IN-TG', osmRelationId: 1656188, placeType: 'state'},
            {name: 'Tripura', isoCode: 'IN-TR', osmRelationId: 1656189, placeType: 'state'},
            {name: 'Uttar Pradesh', isoCode: 'IN-UP', osmRelationId: 1656191, placeType: 'state'},
            {name: 'Uttarakhand', isoCode: 'IN-UT', osmRelationId: 1656192, placeType: 'state'},
            {name: 'West Bengal', isoCode: 'IN-WB', osmRelationId: 1656193, placeType: 'state'},
            // Union Territories
            {name: 'Andaman and Nicobar Islands', isoCode: 'IN-AN', osmRelationId: 1656194, placeType: 'union_territory'},
            {name: 'Chandigarh', isoCode: 'IN-CH', osmRelationId: 1656195, placeType: 'union_territory'},
            {name: 'Dadra and Nagar Haveli and Daman and Diu', isoCode: 'IN-DH', osmRelationId: 1656196, placeType: 'union_territory'},
            {name: 'Delhi', isoCode: 'IN-DL', osmRelationId: 1656197, placeType: 'union_territory'},
            {name: 'Jammu and Kashmir', isoCode: 'IN-JK', osmRelationId: 1656198, placeType: 'union_territory'},
            {name: 'Ladakh', isoCode: 'IN-LA', osmRelationId: 1656199, placeType: 'union_territory'},
            {name: 'Lakshadweep', isoCode: 'IN-LD', osmRelationId: 1656200, placeType: 'union_territory'},
            {name: 'Puducherry', isoCode: 'IN-PY', osmRelationId: 1656201, placeType: 'union_territory'}
        ];
        
        console.log('OverpassAPI v3.2 initialized with ISO code support for', this.territories.length, 'territories');
    }

    // ================================
    // TERRITORY DATA FETCHING
    // ================================

    /**
     * Fetch Indian territories using API and fallback data
     * @returns {Promise<{success: boolean, data?: Array, error?: string}>}
     */
    async fetchIndianStates() {
        try {
            console.log('Attempting to fetch states from Overpass API...');
            
            const apiStates = await this.fetchStatesFromAPI();
            if (apiStates && apiStates.length > 0) {
                console.log(`Success! Found ${apiStates.length} states from API`);
                return {
                    success: true,
                    data: this.formatTerritoriesForDatabase(apiStates),
                    source: 'api'
                };
            }
        } catch (error) {
            console.warn('API fetch failed, using fallback data:', error.message);
        }
        
        console.log('Using embedded territory data');
        
        const fallbackFormatted = this.territories.map(territory => ({
            name: territory.name,
            isoCode: territory.isoCode,
            osmRelationId: territory.osmRelationId,
            nameEn: territory.name,
            placeType: territory.placeType
        }));
        
        return {
            success: true,
            data: this.formatTerritoriesForDatabase(fallbackFormatted),
            source: 'fallback'
        };
    }

    /**
     * Fetch territories from Overpass API
     * @private
     */
    async fetchStatesFromAPI() {
        const queries = [
            `[out:json][timeout:${this.timeout}];
(
  relation["boundary"="administrative"]["admin_level"="4"]["country"="IN"];
);
out tags;`,
            
            `[out:json][timeout:120];
(
  relation["boundary"="administrative"]["admin_level"="4"]["ISO3166-2"~"^IN-"];
);
out tags;`
        ];

        for (let queryIndex = 0; queryIndex < queries.length; queryIndex++) {
            try {
                console.log(`Attempting territory query ${queryIndex + 1}/${queries.length}...`);
                
                const result = await this.executeQuery(queries[queryIndex]);
                if (result.success) {
                    const territories = this.processAPITerritoryData(result.data);
                    if (territories.length > 0) {
                        return territories;
                    }
                }
            } catch (error) {
                console.warn(`Territory query ${queryIndex + 1} failed:`, error.message);
                continue;
            }
        }
        
        return [];
    }

    /**
     * Process raw API data into standardized territory objects
     * @private
     */
    processAPITerritoryData(data) {
        if (!data?.elements?.length) {
            return [];
        }

        return data.elements
            .filter(element => element.tags?.name && element.id && element.tags['ISO3166-2'])
            .filter(element => {
                const tags = element.tags;
                return tags.country === 'IN' || tags['ISO3166-2']?.startsWith('IN-');
            })
            .map(element => ({
                name: element.tags.name,
                isoCode: element.tags['ISO3166-2'],
                osmRelationId: element.id,
                nameEn: element.tags['name:en'] || element.tags.name,
                placeType: this.determinePlaceType(element.tags)
            }))
            .filter(territory => this.validateISOCode(territory.isoCode))
            .sort((a, b) => a.name.localeCompare(b.name));
    }

    /**
     * Format territories for database insertion
     * @private
     */
    formatTerritoriesForDatabase(territories) {
        return territories.map(territory => ({
            name: territory.name,
            name_en: territory.nameEn || territory.name,
            iso_code: territory.isoCode,
            osm_relation_id: territory.osmRelationId,
            place_type: this.normalizePlaceType(territory.placeType),
            is_active: true,
            area_km2: null,
            population: null,
            capital: null
        }));
    }

    /**
     * Normalize place type for database constraint
     * @private
     */
    normalizePlaceType(place) {
        if (!place) return 'state';
        
        const normalized = place.toLowerCase();
        if (normalized === 'territory' || normalized === 'union_territory') {
            return 'union_territory';
        }
        return 'state';
    }

    // ================================
    // QUERY GENERATION - ISO CODE BASED
    // ================================

    /**
     * Generate comprehensive power infrastructure query using ISO code
     * @param {string} isoCode - ISO code for the territory (e.g., 'IN-MH')
     * @returns {string} Overpass QL query string
     */
    generatePowerQuery(isoCode) {
        if (!this.validateISOCode(isoCode)) {
            throw new Error(`Invalid ISO code: ${isoCode}`);
        }

        return `[out:xml][timeout:${this.timeout}];

// Find territory by ISO code using multiple methods
(
  relation["ISO3166-2"="${isoCode}"];
  relation["boundary"="administrative"]["admin_level"="4"]["ISO3166-2"="${isoCode}"];
  area["ISO3166-2"="${isoCode}"];
)->.territory;

// Convert relations to areas for spatial queries
.territory map_to_area ->.searchArea;

// Also try direct area lookup
area["ISO3166-2"="${isoCode}"]->.directArea;

(
  // Power infrastructure within the territory
  
  // Power transmission infrastructure
  node["power"="tower"](area.searchArea);
  node["power"="tower"](area.directArea);
  node["power"="pole"](area.searchArea);
  node["power"="pole"](area.directArea);
  
  // Power lines
  way["power"="line"](area.searchArea);
  way["power"="line"](area.directArea);
  
  // Power cables
  way["power"="cable"](area.searchArea);
  way["power"="cable"](area.directArea);
  
  // Substations and switching stations
  node["power"="substation"](area.searchArea);
  node["power"="substation"](area.directArea);
  way["power"="substation"](area.searchArea);
  way["power"="substation"](area.directArea);
  relation["power"="substation"](area.searchArea);
  relation["power"="substation"](area.directArea);
  
  // Power generation
  node["power"="plant"](area.searchArea);
  node["power"="plant"](area.directArea);
  way["power"="plant"](area.searchArea);
  way["power"="plant"](area.directArea);
  relation["power"="plant"](area.searchArea);
  relation["power"="plant"](area.directArea);
  
  node["power"="generator"](area.searchArea);
  node["power"="generator"](area.directArea);
  way["power"="generator"](area.searchArea);
  way["power"="generator"](area.directArea);
  
  // Transformers and other equipment
  node["power"="transformer"](area.searchArea);
  node["power"="transformer"](area.directArea);
  way["power"="transformer"](area.searchArea);
  way["power"="transformer"](area.directArea);
  
  node["power"="switch"](area.searchArea);
  node["power"="switch"](area.directArea);
  node["power"="portal"](area.searchArea);
  node["power"="portal"](area.directArea);
  
  // Include territory boundary for context
  .territory;
);

out meta;
>;
out meta;`;
    }

    /**
     * Generate a simplified power query for testing
     * @param {string} isoCode - ISO code for the territory
     * @returns {string} Simple test query
     */
    generateSimplePowerQuery(isoCode) {
        if (!this.validateISOCode(isoCode)) {
            throw new Error(`Invalid ISO code: ${isoCode}`);
        }

        return `[out:xml][timeout:${this.timeout}];

// Find territory by ISO code
area["ISO3166-2"="${isoCode}"]->.searchArea;

(
  node["power"](area.searchArea);
  way["power"](area.searchArea);
  relation["power"](area.searchArea);
  
  // Also get the boundary for context
  relation["ISO3166-2"="${isoCode}"];
);

out meta;
>;
out meta;`;
    }

    /**
     * Generate bbox-based query as fallback
     * @param {string} isoCode - ISO code for the territory
     * @returns {Promise<string>} Bbox-based query
     */
    async generateBboxPowerQuery(isoCode) {
        try {
            // First get the territory bbox using ISO code
            const bboxQuery = `[out:json][timeout:60];
relation["ISO3166-2"="${isoCode}"];
out bb;`;

            const result = await this.executeQuery(bboxQuery);
            if (!result.success || !result.data.elements?.length) {
                throw new Error('Could not get territory bounding box');
            }

            const element = result.data.elements[0];
            if (!element.bounds) {
                throw new Error('No bounding box data available');
            }

            const bbox = `${element.bounds.south},${element.bounds.west},${element.bounds.north},${element.bounds.east}`;

            return `[out:xml][timeout:${this.timeout}][bbox:${bbox}];

(
  node["power"];
  way["power"];
  relation["power"];
);

out meta;
>;
out meta;`;

        } catch (error) {
            console.error('Bbox query generation failed:', error);
            throw error;
        }
    }

    /**
     * Generate JOSM remote control URL using ISO code
     * @param {string} isoCode - ISO code for the territory
     * @returns {{success: boolean, data?: object, error?: string}}
     */
    generateJOSMUrl(isoCode) {
        try {
            if (!this.validateISOCode(isoCode)) {
                throw new Error(`Invalid ISO code: ${isoCode}`);
            }

            const territory = this.findTerritoryByISOCode(isoCode);
            const territoryName = territory ? territory.name : isoCode;

            const queries = [
                {
                    name: 'Full Power Query',
                    query: this.generatePowerQuery(isoCode)
                },
                {
                    name: 'Simple Power Query',
                    query: this.generateSimplePowerQuery(isoCode)
                }
            ];

            const josmUrls = queries.map(queryInfo => {
                const encodedQuery = encodeURIComponent(queryInfo.query);
                return {
                    name: queryInfo.name,
                    url: `http://localhost:8111/import?url=${encodeURIComponent(this.servers[0] + '?data=' + encodedQuery)}`,
                    query: queryInfo.query
                };
            });

            return {
                success: true,
                data: {
                    josmUrls: josmUrls,
                    primaryUrl: josmUrls[0].url,
                    isoCode: isoCode,
                    territoryName: territoryName,
                    instructions: [
                        "Make sure JOSM is running",
                        "Enable Remote Control in JOSM (Preferences → Remote Control → Enable remote control)",
                        `Try the Full Power Query for ${territoryName} first`,
                        "If no data loads, try the Simple Power Query",
                        "If your browser blocks the link, copy it to your address bar"
                    ],
                    troubleshooting: [
                        "Ensure JOSM is running with Remote Control enabled",
                        "Check that port 8111 is not blocked by firewall",
                        "Try the Simple Power Query if Full Query returns no data",
                        `Some territories may have sparse power infrastructure data`,
                        `Verify the ISO code ${isoCode} is correct`,
                        "Try refreshing JOSM if it becomes unresponsive"
                    ]
                }
            };
            
        } catch (error) {
            console.error('JOSM URL generation failed:', error);
            return {
                success: false,
                error: error.message
            };
        }
    }

    /**
     * Generate direct download URL using ISO code
     * @param {string} isoCode - ISO code for the territory
     * @returns {{success: boolean, data?: string, error?: string}}
     */
    generateDownloadUrl(isoCode) {
        try {
            if (!this.validateISOCode(isoCode)) {
                throw new Error(`Invalid ISO code: ${isoCode}`);
            }

            const query = this.generatePowerQuery(isoCode);
            const encodedQuery = encodeURIComponent(query);
            const downloadUrl = `${this.servers[0]}?data=${encodedQuery}`;

            return {
                success: true,
                data: downloadUrl,
                fallbackQuery: this.generateSimplePowerQuery(isoCode),
                isoCode: isoCode
            };
            
        } catch (error) {
            console.error('Download URL generation failed:', error);
            return {
                success: false,
                error: error.message
            };
        }
    }

    // ================================
    // QUERY EXECUTION
    // ================================

    /**
     * Execute Overpass query with enhanced error handling
     * @param {string} query - Overpass QL query
     * @returns {Promise<{success: boolean, data?: any, error?: string}>}
     */
    async executeQuery(query) {
        let lastError = null;
        
        for (let serverIndex = 0; serverIndex < this.servers.length; serverIndex++) {
            const server = this.servers[serverIndex];
            
            try {
                console.log(`Trying Overpass server ${serverIndex + 1}/${this.servers.length}: ${server}`);
                
                const result = await this.executeQueryOnServer(query, server);
                
                if (result.elements) {
                    console.log(`Query successful: ${result.elements.length} elements returned`);
                    
                    if (result.elements.length === 0) {
                        console.warn('Query returned 0 elements - this might indicate:');
                        console.warn('1. No power infrastructure in this area');
                        console.warn('2. ISO code area lookup failed');
                        console.warn('3. Query is too restrictive');
                    }
                } else if (typeof result === 'string') {
                    console.log('Query successful: XML response received');
                } else {
                    console.log('Query successful: response received');
                }
                
                return { success: true, data: result };
                
            } catch (error) {
                console.warn(`Server ${serverIndex + 1} failed: ${error.message}`);
                lastError = error;
                
                if (serverIndex < this.servers.length - 1) {
                    await this.delay(2000);
                }
            }
        }
        
        return {
            success: false,
            error: lastError ? lastError.message : 'All Overpass servers failed'
        };
    }

    /**
     * Execute query on a specific server
     * @private
     */
    async executeQueryOnServer(query, serverUrl) {
        const encodedQuery = encodeURIComponent(query);
        const url = `${serverUrl}?data=${encodedQuery}`;
        
        console.log('Executing query for ISO code:', query.substring(0, 200) + '...');
        
        const controller = new AbortController();
        const timeoutId = setTimeout(() => controller.abort(), this.timeout * 1000);
        
        try {
            const response = await fetch(url, {
                method: 'GET',
                signal: controller.signal,
                headers: {
                    'Accept': 'application/json,application/xml,text/xml,*/*',
                    'User-Agent': 'GridTycoon/3.2'
                }
            });
            
            clearTimeout(timeoutId);
            
            if (!response.ok) {
                if (response.status === 429) {
                    throw new Error(`Rate limited (HTTP ${response.status}). Try again in a few minutes.`);
                } else if (response.status === 504 || response.status === 502) {
                    throw new Error(`Server timeout (HTTP ${response.status}). Try a simpler query.`);
                } else {
                    throw new Error(`HTTP ${response.status}: ${response.statusText}`);
                }
            }
            
            const text = await response.text();
            
            if (text.trim().startsWith('{') || text.trim().startsWith('[')) {
                const data = JSON.parse(text);
                
                if (data.remark && data.remark.includes('error')) {
                    throw new Error(`Overpass API error: ${data.remark}`);
                }
                
                if (data.elements && data.elements.length === 0) {
                    console.warn('Empty result returned. This could indicate:');
                    console.warn('- No power infrastructure in the queried area');
                    console.warn('- ISO code area lookup failed');
                    console.warn('- Query filters are too restrictive');
                }
                
                return data;
            } else if (text.trim().startsWith('<')) {
                if (text.includes('<osm') && !text.includes('<node') && !text.includes('<way') && !text.includes('<relation')) {
                    console.warn('XML response is empty (no nodes, ways, or relations found)');
                }
                return text;
            } else {
                throw new Error('Server returned unrecognized response format');
            }
            
        } catch (error) {
            clearTimeout(timeoutId);
            
            if (error.name === 'AbortError') {
                throw new Error(`Query timeout after ${this.timeout} seconds. Try a smaller area or simpler query.`);
            }
            
            throw error;
        }
    }

    // ================================
    // VALIDATION AND UTILITIES
    // ================================

    /**
     * Validate ISO code format
     * @param {string} isoCode - ISO code to validate (e.g., 'IN-MH')
     * @returns {boolean} True if valid
     */
    validateISOCode(isoCode) {
        if (!isoCode || typeof isoCode !== 'string') {
            return false;
        }
        
        // Check format: IN-XX where XX is 2-3 letters
        const isoPattern = /^IN-[A-Z]{2,3}$/;
        return isoPattern.test(isoCode.toUpperCase());
    }

    /**
     * Test a query with a known ISO code
     * @param {string} testIsoCode - Test ISO code (defaults to Maharashtra)
     * @returns {Promise<{success: boolean, data?: object, error?: string}>}
     */
    async testQuery(testIsoCode = 'IN-MH') {
        try {
            console.log(`Testing query with ISO code: ${testIsoCode}`);
            
            const simpleQuery = this.generateSimplePowerQuery(testIsoCode);
            const result = await this.executeQuery(simpleQuery);
            
            return {
                success: result.success,
                data: {
                    isoCode: testIsoCode,
                    queryWorked: result.success,
                    elementsFound: result.success && result.data.elements ? result.data.elements.length : 0,
                    error: result.error || null
                },
                error: result.error
            };
            
        } catch (error) {
            return {
                success: false,
                error: error.message
            };
        }
    }

    /**
     * Determine place type from OSM tags
     * @private
     */
    determinePlaceType(tags) {
        if (tags.place === 'state') return 'state';
        if (tags.place === 'territory') return 'union_territory';
        
        const name = tags.name?.toLowerCase() || '';
        if (name.includes('territory') || name.includes('islands') || 
            ['delhi', 'chandigarh', 'puducherry', 'lakshadweep'].some(ut => name.includes(ut))) {
            return 'union_territory';
        }
        
        return 'state';
    }

    /**
     * Find territory by ISO code
     * @param {string} isoCode - ISO code
     * @returns {object|null} Territory object or null if not found
     */
    findTerritoryByISOCode(isoCode) {
        return this.territories.find(territory => 
            territory.isoCode.toLowerCase() === isoCode.toLowerCase()
        ) || null;
    }

    /**
     * Get territory information for display
     * @param {string} isoCode - ISO code
     * @returns {{success: boolean, data?: object, error?: string}}
     */
    getTerritoryInfo(isoCode) {
        const territory = this.findTerritoryByISOCode(isoCode);
        
        if (!territory) {
            return {
                success: false,
                error: `Territory with ISO code ${isoCode} not found`
            };
        }

        return {
            success: true,
            data: {
                name: territory.name,
                isoCode: territory.isoCode,
                placeType: territory.placeType,
                osmRelationId: territory.osmRelationId,
                josmReady: this.validateISOCode(territory.isoCode),
                queryAvailable: true
            }
        };
    }

    /**
     * Get OSM relation ID from ISO code (for backward compatibility)
     * @param {string} isoCode - ISO code
     * @returns {number|null} OSM relation ID or null if not found
     */
    getOSMRelationIdFromISOCode(isoCode) {
        const territory = this.findTerritoryByISOCode(isoCode);
        return territory ? territory.osmRelationId : null;
    }

    /**
     * Get query description for documentation
     * @returns {string} Human-readable query description
     */
    getPowerQueryDescription() {
        return `This Overpass query searches for power infrastructure using ISO codes:
• All power lines (transmission and distribution)
• Power transmission towers and poles  
• Electrical substations and switching stations
• Power generation facilities (plants, generators)
• Transformation and distribution equipment
• Grid control infrastructure (portals, switches)
• Underground power cables
• Administrative boundaries for geographic context

The query uses ISO codes (like IN-MH for Maharashtra) for more reliable territory identification.`;
    }

    /**
     * Get API statistics for monitoring
     * @returns {object} API configuration and status
     */
    getAPIStats() {
        return {
            servers: this.servers.length,
            currentServer: this.servers[this.currentServerIndex],
            timeout: this.timeout,
            territories: this.territories.length,
            usesISOCodes: true,
            infrastructureTypes: 15,
            outputFormat: 'XML (JOSM compatible)',
            version: '3.2',
            features: [
                'ISO code based queries',
                'Multi-server fallback',
                'Enhanced error reporting', 
                'Multiple query strategies',
                'Area lookup fallbacks'
            ]
        };
    }

    /**
     * Simple delay utility
     * @private
     */
    async delay(ms) {
        return new Promise(resolve => setTimeout(resolve, ms));
    }
}

// Export for global use
if (typeof window !== 'undefined') {
    window.OverpassAPI = OverpassAPI;
}

// Export for Node.js environments
if (typeof module !== 'undefined' && module.exports) {
    module.exports = OverpassAPI;
}