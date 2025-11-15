require('dotenv').config();

const RAPIDBooking_CONFIG = {
  key: process.env.RAPIDAPI_KEY,
  host: 'booking-com.p.rapidapi.com'
};

module.exports = RAPIDBooking_CONFIG;