const openai = require('../config/openai');
const flightService = require('./flightService');
const hotelService = require('./hotelService');
const resortService = require('./resortService');
const osmService = require('./osmService');

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
          description: 'Search ski resorts from database based on various criteria like country, rating, piste difficulty, price, etc. This is YOUR custom database with detailed resort information.',
          parameters: {
            type: 'object',
            properties: {
              includeCountries: {
                type: 'array',
                items: { type: 'string' },
                description: 'Countries to include (e.g., ["France", "Switzerland"])'
              },
              excludeCountries: {
                type: 'array',
                items: { type: 'string' },
                description: 'Countries to exclude'
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

IMPORTANT: You have access to FOUR tools:
1. search_resorts - YOUR custom ski resort database with detailed info (ratings, piste km, difficulty, prices, altitude)
2. search_flights - Real flight search via Amadeus
3. search_hotels - Real hotel search via Booking.com
4. analyze_location_amenities - Detailed location analysis via OpenStreetMap (lifts, runs, ski schools, amenities, nightlife, etc.)

WORKFLOW:
1. ALWAYS start by searching resorts using search_resorts to find the best matches
2. Then search flights to the nearest airport
3. Then search hotels near the chosen resort using coordinates from resort data
4. OPTIONALLY use analyze_location_amenities to get detailed local information about amenities, nightlife, and facilities
5. Analyze all data together

IMPORTANT CONSTRAINTS:
- Only search ONE destination (pick the best resort from your search)
- APIs return limited results, use them wisely
- ALWAYS use the resort database first to make informed decisions
- Use OSM analysis when user cares about specific amenities, nightlife, or local facilities

Resort Database Info:
- Contains real data: ratings, piste km (blue/red/black), lift counts, prices, altitude
- Filter by difficulty level, size, country, price
- Use this to match user preferences before searching flights/hotels

OSM Location Analysis Info:
- Provides detailed local amenities: nearby lifts, runs, ski schools, pass offices
- Shows nightlife (bars, clubs), restaurants, shops (including ski rental)
- Reveals public transport, parking, and family facilities (pools, spas, playgrounds)
- Use when users ask about "nightlife", "amenities", "après-ski", "facilities", or "local area"

Airport mapping:
- Geneva (GVA): French/Swiss Alps (Val Thorens, Chamonix, Verbier)
- Zurich (ZRH): Swiss Alps (Zermatt, St. Moritz)
- Innsbruck (INN): Austrian Alps (St. Anton, Ischgl)
- Munich (MUC): German/Austrian Alps

After gathering all data, respond with a JSON object (and ONLY JSON, no other text):
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
      "hotel": {
        "name": "Hotel Name",
        "stars": 4,
        "pricePerNight": 180,
        "totalPrice": 900,
        "distanceToResort": 0.5
      },
      "totalPrice": 2350,
      "currency": "EUR",
      "reasoning": "Why this is a great match for the user"
    }
  ],
  "summary": "Overall recommendation summary"
}

CRITICAL: Return ONLY valid JSON, nothing else. No markdown, no explanations outside the JSON.`
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