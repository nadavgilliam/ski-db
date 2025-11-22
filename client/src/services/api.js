/**
 * API Service
 * 
 * Handles all communication with the backend API
 * Base URL points to your local server (we'll change this when deploying)
 */

// Backend API base URL
const API_BASE_URL = 'http://localhost:3000/api'

/**
 * Search for ski trips based on user preferences
 * 
 * @param {Object} searchData - User's search preferences
 * @param {string} searchData.query - Natural language query (optional)
 * @param {Object} searchData.filters - Structured filters (optional)
 * @returns {Promise} - API response with recommendations
 */
export async function searchSkiTrips(searchData) {
  try {
    const response = await fetch(`${API_BASE_URL}/search`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        origin: searchData.origin || 'Tel Aviv',
        dates: searchData.dates,
        adults: searchData.adults,
        skiDays: searchData.skiDays,
        budget: searchData.budget,
        preferences: searchData.query || searchData.preferences,
        // Resort filters
        countries: searchData.countries,
        resortNames: searchData.resortNames,
        minRating: searchData.minRating,
        // Piste/Difficulty filters
        minPisteKm: searchData.minPisteKm,
        maxPisteKm: searchData.maxPisteKm,
        minBlueKm: searchData.minBlueKm,
        minRedKm: searchData.minRedKm,
        minBlackKm: searchData.minBlackKm,
        // Infrastructure filters
        minLifts: searchData.minLifts,
        maxPricePerDay: searchData.maxPricePerDay,
        // Flight filters
        nonStopOnly: searchData.nonStopOnly
      })
    })

    if (!response.ok) {
      throw new Error(`API error: ${response.status}`)
    }

    const data = await response.json()
    return data
  } catch (error) {
    console.error('API call failed:', error)
    throw error
  }
}

/**
 * Health check - verify backend is running
 */
export async function healthCheck() {
  try {
    const response = await fetch(`${API_BASE_URL}/search/health`)
    return await response.json()
  } catch (error) {
    console.error('Health check failed:', error)
    return { success: false }
  }
}