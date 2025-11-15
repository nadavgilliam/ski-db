const express = require('express');
const router = express.Router();
const aiService = require('../services/aiService');

// POST /api/search
router.post('/', async (req, res) => {
  try {
    console.log('📥 Received search request:', req.body);

    // Validate required fields
    const { origin, dates, adults, budget, preferences } = req.body;

    if (!origin || !dates || !adults) {
      return res.status(400).json({
        success: false,
        error: 'Missing required fields: origin, dates, adults'
      });
    }

    // Build natural language prompt from structured input
    const userPrompt = `
I want to plan a ski trip with the following preferences:

- Departure city: ${origin}
- Travel dates: ${dates.departure} to ${dates.return}
- Number of travelers: ${adults} adult${adults > 1 ? 's' : ''}
- Budget: ${budget ? `€${budget}` : 'Flexible'}
- Additional preferences: ${preferences || 'Looking for good value and convenience'}

Please search for flights and hotels, then recommend the best complete vacation packages.
    `.trim();

    // Call AI service
    const recommendation = await aiService.planSkiTrip(userPrompt);

    // Return successful response
    res.json({
      success: true,
      data: {
        recommendation: recommendation,
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

// GET /api/search/health - Simple health check
router.get('/health', (req, res) => {
  res.json({
    success: true,
    message: 'Ski planner API is running',
    timestamp: new Date().toISOString()
  });
});

module.exports = router;