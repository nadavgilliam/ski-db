require('dotenv').config();

async function searchHotelsNearValThorens() {
  // Val Thorens coordinates
  const latitude = 45.2975;
  const longitude = 6.5802;
  
  // Search parameters
  const checkinDate = '2026-01-15';
  const checkoutDate = '2026-01-20';
  const adults = 2;
  const rooms = 1;

  const url = new URL('https://booking-com.p.rapidapi.com/v2/hotels/search-by-coordinates');
  
  // Add query parameters
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
  url.searchParams.append('order_by', 'distance'); // Sort by distance (closest first)

  console.log('🔍 Searching for hotels near Val Thorens...');
  console.log(`Coordinates: ${latitude}, ${longitude}`);
  console.log(`Dates: ${checkinDate} to ${checkoutDate}`);
  console.log(`Guests: ${adults} adults, ${rooms} room\n`);

  try {
    const response = await fetch(url, {
      method: 'GET',
      headers: {
        'x-rapidapi-host': 'booking-com.p.rapidapi.com',
        'x-rapidapi-key': process.env.RAPIDAPI_KEY
      }
    });

    if (!response.ok) {
      throw new Error(`HTTP error! status: ${response.status}`);
    }

    const data = await response.json();

    console.log('✅ API Response received!\n');
    
    if (data.results && data.results.length > 0) {
      console.log(`Total found: ${data.count || data.results.length} hotels`);
      console.log('Showing closest 3 hotels...\n');
      
      // Helper function to calculate distance
      function calculateDistance(lat1, lon1, lat2, lon2) {
        const R = 6371;
        const dLat = (lat2 - lat1) * (Math.PI / 180);
        const dLon = (lon2 - lon1) * (Math.PI / 180);
        const a = 
          Math.sin(dLat / 2) * Math.sin(dLat / 2) +
          Math.cos(lat1 * (Math.PI / 180)) * Math.cos(lat2 * (Math.PI / 180)) *
          Math.sin(dLon / 2) * Math.sin(dLon / 2);
        const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
        return R * c;
      }
      
      // Display ONLY first 3 hotels with CORRECT field names
      console.log('=== Top 3 Closest Hotels ===\n');
      data.results.slice(0, 3).forEach((hotel, index) => {
        const distance = calculateDistance(latitude, longitude, hotel.latitude, hotel.longitude);
        const pricePerNight = hotel.priceBreakdown?.grossPrice?.value 
          ? (hotel.priceBreakdown.grossPrice.value / 5).toFixed(2) 
          : 'N/A';
        
        console.log(`${index + 1}. ${hotel.name}`);
        console.log(`   Property ID: ${hotel.id}`);
        console.log(`   Distance: ${distance.toFixed(2)} km from Val Thorens center`);
        console.log(`   Total Price: €${hotel.priceBreakdown?.grossPrice?.value || 'N/A'} (5 nights)`);
        console.log(`   Per Night: €${pricePerNight}`);
        console.log(`   Review: ${hotel.reviewScore || 'N/A'}/10 (${hotel.reviewScoreWord || 'N/A'}) - ${hotel.reviewCount || 0} reviews`);
        console.log(`   Property Type: ${hotel.propertyType || 'N/A'}`);
        console.log(`   Accommodation: ${hotel.proposedAccommodation?.join(', ') || 'N/A'}`);
        console.log('');
      });

      // Show ONLY the first hotel's full structure
      console.log('\n=== Full Structure of First Hotel ===');
      console.log(JSON.stringify(data.results[0], null, 2));

    } else {
      console.log('⚠️  No hotels found');
    }

  } catch (error) {
    console.error('❌ Error:', error.message);
  }
}

searchHotelsNearValThorens();