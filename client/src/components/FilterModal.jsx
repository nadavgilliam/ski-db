import React, { useState } from 'react'
import { X, Search } from 'lucide-react'

/**
 * FilterModal Component
 * 
 * Large modal that opens when user clicks "Select Manually"
 * Features:
 * - Left sidebar with filter categories
 * - Right panel with actual filter inputs
 * - Save button with match count
 */
function FilterModal({ isOpen, onClose, onSave }) {
  // Track which category is selected
  const [selectedCategory, setSelectedCategory] = useState('general')
  
  // Track all filter values
  const [filters, setFilters] = useState({
    // General
    departureCity: '',
    dates: { start: '', end: '' },
    adults: 2,
    budget: '',
    
    // Resort preferences
    countries: { include: [], exclude: [] },
    resortNames: { include: [], exclude: [] },
    minRating: '',
    
    // Piste/Difficulty
    minPisteKm: '',
    maxPisteKm: '',
    minBlueKm: '',
    minRedKm: '',
    minBlackKm: '',
    
    // Infrastructure
    minLifts: '',
    maxPricePerDay: '',
  })

  // Filter categories for sidebar
  const categories = [
    { id: 'general', icon: '⚙️', label: 'General' },
    { id: 'resort', icon: '🏔️', label: 'Resort Preferences' },
    { id: 'difficulty', icon: '⛷️', label: 'Piste & Difficulty' },
    { id: 'infrastructure', icon: '🚡', label: 'Infrastructure' },
  ]

  // Update a filter value
  const updateFilter = (key, value) => {
    setFilters(prev => ({ ...prev, [key]: value }))
  }

  // Handle save
  const handleSave = () => {
    onSave(filters)
    onClose()
  }

  if (!isOpen) return null

  return (
    <div style={styles.overlay} onClick={onClose}>
      <div style={styles.modal} onClick={(e) => e.stopPropagation()}>
        {/* Header */}
        <div style={styles.header}>
          <h2 style={styles.title}>Edit Your Search Filters</h2>
          <button style={styles.saveButton} onClick={handleSave}>
            Save Changes →
          </button>
        </div>

        {/* Main Content */}
        <div style={styles.content}>
          {/* Left Sidebar */}
          <div style={styles.sidebar}>
            <div style={styles.searchBox}>
              <Search size={16} color="var(--text-secondary)" />
              <input
                type="text"
                placeholder="Search filters"
                style={styles.searchInput}
              />
            </div>

            {categories.map(cat => (
              <button
                key={cat.id}
                style={{
                  ...styles.categoryButton,
                  ...(selectedCategory === cat.id ? styles.categoryButtonActive : {})
                }}
                onClick={() => setSelectedCategory(cat.id)}
              >
                <span style={styles.categoryIcon}>{cat.icon}</span>
                <span>{cat.label}</span>
              </button>
            ))}
          </div>

          {/* Right Panel - Filter Inputs */}
          <div style={styles.panel}>
            {selectedCategory === 'general' && (
              <GeneralFilters filters={filters} updateFilter={updateFilter} />
            )}
            {selectedCategory === 'resort' && (
              <ResortFilters filters={filters} updateFilter={updateFilter} />
            )}
            {selectedCategory === 'difficulty' && (
              <DifficultyFilters filters={filters} updateFilter={updateFilter} />
            )}
            {selectedCategory === 'infrastructure' && (
              <InfrastructureFilters filters={filters} updateFilter={updateFilter} />
            )}
          </div>
        </div>
      </div>
    </div>
  )
}

// General Filters Panel
function GeneralFilters({ filters, updateFilter }) {
  return (
    <div style={styles.filterSection}>
      <h3 style={styles.sectionTitle}>General Preferences</h3>
      
      {/* Departure City */}
      <div style={styles.filterGroup}>
        <label style={styles.label}>Departure City</label>
        <input
          type="text"
          placeholder="e.g., Tel Aviv, London, New York"
          value={filters.departureCity}
          onChange={(e) => updateFilter('departureCity', e.target.value)}
          style={styles.input}
        />
      </div>

      {/* Travel Dates */}
      <div style={styles.filterRow}>
        <div style={styles.filterGroup}>
          <label style={styles.label}>Check-in Date</label>
          <input
            type="date"
            value={filters.dates.start}
            onChange={(e) => updateFilter('dates', { ...filters.dates, start: e.target.value })}
            style={styles.input}
          />
        </div>
        <div style={styles.filterGroup}>
          <label style={styles.label}>Check-out Date</label>
          <input
            type="date"
            value={filters.dates.end}
            onChange={(e) => updateFilter('dates', { ...filters.dates, end: e.target.value })}
            style={styles.input}
          />
        </div>
      </div>

      {/* Number of Adults */}
      <div style={styles.filterGroup}>
        <label style={styles.label}>Number of Adults</label>
        <input
          type="number"
          min="1"
          value={filters.adults}
          onChange={(e) => updateFilter('adults', parseInt(e.target.value))}
          style={styles.input}
        />
      </div>

      {/* Budget */}
      <div style={styles.filterGroup}>
        <label style={styles.label}>Total Budget (EUR)</label>
        <input
          type="number"
          placeholder="e.g., 2500"
          value={filters.budget}
          onChange={(e) => updateFilter('budget', e.target.value)}
          style={styles.input}
        />
      </div>
    </div>
  )
}

// Resort Filters Panel
function ResortFilters({ filters, updateFilter }) {
  return (
    <div style={styles.filterSection}>
      <h3 style={styles.sectionTitle}>Resort Preferences</h3>
      
      <div style={styles.filterGroup}>
        <label style={styles.label}>Include Countries</label>
        <input
          type="text"
          placeholder="e.g., France, Switzerland, Austria"
          style={styles.input}
        />
        <p style={styles.hint}>Comma-separated list</p>
      </div>

      <div style={styles.filterGroup}>
        <label style={styles.label}>Exclude Countries</label>
        <input
          type="text"
          placeholder="e.g., Italy"
          style={styles.input}
        />
      </div>

      <div style={styles.filterGroup}>
        <label style={styles.label}>Minimum Rating</label>
        <input
          type="number"
          min="0"
          max="5"
          step="0.1"
          placeholder="e.g., 4.5"
          value={filters.minRating}
          onChange={(e) => updateFilter('minRating', e.target.value)}
          style={styles.input}
        />
      </div>
    </div>
  )
}

// Difficulty Filters Panel
function DifficultyFilters({ filters, updateFilter }) {
  return (
    <div style={styles.filterSection}>
      <h3 style={styles.sectionTitle}>Piste & Difficulty</h3>
      
      <div style={styles.filterRow}>
        <div style={styles.filterGroup}>
          <label style={styles.label}>Min Total Piste (km)</label>
          <input
            type="number"
            placeholder="e.g., 50"
            value={filters.minPisteKm}
            onChange={(e) => updateFilter('minPisteKm', e.target.value)}
            style={styles.input}
          />
        </div>
        <div style={styles.filterGroup}>
          <label style={styles.label}>Max Total Piste (km)</label>
          <input
            type="number"
            placeholder="e.g., 300"
            value={filters.maxPisteKm}
            onChange={(e) => updateFilter('maxPisteKm', e.target.value)}
            style={styles.input}
          />
        </div>
      </div>

      <div style={styles.filterGroup}>
        <label style={styles.label}>Min Blue Slopes (km)</label>
        <input
          type="number"
          placeholder="For beginner-friendly resorts"
          value={filters.minBlueKm}
          onChange={(e) => updateFilter('minBlueKm', e.target.value)}
          style={styles.input}
        />
      </div>

      <div style={styles.filterGroup}>
        <label style={styles.label}>Min Red Slopes (km)</label>
        <input
          type="number"
          placeholder="For intermediate skiers"
          value={filters.minRedKm}
          onChange={(e) => updateFilter('minRedKm', e.target.value)}
          style={styles.input}
        />
      </div>

      <div style={styles.filterGroup}>
        <label style={styles.label}>Min Black Slopes (km)</label>
        <input
          type="number"
          placeholder="For advanced skiers"
          value={filters.minBlackKm}
          onChange={(e) => updateFilter('minBlackKm', e.target.value)}
          style={styles.input}
        />
      </div>
    </div>
  )
}

// Infrastructure Filters Panel
function InfrastructureFilters({ filters, updateFilter }) {
  return (
    <div style={styles.filterSection}>
      <h3 style={styles.sectionTitle}>Infrastructure & Pricing</h3>
      
      <div style={styles.filterGroup}>
        <label style={styles.label}>Minimum Lifts</label>
        <input
          type="number"
          placeholder="e.g., 20"
          value={filters.minLifts}
          onChange={(e) => updateFilter('minLifts', e.target.value)}
          style={styles.input}
        />
        <p style={styles.hint}>More lifts typically means larger resort</p>
      </div>

      <div style={styles.filterGroup}>
        <label style={styles.label}>Max Day Pass Price (EUR)</label>
        <input
          type="number"
          placeholder="e.g., 60"
          value={filters.maxPricePerDay}
          onChange={(e) => updateFilter('maxPricePerDay', e.target.value)}
          style={styles.input}
        />
      </div>
    </div>
  )
}

// Styles
const styles = {
  overlay: {
    position: 'fixed',
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
    backgroundColor: 'rgba(0, 0, 0, 0.6)',
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    zIndex: 1000,
    padding: '2rem',
  },
  modal: {
    backgroundColor: 'white',
    borderRadius: '12px',
    width: '100%',
    maxWidth: '1200px',
    maxHeight: '90vh',
    display: 'flex',
    flexDirection: 'column',
    boxShadow: '0 20px 25px -5px rgba(0, 0, 0, 0.1)',
  },
  header: {
    display: 'flex',
    justifyContent: 'space-between',
    alignItems: 'center',
    padding: '1.5rem 2rem',
    borderBottom: '1px solid var(--border-color)',
  },
  title: {
    fontSize: '1.5rem',
    fontWeight: '600',
    color: 'var(--midnight-navy)',
  },
  saveButton: {
    padding: '0.75rem 1.5rem',
    backgroundColor: 'var(--glacier-blue)',
    color: 'white',
    border: 'none',
    borderRadius: '8px',
    fontSize: '1rem',
    fontWeight: '500',
    cursor: 'pointer',
  },
  content: {
    display: 'flex',
    flex: 1,
    overflow: 'hidden',
  },
  sidebar: {
    width: '280px',
    borderRight: '1px solid var(--border-color)',
    padding: '1.5rem',
    overflowY: 'auto',
  },
  searchBox: {
    display: 'flex',
    alignItems: 'center',
    gap: '0.5rem',
    padding: '0.75rem',
    backgroundColor: 'var(--bg-secondary)',
    borderRadius: '8px',
    marginBottom: '1rem',
  },
  searchInput: {
    flex: 1,
    border: 'none',
    backgroundColor: 'transparent',
    outline: 'none',
    fontSize: '0.9rem',
  },
  categoryButton: {
    width: '100%',
    display: 'flex',
    alignItems: 'center',
    gap: '0.75rem',
    padding: '0.75rem 1rem',
    backgroundColor: 'transparent',
    border: 'none',
    borderRadius: '8px',
    fontSize: '0.95rem',
    color: 'var(--text-secondary)',
    cursor: 'pointer',
    marginBottom: '0.5rem',
    textAlign: 'left',
    transition: 'all 0.2s',
  },
  categoryButtonActive: {
    backgroundColor: 'var(--ice-blue)',
    color: 'var(--glacier-blue)',
    fontWeight: '500',
  },
  categoryIcon: {
    fontSize: '1.25rem',
  },
  panel: {
    flex: 1,
    padding: '2rem',
    overflowY: 'auto',
  },
  filterSection: {
    maxWidth: '700px',
  },
  sectionTitle: {
    fontSize: '1.25rem',
    fontWeight: '600',
    marginBottom: '1.5rem',
    color: 'var(--midnight-navy)',
  },
  filterGroup: {
    marginBottom: '1.5rem',
  },
  filterRow: {
    display: 'grid',
    gridTemplateColumns: '1fr 1fr',
    gap: '1rem',
    marginBottom: '1.5rem',
  },
  label: {
    display: 'block',
    fontSize: '0.95rem',
    fontWeight: '500',
    color: 'var(--midnight-navy)',
    marginBottom: '0.5rem',
  },
  input: {
    width: '100%',
    padding: '0.75rem',
    border: '1px solid var(--border-color)',
    borderRadius: '8px',
    fontSize: '0.95rem',
    outline: 'none',
    transition: 'border-color 0.2s',
  },
  hint: {
    fontSize: '0.85rem',
    color: 'var(--text-secondary)',
    marginTop: '0.25rem',
  },
}

export default FilterModal