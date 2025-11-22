import React, { useState } from 'react'
import { ArrowRight, Settings } from 'lucide-react'
import { useNavigate } from 'react-router-dom'
import FilterModal from '../components/FilterModal'
import { searchSkiTrips } from '../services/api'

/**
 * SearchPage Component
 * 
 * Main search interface where users describe their ideal ski trip
 * Features:
 * - Large text area for natural language input
 * - "Select Manually" button to open filter modal
 * - Auto-detected filter pills
 * - Submit button
 */
function SearchPage() {
  const navigate = useNavigate()
  const [searchQuery, setSearchQuery] = useState('')
  const [isModalOpen, setIsModalOpen] = useState(false)
  const [manualFilters, setManualFilters] = useState(null)
  const [detectedFilters, setDetectedFilters] = useState([
    'Location',
    'Dates', 
    'Budget',
    'Skill Level'
  ])

  const handleSaveFilters = (filters) => {
    console.log('Saved filters:', filters)
    setManualFilters(filters)
  }

  const handleSubmit = async (e) => {
    e.preventDefault()
    
    if (!searchQuery.trim() && !manualFilters) {
      alert('Please enter a search query or select filters manually')
      return
    }

    // Navigate to results page with loading state
    navigate('/results', {
      state: {
        isLoading: true,
        searchParams: {
          preferences: searchQuery,
          filters: manualFilters
        }
      }
    })

    try {
      // Call the backend API
      const response = await searchSkiTrips({
        query: searchQuery,
        origin: manualFilters?.departureCity || 'Tel Aviv',  // Mandatory with default
        adults: manualFilters?.adults || 2,                   // Mandatory with default
        dates: manualFilters?.dates?.start && manualFilters?.dates?.end ? {
          departure: manualFilters.dates.start,
          return: manualFilters.dates.end
        } : undefined,  // Optional - only send if provided
        budget: manualFilters?.budget,
        preferences: searchQuery,
        // Resort filters
        countries: manualFilters?.countries,
        resortNames: manualFilters?.resortNames,
        minRating: manualFilters?.minRating,
        // Piste/Difficulty filters
        minPisteKm: manualFilters?.minPisteKm,
        maxPisteKm: manualFilters?.maxPisteKm,
        minBlueKm: manualFilters?.minBlueKm,
        minRedKm: manualFilters?.minRedKm,
        minBlackKm: manualFilters?.minBlackKm,
        // Infrastructure filters
        minLifts: manualFilters?.minLifts,
        maxPricePerDay: manualFilters?.maxPricePerDay
      })

      console.log('API Response:', response)

      // Navigate to results with the actual recommendations
      navigate('/results', {
        state: {
          isLoading: false,
          recommendations: response.data.recommendations,
          summary: response.data.summary,
          searchParams: response.data.searchParams
        }
      })

    } catch (error) {
      console.error('Search failed:', error)
      alert('Search failed. Make sure your backend server is running on http://localhost:3000')
      navigate('/')
    }
  }

  return (
    <div style={styles.container}>
      {/* Hero Section */}
      <div style={styles.hero}>
        <h1 style={styles.title}>ski-db</h1>
        <p style={styles.subtitle}>
          Your perfect ski trip, planned in minutes.{' '}
          <a href="#" style={styles.link}>See how it works.</a>
        </p>
      </div>

      {/* Search Section */}
      <div style={styles.searchSection}>
        {/* Tab-like header */}
        <div style={styles.tabHeader}>
          <div style={styles.activeTab}>
            <span style={styles.tabIcon}>✨</span>
            <span>Describe your trip</span>
          </div>
          <button 
            style={styles.manualButton}
            onClick={() => setIsModalOpen(true)}
          >
            <Settings size={16} />
            <span>Select Manually</span>
          </button>
        </div>

        {/* Search Input */}
        <form onSubmit={handleSubmit} style={styles.searchForm}>
          <textarea
            style={styles.textarea}
            placeholder="Example: I want to ski in the French Alps in January for a week, budget around €2000, looking for challenging slopes..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            rows={3}
          />
          
          {/* Submit Button */}
          <button 
            type="submit" 
            style={styles.submitButton}
            disabled={!searchQuery.trim() && !manualFilters}
          >
            <ArrowRight size={24} />
          </button>
        </form>

        {/* Detected Filter Pills */}
        {detectedFilters.length > 0 && (
          <div style={styles.filterPills}>
            {detectedFilters.map((filter, index) => (
              <div key={index} style={styles.pill}>
                <span style={styles.pillIcon}>✓</span>
                <span>{filter}</span>
              </div>
            ))}
          </div>
        )}
      </div>

      {/* Filter Modal */}
      <FilterModal 
        isOpen={isModalOpen}
        onClose={() => setIsModalOpen(false)}
        onSave={handleSaveFilters}
      />
    </div>
  )
}

// Styles
const styles = {
  container: {
    minHeight: 'calc(100vh - 80px)',
    display: 'flex',
    flexDirection: 'column',
    alignItems: 'center',
    padding: '4rem 2rem',
    backgroundColor: 'var(--bg-primary)',
  },
  hero: {
    textAlign: 'center',
    marginBottom: '3rem',
  },
  title: {
    fontSize: '3rem',
    fontWeight: '600',
    marginBottom: '1rem',
    color: 'var(--midnight-navy)',
  },
  subtitle: {
    fontSize: '1.25rem',
    color: 'var(--text-secondary)',
  },
  link: {
    color: 'var(--glacier-blue)',
    textDecoration: 'none',
    borderBottom: '1px solid var(--glacier-blue)',
  },
  searchSection: {
    width: '100%',
    maxWidth: '800px',
    backgroundColor: 'white',
    borderRadius: '12px',
    boxShadow: '0 4px 6px rgba(0, 0, 0, 0.05)',
    overflow: 'hidden',
  },
  tabHeader: {
    display: 'flex',
    justifyContent: 'space-between',
    alignItems: 'center',
    padding: '1rem 1.5rem',
    borderBottom: '1px solid var(--border-color)',
  },
  activeTab: {
    display: 'flex',
    alignItems: 'center',
    gap: '0.5rem',
    color: 'var(--glacier-blue)',
    fontWeight: '500',
    padding: '0.5rem 1rem',
    borderBottom: '2px solid var(--glacier-blue)',
  },
  tabIcon: {
    fontSize: '1.25rem',
  },
  manualButton: {
    display: 'flex',
    alignItems: 'center',
    gap: '0.5rem',
    padding: '0.5rem 1rem',
    backgroundColor: 'transparent',
    border: '1px solid var(--border-color)',
    borderRadius: '6px',
    color: 'var(--text-secondary)',
    fontSize: '0.9rem',
    transition: 'all 0.2s',
  },
  searchForm: {
    display: 'flex',
    gap: '1rem',
    padding: '1.5rem',
    alignItems: 'flex-start',
  },
  textarea: {
    flex: 1,
    padding: '1rem',
    fontSize: '1rem',
    border: '1px solid var(--border-color)',
    borderRadius: '8px',
    resize: 'vertical',
    fontFamily: 'inherit',
    color: 'var(--text-primary)',
    transition: 'border-color 0.2s',
  },
  submitButton: {
    width: '48px',
    height: '48px',
    borderRadius: '50%',
    backgroundColor: 'var(--glacier-blue)',
    border: 'none',
    color: 'white',
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    transition: 'all 0.2s',
    flexShrink: 0,
    cursor: 'pointer',
  },
  filterPills: {
    display: 'flex',
    gap: '0.75rem',
    padding: '0 1.5rem 1.5rem',
    flexWrap: 'wrap',
  },
  pill: {
    display: 'flex',
    alignItems: 'center',
    gap: '0.5rem',
    padding: '0.5rem 1rem',
    backgroundColor: 'var(--ice-blue)',
    color: 'var(--glacier-blue)',
    borderRadius: '20px',
    fontSize: '0.9rem',
    fontWeight: '500',
  },
  pillIcon: {
    fontSize: '0.8rem',
  },
}

export default SearchPage