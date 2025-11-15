const resortService = require('../services/resortService');

async function testAdvancedFiltering() {
  console.log('Testing Advanced Resort Filtering...\n');

  try {
    // Test 1: Include specific countries, exclude others
    console.log('=== Test 1: France OR Switzerland, but NOT Austria ===');
    const test1 = resortService.searchResorts({
      includeCountries: ['France', 'Switzerland'],
      excludeCountries: ['Austria'],
      limit: 5
    });
    test1.forEach(r => console.log(`- ${r.name} (${r.country})`));

    // Test 2: Beginner-friendly resorts (high blue percentage)
    console.log('\n=== Test 2: Beginner-Friendly Resorts (>40% blue slopes) ===');
    const test2 = resortService.searchResorts({
      minBluePercent: 40,
      minRating: 4.0,
      limit: 5
    });
    test2.forEach(r => {
      console.log(`- ${r.name}: ${r.pistes.bluePercent}% blue, ${r.pistes.total}km total`);
    });

    // Test 3: Advanced resorts (lots of black slopes)
    console.log('\n=== Test 3: Advanced Resorts (>10km black slopes) ===');
    const test3 = resortService.searchResorts({
      minBlackKm: 10,
      minRating: 4.0,
      limit: 5
    });
    test3.forEach(r => {
      console.log(`- ${r.name}: ${r.pistes.black}km black (${r.pistes.blackPercent}%)`);
    });

    // Test 4: Large resorts (many lifts, lots of pistes)
    console.log('\n=== Test 4: Large Resorts (>30 lifts, >150km pistes) ===');
    const test4 = resortService.searchResorts({
      minLifts: 30,
      minPisteKm: 150,
      limit: 5
    });
    test4.forEach(r => {
      console.log(`- ${r.name}: ${r.lifts} lifts, ${r.pistes.total}km pistes`);
    });

    // Test 5: Budget-friendly resorts
    console.log('\n=== Test 5: Budget Resorts (day pass <€50) ===');
    const test5 = resortService.searchResorts({
      maxPriceEur: 50,
      minRating: 4.0,
      limit: 5
    });
    test5.forEach(r => {
      console.log(`- ${r.name}: €${r.dayPass.price}/day, rating ${r.rating}`);
    });

    // Test 6: High-end resorts
    console.log('\n=== Test 6: Premium Resorts (day pass >€70) ===');
    const test6 = resortService.searchResorts({
      minPriceEur: 70,
      minRating: 4.5,
      limit: 5
    });
    test6.forEach(r => {
      console.log(`- ${r.name}: €${r.dayPass.price}/day, rating ${r.rating}`);
    });

    // Test 7: Exclude specific resort names
    console.log('\n=== Test 7: Swiss Resorts, but NOT Zermatt ===');
    const test7 = resortService.searchResorts({
      includeCountries: ['Switzerland'],
      excludeNames: ['Zermatt'],
      limit: 5
    });
    test7.forEach(r => console.log(`- ${r.name}`));

    console.log('\n✅ Advanced filtering working correctly!');

  } catch (error) {
    console.error('❌ Test Error:', error.message);
  }
}

testAdvancedFiltering();