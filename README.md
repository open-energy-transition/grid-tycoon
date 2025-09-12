# ⚡ Grid Tycoon - Multi-Country Power Infrastructure Team Competition

**Master Global Power Grid Networks Through Competitive Team-Based OpenStreetMap Editing**

Grid Tycoon is an innovative web-based competitive game that transforms power infrastructure mapping into an engaging team sport. Two teams compete to map high-voltage electrical networks across major countries using professional OpenStreetMap tools, creating a systematic and motivating approach to critical infrastructure documentation.

## 🌍 Supported Countries

Grid Tycoon supports power infrastructure mapping across five major countries:

| Country | Flag | Territories | Admin Level |
|---------|------|-------------|-------------|
| **Brazil** | 🇧🇷 | 27 States + Federal District | 4 |
| **India** | 🇮🇳 | 28 States + 8 Union Territories | 4 |
| **Canada** | 🇨🇦 | 10 Provinces + 3 Territories | 4 |
| **United States** | 🇺🇸 | 50 States + DC + Territories | 4 |
| **Australia** | 🇦🇺 | 6 States + 2 Territories | 4 |

## 🎮 Team Competition Overview

### 🏆 Game Format
- **Two Teams**: Blue Lightning ⚡ vs Green Thunder 🌿
- **Random Assignment**: Territories distributed evenly between teams
- **Alternating Turns**: Teams take turns selecting and conquering territories
- **Victory Condition**: First team to complete all their assigned territories wins
- **Professional Tools**: Real JOSM integration for serious cartographic work

### ⚡ What Gets Mapped
- **High-Voltage Transmission**: ≥50kV power lines and infrastructure
- **Power Generation**: Plants, generators, renewable facilities
- **Grid Infrastructure**: Substations, transformers, switching stations
- **Support Systems**: Towers, poles, underground cables
- **Future Development**: Under-construction power projects

## 🚀 Core Features

### 🌐 Multi-Country Support
- **Dynamic Territory Discovery**: Real-time fetching of administrative boundaries
- **Country-Specific Configuration**: Adapted queries for different administrative systems
- **Flexible Architecture**: Easy to extend to additional countries

### 👥 Team Competition System
- **Balanced Teams**: Automatic random distribution of territories
- **Visual Team Tracking**: Color-coded progress bars and territory grids
- **Turn-Based Gameplay**: Clear alternating team structure
- **Competitive Motivation**: Team vs team conquest dynamics

### 🛠️ Professional Integration
- **JOSM Layer Management**: Each territory loads as a named layer
- **Overpass API Optimization**: Efficient real-time data queries
- **Professional Workflows**: Seamless integration with standard OSM tools
- **Quality Infrastructure Focus**: Targets transmission-level power systems

## 📋 Prerequisites

### Required Software
1. **JOSM (Java OpenStreetMap Editor)**
   - Download: https://josm.openstreetmap.de/
   - Version: Latest stable release recommended
   - Platforms: Windows, macOS, Linux

2. **Modern Web Browser**
   - Chrome/Chromium 90+
   - Firefox 88+
   - Safari 14+
   - Edge 90+

### JOSM Configuration
Enable Remote Control in JOSM:
1. Open JOSM → Preferences (F12)
2. Navigate to "Remote Control" section
3. ✅ Check "Enable remote control"
4. Ensure port is set to `8111` (default)
5. ✅ Check "Load data from API" (recommended)
6. Click "OK" and restart JOSM

## 🎯 How to Play

### Step 1: Country Selection & Team Setup
1. Launch Grid Tycoon in your web browser
2. Select your target country from the dropdown (Brazil, India, Canada, US, Australia)
3. Click **"📡 Discover Territory Network"**
4. Wait for automatic territory discovery and team assignment
5. Review your Blue Lightning ⚡ and Green Thunder 🌿 team rosters

### Step 2: Team Competition
1. **Blue Lightning starts first** - click **"🎲 Draw Team Territory"**
2. Review the selected territory information and mission details
3. Click **"📡 Deploy to JOSM Grid"** to load power infrastructure data
4. **Switch to JOSM** - find your new named layer (e.g., "Canada - Ontario - Power Grid")
5. **Map the electrical infrastructure** using professional OSM editing techniques
6. **Return to Grid Tycoon** - click **"✅ Mark Territory Complete"**
7. **Green Thunder's turn** - repeat the process
8. **Continue alternating** until one team conquers all their territories

### Step 3: Victory & Championship
- **Monitor team progress** via dual progress bars
- **Celebrate victories** as territories are conquered
- **Achieve championship** when your team completes all assigned territories
- **Start new campaigns** by selecting different countries

## 🔧 Technical Architecture

### Frontend Technologies
- **HTML5**: Semantic structure and WCAG accessibility compliance
- **CSS3**: Advanced animations, responsive grid systems, team color theming
- **ES6+ JavaScript**: Class-based architecture with async/await patterns
- **Responsive Design**: Mobile-first approach with desktop enhancements

### Backend Integration
- **Overpass API**: Real-time OpenStreetMap administrative boundary queries
- **JOSM Remote Control**: HTTP-based professional editor integration
- **Layer Management**: Automatic JOSM layer naming and organization
- **Error Handling**: Comprehensive network failure recovery

### Country-Specific Query Architecture

```javascript
// Multi-country administrative boundary discovery
area["name:en"="${config.osmName}"]["admin_level"="2"]->.country;
relation["boundary"="administrative"]["admin_level"="${config.adminLevel}"](area.country);

// High-voltage power infrastructure extraction
relation(${territoryId}) -> territory;
way["power"="line"]["voltage"~"^([5-9][0-9]{4}|[1-9][0-9]{5,})$"](area.territory);
node["power"="substation"](area.territory);
// ... comprehensive infrastructure queries
```

## ⚙️ Advanced Configuration

### Voltage Classification System
```regex
≥50kV Lines: ^([5-9][0-9]{4}|[1-9][0-9]{5,})$
Includes: 50kV, 66kV, 110kV, 220kV, 400kV, 500kV, 765kV, etc.
Excludes: Distribution networks (<50kV)
```

### Infrastructure Categories Mapped
- **Transmission Networks**: High-voltage lines, cables, towers, poles
- **Generation Facilities**: Power plants, wind farms, solar installations
- **Grid Control Systems**: Substations, transformers, switching stations
- **Support Infrastructure**: Portals, switches, monitoring equipment
- **Development Pipeline**: Under-construction power projects

### JOSM Layer Naming Convention
```
Format: "{Country} - {Territory} - Power Grid"
Examples:
- "Brazil - São Paulo - Power Grid"
- "India - Maharashtra - Power Grid"  
- "Canada - Ontario - Power Grid"
- "United States - California - Power Grid"
- "Australia - New South Wales - Power Grid"
```

## 🌍 Country-Specific Details

### Brazil 🇧🇷
- **Territories**: 26 States + Federal District (27 total)
- **Notable**: Large renewable energy infrastructure
- **Grid Focus**: Hydroelectric transmission networks

### India 🇮🇳
- **Territories**: 28 States + 8 Union Territories (36+ total)
- **Notable**: Rapidly expanding solar and wind infrastructure
- **Grid Focus**: Inter-state transmission corridors

### Canada 🇨🇦
- **Territories**: 10 Provinces + 3 Territories (13 total)
- **Notable**: Extensive hydroelectric networks
- **Grid Focus**: Long-distance transmission lines

### United States 🇺🇸
- **Territories**: 50 States + DC + Territories (53+ total)
- **Notable**: Complex regional transmission organizations
- **Grid Focus**: Interstate power markets and connections

### Australia 🇦🇺
- **Territories**: 6 States + 2 Territories (8 total)
- **Notable**: Isolated grids and renewable energy zones
- **Grid Focus**: National electricity market connections

## 🛠️ Development & Customization

### Local Development Environment
```bash
# Clone repository
git clone [repository-url]
cd grid-tycoon

# Serve locally (various options)
# Python
python -m http.server 8000

# Node.js (with live-server)
npx live-server --port=8000

# PHP
php -S localhost:8000

# Access application
open http://localhost:8000
```

### Adding New Countries
```javascript
// 1. Add country configuration
const newCountryConfig = {
    'New Country': {
        osmName: 'OSM Name',
        adminLevel: '4', // or appropriate level
        territoryType: 'states/provinces/regions'
    }
};

// 2. Add to country dropdown in HTML
<option value="New Country">🏁 New Country</option>

// 3. Test territory discovery and power queries
```

### Customization Options
- **Team Colors**: Modify CSS variables for different color schemes
- **Infrastructure Types**: Add/remove power infrastructure categories
- **Voltage Thresholds**: Adjust regex patterns for different voltage levels
- **Territory Types**: Support different administrative levels
- **UI Themes**: Custom branding and visual styles

## 🔍 Troubleshooting Guide

### Common Issues & Solutions

#### "JOSM deployment failed"
**Symptoms**: Error message when clicking "Deploy to JOSM Grid"
**Solutions**:
- Verify JOSM is running and responsive
- Check Remote Control is enabled: Preferences → Remote Control
- Ensure port 8111 is not blocked by firewall
- Try restarting JOSM and Grid Tycoon

#### "No territories discovered" 
**Symptoms**: Empty results after country selection
**Solutions**:
- Check internet connection stability
- Try different country selection
- Verify Overpass API status: https://overpass-api.de/api/status
- Wait 2-3 minutes and retry (server may be busy)

#### "Teams not balanced correctly"
**Symptoms**: Uneven territory distribution between teams
**Solutions**:
- This is normal for countries with odd numbers of territories
- Blue team gets extra territory if total is odd
- Reset game to get new random distribution

#### "JOSM layer not appearing"
**Symptoms**: Data loads but no named layer visible
**Solutions**:
- Check JOSM layer panel (right side)
- Look for layer named "{Country} - {Territory} - Power Grid"
- Ensure "Load data from API" is enabled in JOSM preferences
- Try zooming to layer extent in JOSM

### Performance Optimization

#### Large Country Handling
- **Memory Management**: JOSM may require increased heap size for large territories
- **Query Timeouts**: Overpass queries automatically timeout after 5 minutes
- **Network Stability**: Ensure stable internet for large data transfers
- **Browser Resources**: Close unnecessary tabs when handling large datasets

#### Network Requirements
- **Internet Connection**: Stable broadband recommended for large territories
- **JOSM Communication**: Local HTTP connection to port 8111
- **CORS Compliance**: Modern browser with proper CORS support
- **API Rate Limits**: Overpass API has usage limits - avoid rapid repeated queries

## 📊 Data Sources & Attribution

### OpenStreetMap Integration
- **Primary Source**: OpenStreetMap Contributors
- **License**: Open Database License (ODbL) 
- **Attribution**: © OpenStreetMap contributors
- **API Provider**: Overpass API (overpass-api.de)
- **Data Quality**: Community-verified, continuously updated

### Administrative Boundaries
- **Boundary Data**: OSM administrative relations (admin_level=2,4)
- **Update Frequency**: Real-time boundary changes reflected automatically
- **Accuracy**: Crowd-sourced verification with government data sources
- **Coverage**: Global administrative hierarchy support

### Power Infrastructure Data
- **Infrastructure Source**: OpenStreetMap power infrastructure tags
- **Classification**: Community-maintained power system taxonomy
- **Voltage Standards**: International electrical standards compliance
- **Update Mechanism**: Real-time infrastructure changes via OSM editing

## 🤝 Contributing to Grid Tycoon

### Ways to Contribute
1. **Feature Development**: Implement new countries, game modes, or UI improvements
2. **Bug Reports**: Submit detailed issues via GitHub issue tracker
3. **Documentation**: Improve setup guides, troubleshooting, or country-specific notes
4. **Testing**: Validate functionality across browsers, JOSM versions, and countries
5. **Translation**: Add multi-language support for international users
6. **Power Infrastructure Mapping**: Contribute actual OSM data in your region

### Development Guidelines
- **Code Standards**: ES6+ JavaScript, semantic HTML5, CSS3 with fallbacks
- **Accessibility**: WCAG 2.1 AA compliance for inclusive design
- **Performance**: Optimize for mobile devices and slower networks
- **Documentation**: JSDoc comments for complex functions
- **Testing**: Cross-browser compatibility testing required

### Country Addition Process
1. **Research**: Verify OSM administrative boundary completeness
2. **Configuration**: Add country config with correct admin levels
3. **Testing**: Validate territory discovery and team balancing
4. **Power Query Testing**: Ensure power infrastructure queries return data
5. **Documentation**: Add country-specific notes and territory counts
6. **Pull Request**: Submit with test results and screenshots

## 📜 Legal & Licensing

### Software License
Grid Tycoon is released under the **MIT License**:
- ✅ Commercial use permitted
- ✅ Modification and distribution allowed  
- ✅ Private use encouraged
- ✅ Patent use protection
- ❗ No warranty or liability provided

### Data Licensing & Compliance
- **OpenStreetMap Data**: Open Database License (ODbL)
- **Derived Works**: Must maintain ODbL attribution
- **Commercial Use**: Permitted with proper OSM attribution
- **Data Export**: JOSM exports maintain OSM licensing requirements

### Third-Party Dependencies
- **Overpass API**: Community-provided service (check availability)
- **JOSM Software**: GPL v2+ license
- **Browser APIs**: Standard web platform APIs
- **No External Libraries**: Pure vanilla JavaScript implementation

### Privacy & Data Handling
- **No User Tracking**: No analytics, cookies, or user identification
- **No Data Storage**: No persistent user data or mapping progress storage
- **Local Processing**: All game state maintained in browser memory only
- **Network Usage**: Only communicates with OSM/Overpass API and local JOSM

## 🎯 Future Development Roadmap

### Short-Term Goals (Next Release)
- **Mobile Optimization**: Enhanced touch interfaces and mobile layouts
- **Additional Countries**: Mexico, Germany, United Kingdom, France
- **Advanced Statistics**: Detailed mapping progress analytics and achievements
- **Offline Mode**: Cache territory data for offline competition sessions

### Medium-Term Goals (6 Months)
- **Multi-Language Support**: Spanish, Portuguese, French, German interfaces
- **Custom Competition Modes**: Different infrastructure types, voltage levels
- **Team Management**: Named teams, persistent team rosters, competition history
- **Advanced JOSM Integration**: Custom validation rules, mapping presets

### Long-Term Vision (1 Year+)
- **Native Mobile Apps**: iOS and Android applications with field mapping
- **Global Leaderboards**: Cross-country team competition rankings
- **Real-Time Collaboration**: Live team coordination and progress sharing  
- **Educational Integration**: Curriculum modules for geography and infrastructure studies
- **Government Partnerships**: Official infrastructure mapping campaigns

### Technical Improvements
- **Performance Optimization**: Lazy loading, data streaming, memory management
- **Advanced Error Recovery**: Automatic retry logic, offline queue management  
- **API Enhancements**: Custom Overpass endpoints, query optimization
- **Accessibility Improvements**: Screen reader support, keyboard navigation
- **Testing Framework**: Automated cross-browser and cross-country testing

---

## 🏆 Ready to Compete?

**Form your teams, select your country, and begin the ultimate power infrastructure mapping competition! Will Blue Lightning ⚡ or Green Thunder 🌿 dominate the global power grid?**

### Quick Start Checklist
- [ ] Install and configure JOSM with Remote Control enabled
- [ ] Launch Grid Tycoon in a modern web browser
- [ ] Select your target country for competition
- [ ] Review team assignments and territory distribution
- [ ] Begin alternating team turns to conquer territories
- [ ] Map high-voltage power infrastructure professionally in JOSM
- [ ] Track progress and celebrate team victories
- [ ] Achieve Grid Tycoon championship status!

## 📞 Support & Community

### Getting Help
- **Technical Issues**: GitHub issue tracker with detailed bug reports
- **Game Strategy**: Community discussions and team coordination tips
- **JOSM Support**: Official JOSM documentation and OSM community forums
- **Power Mapping**: OpenStreetMap wiki power infrastructure guidelines

### Community Resources
- **OSM Community**: Local OpenStreetMap chapters and mapping parties
- **Power Infrastructure**: Electrical engineering and grid operator communities  
- **Educational Use**: Teachers and students using Grid Tycoon for learning
- **Development Community**: Contributors and developers extending Grid Tycoon

**Happy Team Mapping! ⚡🌿🗺️🏆**