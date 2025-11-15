require('dotenv').config();
const Amadeus = require('amadeus');

const amadeusClient = new Amadeus({
  clientId: process.env.AMADEUS_CLIENT_ID,
  clientSecret: process.env.AMADEUS_CLIENT_SECRET
});

module.exports = amadeusClient;