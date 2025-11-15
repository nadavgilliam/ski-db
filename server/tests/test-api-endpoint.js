async function testAPIEndpoint() {
  console.log('Testing API Endpoint...\n');

  const testPayload = {
    origin: 'Tel Aviv',
    dates: {
      departure: '2026-01-15',
      return: '2026-01-20'
    },
    adults: 2,
    budget: 2500,
    preferences: 'I prefer hotels close to the slopes with good ratings'
  };

  try {
    console.log('📤 Sending request to API...');
    console.log('Payload:', JSON.stringify(testPayload, null, 2));

    const response = await fetch('http://localhost:3000/api/search', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json'
      },
      body: JSON.stringify(testPayload)
    });

    const data = await response.json();

    if (data.success) {
      console.log('\n✅ API Request Successful!\n');
      console.log('='.repeat(80));
      console.log('RECOMMENDATION:');
      console.log('='.repeat(80));
      console.log(data.data.recommendation);
      console.log('='.repeat(80));
    } else {
      console.error('\n❌ API Request Failed:');
      console.error(data.error);
    }

  } catch (error) {
    console.error('❌ Request error:', error.message);
  }
}

testAPIEndpoint();