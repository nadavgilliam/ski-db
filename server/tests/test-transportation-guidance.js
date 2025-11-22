require('dotenv').config();
const transportService = require('../services/transportService');

console.log('Testing Transportation Guidance (Real API Calls)...\n');
console.log('⚠️  WARNING: This test makes real OpenAI API calls and will cost money!\n');

async function testTransportationGuidance() {
  const testCases = [
    {
      name: 'Geneva Airport to Val Thorens (French Alps)',
      from: 'GVA',
      resort: 'Val Thorens',
      country: 'France'
    },
    {
      name: 'Zurich Airport to Zermatt (Swiss Alps)',
      from: 'ZRH',
      resort: 'Zermatt',
      country: 'Switzerland'
    },
    {
      name: 'Innsbruck Airport to St. Anton (Austrian Alps)',
      from: 'INN',
      resort: 'St. Anton',
      country: 'Austria'
    }
  ];

  for (const testCase of testCases) {
    console.log('='.repeat(80));
    console.log(`🧪 TEST: ${testCase.name}`);
    console.log('='.repeat(80));

    try {
      const result = await transportService.getTransportationGuidance(
        testCase.from,
        testCase.resort,
        testCase.country
      );

      console.log('\n✅ SUCCESS! Response structure:');
      console.log('-------------------------------------------');
      console.log(JSON.stringify(result, null, 2));
      console.log('-------------------------------------------\n');

      // Validate structure
      if (!result.options || !Array.isArray(result.options)) {
        console.log('❌ ERROR: Missing or invalid "options" array');
      } else {
        console.log(`✓ Found ${result.options.length} transportation options`);

        result.options.forEach((option, index) => {
          console.log(`\n   Option ${index + 1}:`);
          console.log(`   • Mode: ${option.mode}`);
          console.log(`   • Provider: ${option.provider || 'N/A'}`);
          console.log(`   • Duration: ${option.duration_minutes} minutes (${(option.duration_minutes / 60).toFixed(1)} hours)`);
          console.log(`   • Cost: €${option.cost_eur} ${option.cost_type ? `(${option.cost_type})` : ''}`);
          console.log(`   • Description: ${option.description}`);
        });
      }

      if (result.notes) {
        console.log(`\n   📝 Additional notes: ${result.notes}`);
      }

      console.log('\n✅ Test passed!\n');

    } catch (error) {
      console.error('\n❌ TEST FAILED!');
      console.error('Error:', error.message);
      console.error('Stack:', error.stack);
      console.log('\n');
    }

    // Add a small delay between tests to avoid rate limiting
    if (testCases.indexOf(testCase) < testCases.length - 1) {
      console.log('⏳ Waiting 2 seconds before next test...\n');
      await new Promise(resolve => setTimeout(resolve, 2000));
    }
  }

  console.log('='.repeat(80));
  console.log('🏁 ALL TESTS COMPLETED');
  console.log('='.repeat(80));
}

// Run the tests
testTransportationGuidance().catch(error => {
  console.error('Fatal error:', error);
  process.exit(1);
});
