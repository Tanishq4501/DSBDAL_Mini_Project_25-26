/**
 * StatsCard — white/light theme
 *
 * Props:
 *   title     {string}        — monospace uppercase label
 *   value     {string|number} — large prominent value
 *   subtitle  {string}        — small description
 *   delta     {string}        — e.g. "+4.2%"
 *   deltaUp   {boolean}       — true = green ▲, false = red ▼
 *   icon      {ReactNode}     — 20px SVG element
 *   color     {'indigo'|'cyan'|'violet'|'danger'|'success'|'warning'}
 *   delay     {0|1|2|3|4}    — animation delay class
 */

const colorMap = {
  indigo:  { bg: 'rgba(99,102,241,0.10)',  text: '#6366f1', border: 'rgba(99,102,241,0.20)' },
  cyan:    { bg: 'rgba(8,145,178,0.10)',   text: '#0891b2', border: 'rgba(8,145,178,0.20)'  },
  violet:  { bg: 'rgba(124,58,237,0.10)',  text: '#7c3aed', border: 'rgba(124,58,237,0.20)' },
  danger:  { bg: 'rgba(225,29,72,0.10)',   text: '#e11d48', border: 'rgba(225,29,72,0.20)'  },
  success: { bg: 'rgba(5,150,105,0.10)',   text: '#059669', border: 'rgba(5,150,105,0.20)'  },
  warning: { bg: 'rgba(217,119,6,0.10)',   text: '#d97706', border: 'rgba(217,119,6,0.20)'  },
}

export default function StatsCard({
  title,
  value,
  subtitle,
  delta,
  deltaUp = true,
  icon,
  color = 'indigo',
  delay = 0,
}) {
  const c = colorMap[color] || colorMap.indigo
  const delayClass = delay > 0 ? `delay-${delay}` : ''

  return (
    <div
      className={`glow-card bracket fade-up ${delayClass}`}
      style={{ padding: 20 }}
    >
      {/* Top row: title + icon */}
      <div
        style={{
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between',
          marginBottom: 10,
        }}
      >
        <span
          className="mono"
          style={{
            fontSize: 11,
            letterSpacing: '0.12em',
            textTransform: 'uppercase',
            color: 'var(--text-muted)',
          }}
        >
          {title}
        </span>

        {icon && (
          <div
            style={{
              width: 32,
              height: 32,
              borderRadius: '50%',
              background: c.bg,
              border: `1px solid ${c.border}`,
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              color: c.text,
              flexShrink: 0,
            }}
          >
            {icon}
          </div>
        )}
      </div>

      {/* Large value */}
      <div
        style={{
          fontSize: 34,
          fontWeight: 800,
          color: c.text,
          lineHeight: 1,
          margin: '10px 0 4px',
          fontVariantNumeric: 'tabular-nums',
          letterSpacing: '-0.02em',
        }}
      >
        {value}
      </div>

      {/* Bottom row: subtitle + delta badge */}
      <div
        style={{
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between',
          marginTop: 8,
          gap: 8,
        }}
      >
        {subtitle && (
          <span
            style={{
              fontSize: 12,
              color: 'var(--text-muted)',
              whiteSpace: 'nowrap',
              overflow: 'hidden',
              textOverflow: 'ellipsis',
            }}
          >
            {subtitle}
          </span>
        )}

        {delta != null && (
          <span
            style={{
              display: 'inline-flex',
              alignItems: 'center',
              gap: 3,
              padding: '2px 7px',
              borderRadius: 99,
              fontSize: 11,
              fontWeight: 600,
              fontFamily: "'JetBrains Mono', monospace",
              flexShrink: 0,
              background: deltaUp
                ? 'rgba(5,150,105,0.10)'
                : 'rgba(225,29,72,0.09)',
              color: deltaUp ? '#059669' : '#e11d48',
              border: deltaUp
                ? '1px solid rgba(5,150,105,0.20)'
                : '1px solid rgba(225,29,72,0.18)',
            }}
          >
            {deltaUp ? '▲' : '▼'}
            {delta}
          </span>
        )}
      </div>
    </div>
  )
}
