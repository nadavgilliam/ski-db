// Load environment variables
require('dotenv').config();

// We'll use the OpenAI SDK
// First, install it: npm install openai

const OpenAI = require('openai');

const openai = new OpenAI({
  apiKey: process.env.OPENAI_API_KEY, // You'll need to add this to .env
});

// Sample flight data (simplified from what we got from Amadeus)
const sampleFlights = [
  {
    id: "1",
    price: { total: "336.19", currency: "EUR" },
    outbound: {
      departure: "TLV 08:35",
      arrival: "GVA 18:05",
      duration: "10h 30m",
      stops: 1,
      layover: "FCO (Rome)"
    },
    return: {
      departure: "GVA 18:55",
      arrival: "TLV 03:10+1",
      duration: "7h 15m",
      stops: 1,
      layover: "FCO (Rome)"
    }
  },
  {
    id: "2",
    price: { total: "445.50", currency: "EUR" },
    outbound: {
      departure: "TLV 06:00",
      arrival: "GVA 14:30",
      duration: "8h 30m",
      stops: 0
    },
    return: {
      departure: "GVA 16:00",
      arrival: "TLV 23:30",
      duration: "7h 30m",
      stops: 0
    }
  }
];

async function analyzeFlights() {
  try {
    console.log('Asking GPT to analyze flights...\n');

    const completion = await openai.chat.completions.create({
      model: 'gpt-4o-mini', // or 'gpt-4o-mini' for cheaper/faster
      messages: [{
        role: 'user',
        content: `I'm planning a ski trip and found these flight options. 
        My preferences: I want good value for money, prefer fewer stops, and my budget is €400.
        
        Flight options:
        ${JSON.stringify(sampleFlights, null, 2)}
        
        Please analyze these options and recommend which flight I should book and why.`
      }],
      temperature: 0.7,
    });

    console.log('✅ GPT\'s Response:');
    console.log(completion.choices[0].message.content);

  } catch (error) {
    console.error('❌ Error calling OpenAI API:');
    console.error(error.message);
  }
}

// Run the analysis
analyzeFlights();