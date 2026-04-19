import { Routes, Route, useLocation } from 'react-router-dom'
import Sidebar from './components/Sidebar'
import Dashboard from './pages/Dashboard'
import EDA from './pages/EDA'
import Models from './pages/Models'
import BatchAnalytics from './pages/BatchAnalytics'
import Predict from './pages/Predict'
import Stream from './pages/Stream'

function TopBar() {
  const loc = useLocation()
  const labels = {
    '/': 'Dashboard',
    '/eda': 'EDA Analysis',
    '/models': 'ML Models',
    '/batch': 'Batch Analytics',
    '/predict': 'Predict',
    '/stream': 'Live Stream',
  }
  const current = labels[loc.pathname] || 'FraudShield'

  return (
    <div
      style={{
        height: 60,
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'space-between',
        padding: '0 28px',
        background: 'rgba(255,255,255,0.92)',
        backdropFilter: 'blur(12px)',
        borderBottom: '1px solid var(--border-subtle)',
        flexShrink: 0,
        position: 'sticky',
        top: 0,
        zIndex: 20,
      }}
    >
      {/* Breadcrumb */}
      <div style={{ fontSize: 13, display: 'flex', alignItems: 'center', gap: 6 }}>
        <span style={{ color: 'var(--text-muted)' }}>FraudShield</span>
        <span style={{ color: 'var(--text-muted)', opacity: 0.5 }}>/</span>
        <span style={{ color: 'var(--text-primary)', fontWeight: 600 }}>{current}</span>
      </div>

      {/* Search */}
      <div
        style={{
          display: 'flex',
          alignItems: 'center',
          gap: 8,
          background: 'var(--bg-elevated)',
          border: '1px solid var(--border-subtle)',
          borderRadius: 8,
          padding: '7px 14px',
          width: 300,
          cursor: 'text',
        }}
      >
        <svg
          width="14"
          height="14"
          fill="none"
          stroke="var(--text-muted)"
          strokeWidth="2"
          viewBox="0 0 24 24"
        >
          <circle cx="11" cy="11" r="8" />
          <path d="m21 21-4.35-4.35" />
        </svg>
        <span style={{ fontSize: 13, color: 'var(--text-muted)' }}>
          Search transactions, models…
        </span>
        <span
          className="mono"
          style={{
            marginLeft: 'auto',
            fontSize: 10,
            color: 'var(--text-muted)',
            background: 'var(--bg-surface)',
            border: '1px solid var(--border-subtle)',
            padding: '2px 6px',
            borderRadius: 4,
          }}
        >
          ⌘K
        </span>
      </div>

      {/* Right cluster */}
      <div style={{ display: 'flex', alignItems: 'center', gap: 14 }}>
        {/* Live indicator */}
        <div
          style={{
            display: 'flex',
            alignItems: 'center',
            gap: 6,
            fontSize: 12,
            fontWeight: 600,
          }}
        >
          <span
            className="pulse-dot"
            style={{
              width: 7,
              height: 7,
              borderRadius: '50%',
              background: 'var(--success)',
              display: 'inline-block',
            }}
          />
          <span className="mono" style={{ color: 'var(--success)' }}>LIVE</span>
        </div>

        {/* Avatar */}
        <div
          style={{
            width: 34,
            height: 34,
            borderRadius: '50%',
            background: 'linear-gradient(135deg,#6366f1,#7c3aed)',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            fontSize: 12,
            fontWeight: 700,
            color: '#fff',
            boxShadow: '0 2px 8px rgba(99,102,241,0.35)',
          }}
        >
          FS
        </div>
      </div>
    </div>
  )
}

function Layout({ children }) {
  return (
    <div
      style={{
        display: 'flex',
        height: '100vh',
        overflow: 'hidden',
        background: 'var(--bg-base)',
      }}
    >
      <Sidebar />
      <div
        style={{ flex: 1, display: 'flex', flexDirection: 'column', overflow: 'hidden' }}
      >
        <TopBar />
        <main
          className="dot-grid"
          style={{ flex: 1, overflowY: 'auto', padding: '28px 32px' }}
        >
          {children}
        </main>
      </div>
    </div>
  )
}

export default function App() {
  return (
    <Routes>
      <Route path="/"        element={<Layout><Dashboard /></Layout>} />
      <Route path="/eda"     element={<Layout><EDA /></Layout>} />
      <Route path="/models"  element={<Layout><Models /></Layout>} />
      <Route path="/batch"   element={<Layout><BatchAnalytics /></Layout>} />
      <Route path="/predict" element={<Layout><Predict /></Layout>} />
      <Route path="/stream"  element={<Layout><Stream /></Layout>} />
    </Routes>
  )
}
