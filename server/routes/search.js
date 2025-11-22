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
      skiDays,              // Optional - number of full ski days
      budget,
      preferences,
      // Resort filters
      countries,
      resortNames,
      minRating,
      // Piste/Difficulty filters
      minPisteKm,
      maxPisteKm,
      minAltitude,
      maxAltitude,
      minBlueKm,
      minRedKm,
      minBlackKm,
      // Infrastructure filters
      minLifts,
      maxPricePerDay,
      // Transfer filters
      maxTransferTime,
      transferTypes
    } = req.body;

    // Build comprehensive natural language prompt with clear, descriptive filter names
    let userPrompt = `
I want to plan a ski trip with the following requirements and preferences:

BASIC TRIP DETAILS:
- Departure City (for flights): ${origin}
- Travel Dates: ${dates?.departure && dates?.return ? `Departure on ${dates.departure}, Return on ${dates.return}` : 'Not specified (flexible dates)'}
- Number of Adult Travelers: ${adults}
- Number of Full Ski Days Expected: ${skiDays ? `${skiDays} full days of skiing` : 'Not specified (use trip duration to estimate)'}
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

    // Altitude filters
    userPrompt += `\n\nALTITUDE REQUIREMENTS:`;
    if (minAltitude) {
      userPrompt += `\n- Minimum Altitude: ${minAltitude} meters or higher`;
    } else {
      userPrompt += `\n- Minimum Altitude: No minimum requirement`;
    }
    if (maxAltitude) {
      userPrompt += `\n- Maximum Altitude: ${maxAltitude} meters or lower`;
    } else {
      userPrompt += `\n- Maximum Altitude: No maximum limit`;
    }

    // Difficulty-specific piste requirements
    userPrompt += `\n\nSKI RESORT REQUIREMENTS:`;
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
      userPrompt += `\n- Countries or Regions to Include (search only in these): ${countries.include.join(', ')}`;
      userPrompt += `\n  Note: This can include specific countries (e.g., France, Austria) OR broader regions (e.g., Alps, French Alps, Europe, Dolomites). Interpret regional terms flexibly.`;
    } else {
      userPrompt += `\n- Countries or Regions to Include: All locations are acceptable`;
    }
    if (countries?.exclude?.length > 0) {
      userPrompt += `\n- Countries or Regions to Exclude (do not search in these): ${countries.exclude.join(', ')}`;
      userPrompt += `\n  Note: This can include specific countries OR broader regions. Interpret regional terms flexibly.`;
    } else {
      userPrompt += `\n- Countries or Regions to Exclude: None`;
    }
    if (resortNames?.include?.length > 0) {
      userPrompt += `\n- Specific Resorts to Include: ${resortNames.include.join(', ')}`;
    }
    if (resortNames?.exclude?.length > 0) {
      userPrompt += `\n- Specific Resorts to Exclude: ${resortNames.exclude.join(', ')}`;
    }

    // Transfer filters
    userPrompt += `\n\nTRANSFER PREFERENCES:`;
    if (maxTransferTime) {
      userPrompt += `\n- Maximum Transfer Time from Airport to Resort: ${maxTransferTime} minutes or less`;
      userPrompt += `\n  IMPORTANT: Use the get_transportation_guidance tool to check transfer times. At least one transportation option must meet this time requirement.`;
    } else {
      userPrompt += `\n- Maximum Transfer Time from Airport: No time limit (flexible)`;
    }
    if (transferTypes?.length > 0) {
      const typeLabels = {
        'car_rental': 'Car Rental',
        'train_and_bus': 'Train and Bus',
        'shuttle_bus': 'Shuttle Bus',
        'public_bus': 'Public Bus'
      };
      const selectedTypes = transferTypes.map(t => typeLabels[t] || t).join(', ');
      userPrompt += `\n- Preferred Transfer Types: ${selectedTypes}`;
      userPrompt += `\n  IMPORTANT: Use the get_transportation_guidance tool. At least one of these transportation types should be available for recommended resorts.`;
    } else {
      userPrompt += `\n- Preferred Transfer Types: All transfer types are acceptable`;
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
          skiDays,
          budget,
          minRating,
          minPisteKm,
          maxPisteKm,
          minAltitude,
          maxAltitude,
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