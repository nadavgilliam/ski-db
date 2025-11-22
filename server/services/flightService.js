const amadeus = require('../config/amadeus');

class FlightService {
  async searchFlights({ origin, destination, departureDate, returnDate, adults, nonStop }) {
    try {
      const searchParams = {
        originLocationCode: origin,
        destinationLocationCode: destination,
        departureDate: departureDate,
        returnDate: returnDate,
        adults: adults.toString(),
        max: '3',
        ...(nonStop === true && { nonStop: 'true' })
      };

      const response = await amadeus.shopping.flightOffersSearch.get(searchParams);

      return this.formatFlightResults(response.data);
    } catch (error) {
      console.error('Flight search error:', error);
      throw new Error(`Flight search failed: ${error.message}`);
    }
  }

  formatFlightResults(flights) {
    // Format the raw Amadeus data into cleaner structure
    return flights.map(flight => ({
      id: flight.id,
      price: {
        total: flight.price.grandTotal,
        currency: flight.price.currency
      },
      outbound: {
        departure: flight.itineraries[0].segments[0].departure.at,
        arrival: flight.itineraries[0].segments[flight.itineraries[0].segments.length - 1].arrival.at,
        duration: flight.itineraries[0].duration,
        stops: flight.itineraries[0].segments.length - 1
      },
      return: {
        departure: flight.itineraries[1].segments[0].departure.at,
        arrival: flight.itineraries[1].segments[flight.itineraries[1].segments.length - 1].arrival.at,
        duration: flight.itineraries[1].duration,
        stops: flight.itineraries[1].segments.length - 1
      }
    }));
  }
}

module.exports = new FlightService();