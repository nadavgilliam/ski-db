const openai = require('../config/openai');
const flightService = require('./flightService');
const hotelService = require('./hotelService');

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
      }
    ];
  }

  async executeToolCall(toolCall) {
    const functionName = toolCall.function.name;
    const args = JSON.parse(toolCall.function.arguments);

    console.log(`\n🔧 Executing tool: ${functionName}`);
    console.log('Arguments:', args);

    try {
      let result;
      
      if (functionName === 'search_flights') {
        result = await flightService.searchFlights(args);
      } else if (functionName === 'search_hotels') {
        result = await hotelService.searchHotels(args);
      } else {
        throw new Error(`Unknown function: ${functionName}`);
      }

      return {
        tool_call_id: toolCall.id,
        role: 'tool',
        name: functionName,
        content: JSON.stringify(result)
      };
    } catch (error) {
      console.error(`Error executing ${functionName}:`, error.message);
      return {
        tool_call_id: toolCall.id,
        role: 'tool',
        name: functionName,
        content: JSON.stringify({ error: error.message })
      };
    }
  }

  async planSkiTrip(userPreferences) {
    console.log('🤖 Starting AI-powered ski trip planning...\n');

    const messages = [
      {
        role: 'system',
        content: `You are an expert ski trip planner. Your job is to:
1. Search for flights to ski destinations
2. Search for hotels near ski resorts
3. Analyze the options based on user preferences
4. Recommend the best 2-3 complete vacation packages (flight + hotel)


Always search for both flights and hotels, then provide a comprehensive recommendation with pros/cons of each option.`
      },
      {
        role: 'user',
        content: userPreferences
      }
    ];

    try {
      let response = await openai.chat.completions.create({
        model: 'gpt-4o',
        messages: messages,
        tools: this.tools,
        tool_choice: 'auto'
      });

      let iterations = 0;
      const maxIterations = 3; // Prevent infinite loops

      // Handle tool calls in a loop
      while (response.choices[0].message.tool_calls && iterations < maxIterations) {
        iterations++;
        console.log(`\n📞 GPT wants to call ${response.choices[0].message.tool_calls.length} tool(s)...`);

        const assistantMessage = response.choices[0].message;
        messages.push(assistantMessage);

        // Execute all tool calls
        const toolResults = await Promise.all(
          assistantMessage.tool_calls.map(toolCall => this.executeToolCall(toolCall))
        );

        // Add tool results to messages
        messages.push(...toolResults);

        // Get next response from GPT
        response = await openai.chat.completions.create({
          model: 'gpt-4o',
          messages: messages,
          tools: this.tools,
          tool_choice: 'auto'
        });
      }

      console.log('\n✅ AI planning complete!\n');
      return response.choices[0].message.content;

    } catch (error) {
      console.error('AI Service Error:', error);
      throw new Error(`AI planning failed: ${error.message}`);
    }
  }
}

module.exports = new AIService();