const hotelService = require('../services/hotelService');

async function testHotelService() {
  console.log('Testing Hotel Service...\n');

  try {
    // Val Thorens coordinates
    const results = await hotelService.searchHotels({
      latitude: 45.2975,
      longitude: 6.5802,
      checkinDate: '2026-01-15',
      checkoutDate: '2026-01-20',
      adults: 2,
      rooms: 1
    });

    console.log(`✅ Found ${results.length} hotels\n`);
    
    // Show first 3 hotels
    results.slice(0, 3).forEach((hotel, i) => {
      console.log(`Hotel ${i + 1}: ${hotel.name}`);
      console.log(`  Price: ${hotel.price.currency} ${hotel.price.total} (total)`);
      console.log(`  Distance: ${hotel.location.distance} km`);
      console.log(`  Rating: ${hotel.rating.score}/10 (${hotel.rating.word})`);
      console.log(`  Type: ${hotel.propertyType}`);
      console.log('');
    });

    console.log('✅ Hotel Service working correctly!');

  } catch (error) {
    console.error('❌ Hotel Service Error:', error.message);
  }
}

testHotelService();