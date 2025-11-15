const aiService = require('../services/aiService');

async function testAIService() {
  console.log('Testing AI Service with Tool Use...\n');
  console.log('This may take 30-60 seconds as GPT searches flights and hotels...\n');

  try {
    const userPreferences = `
I want to plan a ski trip in January 2026 (around Jan 15-20).
I'm traveling from Tel Aviv with my partner (2 adults).
My budget is around €2000-3000 total for flights and accommodation.
I prefer well-rated hotels close to the slopes.
Please find me the best options!
    `;

    const recommendation = await aiService.planSkiTrip(userPreferences);

    console.log('='.repeat(80));
    console.log('AI RECOMMENDATION:');
    console.log('='.repeat(80));
    console.log(recommendation);
    console.log('='.repeat(80));

  } catch (error) {
    console.error('❌ Test failed:', error.message);
  }
}

testAIService();