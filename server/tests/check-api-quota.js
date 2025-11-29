const RAPIDAPI_CONFIG = require('../config/rapidBooking');

/**
 * Check RapidAPI quota usage by making a test request
 * and examining the response headers
 */
async function checkQuota() {
  console.log('🔍 Checking RapidAPI Booking.com quota usage...\n');

  try {
    const url = new URL('https://booking-com.p.rapidapi.com/v2/hotels/search-by-coordinates');

    // Minimal test request (Val Thorens)
    url.searchParams.append('latitude', 45.2975);
    url.searchParams.append('longitude', 6.5802);
    url.searchParams.append('checkin_date', '2026-01-15');
    url.searchParams.append('checkout_date', '2026-01-20');
    url.searchParams.append('adults_number', 2);
    url.searchParams.append('room_number', 1);
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

    // Extract quota information from headers
    const headers = response.headers;

    console.log('📊 QUOTA INFORMATION:');
    console.log('='.repeat(60));

    const remaining = headers.get('x-ratelimit-requests-remaining');
    const limit = headers.get('x-ratelimit-requests-limit');
    const reset = headers.get('x-ratelimit-requests-reset');

    if (remaining !== null) {
      console.log(`✅ Requests Remaining: ${remaining}`);
    } else {
      console.log('⚠️  Requests Remaining: Not available in headers');
    }

    if (limit !== null) {
      console.log(`📦 Total Quota Limit: ${limit}`);
    } else {
      console.log('⚠️  Total Quota Limit: Not available in headers');
    }

    if (reset !== null) {
      const resetDate = new Date(parseInt(reset) * 1000);
      console.log(`🔄 Quota Resets In: ${reset} seconds (${resetDate.toLocaleString()})`);
    } else {
      console.log('⚠️  Quota Reset Time: Not available in headers');
    }

    if (remaining && limit) {
      const used = parseInt(limit) - parseInt(remaining);
      const percentUsed = ((used / parseInt(limit)) * 100).toFixed(1);
      console.log(`📈 Usage: ${used}/${limit} (${percentUsed}% used)`);

      if (percentUsed > 85) {
        console.log('⚠️  WARNING: You have used over 85% of your quota!');
      } else if (percentUsed > 50) {
        console.log('⚠️  CAUTION: You have used over 50% of your quota');
      } else {
        console.log('✅ You have plenty of quota remaining');
      }
    }

    console.log('='.repeat(60));

    console.log('\n📋 ALL RESPONSE HEADERS:');
    console.log('='.repeat(60));
    headers.forEach((value, key) => {
      if (key.toLowerCase().includes('rate') || key.toLowerCase().includes('limit')) {
        console.log(`${key}: ${value}`);
      }
    });
    console.log('='.repeat(60));

    console.log('\n💡 TIP: To check your detailed usage history:');
    console.log('   Visit: https://rapidapi.com/developer/billing/subscriptions-and-usage');

  } catch (error) {
    console.error('❌ Error checking quota:', error.message);
  }
}

checkQuota();
