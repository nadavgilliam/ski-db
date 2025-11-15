const flightService = require('../services/flightService');

async function testFlightService() {
  console.log('Testing Flight Service...\n');

  try {
    const results = await flightService.searchFlights({
      origin: 'TLV',
      destination: 'GVA',
      departureDate: '2026-01-15',
      returnDate: '2026-01-20',
      adults: 2
    });

    console.log(`✅ Found ${results.length} flights\n`);
    
    // Show first 2 flights
    results.slice(0, 2).forEach((flight, i) => {
      console.log(`Flight ${i + 1}:`);
      console.log(`  Price: ${flight.price.currency} ${flight.price.total}`);
      console.log(`  Outbound: ${flight.outbound.departure} → ${flight.outbound.arrival}`);
      console.log(`  Duration: ${flight.outbound.duration}, Stops: ${flight.outbound.stops}`);
      console.log(`  Return: ${flight.return.departure} → ${flight.return.arrival}`);
      console.log(`  Duration: ${flight.return.duration}, Stops: ${flight.return.stops}`);
      console.log('');
    });

    console.log('✅ Flight Service working correctly!');

  } catch (error) {
    console.error('❌ Flight Service Error:', error.message);
  }
}

testFlightService();