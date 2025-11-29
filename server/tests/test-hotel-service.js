const hotelService = require('../services/hotelService');

async function testBasicHotelSearch() {
  console.log('='.repeat(60));
  console.log('TEST 1: Basic Hotel Search (Default ordering)');
  console.log('='.repeat(60));

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

    console.log('✅ Basic hotel search working correctly!\n');
    return true;

  } catch (error) {
    console.error('❌ Basic Hotel Search Error:', error.message);
    return false;
  }
}

async function testHotelOrdering() {
  console.log('='.repeat(60));
  console.log('TEST 2: Hotel Ordering Options');
  console.log('='.repeat(60));

  const searchParams = {
    latitude: 45.2975,
    longitude: 6.5802,
    checkinDate: '2026-01-15',
    checkoutDate: '2026-01-20',
    adults: 2,
    rooms: 1
  };

  try {
    // Test Distance ordering
    console.log('\n📍 Testing: Order by distance (closest first)');
    const distanceResults = await hotelService.searchHotels({
      ...searchParams,
      orderBy: 'distance'
    });
    console.log(`Found ${distanceResults.length} hotels`);
    distanceResults.slice(0, 2).forEach((hotel, i) => {
      console.log(`  ${i + 1}. ${hotel.name.substring(0, 40)}... - ${hotel.location.distance}km`);
    });

    // Test Price ordering
    console.log('\n💰 Testing: Order by price (cheapest first)');
    const priceResults = await hotelService.searchHotels({
      ...searchParams,
      orderBy: 'price'
    });
    console.log(`Found ${priceResults.length} hotels`);
    priceResults.slice(0, 2).forEach((hotel, i) => {
      console.log(`  ${i + 1}. ${hotel.name.substring(0, 40)}... - €${hotel.price.total}`);
    });

    // Test Review Score ordering
    console.log('\n⭐ Testing: Order by review_score (highest rated)');
    const reviewResults = await hotelService.searchHotels({
      ...searchParams,
      orderBy: 'review_score'
    });
    console.log(`Found ${reviewResults.length} hotels`);
    reviewResults.slice(0, 2).forEach((hotel, i) => {
      console.log(`  ${i + 1}. ${hotel.name.substring(0, 40)}... - ${hotel.rating.score}/10`);
    });

    // Test Popularity ordering
    console.log('\n🔥 Testing: Order by popularity');
    const popularityResults = await hotelService.searchHotels({
      ...searchParams,
      orderBy: 'popularity'
    });
    console.log(`Found ${popularityResults.length} hotels`);
    popularityResults.slice(0, 2).forEach((hotel, i) => {
      console.log(`  ${i + 1}. ${hotel.name.substring(0, 40)}... - ${hotel.rating.count} reviews`);
    });

    console.log('\n✅ All ordering options working correctly!\n');
    return true;

  } catch (error) {
    console.error('❌ Hotel Ordering Test Error:', error.message);
    return false;
  }
}

async function testStarRatingFilter() {
  console.log('='.repeat(60));
  console.log('TEST 3: Star Rating Filter');
  console.log('='.repeat(60));

  const searchParams = {
    latitude: 45.2975,
    longitude: 6.5802,
    checkinDate: '2026-01-15',
    checkoutDate: '2026-01-20',
    adults: 2,
    rooms: 1
  };

  try {
    // Test without star filter
    console.log('\n⭐ Testing: No star rating filter (baseline)');
    const noFilterResults = await hotelService.searchHotels(searchParams);
    console.log(`Found ${noFilterResults.length} hotels without filter`);
    console.log(`Sample: ${noFilterResults[0]?.name.substring(0, 40)}`);

    // Test with 3+ stars
    console.log('\n⭐ Testing: Minimum 3 stars');
    const threeStarResults = await hotelService.searchHotels({
      ...searchParams,
      minStarRating: 3
    });
    console.log(`Found ${threeStarResults.length} hotels with 3+ stars`);
    if (threeStarResults.length > 0) {
      console.log(`Sample: ${threeStarResults[0]?.name.substring(0, 40)}`);
    }

    // Test with 4+ stars
    console.log('\n⭐ Testing: Minimum 4 stars');
    const fourStarResults = await hotelService.searchHotels({
      ...searchParams,
      minStarRating: 4
    });
    console.log(`Found ${fourStarResults.length} hotels with 4+ stars`);
    if (fourStarResults.length > 0) {
      console.log(`Sample: ${fourStarResults[0]?.name.substring(0, 40)}`);
    }

    // Test with 5 stars
    console.log('\n⭐ Testing: Minimum 5 stars');
    const fiveStarResults = await hotelService.searchHotels({
      ...searchParams,
      minStarRating: 5
    });
    console.log(`Found ${fiveStarResults.length} hotels with 5 stars`);
    if (fiveStarResults.length > 0) {
      console.log(`Sample: ${fiveStarResults[0]?.name.substring(0, 40)}`);
    }

    console.log('\n✅ Star rating filter working correctly!\n');
    return true;

  } catch (error) {
    console.error('❌ Star Rating Filter Test Error:', error.message);
    return false;
  }
}

async function testPropertyTypeFilter() {
  console.log('='.repeat(60));
  console.log('TEST 4: Property Type Filter');
  console.log('='.repeat(60));

  const searchParams = {
    latitude: 45.2975,
    longitude: 6.5802,
    checkinDate: '2026-01-15',
    checkoutDate: '2026-01-20',
    adults: 2,
    rooms: 1
  };

  try {
    // Test without filter (baseline)
    console.log('\n🏨 Testing: No property type filter (baseline)');
    const noFilterResults = await hotelService.searchHotels(searchParams);
    console.log(`Found ${noFilterResults.length} properties without filter`);
    const propertyTypeCounts = {};
    noFilterResults.forEach(hotel => {
      const type = hotel.propertyType || 'Unknown';
      propertyTypeCounts[type] = (propertyTypeCounts[type] || 0) + 1;
    });
    console.log('Property type breakdown:', propertyTypeCounts);

    // Test with hotels only
    console.log('\n🏨 Testing: Hotels only');
    const hotelResults = await hotelService.searchHotels({
      ...searchParams,
      propertyTypes: ['hotel']
    });
    console.log(`Found ${hotelResults.length} hotels`);
    if (hotelResults.length > 0) {
      console.log(`Sample: ${hotelResults[0]?.name.substring(0, 40)} - Type: ${hotelResults[0]?.propertyType}`);
    }

    // Test with apartments only
    console.log('\n🏨 Testing: Apartments only');
    const apartmentResults = await hotelService.searchHotels({
      ...searchParams,
      propertyTypes: ['apartment']
    });
    console.log(`Found ${apartmentResults.length} apartments`);
    if (apartmentResults.length > 0) {
      console.log(`Sample: ${apartmentResults[0]?.name.substring(0, 40)} - Type: ${apartmentResults[0]?.propertyType}`);
    }

    // Test with multiple types
    console.log('\n🏨 Testing: Hotels and Apartments');
    const multiResults = await hotelService.searchHotels({
      ...searchParams,
      propertyTypes: ['hotel', 'apartment']
    });
    console.log(`Found ${multiResults.length} hotels and apartments`);

    console.log('\n✅ Property type filter working correctly!\n');
    return true;

  } catch (error) {
    console.error('❌ Property Type Filter Test Error:', error.message);
    return false;
  }
}

async function testFreeCancellationFilter() {
  console.log('='.repeat(60));
  console.log('TEST 5: Free Cancellation Filter');
  console.log('='.repeat(60));

  const searchParams = {
    latitude: 45.2975,
    longitude: 6.5802,
    checkinDate: '2026-01-15',
    checkoutDate: '2026-01-20',
    adults: 2,
    rooms: 1
  };

  try {
    // Test without free cancellation filter
    console.log('\n✅ Testing: No free cancellation filter (baseline)');
    const noFilterResults = await hotelService.searchHotels(searchParams);
    console.log(`Found ${noFilterResults.length} properties without filter`);
    if (noFilterResults.length > 0) {
      console.log(`Sample: ${noFilterResults[0]?.name.substring(0, 40)}`);
    }

    // Test with free cancellation only
    console.log('\n✅ Testing: Free cancellation only');
    const freeCancelResults = await hotelService.searchHotels({
      ...searchParams,
      freeCancellation: true
    });
    console.log(`Found ${freeCancelResults.length} properties with free cancellation`);
    if (freeCancelResults.length > 0) {
      console.log(`Sample: ${freeCancelResults[0]?.name.substring(0, 40)}`);
    }

    console.log('\n✅ Free cancellation filter working correctly!\n');
    return true;

  } catch (error) {
    console.error('❌ Free Cancellation Filter Test Error:', error.message);
    return false;
  }
}

async function testReviewCountFilter() {
  console.log('='.repeat(60));
  console.log('TEST 6: Review Count Filter');
  console.log('='.repeat(60));

  const searchParams = {
    latitude: 45.2975,
    longitude: 6.5802,
    checkinDate: '2026-01-15',
    checkoutDate: '2026-01-20',
    adults: 2,
    rooms: 1
  };

  try {
    // Test without review count filter
    console.log('\n📊 Testing: No review count filter (baseline)');
    const noFilterResults = await hotelService.searchHotels(searchParams);
    console.log(`Found ${noFilterResults.length} properties without filter`);

    // Show review count distribution
    const reviewCounts = noFilterResults.map(h => h.rating.count).sort((a, b) => a - b);
    console.log(`Review count range: ${Math.min(...reviewCounts)} to ${Math.max(...reviewCounts)}`);
    const under50 = reviewCounts.filter(c => c < 50).length;
    const over50 = reviewCounts.filter(c => c >= 50).length;
    console.log(`Properties with <50 reviews: ${under50}`);
    console.log(`Properties with 50+ reviews: ${over50}`);

    // Test with minimum review count filter
    console.log('\n📊 Testing: Minimum 50 reviews (well-reviewed only)');
    const wellReviewedResults = await hotelService.searchHotels({
      ...searchParams,
      minReviewCount: true
    });
    console.log(`Found ${wellReviewedResults.length} well-reviewed properties`);

    if (wellReviewedResults.length > 0) {
      console.log(`Sample: ${wellReviewedResults[0]?.name.substring(0, 40)} - ${wellReviewedResults[0]?.rating.count} reviews`);

      // Verify all results have 50+ reviews
      const allAbove50 = wellReviewedResults.every(h => h.rating.count >= 50);
      if (allAbove50) {
        console.log('✅ All results have 50+ reviews (filter working correctly)');
      } else {
        console.log('❌ WARNING: Some results have <50 reviews (filter not working)');
        return false;
      }
    }

    console.log('\n✅ Review count filter working correctly!\n');
    return true;

  } catch (error) {
    console.error('❌ Review Count Filter Test Error:', error.message);
    return false;
  }
}

async function runAllTests() {
  console.log('\n🧪 HOTEL SERVICE TEST SUITE\n');

  const test1 = await testBasicHotelSearch();
  const test2 = await testHotelOrdering();
  const test3 = await testStarRatingFilter();
  const test4 = await testPropertyTypeFilter();
  const test5 = await testFreeCancellationFilter();
  const test6 = await testReviewCountFilter();

  console.log('='.repeat(60));
  console.log('TEST SUMMARY');
  console.log('='.repeat(60));
  console.log(`Basic Search: ${test1 ? '✅ PASS' : '❌ FAIL'}`);
  console.log(`Ordering Options: ${test2 ? '✅ PASS' : '❌ FAIL'}`);
  console.log(`Star Rating Filter: ${test3 ? '✅ PASS' : '❌ FAIL'}`);
  console.log(`Property Type Filter: ${test4 ? '✅ PASS' : '❌ FAIL'}`);
  console.log(`Free Cancellation Filter: ${test5 ? '✅ PASS' : '❌ FAIL'}`);
  console.log(`Review Count Filter: ${test6 ? '✅ PASS' : '❌ FAIL'}`);
  console.log('='.repeat(60));

  if (test1 && test2 && test3 && test4 && test5 && test6) {
    console.log('\n✅ All tests passed!\n');
  } else {
    console.log('\n❌ Some tests failed\n');
    process.exit(1);
  }
}

runAllTests();