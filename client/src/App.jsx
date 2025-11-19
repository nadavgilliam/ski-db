import React from 'react'
import { Routes, Route } from 'react-router-dom'
import Navbar from './components/Navbar'
import SearchPage from './pages/SearchPage'
import ResultsPage from './pages/ResultsPage'

function App() {
  return (
    <div className="app">
      <Navbar />
      
      <Routes>
        {/* Changed: Now using SearchPage component instead of placeholder */}
        <Route path="/" element={<SearchPage />} />
        <Route path="/results" element={<ResultsPage />} />
        <Route path="/about" element={<AboutPage />} />
        <Route path="/how-it-works" element={<HowItWorksPage />} />
      </Routes>
    </div>
  )
}

// Keep the placeholder pages as they were
function AboutPage() {
  return (
    <div className="container" style={{ padding: '4rem 2rem' }}>
      <h1>About Us</h1>
      <p style={{ marginTop: '1rem', color: 'var(--text-secondary)' }}>
        About page content coming soon...
      </p>
    </div>
  )
}

function HowItWorksPage() {
  return (
    <div className="container" style={{ padding: '4rem 2rem' }}>
      <h1>How It Works</h1>
      <p style={{ marginTop: '1rem', color: 'var(--text-secondary)' }}>
        How it works content coming soon...
      </p>
    </div>
  )
}

export default App