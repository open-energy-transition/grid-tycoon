/**
 * Osmose Integration for Grid Tycoon v3.0
 *
 * Generates download URLs for Osmose API quality assurance issues for Indian territories.
 * Downloads GeoJSON files that can be loaded into JOSM or other mapping tools.
 *
 * Uses the format: india_territoryname* (e.g., india_maharashtra*, india_karnataka*)
 *
 * @version 3.0
 * @author Grid Tycoon Team
 */

// Common power-related Osmose issue types
const powerIssueTypes = [
  { item: 7040, class: 2, name: 'Unfinished Major Line' }
];

/**
 * Generate Osmose API URL for downloading issues
 * @param {string} territoryName - Name of the territory (e.g., "Maharashtra")
 * @param {string} isoCode - ISO 3166-2 code (e.g., "IN-MH")
 * @param {object} options - Optional parameters
 * @param {number} options.item - Osmose item number (defaults to 7040 - Unfinished Major Line)
 * @param {number} options.class - Osmose class number (defaults to 2)
 * @param {number} options.limit - Maximum number of issues to fetch (default: 5000)
 * @returns {string} URL to download Osmose issues as JSON
 */
function generateOsmoseDownloadUrl(territoryName, isoCode, options = {}) {
  console.log(`Generating Osmose download URL for ${territoryName} (${isoCode})`);

  // Normalize territory name: lowercase and replace spaces with underscores
  const normalizedTerritoryName = territoryName.toLowerCase().replace(/\s+/g, '_');

  // Use format: india_territoryname* (e.g., india_maharashtra*)
  const country = `india_${normalizedTerritoryName}*`;
  const limit = options.limit || 5000;

  console.log(`Using Osmose region: ${country}`);

  // Default to Unfinished Major Line (most common issue)
  const item = options.item || 7040;
  const classNum = options.class !== undefined ? options.class : 2;

  const apiUrl =
    `https://osmose.openstreetmap.fr/api/0.3/issues.geojson?` +
    `country=${encodeURIComponent(country)}` +
    `&item=${item}&class=${classNum}&limit=${limit}` +
    `&useDevItem=all`;

  console.log(`Generated Osmose URL: ${apiUrl}`);

  return apiUrl;
}

/**
 * Download Osmose issues for an Indian territory automatically
 * @param {string} territoryName - Name of the territory (e.g., "Maharashtra")
 * @param {string} isoCode - ISO 3166-2 code (e.g., "IN-MH")
 * @param {object} options - Optional parameters
 * @returns {Promise<object>} Result with download URL
 */
async function downloadOsmoseIssuesForTerritory(territoryName, isoCode, options = {}) {
  try {
    console.log(`Fetching Osmose issues for ${territoryName} (${isoCode})`);

    const downloadUrl = generateOsmoseDownloadUrl(territoryName, isoCode, options);

    // Create a safe filename: osmose_issues_india_territoryname.geojson
    const normalizedTerritoryName = territoryName.replace(/\s+/g, '_');
    const safeFileName = `osmose_issues_india_${normalizedTerritoryName}.geojson`;

    // Fetch the data from Osmose API
    const response = await fetch(downloadUrl);

    if (!response.ok) {
      throw new Error(`Osmose API returned ${response.status}: ${response.statusText}`);
    }

    // Get the JSON data as text
    const jsonText = await response.text();

    // Create a Blob from the JSON text
    const blob = new Blob([jsonText], { type: 'application/json' });

    // Create an object URL for the blob
    const blobUrl = URL.createObjectURL(blob);

    // Create a temporary anchor element to trigger download
    const link = document.createElement('a');
    link.href = blobUrl;
    link.download = safeFileName;
    link.style.display = 'none';

    // Append to body, click, and remove
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);

    // Clean up the blob URL after a short delay
    setTimeout(() => {
      URL.revokeObjectURL(blobUrl);
    }, 1000);

    console.log(`Download completed for ${safeFileName}`);

    return {
      success: true,
      data: {
        downloadUrl,
        fileName: safeFileName,
        territoryName,
        isoCode
      }
    };

  } catch (error) {
    console.error('Error downloading Osmose issues:', error);
    return {
      success: false,
      error: error.message
    };
  }
}

// Export for use in Grid Tycoon app
if (typeof window !== 'undefined') {
  window.downloadOsmoseIssuesForTerritory = downloadOsmoseIssuesForTerritory;
  window.generateOsmoseDownloadUrl = generateOsmoseDownloadUrl;
}

// Export for Node.js environments (optional)
if (typeof module !== 'undefined' && module.exports) {
  module.exports = { downloadOsmoseIssuesForTerritory, generateOsmoseDownloadUrl };
}
