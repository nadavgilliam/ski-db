const RAPIDAPI_CONFIG = require('../config/rapidBooking');

class HotelService {
  async searchHotels({ latitude, longitude, checkinDate, checkoutDate, adults, rooms = 1 }) {
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
      url.searchParams.append('order_by', 'distance');

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
    // Take top 10 closest hotels
    return hotels.slice(0, 10).map(hotel => ({
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