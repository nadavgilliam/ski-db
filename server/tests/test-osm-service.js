const osmService = require('../services/osmService');

async function testOSMService() {
  console.log('Testing OSM Service...\n');

  try {
    // Val Thorens coordinates (same as Python test)
    const hotelLat = 45.29793969030922;
    const hotelLon = 6.5832264545347305;
    const hotelName = 'Test Hotel Val Thorens';

    console.log(`Analyzing location: ${hotelName}`);
    console.log(`Coordinates: ${hotelLat}, ${hotelLon}\n`);

    const results = await osmService.analyzeLocation(hotelLat, hotelLon, hotelName);

    console.log('\n' + '='.repeat(60));
    console.log('ANALYSIS RESULTS');
    console.log('='.repeat(60) + '\n');

    // Lifts
    console.log('LIFTS:');
    console.log(`  Total within ${results.lifts.search_radius_m}m: ${results.lifts.total_within_radius}`);
    console.log('  Nearest 3:');
    results.lifts.nearest_3.forEach((lift, i) => {
      console.log(`    ${i + 1}. ${lift.name}`);
      console.log(`       Type: ${lift.type}, Station: ${lift.station_type || 'unknown'}`);
      console.log(`       Distance: ${lift.distance_m}m`);
    });
    console.log();

    // Runs
    console.log('RUNS:');
    console.log(`  Total within ${results.runs.search_radius_m}m: ${results.runs.total_within_radius}`);
    console.log('  Nearest 3:');
    results.runs.nearest_3.forEach((run, i) => {
      console.log(`    ${i + 1}. ${run.name} (${run.difficulty})`);
      console.log(`       Distance: ${run.distance_m}m ${run.distance_note}`);
    });
    console.log(`  Difficulty distribution: ${JSON.stringify(results.runs.difficulty_distribution)}`);
    console.log();

    // Ski Schools
    console.log('SKI SCHOOLS:');
    console.log(`  Total within ${results.ski_schools.search_radius_m}m: ${results.ski_schools.total_within_radius}`);
    console.log(`  Hotel has ski school: ${results.ski_schools.hotel_has_ski_school}`);
    if (results.ski_schools.nearest_3.length > 0) {
      console.log('  Nearest 3:');
      results.ski_schools.nearest_3.forEach((school, i) => {
        console.log(`    ${i + 1}. ${school.name} (${school.distance_m}m)`);
      });
    }
    console.log();

    // Official Ski Pass Offices
    console.log('OFFICIAL SKI PASS OFFICES:');
    console.log(`  Total within ${results.official_ski_pass_offices.search_radius_m}m: ${results.official_ski_pass_offices.total_within_radius}`);
    console.log(`  Hotel has pass office: ${results.official_ski_pass_offices.hotel_has_pass_office}`);
    if (results.official_ski_pass_offices.nearest_3.length > 0) {
      console.log('  Nearest 3:');
      results.official_ski_pass_offices.nearest_3.forEach((office, i) => {
        console.log(`    ${i + 1}. ${office.name} (${office.distance_m}m)`);
      });
    }
    console.log();

    // Public Transport
    console.log('PUBLIC TRANSPORT:');
    console.log(`  Total stops within ${results.public_transport.search_radius_m}m: ${results.public_transport.total_within_radius}`);
    console.log(`  Closest by type (max 1 per type):`);
    results.public_transport.closest_by_type.forEach((stop, i) => {
      console.log(`    ${i + 1}. ${stop.name || '(unnamed)'} (${stop.type}) - ${stop.distance_m}m`);
    });
    console.log();

    // Public Parking Lots
    console.log('PUBLIC PARKING LOTS:');
    console.log(`  Total lots within ${results.public_parking_lots.search_radius_m}m: ${results.public_parking_lots.total_within_radius}`);
    if (results.public_parking_lots.closest_lot) {
      console.log('  Closest lot:');
      const lot = results.public_parking_lots.closest_lot;
      console.log(`    ${lot.name} - ${lot.distance_m}m`);
      if (lot.fee) console.log(`    Fee: ${lot.fee}`);
      if (lot.capacity) console.log(`    Capacity: ${lot.capacity}`);
    } else {
      console.log('  No parking lots found');
    }
    console.log();

    // Food & Drink
    console.log('FOOD & DRINK:');
    console.log(`  Restaurants/Cafes: ${results.food_stats.restaurants_like}`);
    console.log(`  Bars/Pubs: ${results.food_stats.bars_like}`);
    console.log(`  Nightclubs: ${results.food_stats.nightclubs}`);
    console.log(`  Nightlife total: ${results.food_stats.nightlife_total}`);
    console.log();

    // Shops
    console.log('SHOPS:');
    console.log(`  Total shops: ${results.shops.total_shops}`);
    console.log(`  Ski rental shops: ${results.shops.ski_rental_count}`);
    console.log(`  Shop types found: ${Object.keys(results.shops.shops_by_type).length}`);
    console.log('  Closest by type (first 5):');

    // Show first 5 shop types with their closest shop
    Object.entries(results.shops.shops_by_type).slice(0, 5).forEach(([type, data]) => {
      console.log(`    ${type}: ${data.total_within_radius} found, closest "${data.closest.name || '(unnamed)'}" at ${data.closest.distance_m}m`);
    });
    console.log();

    // Hotel
    console.log('HOTEL:');
    if (results.hotel.name) {
      console.log(`  Name: ${results.hotel.name}`);
      console.log(`  Category: ${results.hotel.category}`);
      console.log(`  Stars: ${results.hotel.stars || 'N/A'}`);
      console.log(`  Distance: ${results.hotel.distance_m}m`);
      console.log('  Facilities:');
      console.log(`    Spa: ${results.hotel.has_spa}`);
      console.log(`    Pool: ${results.hotel.has_pool}`);
      console.log(`    Sauna: ${results.hotel.has_sauna}`);
      console.log(`    Playground: ${results.hotel.has_playground}`);
      console.log(`    Childcare: ${results.hotel.has_childcare}`);
    } else {
      console.log('  No hotel object found near coordinates');
    }
    console.log();

    console.log('='.repeat(60));
    console.log('Full JSON Output:');
    console.log('='.repeat(60));
    console.log(JSON.stringify(results, null, 2));

    console.log('\n✅ OSM Service working correctly!');

  } catch (error) {
    console.error('❌ OSM Service Error:', error.message);
    console.error(error.stack);
  }
}

testOSMService();
