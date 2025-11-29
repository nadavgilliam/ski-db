const RAPIDAPI_CONFIG = require('../config/rapidBooking');

class HotelService {
  async searchHotels({ latitude, longitude, checkinDate, checkoutDate, adults, rooms = 1, orderBy = 'review_score', minStarRating, propertyTypes, freeCancellation, minReviewCount }) {
    try {
      const url = new URL('https://booking-com.p.rapidapi.com/v2/hotels/search-by-coordinates');

      url.searchParams.append('latitude', latitude);
      url.searchParams.append('longitude', longitude);
      url.searchParams.append('checkin_date', checkinDate);
      url.searchParams.append('checkout_date', checkoutDate);
      url.searchParams.append('adults_number', adults);
      url.searchParams.append('room_number', rooms);
      url.searchParams.append('units', 'metric');
      url.searchParams.append('page_number', 0);
      url.searchParams.append('locale', 'en-gb');
      url.searchParams.append('filter_by_currency', 'EUR');
      url.searchParams.append('order_by', orderBy);

      // Add star rating filter if specified
      if (minStarRating) {
        // API expects comma-separated list of star ratings to include
        // e.g., "3,4,5" for 3+ stars
        const starRatings = [];
        for (let i = parseInt(minStarRating); i <= 5; i++) {
          starRatings.push(i);
        }
        url.searchParams.append('filter_by_star_rating', starRatings.join(','));
      }

      // Add free cancellation filter if specified
      if (freeCancellation) {
        url.searchParams.append('filter_by_free_cancellation', '1');
      }

      // Add property type filter if specified
      // Note: The Booking.com API may not directly support property type filtering via URL params
      // We'll implement client-side filtering after receiving results if the API doesn't support it
      // For now, we'll store this for post-processing
      this._propertyTypeFilter = propertyTypes;

      // Store review count filter for client-side filtering
      // Note: The Booking.com API does not support review count filtering via URL params
      this._minReviewCount = minReviewCount;

      const response = await fetch(url, {
        method: 'GET',
        headers: {
          'x-rapidapi-host': RAPIDAPI_CONFIG.host,
          'x-rapidapi-key': RAPIDAPI_CONFIG.key
        }
      });

      if (!response.ok) {
        throw new Error(`HTTP error! status: ${response.status}`);
      }

      const data = await response.json();
      return this.formatHotelResults(data.results, latitude, longitude);
    } catch (error) {
      console.error('Hotel search error:', error);
      throw new Error(`Hotel search failed: ${error.message}`);
    }
  }

  formatHotelResults(hotels, centerLat, centerLon) {
    // Return all hotels from API (typically ~20 results)
    let results = hotels.map(hotel => ({
      id: hotel.id,
      name: hotel.name,
      price: {
        total: hotel.priceBreakdown?.grossPrice?.value,
        currency: hotel.currency
      },
      location: {
        latitude: hotel.latitude,
        longitude: hotel.longitude,
        distance: this.calculateDistance(centerLat, centerLon, hotel.latitude, hotel.longitude)
      },
      rating: {
        score: hotel.reviewScore,
        word: hotel.reviewScoreWord,
        count: hotel.reviewCount
      },
      propertyType: hotel.propertyType
    }));

    // Apply client-side property type filtering if specified
    if (this._propertyTypeFilter && this._propertyTypeFilter.length > 0) {
      results = results.filter(hotel => {
        if (!hotel.propertyType) return false;

        // Normalize property type from API to match our filter values
        const propertyTypeLower = hotel.propertyType.toLowerCase();

        return this._propertyTypeFilter.some(filterType => {
          switch(filterType) {
            case 'hotel':
              return propertyTypeLower.includes('hotel') || propertyTypeLower.includes('resort');
            case 'apartment':
              return propertyTypeLower.includes('apartment') || propertyTypeLower.includes('aparthotel');
            case 'chalet':
              return propertyTypeLower.includes('chalet');
            case 'hostel':
              return propertyTypeLower.includes('hostel');
            case 'bnb':
              return propertyTypeLower.includes('b&b') ||
                     propertyTypeLower.includes('bed and breakfast') ||
                     propertyTypeLower.includes('guest house') ||
                     propertyTypeLower.includes('guesthouse');
            default:
              return false;
          }
        });
      });

      // Clear the filter after use
      this._propertyTypeFilter = null;
    }

    // Apply client-side review count filtering if specified
    if (this._minReviewCount) {
      results = results.filter(hotel => {
        return hotel.rating.count >= 50;
      });

      // Clear the filter after use
      this._minReviewCount = null;
    }

    return results;
  }

  calculateDistance(lat1, lon1, lat2, lon2) {
    const R = 6371;
    const dLat = (lat2 - lat1) * (Math.PI / 180);
    const dLon = (lon2 - lon1) * (Math.PI / 180);
    const a = 
      Math.sin(dLat / 2) * Math.sin(dLat / 2) +
      Math.cos(lat1 * (Math.PI / 180)) * Math.cos(lat2 * (Math.PI / 180)) *
      Math.sin(dLon / 2) * Math.sin(dLon / 2);
    const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
    return parseFloat((R * c).toFixed(2));
  }
}

module.exports = new HotelService();