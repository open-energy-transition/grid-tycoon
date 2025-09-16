/**
 * Overpass API Handler for Grid Tycoon
 * Handles all OpenStreetMap Overpass API queries and interactions
 * Updated for GitHub Pages compatibility
 */

class OverpassAPI {
    constructor() {
        this.baseUrl = 'https://overpass-api.de/api/interpreter';
        this.timeout = 180; // Reduced to 3 minutes for better UX
        this.fallbackServers = [
            'https://overpass-api.de/api/interpreter',
            'https://overpass.kumi.systems/api/interpreter',
            'https://overpass.openstreetmap.fr/api/interpreter'
        ];
        
        // Fallback data for Indian states in case API fails
        this.fallbackStates = [
            {name: 'Andhra Pradesh', id: 1656186, isoCode: 'IN-AP', place: 'state'},
            {name: 'Arunachal Pradesh', id: 1656183, isoCode: 'IN-AR', place: 'state'},
            {name: 'Assam', id: 1656184, isoCode: 'IN-AS', place: 'state'},
            {name: 'Bihar', id: 1656168, isoCode: 'IN-BR', place: 'state'},
            {name: 'Chhattisgarh', id: 1656170, isoCode: 'IN-CT', place: 'state'},
            {name: 'Goa', id: 1656929, isoCode: 'IN-GA', place: 'state'},
            {name: 'Gujarat', id: 1656190, isoCode: 'IN-GJ', place: 'state'},
            {name: 'Haryana', id: 1656180, isoCode: 'IN-HR', place: 'state'},
            {name: 'Himachal Pradesh', id: 1656178, isoCode: 'IN-HP', place: 'state'},
            {name: 'Jharkhand', id: 1656166, isoCode: 'IN-JH', place: 'state'},
            {name: 'Karnataka', id: 1656160, isoCode: 'IN-KA', place: 'state'},
            {name: 'Kerala', id: 1656161, isoCode: 'IN-KL', place: 'state'},
            {name: 'Madhya Pradesh', id: 1656172, isoCode: 'IN-MP', place: 'state'},
            {name: 'Maharashtra', id: 1656179, isoCode: 'IN-MH', place: 'state'},
            {name: 'Manipur', id: 1656227, isoCode: 'IN-MN', place: 'state'},
            {name: 'Meghalaya', id: 1656174, isoCode: 'IN-ML', place: 'state'},
            {name: 'Mizoram', id: 1656175, isoCode: 'IN-MZ', place: 'state'},
            {name: 'Nagaland', id: 1656176, isoCode: 'IN-NL', place: 'state'},
            {name: 'Odisha', id: 1656177, isoCode: 'IN-OR', place: 'state'},
            {name: 'Punjab', id: 1656181, isoCode: 'IN-PB', place: 'state'},
            {name: 'Rajasthan', id: 1656182, isoCode: 'IN-RJ', place: 'state'},
            {name: 'Sikkim', id: 1656185, isoCode: 'IN-SK', place: 'state'},
            {name: 'Tamil Nadu', id: 1656187, isoCode: 'IN-TN', place: 'state'},
            {name: 'Telangana', id: 1656188, isoCode: 'IN-TG', place: 'state'},
            {name: 'Tripura', id: 1656189, isoCode: 'IN-TR', place: 'state'},
            {name: 'Uttar Pradesh', id: 1656191, isoCode: 'IN-UP', place: 'state'},
            {name: 'Uttarakhand', id: 1656192, isoCode: 'IN-UT', place: 'state'},
            {name: 'West Bengal', id: 1656193, isoCode: 'IN-WB', place: 'state'},
            // Union Territories
            {name: 'Andaman and Nicobar Islands', id: 1656194, isoCode: 'IN-AN', place: 'territory'},
            {name: 'Chandigarh', id: 1656195, isoCode: 'IN-CH', place: 'territory'},
            {name: 'Dadra and Nagar Haveli and Daman and Diu', id: 1656196, isoCode: 'IN-DH', place: 'territory'},
            {name: 'Delhi', id: 1656197, isoCode: 'IN-DL', place: 'territory'},
            {name: 'Jammu and Kashmir', id: 1656198, isoCode: 'IN-JK', place: 'territory'},
            {name: 'Ladakh', id: 1656199, isoCode: 'IN-LA', place: 'territory'},
            {name: 'Lakshadweep', id: 1656200, isoCode: 'IN-LD', place: 'territory'},
            {name: 'Puducherry', id: 1656201, isoCode: 'IN-PY', place: 'territory'}
        ];
    }

    /**
     * Fetch all Indian states and territories from OpenStreetMap with fallback
     */
    async fetchIndianStates() {
        // Try API first, fall back to embedded data if needed
        try {
            console.log('Attempting to fetch states from Overpass API...');
            const apiStates = await this.fetchStatesFromAPI();
            if (apiStates && apiStates.length > 0) {
                console.log(`Success! Found ${apiStates.length} states from API`);
                return apiStates;
            }
        } catch (error) {
            console.warn('API fetch failed, using fallback data:', error.message);
        }
        
        console.log('Using embedded fallback state data');
        // Ensure fallback states exist and return properly formatted data
        if (!this.fallbackStates || !Array.isArray(this.fallbackStates)) {
            throw new Error('Fallback state data is not available');
        }
        
        return this.fallbackStates.map(state => ({
            name: state.name,
            id: state.id,
            nameEn: state.name,
            isoCode: state.isoCode,
            wikidata: null,
            place: state.place
        }));
    }

    /**
     * Try to fetch states from Overpass API
     */
    async fetchStatesFromAPI() {
        const queries = [
            // Simplified query with shorter timeout
            `[out:json][timeout:${this.timeout}];
(
  relation["boundary"="administrative"]["admin_level"="4"]["country"="IN"];
);
out tags;`,
            
            // Even simpler fallback
            `[out:json][timeout:120];
(
  relation["boundary"="administrative"]["admin_level"="4"]["ISO3166-2"~"^IN-"];
);
out tags;`
        ];

        let lastError = null;
        
        for (let i = 0; i < queries.length; i++) {
            try {
                console.log(`Trying API query ${i + 1}/${queries.length}...`);
                const data = await this.executeQueryWithFallback(queries[i]);
                const states = this.processStatesData(data);
                
                if (states.length > 0) {
                    console.log(`Success! Found ${states.length} states using query ${i + 1}`);
                    return states;
                }
            } catch (error) {
                console.warn(`API Query ${i + 1} failed:`, error.message);
                lastError = error;
            }
        }
        
        throw lastError || new Error('All API queries failed');
    }

    /**
     * Process the raw data from Overpass API into state objects
     */
    processStatesData(data) {
        // Check if data and elements exist
        if (!data || !data.elements || !Array.isArray(data.elements)) {
            console.warn('Invalid or empty data from API');
            return [];
        }

        const states = data.elements
            .filter(element => element.tags && element.tags.name)
            .filter(element => {
                const tags = element.tags;
                return tags.name && 
                       (tags.country === 'IN' || 
                        tags['ISO3166-2']?.startsWith('IN-') ||
                        tags.place === 'state' || 
                        tags.place === 'territory');
            })
            .map(element => ({
                name: element.tags.name,
                id: element.id,
                nameEn: element.tags['name:en'] || element.tags.name,
                isoCode: element.tags['ISO3166-2'] || null,
                wikidata: element.tags.wikidata || null,
                place: element.tags.place || 'state'
            }))
            .sort((a, b) => a.name.localeCompare(b.name));
        
        // Remove duplicates by name
        const uniqueStates = [];
        const seenNames = new Set();
        
        for (const state of states) {
            if (!seenNames.has(state.name.toLowerCase())) {
                seenNames.add(state.name.toLowerCase());
                uniqueStates.push(state);
            }
        }
        
        return uniqueStates;
    }

    /**
     * Generate comprehensive power infrastructure query for a specific state
     */
    generatePowerQuery(stateRelationId) {
        return `[out:xml][timeout:300];

relation(${stateRelationId})->.territory;
(.territory; >;);
.territory map_to_area ->.gridArea;

(
  // Power transmission towers and poles
  node["power"="tower"](area.gridArea);
  node["power"="pole"](area.gridArea);
  
  // High-voltage transmission lines (>=50kV)
  way["power"="line"]["voltage"~"^([5-9][0-9]{4}|[1-9][0-9]{5,})$"](area.gridArea);
  way["power"="line"]["voltage"~"^(50000|5[0-9]{4}|[6-9][0-9]{4}|[1-9][0-9]{5,})$"](area.gridArea);
  
  // Unspecified voltage lines (manual assessment required)
  way["power"="line"][!"voltage"](area.gridArea);
  
  // Power cables and underground infrastructure
  way["power"="cable"](area.gridArea);
  
  // Electrical substations and switching stations
  node["power"="substation"](area.gridArea);
  way["power"="substation"](area.gridArea);
  relation["power"="substation"](area.gridArea);
  
  // Power generation facilities
  node["power"="plant"](area.gridArea);
  way["power"="plant"](area.gridArea);
  relation["power"="plant"](area.gridArea);
  
  node["power"="generator"](area.gridArea);
  way["power"="generator"](area.gridArea);
  relation["power"="generator"](area.gridArea);
  
  // Transformation and distribution equipment
  node["power"="transformer"](area.gridArea);
  way["power"="transformer"](area.gridArea);
  relation["power"="transformer"](area.gridArea);
  
  // Grid control and switching infrastructure
  node["power"="portal"](area.gridArea);
  node["power"="switch"](area.gridArea);
  
  // Under construction power infrastructure
  node["construction:power"](area.gridArea);
  way["construction:power"](area.gridArea);
  relation["construction:power"](area.gridArea);
  
  // Territory boundary for context
  .territory;
);

out meta;
>;
out meta;`;
    }

    /**
     * Execute an Overpass query with fallback servers
     */
    async executeQueryWithFallback(query) {
        let lastError = null;
        
        for (const server of this.fallbackServers) {
            try {
                console.log(`Trying server: ${server}`);
                const data = await this.executeQueryOnServer(query, server);
                return data;
            } catch (error) {
                console.warn(`Server ${server} failed:`, error.message);
                lastError = error;
                await new Promise(resolve => setTimeout(resolve, 1000));
            }
        }
        
        throw lastError || new Error('All servers failed');
    }

    /**
     * Execute an Overpass query on a specific server
     */
    async executeQueryOnServer(query, serverUrl) {
        const encodedQuery = encodeURIComponent(query);
        const url = `${serverUrl}?data=${encodedQuery}`;
        
        const controller = new AbortController();
        const timeoutId = setTimeout(() => controller.abort(), this.timeout * 1000);
        
        try {
            const response = await fetch(url, {
                method: 'GET',
                signal: controller.signal,
                headers: {
                    'Accept': 'application/json',
                    'User-Agent': 'GridTycoon/1.0'
                }
            });
            
            clearTimeout(timeoutId);
            
            if (!response.ok) {
                throw new Error(`HTTP ${response.status}: ${response.statusText}`);
            }
            
            const text = await response.text();
            
            if (!text.trim().startsWith('{') && !text.trim().startsWith('[')) {
                throw new Error('Server returned non-JSON response');
            }
            
            const data = JSON.parse(text);
            
            if (data.remark && data.remark.includes('error')) {
                throw new Error(`Overpass API error: ${data.remark}`);
            }
            
            return data;
            
        } catch (error) {
            clearTimeout(timeoutId);
            
            if (error.name === 'AbortError') {
                throw new Error(`Query timeout after ${this.timeout} seconds`);
            }
            
            throw error;
        }
    }

    /**
     * Generate JOSM import URL (for manual clicking due to HTTPS/HTTP restrictions)
     */
    generateJOSMUrl(stateRelationId) {
        const query = this.generatePowerQuery(stateRelationId);
        const encodedQuery = encodeURIComponent(query);
        return `http://localhost:8111/import?url=${encodeURIComponent(this.baseUrl + '?data=' + encodedQuery)}`;
    }

    /**
     * Generate a safe JOSM URL that can be clicked by users
     * This bypasses the HTTPS->HTTP mixed content restriction
     */
    generateSafeJOSMUrl(stateRelationId) {
        return {
            url: this.generateJOSMUrl(stateRelationId),
            instructions: [
                "Make sure JOSM is running",
                "Enable Remote Control in JOSM (Preferences → Remote Control → Enable remote control)",
                "Click the link below to load data into JOSM",
                "If your browser blocks the link, copy it to your address bar"
            ]
        };
    }

    /**
     * Test if JOSM might be available (limited test due to CORS)
     */
    async testJOSMAvailability() {
        // We can't actually test due to mixed content restrictions
        // Just provide user guidance instead
        return {
            available: 'unknown',
            message: 'JOSM connectivity cannot be automatically tested from HTTPS pages. Please ensure JOSM is running with Remote Control enabled.',
            instructions: [
                '1. Start JOSM application',
                '2. Go to Preferences → Remote Control',
                '3. Check "Enable remote control"',
                '4. Ensure port 8111 is available',
                '5. Click the generated JOSM links to load data'
            ]
        };
    }

    /**
     * Validate voltage tag format for power lines
     */
    isHighVoltage(voltage) {
        if (!voltage) return false;
        
        const numericVoltage = parseFloat(voltage.replace(/[^\d.]/g, ''));
        
        if (voltage.toLowerCase().includes('kv')) {
            return numericVoltage >= 50;
        }
        
        return numericVoltage >= 50000;
    }

    /**
     * Get human-readable description of power infrastructure query
     */
    getPowerQueryDescription() {
        return `This query searches for:
• High-voltage transmission lines (≥50kV)
• Power transmission towers and poles
• Electrical substations and switching stations
• Power generation facilities (plants, generators)
• Transformation and distribution equipment
• Grid control infrastructure
• Underground power cables
• Construction projects for power infrastructure
• Administrative boundaries for geographic context`;
    }

    /**
     * Get statistics about query coverage
     */
    getQueryStats() {
        return {
            infrastructureTypes: 15,
            minimumVoltage: '50kV',
            includesConstruction: true,
            includesBoundaries: true,
            timeout: this.timeout,
            format: 'XML (for JOSM compatibility)',
            fallbackStatesAvailable: this.fallbackStates.length
        };
    }

    /**
     * Generate downloadable OSM data URL as alternative to JOSM
     */
    generateDownloadUrl(stateRelationId) {
        const query = this.generatePowerQuery(stateRelationId);
        const encodedQuery = encodeURIComponent(query);
        return `${this.baseUrl}?data=${encodedQuery}`;
    }
}

// Export for use in other modules
window.OverpassAPI = OverpassAPI;