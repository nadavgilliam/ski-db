// Load environment variables
require('dotenv').config();

// Import Amadeus SDK
const Amadeus = require('amadeus');

// Initialize Amadeus client
const amadeus = new Amadeus({
  clientId: process.env.AMADEUS_CLIENT_ID,
  clientSecret: process.env.AMADEUS_CLIENT_SECRET
});

// Simple flight search function
async function searchFlights() {
  try {
    console.log('Searching for flights...\n');
    
    const response = await amadeus.shopping.flightOffersSearch.get({
      originLocationCode: 'TLV',  // Tel Aviv
      destinationLocationCode: 'GVA',  // Geneva (close to ski resorts)
      departureDate: '2025-12-20',
      returnDate: '2025-12-27',
      adults: '1',
      max: '1'  // Limit to 3 results for now
    });

    console.log('✅ Success! Found flights:');
    console.log(JSON.stringify(response.data, null, 2));
    
    // Let's also look at the structure
    console.log('\n--- Flight Offer Structure ---');
    if (response.data && response.data.length > 0) {
      const firstOffer = response.data[0];
      console.log('Price:', firstOffer.price);
      console.log('Number of bookable seats:', firstOffer.numberOfBookableSeats);
      console.log('Itineraries:', firstOffer.itineraries.length);
    }
    
  } catch (error) {
    console.error('❌ Error searching flights:');
    console.error('Status:', error.response?.statusCode);
    console.error('Message:', error.response?.body || error.message);
  }
}

// Run the search
searchFlights();