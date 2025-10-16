/**
 * JOSM Integration Module for Grid Tycoon v3.0
 *
 * Handles communication with JOSM (Java OpenStreetMap Editor) via Remote Control API
 * Provides methods for loading OSM data, imagery, and managing JOSM connections
 *
 * @version 3.0
 * @requires None (uses native fetch API)
 * @author Grid Tycoon Team
 */

class JOSMIntegration {
    constructor(config = {}) {
        // JOSM Remote Control configuration
        this.josmHost = config.host || 'localhost';
        this.josmPort = config.port || 8111;
        this.timeout = config.timeout || 5000;

        // Imagery sources configuration
        this.imagerySources = config.imagerySources || [
            { id: 'Mapbox', name: 'Mapbox Satellite' },
            { id: 'Bing', name: 'Bing Aerial Imagery' },
            { id: 'EsriWorldImagery', name: 'Esri World Imagery' }
        ];

        // Overpass API servers
        this.overpassServers = config.overpassServers || [
            'https://overpass-api.de/api/interpreter',
            'https://overpass.kumi.systems/api/interpreter',
            'https://overpass.openstreetmap.fr/api/interpreter'
        ];

        // Default changeset tags for OSM edits
        this.defaultChangesetTags = {
            comment: '#mapyourgrid'
        };

        // Connection state tracking
        this.lastConnectionCheck = null;
        this.isConnected = false;

        console.log('JOSM Integration initialized', {
            host: this.josmHost,
            port: this.josmPort,
            imagerySources: this.imagerySources.length
        });
    }

    // ================================
    // DATA LOADING METHODS
    // ================================

    /**
     * Load Overpass query data into JOSM
     * @param {string} overpassQuery - Overpass QL query string
     * @param {string} layerName - Name for the JOSM layer
     * @param {object} options - Additional options
     * @returns {Promise<{success: boolean, details?: object, error?: string}>}
     */
    async loadOverpassData(overpassQuery, layerName, options = {}) {
        try {
            console.log(`Loading Overpass data into JOSM: ${layerName}`);

            if (!overpassQuery || !layerName) {
                throw new Error('Query and layer name are required');
            }

            const encodedQuery = encodeURIComponent(overpassQuery);
            const overpassServer = options.overpassServer || this.overpassServers[0];
            const overpassUrl = `${overpassServer}?data=${encodedQuery}`;

            const changesetTags = this.buildChangesetTags(options.changesetTags);

            const josmUrl = this.buildJOSMUrl('import', {
                new_layer: true,
                layer_name: encodeURIComponent(layerName),
                changeset_tags: changesetTags,
                url: overpassUrl
            });

            await this.sendJOSMCommand(josmUrl, this.timeout);

            console.log('✅ Data loaded successfully into JOSM');

            if (options.loadImagery !== false) {
                console.log('Loading imagery layers...');
                await this.loadImageryLayers();
            }

            return {
                success: true,
                details: {
                    layerName,
                    overpassServer,
                    imageryLoaded: options.loadImagery !== false
                }
            };

        } catch (error) {
            console.error('JOSM load failed:', error);
            return {
                success: false,
                error: this.getUserFriendlyError(error)
            };
        }
    }

    /**
     * Load GeoJSON URL into JOSM
     * @param {string} geojsonUrl - URL to GeoJSON file
     * @param {string} layerName - Name for the JOSM layer
     * @param {object} options - Additional options
     * @returns {Promise<{success: boolean, error?: string}>}
     */
    async loadGeoJSONUrl(geojsonUrl, layerName, options = {}) {
        try {
            console.log(`Loading GeoJSON into JOSM: ${layerName}`);

            if (!geojsonUrl || !layerName) {
                throw new Error('GeoJSON URL and layer name are required');
            }

            const josmUrl = this.buildJOSMUrl('import', {
                new_layer: true,
                layer_name: encodeURIComponent(layerName),
                url: encodeURIComponent(geojsonUrl)
            });

            await this.sendJOSMCommand(josmUrl);

            console.log('✅ GeoJSON loaded successfully into JOSM');

            if (options.loadImagery) {
                await this.loadImageryLayers();
            }

            return { success: true };

        } catch (error) {
            console.error('GeoJSON load failed:', error);
            return {
                success: false,
                error: this.getUserFriendlyError(error)
            };
        }
    }

    /**
     * Load bounding box into JOSM
     * @param {object} bounds - Bounding box coordinates
     * @param {string} layerName - Name for the JOSM layer
     * @returns {Promise<{success: boolean, error?: string}>}
     */
    async loadBoundingBox(bounds, layerName) {
        try {
            console.log('Loading bounding box into JOSM:', bounds);

            if (!bounds.minLat || !bounds.minLon || !bounds.maxLat || !bounds.maxLon) {
                throw new Error('Complete bounding box coordinates required');
            }

            const josmUrl = this.buildJOSMUrl('load_and_zoom', {
                left: bounds.minLon,
                bottom: bounds.minLat,
                right: bounds.maxLon,
                top: bounds.maxLat,
                new_layer: true,
                layer_name: encodeURIComponent(layerName)
            });

            await this.sendJOSMCommand(josmUrl);

            console.log('✅ Bounding box loaded into JOSM');
            return { success: true };

        } catch (error) {
            console.error('Bounding box load failed:', error);
            return {
                success: false,
                error: this.getUserFriendlyError(error)
            };
        }
    }

    // ================================
    // IMAGERY MANAGEMENT
    // ================================

    /**
     * Load all configured imagery layers into JOSM
     * @returns {Promise<{success: boolean, loaded: Array, failed: Array}>}
     */
    async loadImageryLayers() {
        console.log(`Loading ${this.imagerySources.length} imagery layers...`);

        const results = {
            loaded: [],
            failed: []
        };

        for (const source of this.imagerySources) {
            try {
                const url = this.buildJOSMUrl('imagery', { id: source.id });
                await this.sendJOSMCommand(url, 1000);

                console.log(`✅ Loaded imagery: ${source.name}`);
                results.loaded.push(source.name);

                await this.delay(200);

            } catch (error) {
                console.warn(`⚠️ Failed to load imagery ${source.name}:`, error.message);
                results.failed.push(source.name);
            }
        }

        console.log('Imagery loading complete:', {
            loaded: results.loaded.length,
            failed: results.failed.length
        });

        return {
            success: true,
            ...results
        };
    }

    /**
     * Add custom imagery layer to JOSM
     * @param {string} imageryId - Imagery source ID
     * @param {string} imageryName - Optional display name
     * @returns {Promise<{success: boolean, error?: string}>}
     */
    async addCustomImagery(imageryId, imageryName = null) {
        try {
            console.log(`Adding custom imagery: ${imageryName || imageryId}`);

            const url = this.buildJOSMUrl('imagery', { id: imageryId });
            await this.sendJOSMCommand(url);

            console.log(`✅ Added custom imagery: ${imageryName || imageryId}`);
            return { success: true };

        } catch (error) {
            console.error('Custom imagery load failed:', error);
            return {
                success: false,
                error: this.getUserFriendlyError(error)
            };
        }
    }

    // ================================
    // CONNECTION MANAGEMENT
    // ================================

    /**
     * Check if JOSM is running and Remote Control is enabled
     * @param {boolean} forceCheck - Force fresh check, ignore cache
     * @returns {Promise<{running: boolean, remoteControlEnabled: boolean, version?: string, error?: string}>}
     */
    async checkJOSMStatus(forceCheck = false) {
        try {
            const now = Date.now();
            if (!forceCheck && this.lastConnectionCheck && (now - this.lastConnectionCheck < 30000)) {
                console.log('Using cached JOSM status');
                return {
                    running: this.isConnected,
                    remoteControlEnabled: this.isConnected,
                    cached: true
                };
            }

            console.log('Checking JOSM status...');

            const url = this.buildJOSMUrl('version');

            const controller = new AbortController();
            const timeoutId = setTimeout(() => controller.abort(), 2000);

            try {
                const response = await fetch(url, {
                    method: 'GET',
                    signal: controller.signal
                });

                clearTimeout(timeoutId);

                if (response.ok) {
                    const version = await response.text();
                    const versionClean = version.trim();

                    console.log(`✅ JOSM detected: ${versionClean}`);

                    this.isConnected = true;
                    this.lastConnectionCheck = now;

                    return {
                        running: true,
                        remoteControlEnabled: true,
                        version: versionClean
                    };
                }
            } catch (fetchError) {
                clearTimeout(timeoutId);
                throw fetchError;
            }

            console.warn('JOSM responded but status not ok');
            this.isConnected = false;
            this.lastConnectionCheck = now;

            return {
                running: false,
                remoteControlEnabled: false,
                error: 'JOSM responded with error status'
            };

        } catch (error) {
            console.warn('JOSM not detected:', error.message);

            this.isConnected = false;
            this.lastConnectionCheck = Date.now();

            return {
                running: false,
                remoteControlEnabled: false,
                error: error.message
            };
        }
    }

    /**
     * Simple check if JOSM is available
     * @returns {Promise<boolean>}
     */
    async isJOSMAvailable() {
        const status = await this.checkJOSMStatus(false);
        return status.running && status.remoteControlEnabled;
    }

    /**
     * Reset connection cache (force next check to be fresh)
     */
    resetConnectionCache() {
        this.lastConnectionCheck = null;
        this.isConnected = false;
        console.log('JOSM connection cache reset');
    }

    // ================================
    // URL BUILDING AND COMMUNICATION
    // ================================

    /**
     * Build JOSM Remote Control URL
     * @private
     * @param {string} command - JOSM command (e.g., 'import', 'load_and_zoom')
     * @param {object} params - Query parameters
     * @returns {string} Complete JOSM URL
     */
    buildJOSMUrl(command, params = {}) {
        const baseUrl = `http://${this.josmHost}:${this.josmPort}/${command}`;

        const queryString = Object.entries(params)
            .map(([key, value]) => `${key}=${value}`)
            .join('&');

        return queryString ? `${baseUrl}?${queryString}` : baseUrl;
    }

    /**
     * Send command to JOSM via iframe (cross-origin safe method)
     * @private
     * @param {string} url - Complete JOSM URL
     * @param {number} timeout - Timeout in milliseconds
     * @returns {Promise<void>}
     */
    async sendJOSMCommand(url, timeout = this.timeout) {
        return new Promise((resolve, reject) => {
            const iframe = document.createElement('iframe');
            iframe.style.display = 'none';
            iframe.style.width = '0';
            iframe.style.height = '0';
            iframe.src = url;

            let timeoutId;
            let resolved = false;

            const cleanup = () => {
                clearTimeout(timeoutId);
                if (iframe.parentNode) {
                    try {
                        document.body.removeChild(iframe);
                    } catch (e) {
                        // Ignore cleanup errors
                    }
                }
            };

            iframe.onload = () => {
                if (!resolved) {
                    resolved = true;
                    cleanup();
                    resolve();
                }
            };

            iframe.onerror = () => {
                if (!resolved) {
                    resolved = true;
                    cleanup();
                    reject(new Error('JOSM command failed - check if JOSM is running and Remote Control is enabled'));
                }
            };

            timeoutId = setTimeout(() => {
                if (!resolved) {
                    resolved = true;
                    cleanup();
                    resolve();
                }
            }, timeout);

            try {
                document.body.appendChild(iframe);
            } catch (error) {
                cleanup();
                reject(new Error('Failed to create iframe for JOSM communication'));
            }
        });
    }

    /**
     * Build changeset tags string for JOSM
     * @private
     * @param {object} customTags - Custom tags to merge with defaults
     * @returns {string} Encoded changeset tags string
     */
    buildChangesetTags(customTags = {}) {
        const allTags = { ...this.defaultChangesetTags, ...customTags };

        return Object.entries(allTags)
            .map(([key, value]) => `${key}=${encodeURIComponent(value)}`)
            .join(';');
    }

    // ================================
    // RETRY AND VALIDATION
    // ================================

    /**
     * Load data with automatic retry on failure
     * @param {string} overpassQuery - Overpass QL query
     * @param {string} layerName - Layer name
     * @param {object} options - Options including maxRetries, retryDelay
     * @returns {Promise<{success: boolean, error?: string, attempts: number}>}
     */
    async loadWithRetry(overpassQuery, layerName, options = {}) {
        const maxRetries = options.maxRetries || 2;
        const retryDelay = options.retryDelay || 2000;

        let lastError = null;

        for (let attempt = 1; attempt <= maxRetries; attempt++) {
            console.log(`Load attempt ${attempt}/${maxRetries}`);

            const result = await this.loadOverpassData(overpassQuery, layerName, options);

            if (result.success) {
                return { ...result, attempts: attempt };
            }

            lastError = result.error;

            if (result.error && result.error.includes('not running')) {
                console.log('JOSM not running - no point retrying');
                break;
            }

            if (attempt < maxRetries) {
                console.log(`Waiting ${retryDelay}ms before retry...`);
                await this.delay(retryDelay);
            }
        }

        return {
            success: false,
            error: lastError || 'All retry attempts failed',
            attempts: maxRetries
        };
    }

    /**
     * Validate Overpass query syntax
     * @param {string} query - Overpass QL query to validate
     * @returns {{valid: boolean, issues?: Array<string>, warnings?: Array<string>}}
     */
    validateOverpassQuery(query) {
        const issues = [];

        if (!query || typeof query !== 'string') {
            return { valid: false, issues: ['Query is empty or not a string'] };
        }

        if (query.length < 10) {
            issues.push('Query seems too short');
        }

        if (!query.includes('out')) {
            issues.push('Query missing output statement (out)');
        }

        const hasArea = query.includes('area') || query.includes('rel') || query.includes('way') || query.includes('node');
        if (!hasArea) {
            issues.push('Query missing area/element selector');
        }

        return {
            valid: issues.length === 0,
            issues: issues.length > 0 ? issues : null,
            warnings: issues.length === 0 && query.length > 5000 ? ['Query is very large'] : null
        };
    }

    // ================================
    // ERROR HANDLING AND UTILITIES
    // ================================

    /**
     * Convert technical errors to user-friendly messages
     * @private
     * @param {Error} error - Error object
     * @returns {string} User-friendly error message
     */
    getUserFriendlyError(error) {
        const errorMessages = {
            'Failed to fetch': 'JOSM is not running or Remote Control is not enabled',
            'NetworkError': 'Cannot connect to JOSM. Is it running?',
            'TimeoutError': 'JOSM took too long to respond',
            'AbortError': 'Connection to JOSM was cancelled',
            'The operation was aborted': 'Connection to JOSM timed out'
        };

        for (const [pattern, message] of Object.entries(errorMessages)) {
            if (error.message && error.message.includes(pattern)) {
                return message;
            }
        }

        return error.message || 'Unknown JOSM error occurred';
    }

    /**
     * Simple delay utility
     * @private
     * @param {number} ms - Milliseconds to delay
     * @returns {Promise<void>}
     */
    async delay(ms) {
        return new Promise(resolve => setTimeout(resolve, ms));
    }

    // ================================
    // CONFIGURATION AND STATUS
    // ================================

    /**
     * Reconfigure JOSM integration settings
     * @param {object} settings - New settings to apply
     */
    configure(settings = {}) {
        if (settings.host !== undefined) this.josmHost = settings.host;
        if (settings.port !== undefined) this.josmPort = settings.port;
        if (settings.timeout !== undefined) this.timeout = settings.timeout;
        if (settings.imagerySources !== undefined) this.imagerySources = settings.imagerySources;
        if (settings.overpassServers !== undefined) this.overpassServers = settings.overpassServers;
        if (settings.defaultChangesetTags !== undefined) {
            this.defaultChangesetTags = { ...this.defaultChangesetTags, ...settings.defaultChangesetTags };
        }

        this.lastConnectionCheck = null;
        this.isConnected = false;

        console.log('JOSM integration reconfigured');
    }

    /**
     * Get current configuration
     * @returns {object} Current configuration settings
     */
    getConfig() {
        return {
            host: this.josmHost,
            port: this.josmPort,
            timeout: this.timeout,
            imagerySources: this.imagerySources,
            overpassServers: this.overpassServers,
            defaultChangesetTags: this.defaultChangesetTags,
            isConnected: this.isConnected,
            lastCheck: this.lastConnectionCheck
        };
    }

    /**
     * Get integration statistics and status
     * @returns {object} Statistics and status information
     */
    getStats() {
        return {
            isConnected: this.isConnected,
            lastConnectionCheck: this.lastConnectionCheck,
            lastCheckAge: this.lastConnectionCheck ? Date.now() - this.lastConnectionCheck : null,
            configuration: {
                host: this.josmHost,
                port: this.josmPort,
                timeout: this.timeout,
                imagerySourcesCount: this.imagerySources.length,
                overpassServersCount: this.overpassServers.length
            }
        };
    }
}

// Export for global use
if (typeof window !== 'undefined') {
    window.JOSMIntegration = JOSMIntegration;
}

// Export for Node.js environments (optional)
if (typeof module !== 'undefined' && module.exports) {
    module.exports = JOSMIntegration;
}
