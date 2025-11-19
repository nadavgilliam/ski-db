require('dotenv').config();

const OSM_CONFIG = {
  overpassUrl: 'https://overpass-api.de/api/interpreter',
  timeout: 60,
  maxRetries: 3,
  retryDelay: 4000, // milliseconds
  useCache: true,
  cacheDir: '.osm_cache',

  // Search radii (in meters)
  radiusLifts: 500,
  radiusRuns: 500,
  radiusSkiSchools: 500,
  radiusPassOffices: 500,
  radiusRestaurants: 500,
  radiusShops: 500,
  radiusTransport: 500,
  radiusParking: 500,
  hotelFacilitiesRadius: 40,

  // Get maximum radius
  get maxRadius() {
    return Math.max(
      this.radiusLifts,
      this.radiusRuns,
      this.radiusSkiSchools,
      this.radiusPassOffices,
      this.radiusRestaurants,
      this.radiusShops,
      this.radiusTransport,
      this.radiusParking
    );
  },

  // Lift type priorities (lower = better)
  liftTypePriority: {
    'cable_car': 1,
    'gondola': 2,
    'chair_lift': 3,
    'mixed_lift': 4,
    'drag_lift': 5,
    't-bar': 6,
    'platter': 6,
    'unknown': 7
  }
};

module.exports = OSM_CONFIG;
