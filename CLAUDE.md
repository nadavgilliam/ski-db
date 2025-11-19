# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Project Overview

Ski-db is an AI-powered ski trip planner that helps users find and book complete ski vacations using natural language. The system uses OpenAI GPT-4 to orchestrate multiple data sources (local resort database, Amadeus flights, Booking.com hotels) and present comprehensive trip recommendations.

## Architecture

The project consists of three main components:

1. **Client** (`/client`) - React 19 + Vite frontend
2. **Server** (`/server`) - Node.js + Express backend with GPT-4 orchestration
3. **Scraper** (`/skiresort-scraper`) - Python scraper for resort data from skiresort.info

### Data Flow

```
User Query → React Frontend → Express API → GPT-4 Orchestration Layer
                                                ↓
                                    ┌───────────┼───────────┐
                                    ↓           ↓           ↓
                              Resort DB    Amadeus API   Booking.com
                              (SQLite)     (Flights)     (Hotels)
```

## Development Commands

### Backend Server
```bash
cd server
node index.js              # Start server on port 3000
```

### Frontend
```bash
cd client
npm run dev                # Start Vite dev server (port 5173)
npm run build              # Production build
npm run lint               # Run ESLint
```

### Database Scraper
```bash
cd skiresort-scraper
python create_db.py                      # Initialize database schema
python write_one_country.py <country>    # Scrape single country
python scrape_world_print.py             # Scrape top 10 countries
```

### Running Tests
```bash
cd server
node tests/test-health.js                    # Health endpoint
node tests/test-api-endpoint.js              # Full API integration
node tests/test-resort-service-advanced.js   # Resort database
node tests/test-flight-service.js            # Amadeus API
node tests/test-hotel-service.js             # Booking.com API
node tests/test-osm-service.js               # OpenStreetMap analysis
node tests/test-ai-service.js                # GPT-4 orchestration
```

## Key Architecture Patterns

### AI Orchestration Layer

The core innovation is in `server/services/aiService.js`. GPT-4 (gpt-4o model) acts as an intelligent coordinator using function calling to:

1. Interpret natural language queries
2. Decide which APIs to call and in what order
3. Execute tool calls iteratively (up to 10 iterations)
4. Combine results into structured recommendations

**Three tools exposed to GPT-4:**
- `search_resorts` - Query SQLite database with advanced filters
- `search_flights` - Search Amadeus API for flights
- `search_hotels` - Search Booking.com by coordinates

### Service Layer Pattern

Each external API/database has a dedicated service:
- `resortService.js` - SQLite queries with advanced filtering (country, rating, piste km, difficulty, price, altitude)
- `flightService.js` - Amadeus flight search (returns top 3 offers)
- `hotelService.js` - Booking.com hotel search by lat/long (returns top 5, calculates distance via Haversline)
- `osmService.js` - OpenStreetMap/Overpass API for detailed location analysis (lifts, runs, ski schools, pass offices, amenities)
- `aiService.js` - GPT-4 orchestration layer

## Database Schema

SQLite database at `skiresort-scraper/skiresort.db` (opened in readonly mode by server):

### resorts table
```sql
resort_id, name, country, country_code, region, source_url, status, rating,
altitude_min_m, altitude_max_m, altitude_village_m,
piste_km_total, piste_km_blue, piste_km_red, piste_km_black,
lifts_count, price_day_local, price_currency, price_day_eur
```

The resort service enriches results with calculated fields:
- Size category (small/medium/large/extra-large based on piste km)
- Difficulty profile (beginner-friendly/intermediate/advanced/mixed)
- Difficulty percentages (blue/red/black as % of total)

## API Integration

### Environment Variables (server/.env)
```
AMADEUS_CLIENT_ID         # Amadeus flight API credentials
AMADEUS_CLIENT_SECRET
OPENAI_API_KEY            # OpenAI GPT-4 API key
RAPIDAPI_KEY              # RapidAPI for Booking.com
DATABASE_PATH             # Path to SQLite database
```

### API Endpoints
```
GET  /                    # API info
POST /api/search          # Main search (requires: origin, dates, adults, preferences)
GET  /api/search/health   # Health check
```

### Airport Mapping (hardcoded in AI prompt)
- Geneva (GVA) → French/Swiss Alps
- Zurich (ZRH) → Swiss Alps
- Innsbruck (INN) → Austrian Alps
- Munich (MUC) → German/Austrian Alps

GPT-4 autonomously selects appropriate airports based on resort locations.

## Frontend Structure

React app with routing (`src/App.jsx`):
- `/` - SearchPage (natural language search + manual filters)
- `/results` - ResultsPage (displays recommendations as cards)

API communication handled by `src/services/api.js`, which calls `http://localhost:3000/api/search`.

## OpenStreetMap Service

The `osmService.js` fetches raw OpenStreetMap data via the Overpass API for ski resort locations:

### Features Queried
- **Lifts**: Ski lift stations and aerialway infrastructure
- **Runs**: Ski runs (downhill pistes)
- **Ski Schools**: Ski instruction facilities
- **Pass Offices**: Ski pass ticket offices
- **Public Transport**: Bus stops, train stations, tram stops
- **Parking**: Parking facilities
- **Food & Drink**: Restaurants, cafes, bars, nightclubs
- **Shops**: All shops
- **Hotels**: Hotels, guest houses, apartments, chalets, hostels
- **Family Facilities**: Pools, spas, playgrounds, childcare

### Technical Details
- Returns **raw OSM JSON** from Overpass API (no processing or scoring)
- Implements file-based caching (`.osm_cache/` directory with MD5 hashed query keys)
- Retry logic with exponential backoff (3 attempts, 4s base delay)
- Configurable search radius (default 500m)
- Queries within bounding box with 40% buffer

### Usage
```javascript
const osmService = require('./services/osmService');
const rawOSMData = await osmService.fetchOSMData(45.298, 6.583);
// Returns: { version, generator, osm3s, elements: [...] }
```

## Important Implementation Details

1. **No TypeScript** - Project uses plain JavaScript
2. **SQLite in readonly mode** - Server never writes to database
3. **CSS Variables** - Styling uses custom properties in `client/src/styles/index.css`
4. **No authentication** - All endpoints are public
5. **Iterative GPT execution** - AI can make multiple tool calls in sequence
6. **Coordinate-based hotel search** - Uses resort lat/long from database
7. **Haversine distance** - Hotel service calculates distance to resort
8. **OSM caching** - OSM service caches Overpass API responses to avoid rate limiting

## Key Files

### Backend
- `server/index.js` - Express app entry point
- `server/routes/search.js` - API route handlers
- `server/services/aiService.js` - GPT-4 orchestration (MOST IMPORTANT)
- `server/services/resortService.js` - Database queries with advanced filtering
- `server/services/osmService.js` - OpenStreetMap location analysis
- `server/config/*.js` - API client initialization

### Frontend
- `client/src/main.jsx` - React entry point
- `client/src/App.jsx` - Router setup
- `client/src/pages/SearchPage.jsx` - Search interface
- `client/src/pages/ResultsPage.jsx` - Results display
- `client/src/services/api.js` - API communication

### Database
- `skiresort-scraper/create_db.py` - Schema initialization
- `skiresort-scraper/write_one_country.py` - Main scraper script
- `skiresort-scraper/parse_page.py` - HTML parsing logic
- `skiresort-scraper/skiresort.db` - SQLite database (used by server in readonly mode)

## Development Workflow

1. Ensure `.env` files exist with valid API keys
2. Start backend: `cd server && node index.js`
3. Start frontend: `cd client && npm run dev`
4. Access at `http://localhost:5173`

To update resort data:
```bash
cd skiresort-scraper
python write_one_country.py <country_name>
```

## Testing Philosophy

All tests are manual Node.js scripts in `server/tests/`. Run them individually to test specific components. There are no automated test runners configured.
