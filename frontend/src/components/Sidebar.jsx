import { NavLink } from 'react-router-dom'

/* ── Inline SVG icons (16×16) ── */

function LayoutDashboardIcon() {
  return (
    <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <rect x="3" y="3" width="7" height="7" rx="1" />
      <rect x="14" y="3" width="7" height="7" rx="1" />
      <rect x="14" y="14" width="7" height="7" rx="1" />
      <rect x="3" y="14" width="7" height="7" rx="1" />
    </svg>
  )
}

function BarChart2Icon() {
  return (
    <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <line x1="18" y1="20" x2="18" y2="10" />
      <line x1="12" y1="20" x2="12" y2="4" />
      <line x1="6"  y1="20" x2="6"  y2="14" />
      <line x1="2"  y1="20" x2="22" y2="20" />
    </svg>
  )
}

function CpuIcon() {
  return (
    <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <rect x="4" y="4" width="16" height="16" rx="2" />
      <rect x="9" y="9" width="6" height="6" />
      <line x1="9"  y1="1"  x2="9"  y2="4" />
      <line x1="15" y1="1"  x2="15" y2="4" />
      <line x1="9"  y1="20" x2="9"  y2="23" />
      <line x1="15" y1="20" x2="15" y2="23" />
      <line x1="1"  y1="9"  x2="4"  y2="9" />
      <line x1="1"  y1="15" x2="4"  y2="15" />
      <line x1="20" y1="9"  x2="23" y2="9" />
      <line x1="20" y1="15" x2="23" y2="15" />
    </svg>
  )
}

function ZapIcon() {
  return (
    <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <polygon points="13 2 3 14 12 14 11 22 21 10 12 10 13 2" />
    </svg>
  )
}

function RadioIcon() {
  return (
    <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <circle cx="12" cy="12" r="2" />
      <path d="M16.24 7.76a6 6 0 0 1 0 8.49" />
      <path d="M7.76 7.76a6 6 0 0 0 0 8.49" />
      <path d="M19.07 4.93a10 10 0 0 1 0 14.14" />
      <path d="M4.93 4.93a10 10 0 0 0 0 14.14" />
    </svg>
  )
}

/* ── Nav structure ── */

const navGroups = [
  {
    group: 'DETECTION',
    items: [
      { to: '/',       label: 'Dashboard',   Icon: LayoutDashboardIcon },
      { to: '/eda',    label: 'EDA Analysis', Icon: BarChart2Icon },
      { to: '/models', label: 'ML Models',    Icon: CpuIcon },
    ],
  },
  {
    group: 'OPERATIONS',
    items: [
      { to: '/predict', label: 'Predict',     Icon: ZapIcon },
      { to: '/stream',  label: 'Live Stream', Icon: RadioIcon },
    ],
  },
]

/* ── Sidebar component ── */

export default function Sidebar() {
  return (
    <aside
      style={{
        width: 240,
        height: '100vh',
        background: '#ffffff',
        borderRight: '1px solid rgba(0,0,0,0.07)',
        boxShadow: '2px 0 12px rgba(0,0,0,0.04)',
        display: 'flex',
        flexDirection: 'column',
        flexShrink: 0,
        zIndex: 40,
        position: 'relative',
      }}
    >
      {/* Logo row */}
      <div
        style={{
          height: 64,
          display: 'flex',
          alignItems: 'center',
          gap: 11,
          padding: '0 18px',
          borderBottom: '1px solid rgba(0,0,0,0.07)',
          flexShrink: 0,
        }}
      >
        {/* Fraud-alert logo */}
        <img
          src="/fraud-alert.png"
          alt="FraudShield logo"
          style={{
            width: 36,
            height: 36,
            objectFit: 'contain',
            flexShrink: 0,
            filter: 'drop-shadow(0 1px 4px rgba(0,0,0,0.12))',
          }}
        />

        <div>
          <div
            style={{
              fontSize: 15,
              fontWeight: 700,
              color: '#0f172a',
              lineHeight: 1.2,
              letterSpacing: '-0.01em',
            }}
          >
            FraudShield
          </div>
          <span
            className="mono"
            style={{
              display: 'inline-block',
              marginTop: 3,
              fontSize: 9,
              color: '#6366f1',
              background: 'rgba(99,102,241,0.08)',
              border: '1px solid rgba(99,102,241,0.20)',
              borderRadius: 4,
              padding: '1px 5px',
              letterSpacing: '0.06em',
            }}
          >
            v1.0
          </span>
        </div>
      </div>

      {/* Navigation */}
      <nav style={{ flex: 1, padding: '8px 12px', overflowY: 'auto' }}>
        {navGroups.map(({ group, items }) => (
          <div key={group} style={{ marginTop: 20 }}>
            {/* Group label */}
            <div
              className="mono"
              style={{
                fontSize: 10,
                color: 'var(--text-muted)',
                letterSpacing: '0.18em',
                textTransform: 'uppercase',
                padding: '0 10px',
                marginBottom: 4,
              }}
            >
              {group}
            </div>

            {/* Items */}
            {items.map(({ to, label, Icon }) => (
              <NavLink
                key={to}
                to={to}
                end={to === '/'}
                style={({ isActive }) => ({
                  display: 'flex',
                  alignItems: 'center',
                  gap: 10,
                  height: 38,
                  padding: '0 10px',
                  borderRadius: 6,
                  fontSize: 13,
                  fontWeight: 500,
                  textDecoration: 'none',
                  marginBottom: 2,
                  transition: 'all 0.15s ease',
                  borderLeft: isActive
                    ? '2px solid var(--accent-primary)'
                    : '2px solid transparent',
                  background: isActive ? 'rgba(99,102,241,0.08)' : 'transparent',
                  color: isActive ? 'var(--accent-primary)' : 'var(--text-secondary)',
                })}
                onMouseEnter={(e) => {
                  const el = e.currentTarget
                  const active = el.getAttribute('aria-current') === 'page'
                  if (!active) {
                    el.style.background = 'rgba(0,0,0,0.03)'
                    el.style.color = 'var(--text-primary)'
                  }
                }}
                onMouseLeave={(e) => {
                  const el = e.currentTarget
                  const active = el.getAttribute('aria-current') === 'page'
                  if (!active) {
                    el.style.background = ''
                    el.style.color = ''
                  }
                }}
              >
                <span style={{ flexShrink: 0, display: 'flex', alignItems: 'center' }}>
                  <Icon />
                </span>
                {label}
              </NavLink>
            ))}
          </div>
        ))}
      </nav>

      {/* Bottom model status card */}
      <div
        style={{
          position: 'absolute',
          bottom: 0,
          width: '100%',
          padding: '0 12px 16px',
        }}
      >
        <div
          style={{
            background: 'var(--bg-elevated)',
            border: '1px solid var(--border-subtle)',
            borderRadius: 10,
            padding: 14,
          }}
        >
          {/* Header row */}
          <div
            style={{
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'space-between',
              marginBottom: 8,
            }}
          >
            <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
              <span
                className="pulse-dot"
                style={{
                  width: 6,
                  height: 6,
                  borderRadius: '50%',
                  background: 'var(--success)',
                  display: 'inline-block',
                  flexShrink: 0,
                }}
              />
              <span
                style={{
                  fontSize: 12,
                  fontWeight: 600,
                  color: 'var(--text-primary)',
                }}
              >
                XGBoost Active
              </span>
            </div>
          </div>

          {/* Metrics grid */}
          <div
            style={{
              display: 'grid',
              gridTemplateColumns: '1fr 1fr',
              gap: '4px 12px',
            }}
          >
            {[
              { label: 'Precision', value: '0.94' },
              { label: 'Recall',    value: '0.84' },
              { label: 'F1-Score',  value: '0.89' },
              { label: 'ROC',       value: '0.987' },
            ].map(({ label, value }) => (
              <div key={label}>
                <div
                  style={{
                    fontSize: 10,
                    color: 'var(--text-muted)',
                    marginBottom: 1,
                  }}
                >
                  {label}
                </div>
                <div
                  className="mono"
                  style={{
                    fontSize: 11,
                    fontWeight: 600,
                    color: 'var(--text-primary)',
                  }}
                >
                  {value}
                </div>
              </div>
            ))}
          </div>
        </div>
      </div>
    </aside>
  )
}
