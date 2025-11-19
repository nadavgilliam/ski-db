const OSM_CONFIG = require('../config/osm');
const crypto = require('crypto');
const fs = require('fs');
const path = require('path');
const turf = require('@turf/turf');

class OSMService {
  constructor() {
    this.cache = new Map();
    this.cacheDir = path.join(__dirname, '..', OSM_CONFIG.cacheDir);

    // Create cache directory if it doesn't exist
    if (OSM_CONFIG.useCache && !fs.existsSync(this.cacheDir)) {
      fs.mkdirSync(this.cacheDir, { recursive: true });
    }
  }

  /**
   * Main analysis method - analyzes OSM data for a hotel location
   * @param {number} hotelLat - Hotel latitude
   * @param {number} hotelLon - Hotel longitude
   * @param {string} hotelName - Hotel name (optional)
   * @returns {Promise<Object>} Structured analysis results (without scoring)
   */
  async analyzeLocation(hotelLat, hotelLon, hotelName = null) {
    console.log(`\nAnalyzing OSM location: ${hotelName || `${hotelLat}, ${hotelLon}`}`);

    try {
      // Fetch OSM data
      const data = await this.fetchOSMData(hotelLat, hotelLon);
      const elements = data.elements || [];
      console.log(`Retrieved ${elements.length} OSM elements`);

      // Parse elements into categories
      const parsed = this.parseElements(elements);

      // Create hotel point for distance calculations
      const hotelPoint = turf.point([hotelLon, hotelLat]);

      // Analyze each category (NO SCORING)
      const results = {
        hotel_name: hotelName || `Location at ${hotelLat.toFixed(6)}, ${hotelLon.toFixed(6)}`,
        hotel_coords: [hotelLat, hotelLon],
        lifts: this.analyzeLifts(parsed.liftStations, parsed.liftWays, hotelPoint),
        runs: this.analyzeRuns(parsed.runs, hotelPoint),
        ski_schools: this.analyzeSkiSchools(parsed.skiSchools, hotelPoint),
        official_ski_pass_offices: this.analyzePassOffices(parsed.passOffices, hotelPoint),
        public_transport: this.analyzePublicTransport(parsed.publicTransport, hotelPoint),
        public_parking_lots: this.analyzeParking(parsed.parking, hotelPoint),
        food_stats: this.analyzeFoodDrink(parsed.foodDrink, hotelPoint),
        shops: this.analyzeShops(parsed.shops, hotelPoint),
        hotel: this.analyzeHotel(parsed.hotels, parsed.familyRelax, hotelPoint)
      };

      return results;

    } catch (error) {
      console.error('OSM analysis error:', error);
      throw new Error(`OSM analysis failed: ${error.message}`);
    }
  }

  /**
   * Fetch data from Overpass API with caching and retry
   */
  async fetchOSMData(hotelLat, hotelLon) {
    const bbox = this.makeBbox(hotelLat, hotelLon, OSM_CONFIG.maxRadius);
    const query = this.buildOverpassQuery(bbox);

    // Check cache
    const cached = this.loadFromCache(query);
    if (cached) {
      console.log('Using cached OSM data');
      return cached;
    }

    // Fetch with retry
    let lastError;
    for (let attempt = 1; attempt <= OSM_CONFIG.maxRetries; attempt++) {
      try {
        console.log(`Querying Overpass API (attempt ${attempt}/${OSM_CONFIG.maxRetries})...`);

        const response = await fetch(OSM_CONFIG.overpassUrl, {
          method: 'POST',
          headers: {
            'Content-Type': 'application/x-www-form-urlencoded'
          },
          body: `data=${encodeURIComponent(query)}`,
          timeout: OSM_CONFIG.timeout * 1000
        });

        if (!response.ok) {
          throw new Error(`HTTP ${response.status}: ${response.statusText}`);
        }

        const data = await response.json();
        this.saveToCache(query, data);
        return data;

      } catch (error) {
        lastError = error;
        console.error(`Attempt ${attempt} failed:`, error.message);

        if (attempt < OSM_CONFIG.maxRetries) {
          const delay = OSM_CONFIG.retryDelay * Math.pow(2, attempt - 1);
          console.log(`Retrying in ${delay}ms...`);
          await new Promise(resolve => setTimeout(resolve, delay));
        }
      }
    }

    throw new Error(`Failed after ${OSM_CONFIG.maxRetries} attempts: ${lastError.message}`);
  }

  /**
   * Build Overpass QL query
   */
  buildOverpassQuery(bbox) {
    const [south, west, north, east] = bbox;

    return `
[out:json][timeout:${OSM_CONFIG.timeout}];
(
  // Lifts: station nodes and ways
  node["aerialway"="station"](${south},${west},${north},${east});
  way["aerialway"~"chair_lift|drag_lift|gondola|cable_car|mixed_lift|t-bar|platter|magic_carpet"](${south},${west},${north},${east});

  // Runs
  way["piste:type"="downhill"](${south},${west},${north},${east});

  // Ski schools
  node["amenity"="ski_school"](${south},${west},${north},${east});
  way["amenity"="ski_school"](${south},${west},${north},${east});

  // Ski pass offices
  node["shop"="ticket"](${south},${west},${north},${east});
  way["shop"="ticket"](${south},${west},${north},${east});
  node["amenity"="ticket_office"](${south},${west},${north},${east});
  way["amenity"="ticket_office"](${south},${west},${north},${east});

  // Public transport
  node["highway"="bus_stop"](${south},${west},${north},${east});
  node["public_transport"="platform"](${south},${west},${north},${east});
  node["amenity"="bus_station"](${south},${west},${north},${east});
  node["railway"="station"](${south},${west},${north},${east});
  node["railway"="halt"](${south},${west},${north},${east});
  node["railway"="tram_stop"](${south},${west},${north},${east});

  // Parking
  node["amenity"="parking"](${south},${west},${north},${east});
  way["amenity"="parking"](${south},${west},${north},${east});

  // Restaurants / bars / nightclubs
  node["amenity"~"^(restaurant|cafe|fast_food|bar|pub|nightclub)$"](${south},${west},${north},${east});
  way["amenity"~"^(restaurant|cafe|fast_food|bar|pub|nightclub)$"](${south},${west},${north},${east});

  // Shops
  node["shop"](${south},${west},${north},${east});
  way["shop"](${south},${west},${north},${east});

  // Hotels
  node["tourism"~"^(hotel|guest_house|apartment|chalet|hostel|alpine_hut)$"](${south},${west},${north},${east});
  way["tourism"~"^(hotel|guest_house|apartment|chalet|hostel|alpine_hut)$"](${south},${west},${north},${east});

  // Family / relaxation facilities
  node["leisure"~"^(swimming_pool|spa|playground)$"](${south},${west},${north},${east});
  way["leisure"~"^(swimming_pool|spa|playground)$"](${south},${west},${north},${east});
  node["amenity"~"^(spa|sauna|kindergarten)$"](${south},${west},${north},${east});
  way["amenity"~"^(spa|sauna|kindergarten)$"](${south},${west},${north},${east});
  node["social_facility"="childcare"](${south},${west},${north},${east});
  way["social_facility"="childcare"](${south},${west},${north},${east});
);
out geom;
`;
  }

  /**
   * Create bounding box around point
   */
  makeBbox(lat, lon, radiusM) {
    const degLat = radiusM / 111320.0;
    const latRad = lat * (Math.PI / 180);
    const degLon = radiusM / (111320.0 * Math.max(Math.cos(latRad), 0.01));

    // Add 40% buffer
    const bufferLat = degLat * 1.4;
    const bufferLon = degLon * 1.4;

    return [
      lat - bufferLat, // south
      lon - bufferLon, // west
      lat + bufferLat, // north
      lon + bufferLon  // east
    ];
  }

  /**
   * Cache management
   */
  getCacheKey(query) {
    return crypto.createHash('md5').update(query).digest('hex');
  }

  loadFromCache(query) {
    if (!OSM_CONFIG.useCache) return null;

    const cacheKey = this.getCacheKey(query);
    const cacheFile = path.join(this.cacheDir, `${cacheKey}.json`);

    try {
      if (fs.existsSync(cacheFile)) {
        const data = fs.readFileSync(cacheFile, 'utf8');
        return JSON.parse(data);
      }
    } catch (error) {
      console.error('Cache read error:', error.message);
    }

    return null;
  }

  saveToCache(query, data) {
    if (!OSM_CONFIG.useCache) return;

    const cacheKey = this.getCacheKey(query);
    const cacheFile = path.join(this.cacheDir, `${cacheKey}.json`);

    try {
      fs.writeFileSync(cacheFile, JSON.stringify(data), 'utf8');
    } catch (error) {
      console.error('Cache write error:', error.message);
    }
  }

  /**
   * Parse OSM elements into categories
   */
  parseElements(elements) {
    const parsed = {
      liftStations: [],
      liftWays: [],
      runs: [],
      skiSchools: [],
      passOffices: [],
      publicTransport: [],
      parking: [],
      foodDrink: [],
      shops: [],
      hotels: [],
      familyRelax: []
    };

    for (const el of elements) {
      const tags = el.tags || {};
      const geom = this.buildGeometry(el);
      if (!geom) continue;

      const centroid = turf.centroid(geom);
      const [lon, lat] = centroid.geometry.coordinates;

      // Lifts
      const aerialway = tags.aerialway;
      if (aerialway) {
        if (el.type === 'node' && aerialway === 'station') {
          parsed.liftStations.push({
            geom,
            tags,
            id: el.id,
            lat,
            lon
          });
        } else if (el.type === 'way') {
          parsed.liftWays.push({
            geom,
            tags,
            id: el.id,
            nodes: el.nodes || [],
            lat,
            lon
          });
        }
      }

      // Runs
      if (tags['piste:type'] === 'downhill' && el.type === 'way') {
        parsed.runs.push({ geom, tags, id: el.id, lat, lon });
      }

      // Ski schools
      if (this.isSkiSchool(tags)) {
        parsed.skiSchools.push({ geom, tags, lat, lon });
      }

      // Pass offices
      if (this.isSkiPassOffice(tags)) {
        parsed.passOffices.push({ geom, tags, lat, lon });
      }

      // Public transport
      if (this.isPublicTransport(tags)) {
        parsed.publicTransport.push({ geom, tags, lat, lon });
      }

      // Parking
      if (tags.amenity === 'parking') {
        parsed.parking.push({ geom, tags, lat, lon });
      }

      // Food & drink
      if (this.classifyFoodDrink(tags)) {
        parsed.foodDrink.push({ geom, tags, lat, lon });
      }

      // Shops
      if (tags.shop) {
        parsed.shops.push({ geom, tags, lat, lon });
      }

      // Hotels
      if (this.getHotelCategory(tags)) {
        parsed.hotels.push({ geom, tags, lat, lon });
      }

      // Family facilities
      if (this.isFamilyRelaxFacility(tags)) {
        parsed.familyRelax.push({ geom, tags, lat, lon });
      }
    }

    console.log(`Parsed: ${parsed.liftStations.length} lift stations, ${parsed.runs.length} runs, ${parsed.skiSchools.length} ski schools`);

    return parsed;
  }

  /**
   * Build Turf geometry from OSM element
   */
  buildGeometry(element) {
    if (element.type === 'node') {
      return turf.point([element.lon, element.lat]);
    } else if (element.type === 'way') {
      const coords = (element.geometry || []).map(p => [p.lon, p.lat]);
      if (coords.length < 2) return null;

      // Check if closed polygon
      if (coords.length >= 4 &&
          coords[0][0] === coords[coords.length - 1][0] &&
          coords[0][1] === coords[coords.length - 1][1]) {
        try {
          return turf.polygon([coords]);
        } catch (e) {
          return turf.lineString(coords);
        }
      } else {
        return turf.lineString(coords);
      }
    }
    return null;
  }

  /**
   * Calculate distance from hotel to geometry (in meters)
   */
  distanceToGeometry(hotelPoint, geom) {
    if (geom.geometry.type === 'Point') {
      return turf.distance(hotelPoint, geom, { units: 'meters' });
    } else if (geom.geometry.type === 'LineString') {
      const nearest = turf.nearestPointOnLine(geom, hotelPoint);
      return turf.distance(hotelPoint, nearest, { units: 'meters' });
    } else if (geom.geometry.type === 'Polygon') {
      const line = turf.polygonToLine(geom);
      const nearest = turf.nearestPointOnLine(line, hotelPoint);
      return turf.distance(hotelPoint, nearest, { units: 'meters' });
    } else {
      const centroid = turf.centroid(geom);
      return turf.distance(hotelPoint, centroid, { units: 'meters' });
    }
  }

  /**
   * Get nearest point coordinates on geometry
   */
  getNearestPointCoords(hotelPoint, geom) {
    if (geom.geometry.type === 'Point') {
      return geom.geometry.coordinates.slice().reverse(); // [lat, lon]
    } else if (geom.geometry.type === 'LineString') {
      const nearest = turf.nearestPointOnLine(geom, hotelPoint);
      return nearest.geometry.coordinates.slice().reverse();
    } else if (geom.geometry.type === 'Polygon') {
      const line = turf.polygonToLine(geom);
      const nearest = turf.nearestPointOnLine(line, hotelPoint);
      return nearest.geometry.coordinates.slice().reverse();
    } else {
      const centroid = turf.centroid(geom);
      return centroid.geometry.coordinates.slice().reverse();
    }
  }

  /**
   * Classification helpers
   */
  isSkiSchool(tags) {
    if (tags.amenity === 'ski_school') return true;
    if (tags.sport === 'skiing' && tags.club === 'sport') return true;
    const name = (tags.name || '').toLowerCase();
    return name.includes('ski school') || name.includes('école de ski') || name.includes('skischule');
  }

  isSkiPassOffice(tags) {
    if (tags.shop === 'ticket' && tags.ticket === 'ski_pass') return true;
    if (tags.amenity === 'ticket_office' && tags.ticket === 'ski_pass') return true;
    if (tags.ski_pass === 'yes') return true;
    const name = (tags.name || '').toLowerCase();
    return name.includes('ski pass') || name.includes('forfait') || name.includes('skipass');
  }

  isPublicTransport(tags) {
    return tags.highway === 'bus_stop' ||
           tags.public_transport === 'platform' ||
           tags.amenity === 'bus_station' ||
           ['station', 'halt', 'tram_stop'].includes(tags.railway);
  }

  classifyPublicTransport(tags) {
    if (tags.amenity === 'bus_station') return 'bus_station';
    if (tags.highway === 'bus_stop') return 'bus_stop';
    if (tags.railway === 'station') return 'train_station';
    if (tags.railway === 'halt') return 'train_halt';
    if (tags.railway === 'tram_stop') return 'tram_stop';
    if (tags.public_transport === 'platform') return 'pt_platform';
    return 'other';
  }

  classifyFoodDrink(tags) {
    const amenity = tags.amenity;
    if (['restaurant', 'cafe', 'fast_food', 'bar', 'pub', 'nightclub'].includes(amenity)) {
      return amenity;
    }
    return null;
  }

  isSkiRental(tags) {
    const shop = tags.shop || '';
    const name = (tags.name || '').toLowerCase();
    const desc = [tags.description || '', tags.note || '', tags.operator || ''].join(' ').toLowerCase();

    if (shop === 'ski') return true;
    if (['sports', 'outdoor'].includes(shop)) {
      const keywords = ['ski', 'snowboard', 'rental', 'rent', 'hire'];
      const text = name + ' ' + desc;
      return keywords.some(kw => text.includes(kw));
    }
    return false;
  }

  getHotelCategory(tags) {
    const tourism = tags.tourism;
    if (['hotel', 'guest_house', 'apartment', 'chalet', 'hostel', 'alpine_hut'].includes(tourism)) {
      return tourism;
    }
    return null;
  }

  isFamilyRelaxFacility(tags) {
    return ['swimming_pool', 'spa', 'playground'].includes(tags.leisure) ||
           ['spa', 'sauna', 'kindergarten'].includes(tags.amenity) ||
           tags.social_facility === 'childcare';
  }

  getLiftType(tags) {
    const aerialway = tags.aerialway || '';
    return OSM_CONFIG.liftTypePriority[aerialway] ? aerialway : 'unknown';
  }

  getRunDifficulty(tags) {
    return tags['piste:difficulty'] || 'unknown';
  }

  getRunDisplayName(tags) {
    return tags.name || tags['piste:name'] || tags.ref || '(unnamed)';
  }

  /**
   * Analysis methods for each category
   */
  analyzeLifts(liftStations, liftWays, hotelPoint) {
    // Map station nodes to their parent ways to get lift types
    const nodeToLiftTypes = new Map();
    const nodeToLiftNames = new Map();

    for (const way of liftWays) {
      const liftType = this.getLiftType(way.tags);
      const liftName = way.tags.name || '';
      for (const nid of way.nodes) {
        if (!nodeToLiftTypes.has(nid)) nodeToLiftTypes.set(nid, new Set());
        if (!nodeToLiftNames.has(nid)) nodeToLiftNames.set(nid, new Set());
        nodeToLiftTypes.get(nid).add(liftType);
        if (liftName) nodeToLiftNames.get(nid).add(liftName);
      }
    }

    const candidates = [];

    for (const station of liftStations) {
      const dist = this.distanceToGeometry(hotelPoint, station.geom);
      if (dist > OSM_CONFIG.radiusLifts) continue;

      const tags = station.tags;
      const stationId = station.id;

      // Get lift type from parent ways
      const liftTypes = nodeToLiftTypes.get(stationId) || new Set();
      const liftType = liftTypes.size > 0 ? Array.from(liftTypes).sort()[0] : 'unknown';

      // Get name
      let name = tags.name;
      if (!name) {
        const parentNames = nodeToLiftNames.get(stationId) || new Set();
        name = parentNames.size > 0 ? Array.from(parentNames).sort()[0] : '(unnamed lift)';
      }

      // Determine station type
      let stationType = null;
      const aerialwayAccess = tags['aerialway:access'];
      if (aerialwayAccess === 'entry') stationType = 'entry';
      else if (aerialwayAccess === 'exit') stationType = 'exit';
      else if (tags.station === 'valley') stationType = 'entry';

      candidates.push({
        name,
        type: liftType,
        station_type: stationType,
        distance_m: Math.round(dist * 10) / 10,
        distance_note: 'to lift station',
        priority: OSM_CONFIG.liftTypePriority[liftType] || 999,
        coords: [station.lat, station.lon]
      });
    }

    // Deduplicate by name - keep closest
    const seenNames = new Map();
    for (const lift of candidates) {
      const key = lift.name.toLowerCase();
      if (!seenNames.has(key) || lift.distance_m < seenNames.get(key).distance_m) {
        seenNames.set(key, lift);
      }
    }

    const uniqueLifts = Array.from(seenNames.values());
    uniqueLifts.sort((a, b) => a.distance_m - b.distance_m || a.priority - b.priority);

    return {
      nearest_3: uniqueLifts.slice(0, 3),
      total_within_radius: uniqueLifts.length,
      search_radius_m: OSM_CONFIG.radiusLifts
    };
  }

  analyzeRuns(runs, hotelPoint) {
    const candidates = [];

    for (const run of runs) {
      const dist = this.distanceToGeometry(hotelPoint, run.geom);
      if (dist > OSM_CONFIG.radiusRuns) continue;

      const tags = run.tags;
      const name = this.getRunDisplayName(tags);
      const difficulty = this.getRunDifficulty(tags);
      const nearestCoords = this.getNearestPointCoords(hotelPoint, run.geom);

      candidates.push({
        name,
        difficulty,
        distance_m: Math.round(dist * 10) / 10,
        distance_note: 'to nearest point on run',
        nearest_point_coords: nearestCoords,
        centroid_coords: [run.lat, run.lon]
      });
    }

    // Deduplicate by name
    candidates.sort((a, b) => a.distance_m - b.distance_m);
    const seen = new Set();
    const unique = [];
    const difficultyDistribution = {};

    for (const c of candidates) {
      const key = c.name.toLowerCase();
      if (!seen.has(key)) {
        seen.add(key);
        unique.push(c);
        difficultyDistribution[c.difficulty] = (difficultyDistribution[c.difficulty] || 0) + 1;
      }
    }

    return {
      nearest_3: unique.slice(0, 3),
      total_within_radius: unique.length,
      difficulty_distribution: difficultyDistribution,
      search_radius_m: OSM_CONFIG.radiusRuns
    };
  }

  analyzeSkiSchools(skiSchools, hotelPoint) {
    const candidates = [];

    for (const school of skiSchools) {
      const dist = this.distanceToGeometry(hotelPoint, school.geom);
      if (dist > OSM_CONFIG.radiusSkiSchools) continue;

      const tags = school.tags;
      const nearestCoords = this.getNearestPointCoords(hotelPoint, school.geom);

      candidates.push({
        name: tags.name || '(unnamed ski school)',
        distance_m: Math.round(dist * 10) / 10,
        phone: tags.phone,
        website: tags.website,
        coords: nearestCoords
      });
    }

    candidates.sort((a, b) => a.distance_m - b.distance_m);

    // Check if hotel has ski school
    const hotelHasSkiSchool = skiSchools.some(s =>
      this.distanceToGeometry(hotelPoint, s.geom) <= OSM_CONFIG.hotelFacilitiesRadius
    );

    return {
      nearest_3: candidates.slice(0, 3),
      total_within_radius: candidates.length,
      hotel_has_ski_school: hotelHasSkiSchool,
      search_radius_m: OSM_CONFIG.radiusSkiSchools
    };
  }

  analyzePassOffices(passOffices, hotelPoint) {
    const candidates = [];

    for (const office of passOffices) {
      const dist = this.distanceToGeometry(hotelPoint, office.geom);
      if (dist > OSM_CONFIG.radiusPassOffices) continue;

      const tags = office.tags;
      const nearestCoords = this.getNearestPointCoords(hotelPoint, office.geom);

      candidates.push({
        name: tags.name || '(ski pass office)',
        distance_m: Math.round(dist * 10) / 10,
        opening_hours: tags.opening_hours,
        coords: nearestCoords
      });
    }

    candidates.sort((a, b) => a.distance_m - b.distance_m);

    // Check if hotel has pass office
    const hotelHasPassOffice = passOffices.some(o =>
      this.distanceToGeometry(hotelPoint, o.geom) <= OSM_CONFIG.hotelFacilitiesRadius
    );

    return {
      nearest_3: candidates.slice(0, 3),
      total_within_radius: candidates.length,
      hotel_has_pass_office: hotelHasPassOffice,
      search_radius_m: OSM_CONFIG.radiusPassOffices
    };
  }

  analyzePublicTransport(publicTransport, hotelPoint) {
    const candidates = [];

    for (const pt of publicTransport) {
      const dist = this.distanceToGeometry(hotelPoint, pt.geom);
      if (dist > OSM_CONFIG.radiusTransport) continue;

      const tags = pt.tags;
      candidates.push({
        name: tags.name,
        type: this.classifyPublicTransport(tags),
        distance_m: Math.round(dist * 10) / 10,
        coords: [pt.lat, pt.lon]
      });
    }

    candidates.sort((a, b) => a.distance_m - b.distance_m);

    // Get closest one of each type (max 1 per type)
    const byType = new Map();
    for (const candidate of candidates) {
      if (!byType.has(candidate.type)) {
        byType.set(candidate.type, candidate);
      }
    }

    const closestByType = Array.from(byType.values());
    closestByType.sort((a, b) => a.distance_m - b.distance_m);

    return {
      closest_by_type: closestByType,
      total_within_radius: candidates.length,
      search_radius_m: OSM_CONFIG.radiusTransport
    };
  }

  analyzeParking(parking, hotelPoint) {
    const candidates = [];

    for (const p of parking) {
      const dist = this.distanceToGeometry(hotelPoint, p.geom);
      if (dist > OSM_CONFIG.radiusParking) continue;

      const tags = p.tags;
      const name = tags.name;

      // Skip parking without names
      if (!name) continue;

      candidates.push({
        name,
        type: 'parking',
        distance_m: Math.round(dist * 10) / 10,
        fee: tags.fee,
        capacity: tags.capacity,
        coords: [p.lat, p.lon]
      });
    }

    candidates.sort((a, b) => a.distance_m - b.distance_m);

    // Return only the closest one
    const closest = candidates.length > 0 ? candidates[0] : null;

    return {
      closest_lot: closest,
      total_within_radius: candidates.length,
      search_radius_m: OSM_CONFIG.radiusParking
    };
  }

  analyzeFoodDrink(foodDrink, hotelPoint) {
    let restaurantsLike = 0;
    let barsLike = 0;
    let nightclubs = 0;

    for (const f of foodDrink) {
      const dist = this.distanceToGeometry(hotelPoint, f.geom);
      if (dist > OSM_CONFIG.radiusRestaurants) continue;

      const cat = this.classifyFoodDrink(f.tags);
      if (['restaurant', 'cafe', 'fast_food'].includes(cat)) {
        restaurantsLike++;
      }
      if (['bar', 'pub'].includes(cat)) {
        barsLike++;
      }
      if (cat === 'nightclub') {
        nightclubs++;
      }
    }

    return {
      restaurants_like: restaurantsLike,
      bars_like: barsLike,
      nightclubs: nightclubs,
      nightlife_total: barsLike + nightclubs,
      search_radius_m: OSM_CONFIG.radiusRestaurants
    };
  }

  analyzeShops(shops, hotelPoint) {
    let totalShops = 0;
    let skiRentalCount = 0;
    const shopTypeGroups = {};

    for (const s of shops) {
      const dist = this.distanceToGeometry(hotelPoint, s.geom);
      if (dist > OSM_CONFIG.radiusShops) continue;

      const tags = s.tags;
      const isRental = this.isSkiRental(tags);
      if (isRental) skiRentalCount++;

      const shopType = tags.shop || 'unknown';

      const shopData = {
        name: tags.name,
        shop_type: shopType,
        is_ski_rental: isRental,
        distance_m: Math.round(dist * 10) / 10,
        coords: [s.lat, s.lon]
      };

      totalShops++;

      // Group by shop type
      if (!shopTypeGroups[shopType]) {
        shopTypeGroups[shopType] = [];
      }
      shopTypeGroups[shopType].push(shopData);
    }

    // For each type, keep only the closest and add count
    const shopsByType = {};
    for (const type in shopTypeGroups) {
      const shopsOfType = shopTypeGroups[type];
      shopsOfType.sort((a, b) => a.distance_m - b.distance_m);

      shopsByType[type] = {
        closest: shopsOfType[0],
        total_within_radius: shopsOfType.length
      };
    }

    return {
      total_shops: totalShops,
      ski_rental_count: skiRentalCount,
      shops_by_type: shopsByType,
      search_radius_m: OSM_CONFIG.radiusShops
    };
  }

  analyzeHotel(hotels, familyRelax, hotelPoint) {
    // Find closest hotel object
    let hotelObj = null;
    let bestDist = null;

    for (const h of hotels) {
      const dist = this.distanceToGeometry(hotelPoint, h.geom);
      if (bestDist === null || dist < bestDist) {
        hotelObj = h;
        bestDist = dist;
      }
    }

    const info = {
      name: null,
      category: null,
      stars: null,
      distance_m: null,
      coords: null,
      has_spa: false,
      has_pool: false,
      has_sauna: false,
      has_playground: false,
      has_childcare: false
    };

    if (hotelObj && bestDist <= 60) {
      const tags = hotelObj.tags;
      info.name = tags.name;
      info.category = this.getHotelCategory(tags);
      info.stars = tags.stars;
      info.distance_m = Math.round(bestDist * 10) / 10;
      info.coords = [hotelObj.lat, hotelObj.lon];

      // Check for facilities at hotel
      for (const f of familyRelax) {
        const dist = this.distanceToGeometry(turf.point([hotelObj.lon, hotelObj.lat]), f.geom);
        if (dist > OSM_CONFIG.hotelFacilitiesRadius) continue;

        const tags = f.tags;
        if (tags.leisure === 'swimming_pool') info.has_pool = true;
        if (tags.leisure === 'spa' || tags.amenity === 'spa') info.has_spa = true;
        if (tags.amenity === 'sauna') info.has_sauna = true;
        if (tags.leisure === 'playground') info.has_playground = true;
        if (tags.amenity === 'kindergarten' || tags.social_facility === 'childcare') {
          info.has_childcare = true;
        }
      }
    }

    return info;
  }
}

module.exports = new OSMService();
