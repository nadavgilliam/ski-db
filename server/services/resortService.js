const db = require('../config/database');

class ResortService {
  
  // Search resorts with advanced filtering (include/exclude, ranges, etc.)
  searchResorts(criteria = {}) {
    try {
      let query = 'SELECT * FROM resorts WHERE 1=1';
      const params = [];

      // === NAME FILTERS (include/exclude) ===
      if (criteria.includeNames && criteria.includeNames.length > 0) {
        const namePlaceholders = criteria.includeNames.map(() => 'name LIKE ?').join(' OR ');
        query += ` AND (${namePlaceholders})`;
        criteria.includeNames.forEach(name => params.push(`%${name}%`));
      }

      if (criteria.excludeNames && criteria.excludeNames.length > 0) {
        const namePlaceholders = criteria.excludeNames.map(() => 'name NOT LIKE ?').join(' AND ');
        query += ` AND (${namePlaceholders})`;
        criteria.excludeNames.forEach(name => params.push(`%${name}%`));
      }

      // === COUNTRY FILTERS (include/exclude) ===
      if (criteria.includeCountries && criteria.includeCountries.length > 0) {
        const countryPlaceholders = criteria.includeCountries.map(() => '(country LIKE ? OR country_code = ?)').join(' OR ');
        query += ` AND (${countryPlaceholders})`;
        criteria.includeCountries.forEach(country => {
          params.push(`%${country}%`, country.toUpperCase());
        });
      }

      if (criteria.excludeCountries && criteria.excludeCountries.length > 0) {
        const countryPlaceholders = criteria.excludeCountries.map(() => '(country NOT LIKE ? AND country_code != ?)').join(' AND ');
        query += ` AND (${countryPlaceholders})`;
        criteria.excludeCountries.forEach(country => {
          params.push(`%${country}%`, country.toUpperCase());
        });
      }

      // === RATING ===
      if (criteria.minRating) {
        query += ' AND rating >= ?';
        params.push(criteria.minRating);
      }

      if (criteria.maxRating) {
        query += ' AND rating <= ?';
        params.push(criteria.maxRating);
      }

      // === TOTAL PISTE KM (resort size) ===
      if (criteria.minPisteKm) {
        query += ' AND piste_km_total >= ?';
        params.push(criteria.minPisteKm);
      }

      if (criteria.maxPisteKm) {
        query += ' AND piste_km_total <= ?';
        params.push(criteria.maxPisteKm);
      }

      // === DIFFICULTY-SPECIFIC PISTES ===
      // Beginner-friendly: high percentage of blue slopes
      if (criteria.minBlueKm) {
        query += ' AND piste_km_blue >= ?';
        params.push(criteria.minBlueKm);
      }

      // Intermediate: red slopes
      if (criteria.minRedKm) {
        query += ' AND piste_km_red >= ?';
        params.push(criteria.minRedKm);
      }

      // Advanced: black slopes
      if (criteria.minBlackKm) {
        query += ' AND piste_km_black >= ?';
        params.push(criteria.minBlackKm);
      }

      // Alternative: filter by percentage of difficulty
      if (criteria.minBluePercent) {
        query += ' AND (piste_km_blue * 100.0 / piste_km_total) >= ?';
        params.push(criteria.minBluePercent);
      }

      if (criteria.minBlackPercent) {
        query += ' AND (piste_km_black * 100.0 / piste_km_total) >= ?';
        params.push(criteria.minBlackPercent);
      }

      // === LIFTS COUNT (indicator of resort size/infrastructure) ===
      if (criteria.minLifts) {
        query += ' AND lifts_count >= ?';
        params.push(criteria.minLifts);
      }

      if (criteria.maxLifts) {
        query += ' AND lifts_count <= ?';
        params.push(criteria.maxLifts);
      }

      // === DAY PASS PRICE (in EUR) ===
      if (criteria.minPriceEur) {
        query += ' AND price_day_eur >= ?';
        params.push(criteria.minPriceEur);
      }

      if (criteria.maxPriceEur) {
        query += ' AND price_day_eur <= ?';
        params.push(criteria.maxPriceEur);
      }

      // === ALTITUDE (for snow reliability) ===
      if (criteria.minAltitude) {
        query += ' AND altitude_max_m >= ?';
        params.push(criteria.minAltitude);
      }

      if (criteria.maxAltitude) {
        query += ' AND altitude_max_m <= ?';
        params.push(criteria.maxAltitude);
      }

      // === REGION ===
      if (criteria.region) {
        query += ' AND region LIKE ?';
        params.push(`%${criteria.region}%`);
      }

      // === ORDERING ===
      // Default: order by rating, but can be overridden
      const orderBy = criteria.orderBy || 'rating';
      const orderDirection = criteria.orderDirection || 'DESC';
      query += ` ORDER BY ${orderBy} ${orderDirection}`;

      // === LIMIT ===
      const limit = criteria.limit || 10;
      query += ' LIMIT ?';
      params.push(limit);

      console.log('🔍 Resort query:', query);
      console.log('📊 Params:', params);

      const stmt = db.prepare(query);
      const results = stmt.all(...params);

      return this.formatResortResults(results);
    } catch (error) {
      console.error('Resort search error:', error);
      throw new Error(`Resort search failed: ${error.message}`);
    }
  }

  // Get resort by ID
  getResortById(resortId) {
    try {
      const stmt = db.prepare('SELECT * FROM resorts WHERE resort_id = ?');
      const resort = stmt.get(resortId);
      
      if (!resort) {
        throw new Error(`Resort not found: ${resortId}`);
      }

      return this.formatResort(resort);
    } catch (error) {
      console.error('Get resort error:', error);
      throw new Error(`Get resort failed: ${error.message}`);
    }
  }

  // Get resort by name (fuzzy match)
  getResortByName(name) {
    try {
      const stmt = db.prepare('SELECT * FROM resorts WHERE name LIKE ? ORDER BY rating DESC LIMIT 1');
      const resort = stmt.get(`%${name}%`);
      
      if (!resort) {
        throw new Error(`Resort not found: ${name}`);
      }

      return this.formatResort(resort);
    } catch (error) {
      console.error('Get resort by name error:', error);
      throw new Error(`Get resort failed: ${error.message}`);
    }
  }

  // Get all countries with resort counts
  getCountries() {
    try {
      const stmt = db.prepare(`
        SELECT 
          c.country,
          c.slug,
          COUNT(r.resort_id) as resort_count
        FROM countries c
        LEFT JOIN resorts r ON c.slug = r.country_code OR c.country = r.country
        GROUP BY c.country, c.slug
        ORDER BY resort_count DESC
      `);
      
      return stmt.all();
    } catch (error) {
      console.error('Get countries error:', error);
      throw new Error(`Get countries failed: ${error.message}`);
    }
  }

  // Helper: Categorize resorts by size
  categorizeBySize(pisteKm) {
    if (pisteKm < 50) return 'small';
    if (pisteKm < 150) return 'medium';
    if (pisteKm < 300) return 'large';
    return 'extra-large';
  }

  // Helper: Categorize by difficulty profile
  analyzeDifficulty(resort) {
    const total = resort.piste_km_total || 1;
    const bluePercent = ((resort.piste_km_blue || 0) / total) * 100;
    const redPercent = ((resort.piste_km_red || 0) / total) * 100;
    const blackPercent = ((resort.piste_km_black || 0) / total) * 100;

    if (bluePercent > 50) return 'beginner-friendly';
    if (blackPercent > 20) return 'advanced';
    if (redPercent > 40) return 'intermediate';
    return 'mixed';
  }

  // Format single resort with enhanced metadata
  formatResort(resort) {
    return {
      id: resort.resort_id,
      name: resort.name,
      country: resort.country,
      countryCode: resort.country_code,
      region: resort.region,
      rating: resort.rating,
      altitude: {
        min: resort.altitude_min_m,
        max: resort.altitude_max_m,
        village: resort.altitude_village_m
      },
      pistes: {
        total: resort.piste_km_total,
        blue: resort.piste_km_blue,
        red: resort.piste_km_red,
        black: resort.piste_km_black,
        // Add percentages for easier interpretation
        bluePercent: resort.piste_km_total ? ((resort.piste_km_blue / resort.piste_km_total) * 100).toFixed(1) : 0,
        redPercent: resort.piste_km_total ? ((resort.piste_km_red / resort.piste_km_total) * 100).toFixed(1) : 0,
        blackPercent: resort.piste_km_total ? ((resort.piste_km_black / resort.piste_km_total) * 100).toFixed(1) : 0
      },
      lifts: resort.lifts_count,
      dayPass: {
        price: resort.price_day_eur,
        currency: 'EUR',
        originalPrice: resort.price_day_local,
        originalCurrency: resort.price_currency
      },
      url: resort.source_url,
      // Add helpful categorizations
      sizeCategory: this.categorizeBySize(resort.piste_km_total),
      difficultyProfile: this.analyzeDifficulty(resort)
    };
  }

  // Format multiple resorts
  formatResortResults(resorts) {
    return resorts.map(r => this.formatResort(r));
  }
}

module.exports = new ResortService();