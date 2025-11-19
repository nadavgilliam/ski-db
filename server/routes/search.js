const express = require('express');
const router = express.Router();
const aiService = require('../services/aiService');

// POST /api/search
router.post('/', async (req, res) => {
  try {
    console.log('📥 Received search request:', req.body);

    const { origin, dates, adults, budget, preferences } = req.body;

    if (!origin || !dates || !adults) {
      return res.status(400).json({
        success: false,
        error: 'Missing required fields: origin, dates, adults'
      });
    }

    // Build natural language prompt
    const userPrompt = `
I want to plan a ski trip with the following preferences:

- Departure city: ${origin}
- Travel dates: ${dates.departure} to ${dates.return}
- Number of travelers: ${adults} adult${adults > 1 ? 's' : ''}
- Budget: ${budget ? `€${budget}` : 'Flexible'}
- Additional preferences: ${preferences || 'Looking for good value and convenience'}

Please search resorts first, then find flights and hotels for the best match.
    `.trim();

    // Call AI service
    const aiResponse = await aiService.planSkiTrip(userPrompt);

    // Return successful response with structured data
    res.json({
      success: true,
      data: {
        recommendations: aiResponse.recommendations || [],
        summary: aiResponse.summary || 'No summary available',
        searchParams: {
          origin,
          dates,
          adults,
          budget
        }
      }
    });

  } catch (error) {
    console.error('❌ Search error:', error);
    res.status(500).json({
      success: false,
      error: error.message || 'Search failed'
    });
  }
});

// GET /api/search/health
router.get('/health', (req, res) => {
  res.json({
    success: true,
    message: 'Ski planner API is running',
    timestamp: new Date().toISOString()
  });
});

module.exports = router;