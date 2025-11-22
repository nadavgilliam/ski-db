require('dotenv').config();

// Mock the services before requiring aiService
const flightService = require('../services/flightService');
const hotelService = require('../services/hotelService');
const osmService = require('../services/osmService');
const openai = require('../config/openai');

console.log('Testing AI Service with MOCKED API calls...\n');
console.log('✅ This test uses mocked data and will NOT cost money!\n');

// Store original methods
const originalSearchFlights = flightService.searchFlights;
const originalSearchHotels = hotelService.searchHotels;
const originalAnalyzeLocation = osmService.analyzeLocation;
const originalCreate = openai.chat.completions.create;

// Mock data
const mockResortData = [
  {
    resort_id: 1,
    name: 'Val Thorens',
    country: 'France',
    rating: 4.5,
    altitude_min_m: 1800,
    altitude_max_m: 3230,
    piste_km_total: 150,
    piste_km_blue: 50,
    piste_km_red: 70,
    piste_km_black: 30,
    lifts_count: 30,
    price_day_eur: 65
  }
];

const mockFlightData = [
  {
    id: '1',
    price: { total: '456.50', currency: 'EUR' },
    outbound: {
      departure: '2026-01-15T08:00:00',
      arrival: '2026-01-15T12:00:00',
      duration: 'PT4H',
      stops: 0
    },
    return: {
      departure: '2026-01-20T14:00:00',
      arrival: '2026-01-20T18:00:00',
      duration: 'PT4H',
      stops: 0
    }
  }
];

const mockHotelData = [
  {
    id: 123,
    name: 'Altapura Hotel',
    price: { total: 180, currency: 'EUR' },
    location: { latitude: 45.2975, longitude: 6.5802, distance: 0.2 },
    rating: { score: 8.5, word: 'Excellent', count: 150 },
    propertyType: 'Hotel'
  }
];

const mockOSMData = {
  hotel_name: 'Val Thorens',
  lifts: { total_within_radius: 15, closest_by_type: [] },
  runs: { total_within_radius: 25, closest_by_type: [] },
  ski_schools: { total_within_radius: 5, closest_by_type: [] },
  pass_offices: { total_within_radius: 3, closest_by_type: [] },
  public_transport: { total_within_radius: 10, closest_by_type: [] },
  parking: { total_within_radius: 5, closest_by_type: [] },
  food_stats: { restaurants_like: 20, nightlife_total: 15 }
};

const mockTransportationData = {
  options: [
    {
      mode: 'shuttle_bus',
      provider: 'Altibus',
      duration_minutes: 150,
      cost_eur: 70,
      cost_type: 'one_time',
      description: 'Direct shuttle from Geneva Airport to Val Thorens'
    },
    {
      mode: 'car_rental',
      provider: 'Various rental companies',
      duration_minutes: 120,
      cost_eur: 50,
      cost_type: 'per_day',
      description: 'Rent a car and drive via A43 highway - €50 per day for rental'
    }
  ],
  notes: 'Shuttle bus is recommended for convenience. Car rental offers flexibility.'
};

// Mock the service methods
flightService.searchFlights = async (args) => {
  console.log('🔧 MOCKED: search_flights called with:', args);
  return mockFlightData;
};

hotelService.searchHotels = async (args) => {
  console.log('🔧 MOCKED: search_hotels called with:', args);
  return mockHotelData;
};

osmService.analyzeLocation = async (lat, lon, name) => {
  console.log('🔧 MOCKED: analyze_location_amenities called with:', { lat, lon, name });
  return mockOSMData;
};

// Mock OpenAI API calls
let aiCallCount = 0;
openai.chat.completions.create = async (params) => {
  aiCallCount++;
  console.log(`\n🔧 MOCKED OpenAI call #${aiCallCount}`);
  console.log('Model:', params.model);
  console.log('Messages:', params.messages.length, 'messages');

  // First call: GPT wants to search resorts
  if (aiCallCount === 1) {
    return {
      choices: [{
        message: {
          role: 'assistant',
          content: null,
          tool_calls: [{
            id: 'call_1',
            type: 'function',
            function: {
              name: 'search_resorts',
              arguments: JSON.stringify({
                minRating: 4,
                maxPriceEur: 70,
                limit: 5
              })
            }
          }]
        }
      }]
    };
  }

  // Second call: GPT wants to search flights and get transportation
  if (aiCallCount === 2) {
    return {
      choices: [{
        message: {
          role: 'assistant',
          content: null,
          tool_calls: [
            {
              id: 'call_2',
              type: 'function',
              function: {
                name: 'search_flights',
                arguments: JSON.stringify({
                  origin: 'TLV',
                  destination: 'GVA',
                  departureDate: '2026-01-15',
                  returnDate: '2026-01-20',
                  adults: 2
                })
              }
            },
            {
              id: 'call_3',
              type: 'function',
              function: {
                name: 'get_transportation_guidance',
                arguments: JSON.stringify({
                  from_location: 'GVA',
                  resort_name: 'Val Thorens',
                  country: 'France'
                })
              }
            }
          ]
        }
      }]
    };
  }

  // Third call: GPT wants to search hotels
  if (aiCallCount === 3) {
    return {
      choices: [{
        message: {
          role: 'assistant',
          content: null,
          tool_calls: [{
            id: 'call_4',
            type: 'function',
            function: {
              name: 'search_hotels',
              arguments: JSON.stringify({
                latitude: 45.2975,
                longitude: 6.5802,
                checkinDate: '2026-01-15',
                checkoutDate: '2026-01-20',
                adults: 2,
                rooms: 1
              })
            }
          }]
        }
      }]
    };
  }

  // For transportation guidance sub-call (detect by system message about transportation expert)
  const hasTransportationSystemMessage = params.messages.some(m =>
    m.role === 'system' && m.content && m.content.includes('transportation expert')
  );

  if (hasTransportationSystemMessage) {
    console.log('🔧 MOCKED: Returning transportation guidance data');
    return {
      choices: [{
        message: {
          role: 'assistant',
          content: JSON.stringify(mockTransportationData)
        }
      }]
    };
  }

  // Final call: Return the recommendation
  const finalResponse = {
    recommendations: [{
      destination: 'Val Thorens, France',
      resort: {
        name: 'Val Thorens',
        rating: 4.5,
        pisteKm: 150,
        difficulty: 'Advanced',
        dayPassPrice: 65,
        highlights: ['Highest resort in Europe', 'Ski-in/ski-out', 'Great snow record']
      },
      flights: {
        route: 'TLV → GVA',
        price: 456.50,
        currency: 'EUR',
        outbound: {
          departure: '2026-01-15T08:00:00',
          arrival: '2026-01-15T12:00:00',
          duration: '4h',
          stops: 0
        },
        return: {
          departure: '2026-01-20T14:00:00',
          arrival: '2026-01-20T18:00:00',
          duration: '4h',
          stops: 0
        }
      },
      transportation: {
        from: 'Geneva Airport (GVA)',
        to: 'Val Thorens',
        options: [
          {
            mode: 'shuttle_bus',
            duration_minutes: 150,
            cost_eur: 70,
            cost_type: 'one_time',
            description: 'Direct shuttle from Geneva Airport to Val Thorens'
          },
          {
            mode: 'car_rental',
            duration_minutes: 120,
            cost_eur: 50,
            cost_type: 'per_day',
            description: 'Rent a car and drive via A43 highway - €50 per day'
          }
        ]
      },
      hotel: {
        name: 'Altapura Hotel',
        stars: 5,
        pricePerNight: 180,
        totalPrice: 900,
        distanceToResort: 0.2
      },
      totalPrice: 2426.50,
      currency: 'EUR',
      reasoning: 'Val Thorens is the highest ski resort in Europe with excellent snow conditions. The resort offers extensive skiing for advanced skiers and is within your budget. Transportation from Geneva is straightforward with multiple options.'
    }],
    summary: 'Val Thorens offers world-class skiing with guaranteed snow, excellent facilities, and easy access from Geneva.'
  };

  return {
    choices: [{
      message: {
        role: 'assistant',
        content: JSON.stringify(finalResponse)
      }
    }]
  };
};

// Now require aiService (after mocking)
const aiService = require('../services/aiService');

async function testAIServiceMocked() {
  console.log('Starting mocked AI service test...\n');

  try {
    const userPreferences = `
I want to plan a ski trip in January 2026 (around Jan 15-20).
I'm traveling from Tel Aviv with my partner (2 adults).
My budget is around €2000-3000 total for flights and accommodation.
I prefer well-rated hotels close to the slopes.
Please find me the best options!
    `;

    const recommendation = await aiService.planSkiTrip(userPreferences);

    console.log('\n' + '='.repeat(80));
    console.log('✅ MOCKED AI RECOMMENDATION:');
    console.log('='.repeat(80));
    console.log(JSON.stringify(recommendation, null, 2));
    console.log('='.repeat(80));

    // Validate the response structure
    console.log('\n✅ Validation:');
    console.log(`   • Has recommendations: ${!!recommendation.recommendations}`);
    console.log(`   • Number of recommendations: ${recommendation.recommendations?.length || 0}`);
    if (recommendation.recommendations?.[0]) {
      const rec = recommendation.recommendations[0];
      console.log(`   • Has resort data: ${!!rec.resort}`);
      console.log(`   • Has flight data: ${!!rec.flights}`);
      console.log(`   • Has transportation data: ${!!rec.transportation}`);
      console.log(`   • Has hotel data: ${!!rec.hotel}`);
      console.log(`   • Transportation options: ${rec.transportation?.options?.length || 0}`);
    }
    console.log(`   • Has summary: ${!!recommendation.summary}`);

    console.log('\n✅ Test completed successfully with mocked data!');
    console.log('💰 No API calls were made - no cost incurred!\n');

  } catch (error) {
    console.error('❌ Test failed:', error.message);
    console.error('Stack:', error.stack);
  } finally {
    // Restore original methods (in case we run more tests)
    flightService.searchFlights = originalSearchFlights;
    hotelService.searchHotels = originalSearchHotels;
    osmService.analyzeLocation = originalAnalyzeLocation;
    openai.chat.completions.create = originalCreate;
  }
}

testAIServiceMocked();
