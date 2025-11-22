const flightService = require('../services/flightService');

async function testFlightService() {
  console.log('Testing Flight Service...\n');

  // Test 1: Regular search (with stops allowed)
  console.log('=== Test 1: Regular Flight Search (stops allowed) ===\n');
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

  } catch (error) {
    console.error('❌ Test 1 Error:', error.message);
  }

  // Test 2: Non-stop flights only
  console.log('\n=== Test 2: Non-Stop Flights Only ===\n');
  try {
    const results = await flightService.searchFlights({
      origin: 'TLV',
      destination: 'GVA',
      departureDate: '2026-01-15',
      returnDate: '2026-01-20',
      adults: 2,
      nonStop: true
    });

    console.log(`✅ Found ${results.length} non-stop flights\n`);

    // Show all non-stop flights
    results.forEach((flight, i) => {
      console.log(`Flight ${i + 1}:`);
      console.log(`  Price: ${flight.price.currency} ${flight.price.total}`);
      console.log(`  Outbound: ${flight.outbound.departure} → ${flight.outbound.arrival}`);
      console.log(`  Duration: ${flight.outbound.duration}, Stops: ${flight.outbound.stops}`);
      console.log(`  Return: ${flight.return.departure} → ${flight.return.arrival}`);
      console.log(`  Duration: ${flight.return.duration}, Stops: ${flight.return.stops}`);
      console.log('');

      // Verify they are actually non-stop
      if (flight.outbound.stops > 0 || flight.return.stops > 0) {
        console.log('⚠️  WARNING: This flight has stops but should be non-stop!');
      }
    });

    if (results.length === 0) {
      console.log('ℹ️  No non-stop flights found for this route (this is expected for some routes)\n');
    }

  } catch (error) {
    console.error('❌ Test 2 Error:', error.message);
  }

  console.log('\n✅ Flight Service tests completed!');
}

testFlightService();