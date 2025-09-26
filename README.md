# Grid Tycoon ⚡

**Master India's Power Infrastructure Network**

A collaborative web application for organizing and coordinating OpenStreetMap power infrastructure mapping sessions across Indian states and territories. Grid Tycoon gamifies the mapping process by organizing participants into specialized teams and providing structured workflows for comprehensive power grid documentation.

## Overview

Grid Tycoon transforms power infrastructure mapping from individual effort into coordinated team missions. The application divides India's 36 states and territories among teams of three mappers, each with specialized roles, and integrates with JOSM (Java OpenStreetMap Editor) for efficient data collection.

### Key Features

- **Team-Based Mapping**: Automatic formation of 3-person teams with specialized roles
- **Territory Assignment**: Systematic distribution of Indian states/territories to teams
- **JOSM Integration**: One-click loading of power infrastructure data into JOSM
- **Real-time Progress Tracking**: Live dashboards for coordinators and participants
- **ISO Code Support**: Reliable territory identification using standardized codes
- **Overpass API Integration**: Automated fetching of existing power infrastructure data

## Architecture

### Frontend
- **Vanilla JavaScript**: No framework dependencies for maximum compatibility
- **Responsive Design**: Works on desktop, tablet, and mobile devices
- **Progressive Enhancement**: Graceful degradation when services are unavailable

### Backend Services
- **Supabase**: PostgreSQL database with real-time features
- **Overpass API**: OpenStreetMap data querying for power infrastructure
- **JOSM Remote Control**: Direct integration with desktop mapping editor

### File Structure

```
├── index.html              # Main application interface
├── js/
│   ├── app.js             # Core application logic and UI management
│   ├── overpass.js        # OpenStreetMap Overpass API integration
│   └── supabase.js        # Database operations and team management
├── css/
│   └── styles.css         # Comprehensive styling and responsive design
└── sql/
    ├── schema.sql         # Database table definitions
    └── functions.sql      # Stored procedures for team operations
```

## Team Roles

Each team consists of three specialized roles:

### 🗺️ Pioneer
**Focus**: Traditional mapping and annotation
- Maps basic power infrastructure elements
- Adds geometric representation of power lines and substations
- Ensures comprehensive coverage of assigned territory

### ⚡ Technician  
**Focus**: Technical accuracy and asset naming
- Verifies and corrects power infrastructure tags
- Adds missing voltage information
- Ensures technical standards compliance

### 🔍 Seeker
**Focus**: Discovery and verification
- Identifies missing power plants and major infrastructure
- Researches credible information sources
- Validates industrial connections and major facilities

## Setup Instructions

### Prerequisites

- Modern web browser (Chrome, Firefox, Safari, Edge)
- [JOSM](https://josm.openstreetmap.de/) installed for mapping participants
- [Supabase](https://supabase.com) account for database hosting

### Database Setup

1. **Create Supabase Project**
   ```bash
   # Create new project at https://supabase.com/dashboard
   # Note your project URL and anon key
   ```

2. **Initialize Database Schema**
   ```sql
   -- Run the contents of sql/schema.sql in your Supabase SQL editor
   -- This creates all necessary tables and relationships
   ```

3. **Install Database Functions**
   ```sql
   -- Run the contents of sql/functions.sql
   -- This adds stored procedures for team management
   ```

### Application Configuration

1. **Update Configuration**
   Edit the configuration section in `index.html`:
   ```javascript
   window.GRID_TYCOON_CONFIG = {
       database: {
           url: 'YOUR_SUPABASE_PROJECT_URL',
           anonKey: 'YOUR_SUPABASE_ANON_KEY'
       },
       overpass: {
           servers: [
               'https://overpass-api.de/api/interpreter',
               'https://overpass.kumi.systems/api/interpreter'
           ],
           timeout: 1800
       },
       app: {
           mockMode: false,  // Set to true for testing without database
           debugMode: false,
           fallbackToIndividualMode: true
       }
   };
   ```

2. **Deploy Application**
   - Upload files to web hosting service
   - Or run locally with a simple HTTP server:
   ```bash
   # Python 3
   python -m http.server 8000
   
   # Node.js (with http-server installed)
   npx http-server
   
   # PHP
   php -S localhost:8000
   ```

## Usage Guide

### For Coordinators

1. **Session Creation**
   - Access application with session ID ending in `-COORD` or `-ADMIN`
   - Example: `GRID2025-COORD`

2. **Participant Management**  
   - Monitor participant registration in real-time
   - View detailed participant information and team readiness

3. **Team Formation**
   - Automatic team creation when participant count is divisible by 3
   - Each team gets balanced role assignments (Pioneer, Technician, Seeker)

4. **Territory Distribution**
   - One-click setup distributes all 36 Indian territories among teams
   - Ensures balanced workload across teams
   - Territories include states, union territories, and special regions

5. **Progress Monitoring**
   - Real-time dashboard shows completion status
   - Team leaderboards and performance metrics
   - Individual territory status tracking

### For Participants

1. **Registration**
   - Enter first name, OSM username, and session ID
   - Automatic team assignment upon team formation

2. **Role Assignment**
   - Receive specialized role with specific responsibilities
   - Access role-specific guidance and best practices

3. **Territory Mapping**
   - View assigned territories in mapping interface
   - One-click JOSM loading with pre-configured power infrastructure queries
   - Territory status management (Available → In Progress → Completed)

### JOSM Integration

The application generates specialized Overpass queries for each territory:

**Included Infrastructure Types:**
- Power transmission lines and cables
- Electrical substations and switching stations  
- Power generation facilities (plants, generators)
- Transmission towers and distribution poles
- Transformers and switching equipment
- Grid control infrastructure

**JOSM Workflow:**
1. Click "Load in JOSM" for assigned territory
2. JOSM opens with territory boundary and existing power infrastructure
3. Use standard JOSM tools to add missing infrastructure
4. Upload changes to OpenStreetMap
5. Mark territory as completed in Grid Tycoon

## Territory Coverage

Grid Tycoon covers all 36 Indian administrative regions:

**States (28):** Andhra Pradesh, Arunachal Pradesh, Assam, Bihar, Chhattisgarh, Goa, Gujarat, Haryana, Himachal Pradesh, Jharkhand, Karnataka, Kerala, Madhya Pradesh, Maharashtra, Manipur, Meghalaya, Mizoram, Nagaland, Odisha, Punjab, Rajasthan, Sikkim, Tamil Nadu, Telangana, Tripura, Uttar Pradesh, Uttarakhand, West Bengal

**Union Territories (8):** Andaman and Nicobar Islands, Chandigarh, Dadra and Nagar Haveli and Daman and Diu, Delhi, Jammu and Kashmir, Ladakh, Lakshadweep, Puducherry

## Technical Details

### Overpass API Queries

The application generates comprehensive power infrastructure queries using ISO codes for reliable territory identification:

```overpass
[out:xml][timeout:1800];

// Territory lookup by ISO code (e.g., IN-MH for Maharashtra)
(relation["ISO3166-2"="IN-MH"];)->.territory;
.territory map_to_area ->.searchArea;

// Power infrastructure within territory
(
  node["power"="tower"](area.searchArea);
  way["power"="line"](area.searchArea);
  node["power"="substation"](area.searchArea);
  way["power"="substation"](area.searchArea);
  // ... additional power infrastructure types
);

out meta;
```

### Database Schema

**Core Tables:**
- `sessions`: Mapping session management
- `participants`: User registration and profiles  
- `teams`: Team formation and metadata
- `team_members`: Role assignments and team composition
- `indian_territories`: Geographic territory definitions
- `team_territories`: Territory assignments and progress tracking

### API Endpoints

**Supabase RPC Functions:**
- `create_teams_with_role_assignment()`: Automated team formation
- `distribute_territories_to_teams()`: Territory distribution algorithm
- `get_session_progress_overview()`: Real-time progress statistics
- `update_territory_assignment_status()`: Progress tracking

## Configuration Options

### Mock Mode
Enable for testing without database connection:
```javascript
app: {
    mockMode: true  // Simulates team assignment and territory data
}
```

### Overpass API Servers
Configure multiple servers for reliability:
```javascript
overpass: {
    servers: [
        'https://overpass-api.de/api/interpreter',
        'https://overpass.kumi.systems/api/interpreter',
        'https://overpass.openstreetmap.fr/api/interpreter'
    ],
    timeout: 1800  // Query timeout in seconds
}
```

## Troubleshooting

### Common Issues

**Database Connection Fails**
- Verify Supabase URL and anon key in configuration
- Check that database tables exist (run schema.sql)
- Ensure anon role has appropriate permissions

**JOSM Integration Not Working**
- Verify JOSM is running with Remote Control enabled
- Check JOSM Preferences → Remote Control → Enable remote control
- Ensure port 8111 is not blocked by firewall

**Team Formation Fails** 
- Participant count must be divisible by 3
- Each team requires exactly 3 members
- Check for duplicate OSM usernames in session

**Territory Loading Slow**
- Overpass API may be experiencing high load
- Application automatically retries with different servers
- Some territories may have limited power infrastructure data

### Debug Mode
Enable detailed logging:
```javascript
app: {
    debugMode: true  // Enables console logging for troubleshooting
}
```

## Contributing

Grid Tycoon is designed for OpenStreetMap mapping events and educational workshops. The codebase uses vanilla JavaScript for maximum compatibility and ease of modification.

**Development Guidelines:**
- Maintain compatibility with modern browsers (ES2018+)
- Preserve offline fallback capabilities
- Follow existing code organization patterns
- Test with both mock mode and live database

## License

This project is designed for OpenStreetMap community use. Please respect OpenStreetMap data licenses and contributor guidelines when using this tool for mapping activities.

---

**Grid Tycoon** - Empowering collaborative mapping of India's power infrastructure through teamwork, technology, and structured coordination.