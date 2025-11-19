import React from 'react'
import { Link } from 'react-router-dom'
import { Mountain } from 'lucide-react'

/**
 * Navbar Component
 * 
 * Main navigation bar that appears at the top of all pages
 * - Logo on the left (placeholder using Mountain icon)
 * - Navigation links on the right
 */
function Navbar() {
  return (
    <nav style={styles.nav}>
      <div className="container" style={styles.container}>
        {/* Logo Section */}
        <Link to="/" style={styles.logoLink}>
          <Mountain size={32} color="var(--glacier-blue)" />
          <span style={styles.logoText}>ski-db</span>
        </Link>

        {/* Navigation Links */}
        <div style={styles.links}>
          <Link to="/about" style={styles.link}>About Us</Link>
          <Link to="/how-it-works" style={styles.link}>How It Works</Link>
        </div>
      </div>
    </nav>
  )
}

// Inline styles for this component
// (Later you can move these to CSS files if you prefer)
const styles = {
  nav: {
    backgroundColor: 'var(--warm-snow)',
    borderBottom: '1px solid var(--border-color)',
    padding: '1rem 0',
    position: 'sticky',
    top: 0,
    zIndex: 100,
  },
  container: {
    display: 'flex',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  logoLink: {
    display: 'flex',
    alignItems: 'center',
    gap: '0.75rem',
    textDecoration: 'none',
    color: 'var(--midnight-navy)',
    fontSize: '1.5rem',
    fontWeight: '600',
  },
  logoText: {
    color: 'var(--midnight-navy)',
  },
  links: {
    display: 'flex',
    gap: '2rem',
    alignItems: 'center',
  },
  link: {
    color: 'var(--text-secondary)',
    textDecoration: 'none',
    fontSize: '1rem',
    fontWeight: '500',
    transition: 'color 0.2s',
  },
}

export default Navbar