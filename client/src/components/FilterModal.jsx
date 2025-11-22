import React, { useState } from 'react'

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
    skiDays: '',
    budget: '',

    // Resort preferences
    countries: { include: [], exclude: [] },
    resortNames: { include: [], exclude: [] },
    minRating: '',

    // Piste/Difficulty
    minPisteKm: '',
    maxPisteKm: '',
    minAltitude: '',
    maxAltitude: '',
    minBlueKm: '',
    minRedKm: '',
    minBlackKm: '',

    // Infrastructure
    minLifts: '',
    maxPricePerDay: '',

    // Transfer
    maxTransferTime: '',
    transferTypes: [],

    // Flights
    nonStopOnly: false,
  })

  // Filter categories for sidebar
  const categories = [
    { id: 'general', icon: '⚙️', label: 'General' },
    { id: 'resort', icon: '🗺️', label: 'Destination Preferences' },
    { id: 'difficulty', icon: '⛷️', label: 'Ski Resort' },
    { id: 'flights', icon: '✈️', label: 'Flights' },
    { id: 'transfer', icon: '🚗', label: 'Transfer' },
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
            {selectedCategory === 'flights' && (
              <FlightFilters filters={filters} updateFilter={updateFilter} />
            )}
            {selectedCategory === 'transfer' && (
              <TransferFilters filters={filters} updateFilter={updateFilter} />
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
        <label style={styles.label}>Departure City (for flights)</label>
        <input
          type="text"
          placeholder="e.g., Tel Aviv, London, New York"
          value={filters.departureCity}
          onChange={(e) => updateFilter('departureCity', e.target.value)}
          style={styles.input}
        />
        <p style={styles.hint}>Leave empty to default to Tel Aviv</p>
      </div>

      {/* Travel Dates */}
      <div style={styles.filterRow}>
        <div style={styles.filterGroup}>
          <label style={styles.label}>Departure Date (outbound flight)</label>
          <input
            type="date"
            value={filters.dates.start}
            onChange={(e) => updateFilter('dates', { ...filters.dates, start: e.target.value })}
            style={styles.input}
          />
        </div>
        <div style={styles.filterGroup}>
          <label style={styles.label}>Return Date (return flight)</label>
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
        <label style={styles.label}>Number of Adult Travelers</label>
        <input
          type="number"
          min="1"
          value={filters.adults}
          onChange={(e) => updateFilter('adults', parseInt(e.target.value))}
          style={styles.input}
        />
      </div>

      {/* Number of Ski Days */}
      <div style={styles.filterGroup}>
        <label style={styles.label}>Number of Full Ski Days</label>
        <input
          type="number"
          min="1"
          placeholder="e.g., 5 - leave empty if flexible"
          value={filters.skiDays}
          onChange={(e) => updateFilter('skiDays', e.target.value)}
          style={styles.input}
        />
        <p style={styles.hint}>How many full days you plan to ski (affects ski pass pricing)</p>
      </div>

      {/* Budget */}
      <div style={styles.filterGroup}>
        <label style={styles.label}>Total Trip Budget (EUR)</label>
        <input
          type="number"
          placeholder="e.g., 2500 - leave empty for flexible budget"
          value={filters.budget}
          onChange={(e) => updateFilter('budget', e.target.value)}
          style={styles.input}
        />
        <p style={styles.hint}>Total budget for flights, hotels, and ski passes combined</p>
      </div>
    </div>
  )
}

// Resort Filters Panel
function ResortFilters({ filters, updateFilter }) {
  const [includeCountriesText, setIncludeCountriesText] = React.useState('');
  const [excludeCountriesText, setExcludeCountriesText] = React.useState('');
  const [includeResortsText, setIncludeResortsText] = React.useState('');
  const [excludeResortsText, setExcludeResortsText] = React.useState('');

  const handleIncludeCountriesChange = (text) => {
    setIncludeCountriesText(text);
    const countries = text.split(',').map(c => c.trim()).filter(c => c.length > 0);
    updateFilter('countries', { ...filters.countries, include: countries });
  };

  const handleExcludeCountriesChange = (text) => {
    setExcludeCountriesText(text);
    const countries = text.split(',').map(c => c.trim()).filter(c => c.length > 0);
    updateFilter('countries', { ...filters.countries, exclude: countries });
  };

  const handleIncludeResortsChange = (text) => {
    setIncludeResortsText(text);
    const resorts = text.split(',').map(r => r.trim()).filter(r => r.length > 0);
    updateFilter('resortNames', { ...filters.resortNames, include: resorts });
  };

  const handleExcludeResortsChange = (text) => {
    setExcludeResortsText(text);
    const resorts = text.split(',').map(r => r.trim()).filter(r => r.length > 0);
    updateFilter('resortNames', { ...filters.resortNames, exclude: resorts });
  };

  return (
    <div style={styles.filterSection}>
      <h3 style={styles.sectionTitle}>Destination Preferences</h3>

      <div style={styles.filterGroup}>
        <label style={styles.label}>Include Countries or Regions (only search in these)</label>
        <input
          type="text"
          placeholder="e.g., France, Alps, Rocky Mountains, Japan, Scandinavia"
          value={includeCountriesText}
          onChange={(e) => handleIncludeCountriesChange(e.target.value)}
          style={styles.input}
        />
        <p style={styles.hint}>Comma-separated list of countries or regions - leave empty for all locations</p>
      </div>

      <div style={styles.filterGroup}>
        <label style={styles.label}>Exclude Countries or Regions (avoid these)</label>
        <input
          type="text"
          placeholder="e.g., Italy, USA, Eastern Europe"
          value={excludeCountriesText}
          onChange={(e) => handleExcludeCountriesChange(e.target.value)}
          style={styles.input}
        />
        <p style={styles.hint}>Comma-separated list of countries or regions to exclude - leave empty to exclude none</p>
      </div>

      <div style={styles.filterGroup}>
        <label style={styles.label}>Include Specific Resorts (only consider these)</label>
        <input
          type="text"
          placeholder="e.g., Val Thorens, Chamonix, Zermatt"
          value={includeResortsText}
          onChange={(e) => handleIncludeResortsChange(e.target.value)}
          style={styles.input}
        />
        <p style={styles.hint}>Comma-separated list of resort names - leave empty to search all resorts</p>
      </div>

      <div style={styles.filterGroup}>
        <label style={styles.label}>Exclude Specific Resorts (avoid these)</label>
        <input
          type="text"
          placeholder="e.g., Courchevel, St. Moritz"
          value={excludeResortsText}
          onChange={(e) => handleExcludeResortsChange(e.target.value)}
          style={styles.input}
        />
        <p style={styles.hint}>Comma-separated list of resort names to exclude</p>
      </div>

    </div>
  )
}

// Difficulty Filters Panel
function DifficultyFilters({ filters, updateFilter }) {
  return (
    <div style={styles.filterSection}>
      <h3 style={styles.sectionTitle}>Ski Resort Requirements</h3>

      <div style={styles.filterGroup}>
        <label style={styles.label}>Minimum Resort Rating (0-5 stars)</label>
        <input
          type="number"
          min="0"
          max="5"
          step="0.1"
          placeholder="e.g., 4.5 - leave empty for any rating"
          value={filters.minRating}
          onChange={(e) => updateFilter('minRating', e.target.value)}
          style={styles.input}
        />
      </div>

      <div style={styles.filterRow}>
        <div style={styles.filterGroup}>
          <label style={styles.label}>Min Total Piste Length (km)</label>
          <input
            type="number"
            placeholder="e.g., 50 - leave empty for no minimum"
            value={filters.minPisteKm}
            onChange={(e) => updateFilter('minPisteKm', e.target.value)}
            style={styles.input}
          />
        </div>
        <div style={styles.filterGroup}>
          <label style={styles.label}>Max Total Piste Length (km)</label>
          <input
            type="number"
            placeholder="e.g., 300 - leave empty for no maximum"
            value={filters.maxPisteKm}
            onChange={(e) => updateFilter('maxPisteKm', e.target.value)}
            style={styles.input}
          />
        </div>
      </div>

      <div style={styles.filterRow}>
        <div style={styles.filterGroup}>
          <label style={styles.label}>Min Altitude (meters)</label>
          <input
            type="number"
            placeholder="e.g., 1500 - leave empty for no minimum"
            value={filters.minAltitude}
            onChange={(e) => updateFilter('minAltitude', e.target.value)}
            style={styles.input}
          />
          <p style={styles.hint}>Minimum altitude of the ski area</p>
        </div>
        <div style={styles.filterGroup}>
          <label style={styles.label}>Max Altitude (meters)</label>
          <input
            type="number"
            placeholder="e.g., 3500 - leave empty for no maximum"
            value={filters.maxAltitude}
            onChange={(e) => updateFilter('maxAltitude', e.target.value)}
            style={styles.input}
          />
          <p style={styles.hint}>Maximum altitude of the ski area</p>
        </div>
      </div>

      <div style={styles.filterGroup}>
        <label style={styles.label}>Min Blue Slopes - Beginner (km)</label>
        <input
          type="number"
          placeholder="e.g., 20 - for beginner-friendly resorts"
          value={filters.minBlueKm}
          onChange={(e) => updateFilter('minBlueKm', e.target.value)}
          style={styles.input}
        />
        <p style={styles.hint}>Leave empty if no requirement for blue slopes</p>
      </div>

      <div style={styles.filterGroup}>
        <label style={styles.label}>Min Red Slopes - Intermediate (km)</label>
        <input
          type="number"
          placeholder="e.g., 30 - for intermediate skiers"
          value={filters.minRedKm}
          onChange={(e) => updateFilter('minRedKm', e.target.value)}
          style={styles.input}
        />
        <p style={styles.hint}>Leave empty if no requirement for red slopes</p>
      </div>

      <div style={styles.filterGroup}>
        <label style={styles.label}>Min Black Slopes - Advanced (km)</label>
        <input
          type="number"
          placeholder="e.g., 15 - for advanced/expert skiers"
          value={filters.minBlackKm}
          onChange={(e) => updateFilter('minBlackKm', e.target.value)}
          style={styles.input}
        />
        <p style={styles.hint}>Leave empty if no requirement for black slopes</p>
      </div>

      <div style={styles.filterGroup}>
        <label style={styles.label}>Minimum Number of Ski Lifts</label>
        <input
          type="number"
          placeholder="e.g., 20 - leave empty for no minimum"
          value={filters.minLifts}
          onChange={(e) => updateFilter('minLifts', e.target.value)}
          style={styles.input}
        />
        <p style={styles.hint}>More lifts typically means larger resort with better infrastructure</p>
      </div>

      <div style={styles.filterGroup}>
        <label style={styles.label}>Maximum Daily Ski Pass Price (EUR)</label>
        <input
          type="number"
          placeholder="e.g., 60 - leave empty for no price limit"
          value={filters.maxPricePerDay}
          onChange={(e) => updateFilter('maxPricePerDay', e.target.value)}
          style={styles.input}
        />
        <p style={styles.hint}>Price per adult per day for ski pass access</p>
      </div>
    </div>
  )
}

// Flight Filters Panel
function FlightFilters({ filters, updateFilter }) {
  return (
    <div style={styles.filterSection}>
      <h3 style={styles.sectionTitle}>Flight Preferences</h3>

      <div style={styles.filterGroup}>
        <label style={styles.checkboxLabel}>
          <input
            type="checkbox"
            checked={filters.nonStopOnly}
            onChange={(e) => updateFilter('nonStopOnly', e.target.checked)}
            style={styles.checkbox}
          />
          <span>Non-stop flights only (no layovers)</span>
        </label>
        <p style={styles.hint}>Only show direct flights with no stops between origin and destination</p>
      </div>
    </div>
  )
}

// Transfer Filters Panel
function TransferFilters({ filters, updateFilter }) {
  const transferOptions = [
    { value: 'car_rental', label: 'Car Rental' },
    { value: 'train_and_bus', label: 'Train and Bus' },
    { value: 'shuttle_bus', label: 'Shuttle Bus' },
    { value: 'public_bus', label: 'Public Bus' },
  ];

  const handleTransferTypeToggle = (value) => {
    const currentTypes = filters.transferTypes || [];
    const newTypes = currentTypes.includes(value)
      ? currentTypes.filter(t => t !== value)
      : [...currentTypes, value];
    updateFilter('transferTypes', newTypes);
  };

  return (
    <div style={styles.filterSection}>
      <h3 style={styles.sectionTitle}>Transfer Preferences</h3>

      <div style={styles.filterGroup}>
        <label style={styles.label}>Maximum Transfer Time (minutes)</label>
        <input
          type="number"
          placeholder="e.g., 180 (3 hours) - leave empty for no limit"
          value={filters.maxTransferTime}
          onChange={(e) => updateFilter('maxTransferTime', e.target.value)}
          style={styles.input}
        />
        <p style={styles.hint}>Maximum time from airport to resort - leave empty if flexible</p>
      </div>

      <div style={styles.filterGroup}>
        <label style={styles.label}>Preferred Transfer Types</label>
        <div style={{ display: 'flex', flexDirection: 'column', gap: '0.5rem', marginTop: '0.5rem' }}>
          {transferOptions.map(option => (
            <label key={option.value} style={styles.checkboxLabel}>
              <input
                type="checkbox"
                checked={filters.transferTypes.includes(option.value)}
                onChange={() => handleTransferTypeToggle(option.value)}
                style={styles.checkbox}
              />
              <span>{option.label}</span>
            </label>
          ))}
        </div>
        <p style={styles.hint}>Select one or more preferred transfer options - leave empty for all types</p>
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
    maxWidth: '1400px',
    height: '85vh',
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
    whiteSpace: 'nowrap',
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
    padding: '2rem 3rem',
    overflowY: 'auto',
  },
  filterSection: {
    maxWidth: '100%',
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
    backgroundColor: '#f5f5f5',
  },
  hint: {
    fontSize: '0.85rem',
    color: 'var(--text-secondary)',
    marginTop: '0.25rem',
  },
  checkboxLabel: {
    display: 'flex',
    alignItems: 'center',
    gap: '0.5rem',
    fontSize: '0.95rem',
    color: 'var(--text-primary)',
    cursor: 'pointer',
  },
  checkbox: {
    width: '18px',
    height: '18px',
    cursor: 'pointer',
  },
}

export default FilterModal