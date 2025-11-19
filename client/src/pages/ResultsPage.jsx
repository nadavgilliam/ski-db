import React, { useState } from 'react'
import { useLocation, useNavigate } from 'react-router-dom'
import { ArrowLeft, Loader, Edit2, Settings, Plane, Hotel, MapPin, Calendar, Users, DollarSign } from 'lucide-react'
import FilterModal from '../components/FilterModal'

/**
 * ResultsPage Component
 * 
 * Displays AI-generated ski trip recommendations in card format
 * Features:
 * - Editable search query card at top
 * - Multiple result cards (clickable)
 * - Filter modal integration
 * - Uses REAL data from API
 */
function ResultsPage() {
  const location = useLocation()
  const navigate = useNavigate()
  const [isEditingQuery, setIsEditingQuery] = useState(false)
  const [isFilterModalOpen, setIsFilterModalOpen] = useState(false)
  const [editedQuery, setEditedQuery] = useState('')
  
  // Get data from navigation state
  const { recommendations, summary, searchParams, isLoading } = location.state || {}

  // Use real recommendations from API (or empty array if none)
  const results = recommendations || []

  // If no data, redirect back to search
  if (!location.state) {
    React.useEffect(() => {
      navigate('/')
    }, [navigate])
    return null
  }

  const handleEditQuery = () => {
    setEditedQuery(searchParams?.preferences || '')
    setIsEditingQuery(true)
  }

  const handleSaveQuery = () => {
    // TODO: Re-run search with edited query
    console.log('New query:', editedQuery)
    setIsEditingQuery(false)
  }

  const handleSaveFilters = (filters) => {
    // TODO: Re-run search with new filters
    console.log('New filters:', filters)
    setIsFilterModalOpen(false)
  }

  const handleCardClick = (resultIndex) => {
    console.log('Clicked result:', resultIndex, results[resultIndex])
    // TODO: Navigate to detail page
    // navigate(`/result/${resultIndex}`)
  }

  return (
    <div style={styles.container}>
      {/* Back Button */}
      <button style={styles.backButton} onClick={() => navigate('/')}>
        <ArrowLeft size={20} />
        <span>New Search</span>
      </button>

      {/* Loading State */}
      {isLoading && (
        <div style={styles.loadingContainer}>
          <Loader size={48} color="var(--glacier-blue)" style={styles.spinner} />
          <h2 style={styles.loadingTitle}>Planning your perfect ski trip...</h2>
          <p style={styles.loadingText}>
            Our AI is searching flights, hotels, and resorts based on your preferences.
            This may take 30-60 seconds.
          </p>
        </div>
      )}

      {/* Results */}
      {!isLoading && results.length > 0 && (
        <div style={styles.resultsContainer}>
          {/* Search Query Card */}
          <div style={styles.queryCard}>
            <div style={styles.queryHeader}>
              <h3 style={styles.queryTitle}>Your Search</h3>
              <div style={styles.queryActions}>
                <button 
                  style={styles.editButton}
                  onClick={handleEditQuery}
                >
                  <Edit2 size={16} />
                  <span>Edit Query</span>
                </button>
                <button 
                  style={styles.filterButton}
                  onClick={() => setIsFilterModalOpen(true)}
                >
                  <Settings size={16} />
                  <span>Edit Filters</span>
                </button>
              </div>
            </div>

            {isEditingQuery ? (
              <div style={styles.editQuerySection}>
                <textarea
                  style={styles.queryTextarea}
                  value={editedQuery}
                  onChange={(e) => setEditedQuery(e.target.value)}
                  rows={3}
                />
                <div style={styles.editActions}>
                  <button style={styles.cancelButton} onClick={() => setIsEditingQuery(false)}>
                    Cancel
                  </button>
                  <button style={styles.saveButton} onClick={handleSaveQuery}>
                    Update Search
                  </button>
                </div>
              </div>
            ) : (
              <div style={styles.queryDisplay}>
                <p style={styles.queryText}>
                  {searchParams?.preferences || 'No query provided'}
                </p>
                <div style={styles.queryMetadata}>
                  {searchParams?.origin && (
                    <span style={styles.metaItem}>
                      <MapPin size={14} />
                      From: {searchParams.origin}
                    </span>
                  )}
                  {searchParams?.dates && (
                    <span style={styles.metaItem}>
                      <Calendar size={14} />
                      {searchParams.dates.departure} to {searchParams.dates.return}
                    </span>
                  )}
                  {searchParams?.adults && (
                    <span style={styles.metaItem}>
                      <Users size={14} />
                      {searchParams.adults} adults
                    </span>
                  )}
                  {searchParams?.budget && (
                    <span style={styles.metaItem}>
                      <DollarSign size={14} />
                      Budget: €{searchParams.budget}
                    </span>
                  )}
                </div>
              </div>
            )}
          </div>

          {/* Results Header */}
          <div style={styles.resultsHeader}>
            <h2 style={styles.resultsTitle}>Recommended Ski Trips</h2>
            <p style={styles.resultsSubtitle}>
              {results.length} option{results.length !== 1 ? 's' : ''} found based on your preferences
            </p>
          </div>

          {/* Result Cards - USING REAL DATA */}
          <div style={styles.cardsGrid}>
            {results.map((result, index) => (
              <div 
                key={index} 
                style={styles.resultCard}
                onClick={() => handleCardClick(index)}
              >
                {/* Card Header */}
                <div style={styles.cardHeader}>
                  <div>
                    <h3 style={styles.cardTitle}>{result.destination}</h3>
                    <p style={styles.cardSubtitle}>{result.resort?.name || 'Resort'}</p>
                  </div>
                  <div style={styles.priceTag}>
                    {result.currency === 'EUR' ? '€' : '$'}{result.totalPrice?.toLocaleString() || 'N/A'}
                  </div>
                </div>

                {/* Card Body */}
                <div style={styles.cardBody}>
                  {/* Flight & Hotel Info */}
                  <div style={styles.infoRow}>
                    {result.flights && (
                      <div style={styles.infoItem}>
                        <Plane size={16} color="var(--glacier-blue)" />
                        <span>{result.flights.route}</span>
                      </div>
                    )}
                    {result.hotel && (
                      <div style={styles.infoItem}>
                        <Hotel size={16} color="var(--glacier-blue)" />
                        <span>{result.hotel.stars}★ {result.hotel.name}</span>
                      </div>
                    )}
                  </div>

                  {result.flights?.outbound && (
                    <div style={styles.infoRow}>
                      <div style={styles.infoItem}>
                        <Calendar size={16} color="var(--glacier-blue)" />
                        <span>
                          {new Date(result.flights.outbound.departure).toLocaleDateString()} - {' '}
                          {new Date(result.flights.return.departure).toLocaleDateString()}
                        </span>
                      </div>
                    </div>
                  )}

                  {/* Resort Info */}
                  {result.resort && (
                    <div style={styles.infoRow}>
                      <div style={styles.infoItem}>
                        <MapPin size={16} color="var(--glacier-blue)" />
                        <span>
                          {result.resort.pisteKm}km pistes
                          {result.resort.rating && ` • ${result.resort.rating}/5`}
                          {result.resort.dayPassPrice && ` • €${result.resort.dayPassPrice}/day`}
                        </span>
                      </div>
                    </div>
                  )}

                  {/* Highlights */}
                  {result.resort?.highlights && result.resort.highlights.length > 0 && (
                    <div style={styles.highlights}>
                      {result.resort.highlights.slice(0, 3).map((highlight, idx) => (
                        <span key={idx} style={styles.highlightPill}>
                          {highlight}
                        </span>
                      ))}
                    </div>
                  )}

                  {/* AI Reasoning */}
                  {result.reasoning && (
                    <div style={styles.aiReasoning}>
                      <span style={styles.aiIcon}>✨</span>
                      <p style={styles.aiText}>{result.reasoning}</p>
                    </div>
                  )}
                </div>

                {/* Card Footer */}
                <div style={styles.cardFooter}>
                  <button style={styles.viewButton}>
                    View Details →
                  </button>
                </div>
              </div>
            ))}
          </div>

          {/* Summary from AI */}
          {summary && (
            <details style={styles.aiDetails}>
              <summary style={styles.aiSummary}>View AI Summary</summary>
              <div style={styles.aiFullResponse}>
                <p style={styles.paragraph}>{summary}</p>
              </div>
            </details>
          )}
        </div>
      )}

      {/* No results state */}
      {!isLoading && results.length === 0 && (
        <div style={styles.loadingContainer}>
          <h2 style={styles.loadingTitle}>No trips found</h2>
          <p style={styles.loadingText}>
            Try adjusting your search criteria or budget.
          </p>
          <button style={styles.backButton} onClick={() => navigate('/')}>
            Try Another Search
          </button>
        </div>
      )}

      {/* Filter Modal */}
      <FilterModal 
        isOpen={isFilterModalOpen}
        onClose={() => setIsFilterModalOpen(false)}
        onSave={handleSaveFilters}
      />
    </div>
  )
}

// Styles
const styles = {
  container: {
    minHeight: 'calc(100vh - 80px)',
    padding: '2rem',
    backgroundColor: 'var(--bg-secondary)',
  },
  backButton: {
    display: 'flex',
    alignItems: 'center',
    gap: '0.5rem',
    padding: '0.75rem 1.5rem',
    backgroundColor: 'white',
    border: '1px solid var(--border-color)',
    borderRadius: '8px',
    color: 'var(--text-primary)',
    fontSize: '1rem',
    cursor: 'pointer',
    marginBottom: '2rem',
    transition: 'all 0.2s',
  },
  loadingContainer: {
    maxWidth: '600px',
    margin: '4rem auto',
    textAlign: 'center',
    padding: '3rem',
    backgroundColor: 'white',
    borderRadius: '12px',
    boxShadow: '0 2px 8px rgba(0, 0, 0, 0.08)',
  },
  spinner: {
    animation: 'spin 1s linear infinite',
    margin: '0 auto 2rem',
  },
  loadingTitle: {
    fontSize: '1.75rem',
    fontWeight: '600',
    color: 'var(--midnight-navy)',
    marginBottom: '1rem',
  },
  loadingText: {
    fontSize: '1.1rem',
    color: 'var(--text-secondary)',
    lineHeight: '1.6',
  },
  resultsContainer: {
    maxWidth: '1200px',
    margin: '0 auto',
  },
  
  // Query Card Styles
  queryCard: {
    backgroundColor: 'white',
    padding: '1.5rem',
    borderRadius: '12px',
    marginBottom: '2rem',
    boxShadow: '0 2px 8px rgba(0, 0, 0, 0.08)',
    border: '2px solid var(--glacier-blue)',
  },
  queryHeader: {
    display: 'flex',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: '1rem',
  },
  queryTitle: {
    fontSize: '1.1rem',
    fontWeight: '600',
    color: 'var(--midnight-navy)',
  },
  queryActions: {
    display: 'flex',
    gap: '0.75rem',
  },
  editButton: {
    display: 'flex',
    alignItems: 'center',
    gap: '0.5rem',
    padding: '0.5rem 1rem',
    backgroundColor: 'transparent',
    border: '1px solid var(--border-color)',
    borderRadius: '6px',
    color: 'var(--text-secondary)',
    fontSize: '0.9rem',
    cursor: 'pointer',
    transition: 'all 0.2s',
  },
  filterButton: {
    display: 'flex',
    alignItems: 'center',
    gap: '0.5rem',
    padding: '0.5rem 1rem',
    backgroundColor: 'var(--glacier-blue)',
    border: 'none',
    borderRadius: '6px',
    color: 'white',
    fontSize: '0.9rem',
    cursor: 'pointer',
    transition: 'all 0.2s',
  },
  queryDisplay: {
    // Display mode
  },
  queryText: {
    fontSize: '1rem',
    color: 'var(--text-primary)',
    lineHeight: '1.6',
    marginBottom: '1rem',
  },
  queryMetadata: {
    display: 'flex',
    gap: '1.5rem',
    flexWrap: 'wrap',
  },
  metaItem: {
    display: 'flex',
    alignItems: 'center',
    gap: '0.5rem',
    fontSize: '0.9rem',
    color: 'var(--text-secondary)',
  },
  editQuerySection: {
    // Edit mode
  },
  queryTextarea: {
    width: '100%',
    padding: '1rem',
    fontSize: '1rem',
    border: '1px solid var(--border-color)',
    borderRadius: '8px',
    resize: 'vertical',
    fontFamily: 'inherit',
    marginBottom: '1rem',
  },
  editActions: {
    display: 'flex',
    gap: '1rem',
    justifyContent: 'flex-end',
  },
  cancelButton: {
    padding: '0.5rem 1.5rem',
    backgroundColor: 'transparent',
    border: '1px solid var(--border-color)',
    borderRadius: '6px',
    cursor: 'pointer',
  },
  saveButton: {
    padding: '0.5rem 1.5rem',
    backgroundColor: 'var(--glacier-blue)',
    color: 'white',
    border: 'none',
    borderRadius: '6px',
    cursor: 'pointer',
  },

  // Results Header
  resultsHeader: {
    marginBottom: '2rem',
  },
  resultsTitle: {
    fontSize: '2rem',
    fontWeight: '600',
    color: 'var(--midnight-navy)',
    marginBottom: '0.5rem',
  },
  resultsSubtitle: {
    fontSize: '1.1rem',
    color: 'var(--text-secondary)',
  },

  // Cards Grid
  cardsGrid: {
    display: 'grid',
    gridTemplateColumns: 'repeat(auto-fill, minmax(350px, 1fr))',
    gap: '1.5rem',
    marginBottom: '2rem',
  },

  // Result Card
  resultCard: {
    backgroundColor: 'white',
    borderRadius: '12px',
    padding: '1.5rem',
    boxShadow: '0 2px 8px rgba(0, 0, 0, 0.08)',
    cursor: 'pointer',
    transition: 'all 0.3s',
    border: '1px solid transparent',
  },
  cardHeader: {
    display: 'flex',
    justifyContent: 'space-between',
    alignItems: 'flex-start',
    marginBottom: '1rem',
    paddingBottom: '1rem',
    borderBottom: '1px solid var(--border-color)',
  },
  cardTitle: {
    fontSize: '1.25rem',
    fontWeight: '600',
    color: 'var(--midnight-navy)',
    marginBottom: '0.25rem',
  },
  cardSubtitle: {
    fontSize: '0.9rem',
    color: 'var(--text-secondary)',
  },
  priceTag: {
    fontSize: '1.5rem',
    fontWeight: '700',
    color: 'var(--glacier-blue)',
  },
  cardBody: {
    marginBottom: '1rem',
  },
  infoRow: {
    display: 'flex',
    gap: '1rem',
    marginBottom: '0.75rem',
    flexWrap: 'wrap',
  },
  infoItem: {
    display: 'flex',
    alignItems: 'center',
    gap: '0.5rem',
    fontSize: '0.9rem',
    color: 'var(--text-primary)',
  },
  highlights: {
    display: 'flex',
    gap: '0.5rem',
    flexWrap: 'wrap',
    marginTop: '1rem',
    marginBottom: '1rem',
  },
  highlightPill: {
    padding: '0.25rem 0.75rem',
    backgroundColor: 'var(--ice-blue)',
    color: 'var(--glacier-blue)',
    borderRadius: '12px',
    fontSize: '0.85rem',
    fontWeight: '500',
  },
  aiReasoning: {
    display: 'flex',
    gap: '0.75rem',
    padding: '1rem',
    backgroundColor: 'var(--mint-frost)',
    borderRadius: '8px',
    marginTop: '1rem',
  },
  aiIcon: {
    fontSize: '1.25rem',
    flexShrink: 0,
  },
  aiText: {
    fontSize: '0.9rem',
    color: 'var(--text-primary)',
    lineHeight: '1.5',
    fontStyle: 'italic',
  },
  cardFooter: {
    paddingTop: '1rem',
    borderTop: '1px solid var(--border-color)',
  },
  viewButton: {
    width: '100%',
    padding: '0.75rem',
    backgroundColor: 'transparent',
    border: '1px solid var(--glacier-blue)',
    borderRadius: '6px',
    color: 'var(--glacier-blue)',
    fontWeight: '500',
    cursor: 'pointer',
    transition: 'all 0.2s',
  },

  // AI Details
  aiDetails: {
    backgroundColor: 'white',
    padding: '1.5rem',
    borderRadius: '12px',
    boxShadow: '0 2px 8px rgba(0, 0, 0, 0.08)',
  },
  aiSummary: {
    fontSize: '1.1rem',
    fontWeight: '600',
    color: 'var(--glacier-blue)',
    cursor: 'pointer',
    listStyle: 'none',
  },
  aiFullResponse: {
    marginTop: '1rem',
    paddingTop: '1rem',
    borderTop: '1px solid var(--border-color)',
  },
  paragraph: {
    marginBottom: '1rem',
    lineHeight: '1.8',
  },
}

// CSS for hover effects
const styleSheet = document.createElement('style')
styleSheet.textContent = `
  @keyframes spin {
    from { transform: rotate(0deg); }
    to { transform: rotate(360deg); }
  }
  
  div[style*="resultCard"]:hover {
    transform: translateY(-4px);
    box-shadow: 0 8px 16px rgba(0, 0, 0, 0.12) !important;
    border-color: var(--glacier-blue) !important;
  }
  
  button:hover {
    opacity: 0.9;
  }
`
document.head.appendChild(styleSheet)

export default ResultsPage