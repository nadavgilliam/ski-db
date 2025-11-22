const openai = require('../config/openai');

class TransportService {
  async getTransportationGuidance(fromLocation, resortName, country) {
    console.log(`🚌 Fetching transportation guidance from ${fromLocation} to ${resortName}, ${country}`);

    try {
      const response = await openai.chat.completions.create({
        model: 'gpt-4o',
        messages: [
          {
            role: 'system',
            content: `You are a transportation expert specializing in European ski resort access.
Provide practical ground transportation options with realistic estimates.
Return your response as a JSON object with this structure:
{
  "options": [
    {
      "mode": "shuttle_bus|car_rental|train|public_bus|train_and_bus|car",
      "provider": "company or service name (if known)",
      "duration_minutes": estimated_time_in_minutes,
      "cost_eur": estimated_cost_in_euros,
      "cost_type": "per_day|one_time|per_person",
      "description": "brief description of the route/service"
    }
  ],
  "notes": "any additional helpful information about transportation to this resort"
}

IMPORTANT PRICING GUIDELINES:
- For car rentals: Use "per_day" and specify daily rate
- For shuttle/bus/train: Use "one_time" for total trip cost
- Always be explicit about what the cost covers
- In the description, clarify pricing (e.g., "€50 per day for rental")

IMPORTANT: Return ONLY valid JSON, no markdown, no extra text.`
          },
          {
            role: 'user',
            content: `What are the typical ground transportation options from ${fromLocation} to ${resortName} ski resort in ${country}? Include 2-4 common options with rough time estimates and costs in EUR.`
          }
        ],
        temperature: 0.3,
        response_format: { type: "json_object" }
      });

      const content = response.choices[0].message.content;
      console.log('📄 Transportation guidance response:', content);

      const parsedData = JSON.parse(content);
      return parsedData;

    } catch (error) {
      console.error('❌ Error fetching transportation guidance:', error.message);

      // Return a fallback structure
      return {
        options: [
          {
            mode: 'information_unavailable',
            provider: 'N/A',
            duration_minutes: 0,
            cost_eur: 0,
            description: 'Transportation information temporarily unavailable'
          }
        ],
        notes: 'Please check local transportation options independently.'
      };
    }
  }
}

module.exports = new TransportService();
