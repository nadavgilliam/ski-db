const aiService = require('../services/aiService');

async function testAIWithOSM() {
  console.log('Testing AI Service with OSM Tool Integration...\n');
  console.log('This test will check if GPT-4 can call the new analyze_location_amenities tool\n');

  try {
    const userPreferences = `
I want to plan a ski trip in January 2026 (around Jan 15-20).
I'm traveling from Tel Aviv with my partner (2 adults).
Budget: around €2500 total.

IMPORTANT: I really care about nightlife and après-ski! I want a resort with good bars,
restaurants, and nightclubs. Also, I want to know about ski rental shops and amenities
in the area. Please analyze the local area thoroughly.
    `;

    const recommendation = await aiService.planSkiTrip(userPreferences);

    console.log('='.repeat(80));
    console.log('AI RECOMMENDATION:');
    console.log('='.repeat(80));
    console.log(JSON.stringify(recommendation, null, 2));
    console.log('='.repeat(80));

    // Check if OSM data was used
    const recommendationStr = JSON.stringify(recommendation);
    if (recommendationStr.includes('nightlife') || recommendationStr.includes('bars') ||
        recommendationStr.includes('amenities') || recommendationStr.includes('lifts')) {
      console.log('\n✅ OSM tool appears to have been used successfully!');
    } else {
      console.log('\n⚠️  OSM tool may not have been used');
    }

  } catch (error) {
    console.error('❌ Test failed:', error.message);
    console.error(error);
  }
}

testAIWithOSM();
