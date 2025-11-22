const openai = require('../config/openai');
const flightService = require('./flightService');
const hotelService = require('./hotelService');
const resortService = require('./resortService');
const osmService = require('./osmService');
const transportService = require('./transportService');

class AIService {
  constructor() {
    // Define the tools that GPT can use
    this.tools = [
      {
        type: 'function',
        function: {
          name: 'search_flights',
          description: 'Search for flights between two cities for given dates. Use airport codes (e.g., TLV for Tel Aviv, GVA for Geneva).',
          parameters: {
            type: 'object',
            properties: {
              origin: {
                type: 'string',
                description: 'Origin airport code (e.g., TLV, JFK, LHR)'
              },
              destination: {
                type: 'string',
                description: 'Destination airport code (e.g., GVA, ZRH, INN)'
              },
              departureDate: {
                type: 'string',
                description: 'Departure date in YYYY-MM-DD format'
              },
              returnDate: {
                type: 'string',
                description: 'Return date in YYYY-MM-DD format'
              },
              adults: {
                type: 'number',
                description: 'Number of adult passengers'
              }
            },
            required: ['origin', 'destination', 'departureDate', 'returnDate', 'adults']
          }
        }
      },
      {
        type: 'function',
        function: {
          name: 'search_hotels',
          description: 'Search for hotels near a ski resort by coordinates. Returns hotels with pricing and availability.',
          parameters: {
            type: 'object',
            properties: {
              latitude: {
                type: 'number',
                description: 'Latitude of the ski resort or destination'
              },
              longitude: {
                type: 'number',
                description: 'Longitude of the ski resort or destination'
              },
              checkinDate: {
                type: 'string',
                description: 'Check-in date in YYYY-MM-DD format'
              },
              checkoutDate: {
                type: 'string',
                description: 'Check-out date in YYYY-MM-DD format'
              },
              adults: {
                type: 'number',
                description: 'Number of adults'
              },
              rooms: {
                type: 'number',
                description: 'Number of rooms needed (default: 1)'
              }
            },
            required: ['latitude', 'longitude', 'checkinDate', 'checkoutDate', 'adults']
          }
        }
      },
      {
        type: 'function',
        function: {
          name: 'search_resorts',
          description: 'Search ski resorts from database based on various criteria like country, region, rating, piste difficulty, price, etc. This is YOUR custom database with detailed resort information.',
          parameters: {
            type: 'object',
            properties: {
              includeCountries: {
                type: 'array',
                items: { type: 'string' },
                description: 'Countries or regions to include. Can be specific countries (e.g., ["France", "Switzerland"]) OR broader regions (e.g., ["Alps", "French Alps", "Europe", "Dolomites"]). You should interpret regional terms and convert them to appropriate country filters.'
              },
              excludeCountries: {
                type: 'array',
                items: { type: 'string' },
                description: 'Countries or regions to exclude. Can be specific countries OR broader regions. You should interpret regional terms and convert them to appropriate country filters.'
              },
              minRating: {
                type: 'number',
                description: 'Minimum resort rating (0-5)'
              },
              minPisteKm: {
                type: 'number',
                description: 'Minimum total piste kilometers (for large resorts)'
              },
              maxPisteKm: {
                type: 'number',
                description: 'Maximum total piste kilometers (for small resorts)'
              },
              minBlueKm: {
                type: 'number',
                description: 'Minimum blue slope kilometers (for beginners)'
              },
              minRedKm: {
                type: 'number',
                description: 'Minimum red slope kilometers (for intermediates)'
              },
              minBlackKm: {
                type: 'number',
                description: 'Minimum black slope kilometers (for advanced)'
              },
              minLifts: {
                type: 'number',
                description: 'Minimum number of lifts'
              },
              maxPriceEur: {
                type: 'number',
                description: 'Maximum day pass price in EUR'
              },
              limit: {
                type: 'number',
                description: 'Maximum number of results to return (default: 5)'
              }
            },
            required: []
          }
        }
      },
      {
        type: 'function',
        function: {
          name: 'analyze_location_amenities',
          description: 'Analyze detailed amenities and facilities at a ski resort location using OpenStreetMap data. Returns information about lifts, runs, ski schools, ski pass offices, transport, parking, restaurants, bars, nightlife, shops (including ski rental), and family facilities. Use this to get detailed local information about a specific resort location.',
          parameters: {
            type: 'object',
            properties: {
              latitude: {
                type: 'number',
                description: 'Latitude of the ski resort or location to analyze'
              },
              longitude: {
                type: 'number',
                description: 'Longitude of the ski resort or location to analyze'
              },
              locationName: {
                type: 'string',
                description: 'Optional name of the location (e.g., resort name) for logging purposes'
              }
            },
            required: ['latitude', 'longitude']
          }
        }
      },
      {
        type: 'function',
        function: {
          name: 'get_transportation_guidance',
          description: 'Get general guidance on ground transportation options from airport or major city to ski resort. Returns typical transportation options with rough time estimates and costs. Use this when planning trips to provide users with transfer information.',
          parameters: {
            type: 'object',
            properties: {
              from_location: {
                type: 'string',
                description: 'Starting point - airport code (e.g., GVA, ZRH, INN) or city name'
              },
              resort_name: {
                type: 'string',
                description: 'Destination ski resort name'
              },
              country: {
                type: 'string',
                description: 'Country where the resort is located'
              }
            },
            required: ['from_location', 'resort_name', 'country']
          }
        }
      }
    ];
  }

  async executeToolCall(toolCall) {
    const functionName = toolCall.function.name;
    const args = JSON.parse(toolCall.function.arguments);

    console.log('\n' + '='.repeat(80));
    console.log(`🔧 EXECUTING TOOL: ${functionName}`);
    console.log('📝 Arguments:', JSON.stringify(args, null, 2));
    console.log('='.repeat(80));

    try {
      let result;
      const startTime = Date.now();
      
      if (functionName === 'search_flights') {
        console.log('✈️  Calling flight service...');
        result = await flightService.searchFlights(args);
        console.log(`✅ Flight service returned ${result.length} results`);
        console.log('Sample result:', result[0] ? JSON.stringify(result[0], null, 2) : 'No results');
      } else if (functionName === 'search_hotels') {
        console.log('🏨 Calling hotel service...');
        result = await hotelService.searchHotels(args);
        console.log(`✅ Hotel service returned ${result.length} results`);
        console.log('Sample result:', result[0] ? JSON.stringify(result[0], null, 2) : 'No results');
      } else if (functionName === 'search_resorts') {
        console.log('⛷️  Calling resort service...');
        result = resortService.searchResorts(args);
        console.log(`✅ Resort service returned ${result.length} results`);
        console.log('Sample results:', result.slice(0, 2).map(r => ({
          name: r.name,
          country: r.country,
          rating: r.rating,
          pisteKm: r.pistes.total
        })));
      } else if (functionName === 'analyze_location_amenities') {
        console.log('🗺️  Calling OSM service...');
        result = await osmService.analyzeLocation(args.latitude, args.longitude, args.locationName);
        console.log(`✅ OSM service returned location analysis`);
        console.log('Location:', result.hotel_name);
        console.log('Summary:', {
          lifts_nearby: result.lifts.total_within_radius,
          runs_nearby: result.runs.total_within_radius,
          ski_schools: result.ski_schools.total_within_radius,
          restaurants: result.food_stats.restaurants_like,
          nightlife: result.food_stats.nightlife_total
        });
      } else if (functionName === 'get_transportation_guidance') {
        console.log('🚌 Calling transport service...');
        result = await transportService.getTransportationGuidance(args.from_location, args.resort_name, args.country);
        console.log(`✅ Transport service returned transportation guidance`);
        console.log('Transport options:', result.options ? result.options.length : 'N/A');
      } else {
        throw new Error(`Unknown function: ${functionName}`);
      }

      const endTime = Date.now();
      console.log(`⏱️  Tool execution took ${endTime - startTime}ms`);
      console.log('='.repeat(80) + '\n');

      return {
        tool_call_id: toolCall.id,
        role: 'tool',
        name: functionName,
        content: JSON.stringify(result)
      };
    } catch (error) {
      console.error(`❌ ERROR executing ${functionName}:`, error.message);
      console.error('Full error:', error);
      console.log('='.repeat(80) + '\n');
      
      return {
        tool_call_id: toolCall.id,
        role: 'tool',
        name: functionName,
        content: JSON.stringify({ error: error.message })
      };
    }
  }

  async planSkiTrip(userPreferences) {
    console.log('\n' + '🎿'.repeat(40));
    console.log('🤖 STARTING AI SKI TRIP PLANNING');
    console.log('🎿'.repeat(40));
    console.log('User preferences:', userPreferences);
    console.log('\n');

    const messages = [
      {
        role: 'system',
        content: `You are an expert ski trip planner with access to real-time data.

IMPORTANT: You have access to FIVE tools:
1. search_resorts - YOUR custom ski resort database with detailed info (ratings, piste km, difficulty, prices, altitude)
2. search_flights - Real flight search via Amadeus
3. search_hotels - Real hotel search via Booking.com
4. analyze_location_amenities - Detailed location analysis via OpenStreetMap (lifts, runs, ski schools, amenities, nightlife, etc.)
5. get_transportation_guidance - Ground transportation options from airport/city to resort with time and cost estimates

WORKFLOW:
1. ALWAYS start by searching resorts using search_resorts to find the best matches (at least 3-5 resorts)
2. Select the TOP 3 resorts that best match user preferences
3. For EACH of the 3 resorts:
   a. Search flights to the nearest airport
   b. Get transportation guidance from the airport to that resort
   c. Search hotels near that resort using coordinates from resort data
   d. OPTIONALLY use analyze_location_amenities for detailed local information
4. Compile all data into 3 complete trip options
5. Calculate ski pass costs: If user specifies number of ski days, calculate total ski pass cost (days × daily rate). Otherwise, estimate based on trip duration.
6. Analyze and compare all 3 options in your summary

IMPORTANT CONSTRAINTS:
- You MUST provide EXACTLY 3 different trip options (3 different resorts)
- Search for multiple resorts (at least 3-5) from the database, then select the top 3
- For each of the 3 resorts, search flights, transportation, and hotels
- APIs return limited results, use them wisely
- ALWAYS use the resort database first to make informed decisions
- Use OSM analysis when user cares about specific amenities, nightlife, or local facilities
- ALWAYS use transportation guidance to help users understand how to get to the resort
- If user specifies transport constraints (e.g., "within 3 hours of airport"), use transportation info to filter/rank resorts

Resort Database Info:
- Contains real data: ratings, piste km (blue/red/black), lift counts, prices, altitude
- Filter by difficulty level, size, country, price
- Use this to match user preferences before searching flights/hotels
- IMPORTANT: When users specify regions, interpret them intelligently by converting to appropriate country filters:
  * Examples: "Alps" → France, Switzerland, Austria, Italy; "French Alps" → France; "Dolomites" → Italy
  * "Rocky Mountains" → USA, Canada; "Japan" → Japan; "Scandinavia" → Norway, Sweden, Finland
  * Apply your geographic knowledge to convert ANY regional term (anywhere in the world) to the appropriate countries
  * This applies to both inclusions and exclusions

OSM Location Analysis Info:
- Provides detailed local amenities: nearby lifts, runs, ski schools, pass offices
- Shows nightlife (bars, clubs), restaurants, shops (including ski rental)
- Reveals public transport, parking, and family facilities (pools, spas, playgrounds)
- Use when users ask about "nightlife", "amenities", "après-ski", "facilities", or "local area"

Transportation Guidance Info:
- Provides typical ground transportation options (shuttle bus, car rental, train, public bus, etc.)
- Includes rough time estimates and costs in EUR
- Use this for ALL trip planning to help users understand resort accessibility
- CRITICAL: If user specifies transfer constraints (max transfer time or preferred transfer types):
  * You MUST call get_transportation_guidance for EACH resort you're considering
  * Filter/rank resorts based on whether they meet the transfer requirements
  * For max transfer time: At least one transportation option must be within the time limit
  * For preferred transfer types: At least one of the user's preferred types must be available
  * Only recommend resorts that meet BOTH transfer constraints (if specified)

Airport mapping:
- Geneva (GVA): French/Swiss Alps (Val Thorens, Chamonix, Verbier)
- Zurich (ZRH): Swiss Alps (Zermatt, St. Moritz)
- Innsbruck (INN): Austrian Alps (St. Anton, Ischgl)
- Munich (MUC): German/Austrian Alps

After gathering all data, respond with a JSON object (and ONLY JSON, no other text):

CRITICAL: The "recommendations" array MUST contain EXACTLY 3 trip options for 3 DIFFERENT resorts.

{
  "recommendations": [
    {
      "destination": "Resort Name, Country",
      "resort": {
        "name": "Resort Name",
        "rating": 4.7,
        "pisteKm": 104,
        "difficulty": "Advanced",
        "dayPassPrice": 65,
        "highlights": ["Ski-in/ski-out", "High altitude", "etc"]
      },
      "flights": {
        "route": "TLV → GVA",
        "price": 450,
        "currency": "EUR",
        "outbound": {
          "departure": "2026-01-15T08:00",
          "arrival": "2026-01-15T12:00",
          "duration": "4h",
          "stops": 0
        },
        "return": {
          "departure": "2026-01-20T14:00",
          "arrival": "2026-01-20T20:00",
          "duration": "6h",
          "stops": 1
        }
      },
      "transportation": {
        "from": "Geneva Airport (GVA)",
        "to": "Resort Name",
        "options": [
          {
            "mode": "shuttle_bus",
            "duration_minutes": 150,
            "cost_eur": 70,
            "description": "Direct shuttle service"
          },
          {
            "mode": "car_rental",
            "duration_minutes": 120,
            "cost_eur": 50,
            "description": "Drive via A43 highway"
          }
        ]
      },
      "hotel": {
        "name": "Hotel Name",
        "stars": 4,
        "pricePerNight": 180,
        "totalPrice": 900,
        "distanceToResort": 0.5
      },
      "skiPass": {
        "days": 5,
        "pricePerDay": 65,
        "totalPrice": 325
      },
      "totalPrice": 2350,
      "currency": "EUR",
      "reasoning": "Why this is a great match for the user"
    },
    {
      "destination": "Second Resort Name, Country",
      ... (same structure for second option)
    },
    {
      "destination": "Third Resort Name, Country",
      ... (same structure for third option)
    }
  ],
  "summary": "Overall recommendation summary comparing all 3 options"
}

CRITICAL REQUIREMENTS:
1. Return ONLY valid JSON, nothing else. No markdown, no explanations outside the JSON.
2. The recommendations array MUST have EXACTLY 3 elements (3 different resorts)
3. Each recommendation must be complete with resort, flights, transportation, hotel, and pricing data`
      },
      {
        role: 'user',
        content: userPreferences
      }
    ];

    try {
      console.log('📤 Sending initial request to OpenAI...\n');
      
      let response = await openai.chat.completions.create({
        model: 'gpt-4o',
        messages: messages,
        tools: this.tools,
        tool_choice: 'auto',
        temperature: 0.7,
      });

      let iterations = 0;
      const maxIterations = 10;

      // Handle tool calls in a loop
      while (response.choices[0].message.tool_calls && iterations < maxIterations) {
        iterations++;
        console.log(`\n📞 ITERATION ${iterations}: GPT wants to call ${response.choices[0].message.tool_calls.length} tool(s)`);

        const assistantMessage = response.choices[0].message;
        
        // Log what GPT wants to do
        assistantMessage.tool_calls.forEach((tc, index) => {
          console.log(`   Tool ${index + 1}: ${tc.function.name}`);
        });
        
        messages.push(assistantMessage);

        // Execute all tool calls
        const toolResults = await Promise.all(
          assistantMessage.tool_calls.map(toolCall => this.executeToolCall(toolCall))
        );

        // Add tool results to messages
        messages.push(...toolResults);

        console.log('📤 Sending tool results back to OpenAI...\n');

        // Get next response from GPT
        response = await openai.chat.completions.create({
          model: 'gpt-4o',
          messages: messages,
          tools: this.tools,
          tool_choice: 'auto',
          temperature: 0.7,
        });
      }

      console.log('\n' + '✅'.repeat(40));
      console.log('AI PLANNING COMPLETE!');
      console.log('✅'.repeat(40));
      
      const content = response.choices[0].message.content;
      console.log('\n📄 RAW GPT RESPONSE:');
      console.log(content);
      console.log('\n');
      
      // Try to parse as JSON
      try {
        // Remove markdown code blocks if present
        const cleanedContent = content.replace(/```json\n?/g, '').replace(/```\n?/g, '').trim();
        console.log('🔄 Attempting to parse as JSON...');
        const parsedData = JSON.parse(cleanedContent);
        console.log('✅ Successfully parsed JSON!');
        console.log('📊 Parsed data:', JSON.stringify(parsedData, null, 2));
        return parsedData;
      } catch (parseError) {
        console.error('❌ FAILED TO PARSE JSON RESPONSE');
        console.error('Parse error:', parseError.message);
        console.log('Raw content that failed to parse:', content);
        
        // Return a fallback structure
        return {
          recommendations: [],
          summary: content,
          error: 'Failed to parse structured response'
        };
      }

    } catch (error) {
      console.error('\n' + '❌'.repeat(40));
      console.error('AI SERVICE ERROR');
      console.error('❌'.repeat(40));
      console.error('Error:', error);
      console.error('Error message:', error.message);
      if (error.response) {
        console.error('API response:', error.response);
      }
      throw new Error(`AI planning failed: ${error.message}`);
    }
  }
}

module.exports = new AIService();