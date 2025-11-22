const express = require('express');
const router = express.Router();
const aiService = require('../services/aiService');

// POST /api/search
router.post('/', async (req, res) => {
  try {
    console.log('📥 Received search request:', req.body);

    const {
      origin = 'Tel Aviv',  // Mandatory with default
      adults = 2,           // Mandatory with default
      dates,                // Optional - no default
      budget,
      preferences,
      // Resort filters
      countries,
      resortNames,
      minRating,
      // Piste/Difficulty filters
      minPisteKm,
      maxPisteKm,
      minBlueKm,
      minRedKm,
      minBlackKm,
      // Infrastructure filters
      minLifts,
      maxPricePerDay
    } = req.body;

    // Build comprehensive natural language prompt with clear, descriptive filter names
    let userPrompt = `
I want to plan a ski trip with the following requirements and preferences:

BASIC TRIP DETAILS:
- Departure City (for flights): ${origin}
- Travel Dates: ${dates?.departure && dates?.return ? `Departure on ${dates.departure}, Return on ${dates.return}` : 'Not specified (flexible dates)'}
- Number of Adult Travelers: ${adults}
- Total Trip Budget: ${budget ? `€${budget}` : 'Flexible (no specific budget constraint)'}
${preferences ? `- Additional User Preferences: ${preferences}` : ''}

RESORT QUALITY REQUIREMENTS:`;

    // Resort quality filters
    if (minRating) {
      userPrompt += `\n- Minimum Resort Rating (stars): ${minRating} stars or higher`;
    } else {
      userPrompt += `\n- Minimum Resort Rating: No specific requirement (any rating acceptable)`;
    }

    // Piste size filters
    userPrompt += `\n\nPISTE SIZE REQUIREMENTS:`;
    if (minPisteKm) {
      userPrompt += `\n- Minimum Total Piste Length: ${minPisteKm} km or more`;
    } else {
      userPrompt += `\n- Minimum Total Piste Length: No minimum requirement`;
    }
    if (maxPisteKm) {
      userPrompt += `\n- Maximum Total Piste Length: ${maxPisteKm} km or less`;
    } else {
      userPrompt += `\n- Maximum Total Piste Length: No maximum limit`;
    }

    // Difficulty-specific piste requirements
    userPrompt += `\n\nSLOPE DIFFICULTY REQUIREMENTS:`;
    if (minBlueKm) {
      userPrompt += `\n- Minimum Blue Slopes (beginner-friendly): ${minBlueKm} km or more`;
    } else {
      userPrompt += `\n- Minimum Blue Slopes: No specific requirement`;
    }
    if (minRedKm) {
      userPrompt += `\n- Minimum Red Slopes (intermediate level): ${minRedKm} km or more`;
    } else {
      userPrompt += `\n- Minimum Red Slopes: No specific requirement`;
    }
    if (minBlackKm) {
      userPrompt += `\n- Minimum Black Slopes (advanced/expert level): ${minBlackKm} km or more`;
    } else {
      userPrompt += `\n- Minimum Black Slopes: No specific requirement`;
    }

    // Infrastructure filters
    userPrompt += `\n\nINFRASTRUCTURE & PRICING REQUIREMENTS:`;
    if (minLifts) {
      userPrompt += `\n- Minimum Number of Ski Lifts: ${minLifts} lifts or more`;
    } else {
      userPrompt += `\n- Minimum Number of Ski Lifts: No specific requirement`;
    }
    if (maxPricePerDay) {
      userPrompt += `\n- Maximum Daily Ski Pass Price: €${maxPricePerDay} or less per day`;
    } else {
      userPrompt += `\n- Maximum Daily Ski Pass Price: No price limit`;
    }

    // Geographic filters
    userPrompt += `\n\nGEOGRAPHIC PREFERENCES:`;
    if (countries?.include?.length > 0) {
      userPrompt += `\n- Countries to Include (search only in these): ${countries.include.join(', ')}`;
    } else {
      userPrompt += `\n- Countries to Include: All countries are acceptable`;
    }
    if (countries?.exclude?.length > 0) {
      userPrompt += `\n- Countries to Exclude (do not search in these): ${countries.exclude.join(', ')}`;
    } else {
      userPrompt += `\n- Countries to Exclude: None`;
    }
    if (resortNames?.include?.length > 0) {
      userPrompt += `\n- Specific Resorts to Include: ${resortNames.include.join(', ')}`;
    }
    if (resortNames?.exclude?.length > 0) {
      userPrompt += `\n- Specific Resorts to Exclude: ${resortNames.exclude.join(', ')}`;
    }

    userPrompt += `\n\nINSTRUCTIONS:
Please search for resorts that match ALL of the above requirements. Then find suitable flights and hotels for the best matching resort(s). Present complete trip packages with total costs.`;

    userPrompt = userPrompt.trim();

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
          budget,
          minRating,
          minPisteKm,
          maxPisteKm,
          minBlueKm,
          minRedKm,
          minBlackKm,
          minLifts,
          maxPricePerDay,
          countries,
          resortNames
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