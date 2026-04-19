import { useEffect, useRef, useState } from 'react'

export default function Dashboard() {
  const [time, setTime] = useState(new Date().toLocaleTimeString('en', { hour12: false }))
  const pieRef = useRef(null)

  useEffect(() => {
    const id = setInterval(() => {
      setTime(new Date().toLocaleTimeString('en', { hour12: false }))
    }, 1000)
    return () => clearInterval(id)
  }, [])

  useEffect(() => {
    const canvas = pieRef.current
    if (!canvas) return
    const ctx = canvas.getContext('2d')
    const dpr = window.devicePixelRatio || 1
    const rect = canvas.getBoundingClientRect()
    canvas.width = rect.width * dpr
    canvas.height = rect.height * dpr
    ctx.scale(dpr, dpr)

    const W = rect.width
    const H = rect.height
    const cx = W / 2
    const cy = H / 2
    const r = 90
    const lineW = 28
    const duration = 600
    let start = null

    function draw(ts) {
      if (!start) start = ts
      const elapsed = Math.min(ts - start, duration)
      const progress = elapsed / duration

      ctx.clearRect(0, 0, W, H)

      const legStart = -Math.PI / 2
      const fullAngle = Math.PI * 2
      const fraudFraction = 0.0017
      const legitFraction = 1 - fraudFraction

      // Legitimate arc (cyan)
      const legitEnd = legStart + fullAngle * legitFraction * progress
      ctx.beginPath()
      ctx.arc(cx, cy, r, legStart, legitEnd)
      ctx.strokeStyle = '#0891b2'
      ctx.lineWidth = lineW
      ctx.lineCap = 'round'
      ctx.stroke()

      // Fraud arc (red) — offset slightly outward
      if (progress > 0.8) {
        const fraudProgress = (progress - 0.8) / 0.2
        const fraudStart = legStart + fullAngle * legitFraction
        const fraudEnd = fraudStart + fullAngle * fraudFraction * fraudProgress
        ctx.beginPath()
        ctx.arc(cx, cy, r + 4, fraudStart, fraudEnd)
        ctx.strokeStyle = '#e11d48'
        ctx.lineWidth = lineW - 6
        ctx.lineCap = 'round'
        ctx.stroke()
      }

      // Center text
      ctx.fillStyle = '#0f172a'
      ctx.font = 'bold 22px Inter, sans-serif'
      ctx.textAlign = 'center'
      ctx.textBaseline = 'middle'
      ctx.fillText('99.83%', cx, cy - 10)
      ctx.fillStyle = '#475569'
      ctx.font = '13px Inter, sans-serif'
      ctx.fillText('Legitimate', cx, cy + 14)

      if (elapsed < duration) {
        requestAnimationFrame(draw)
      }
    }

    requestAnimationFrame(draw)
  }, [])

  const statCards = [
    {
      label: 'TOTAL TRANSACTIONS',
      value: '284,807',
      sub: '283,726 after dedup',
      color: '#0891b2',
      delay: 'delay-1',
      icon: (
        <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
          <ellipse cx="12" cy="5" rx="9" ry="3" />
          <path d="M3 5v14c0 1.66 4.03 3 9 3s9-1.34 9-3V5" />
          <path d="M3 12c0 1.66 4.03 3 9 3s9-1.34 9-3" />
        </svg>
      ),
    },
    {
      label: 'FRAUD CASES',
      value: '492',
      sub: '0.1727% of dataset',
      color: '#e11d48',
      delay: 'delay-2',
      icon: (
        <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
          <path d="M10.29 3.86L1.82 18a2 2 0 0 0 1.71 3h16.94a2 2 0 0 0 1.71-3L13.71 3.86a2 2 0 0 0-3.42 0z" />
          <line x1="12" y1="9" x2="12" y2="13" />
          <line x1="12" y1="17" x2="12.01" y2="17" />
        </svg>
      ),
    },
    {
      label: 'LEGITIMATE',
      value: '284,315',
      sub: '99.83% clean transactions',
      color: '#059669',
      delay: 'delay-3',
      icon: (
        <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
          <path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z" />
          <polyline points="9 12 11 14 15 10" />
        </svg>
      ),
    },
    {
      label: 'IMBALANCE RATIO',
      value: '578:1',
      sub: 'Legit to Fraud ratio',
      color: '#7c3aed',
      delay: 'delay-4',
      icon: (
        <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
          <line x1="12" y1="3" x2="12" y2="21" />
          <path d="M5 7l7-4 7 4" />
          <path d="M5 17l7 4 7-4" />
          <line x1="5" y1="12" x2="19" y2="12" />
        </svg>
      ),
    },
  ]

  const insights = [
    {
      border: '#d97706',
      title: 'ACCURACY PARADOX',
      body: 'Predicting ALL as legitimate gives 99.83% accuracy but catches 0% fraud. Accuracy is useless here.',
    },
    {
      border: '#6366f1',
      title: 'SMOTE OVERSAMPLING',
      body: 'Synthetic Minority Oversampling balances training data from 578:1 → 10:1 ratio without data leakage.',
    },
    {
      border: '#0891b2',
      title: 'BEST METRIC',
      body: 'We optimize for Recall (catching fraud) and PR-AUC (imbalanced performance). F1 balances both.',
    },
    {
      border: '#7c3aed',
      title: 'PCA FEATURES',
      body: 'V1–V28 are PCA-anonymized principal components. Original merchant/card data is confidential.',
    },
  ]

  const pipelineSteps = [
    'Load & Validate CSV',
    'Scale Amount + Time',
    'Apply SMOTE',
    'Train/Test Split',
    'Model Training',
    'Evaluate Metrics',
  ]

  const models = [
    { name: 'XGBoost', f1: '0.89', roc: '0.987', best: true },
    { name: 'Random Forest', f1: '0.88', roc: '0.985', best: false },
    { name: 'Log. Regression', f1: '0.81', roc: '0.977', best: false },
    { name: 'Isolation Forest', f1: '0.31', roc: '0.633', best: false },
  ]

  const infraItems = [
    { dot: '#059669', name: 'PySpark (Local[*])', badgeCls: 'badge badge-success', label: 'active' },
    { dot: '#059669', name: 'MapReduce (Python)', badgeCls: 'badge badge-success', label: 'active' },
    { dot: '#d97706', name: 'Hadoop HDFS', badgeCls: 'badge badge-warning', label: 'compose' },
    { dot: '#d97706', name: 'Apache Kafka', badgeCls: 'badge badge-warning', label: 'compose' },
    { dot: '#6366f1', name: 'FastAPI Backend', badgeCls: 'badge badge-indigo', label: 'running' },
  ]

  return (
    <div style={{ padding: '32px 32px 48px', background: 'var(--bg-base)', minHeight: '100vh' }}>

      {/* Header */}
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: 28 }}>
        <div>
          <div className="overline" style={{ marginBottom: 6 }}>// FRAUD DETECTION SYSTEM</div>
          <h1 style={{ fontSize: 30, fontWeight: 800, color: '#0f172a', letterSpacing: '-0.03em', margin: 0, lineHeight: 1.2 }}>
            Detection Dashboard
          </h1>
          <p style={{ margin: '6px 0 0', color: 'var(--text-secondary)', fontSize: 14 }}>
            Real-time monitoring · Kaggle Credit Card Fraud Dataset · 284,807 transactions
          </p>
        </div>
        <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'flex-end', gap: 8 }}>
          <div className="mono" style={{ fontSize: 22, fontWeight: 700, color: 'var(--accent-primary)', letterSpacing: '0.05em' }}>
            {time}
          </div>
          <span className="badge badge-indigo">Kaggle CCF Dataset</span>
        </div>
      </div>

      {/* Stats Row */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4,1fr)', gap: 16, marginBottom: 24 }}>
        {statCards.map((card) => (
          <div key={card.label} className={`glow-card bracket fade-up ${card.delay}`} style={{ padding: 20 }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 10 }}>
              <span className="mono" style={{ fontSize: 10, textTransform: 'uppercase', color: 'var(--text-muted)', letterSpacing: '0.08em' }}>
                {card.label}
              </span>
              <div style={{
                width: 28, height: 28, borderRadius: 8,
                background: card.color + '18',
                color: card.color,
                display: 'flex', alignItems: 'center', justifyContent: 'center',
                flexShrink: 0,
              }}>
                {card.icon}
              </div>
            </div>
            <div style={{ fontSize: 32, fontWeight: 800, color: card.color, lineHeight: 1, marginBottom: 6 }}>
              {card.value}
            </div>
            <div style={{ fontSize: 12, color: 'var(--text-muted)' }}>{card.sub}</div>
          </div>
        ))}
      </div>

      {/* Middle Section */}
      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 20, marginBottom: 24 }}>

        {/* Class Distribution */}
        <div className="glow-card" style={{ padding: 24 }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 16 }}>
            <div style={{ fontSize: 15, fontWeight: 700, color: 'var(--text-primary)' }}>Class Distribution</div>
            <div className="overline">// TARGET VARIABLE</div>
          </div>
          <canvas
            ref={pieRef}
            style={{ width: '100%', height: 260, display: 'block' }}
          />
          <div style={{ marginTop: 16, display: 'flex', flexDirection: 'column', gap: 8 }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
              <div style={{ width: 10, height: 10, borderRadius: '50%', background: '#0891b2', flexShrink: 0 }} />
              <span style={{ fontSize: 13, color: 'var(--text-secondary)', flexGrow: 1 }}>Legitimate</span>
              <span className="mono" style={{ fontSize: 12, color: 'var(--text-muted)' }}>284,315 transactions (99.83%)</span>
            </div>
            <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
              <div style={{ width: 10, height: 10, borderRadius: '50%', background: '#e11d48', flexShrink: 0 }} />
              <span style={{ fontSize: 13, color: 'var(--text-secondary)', flexGrow: 1 }}>Fraud</span>
              <span className="mono" style={{ fontSize: 12, color: 'var(--text-muted)' }}>492 transactions (0.17%)</span>
            </div>
          </div>
        </div>

        {/* Key Insights */}
        <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
          {insights.map((ins) => (
            <div key={ins.title} className="glow-card" style={{ padding: 16, borderLeft: `3px solid ${ins.border}` }}>
              <div className="overline" style={{ marginBottom: 6, color: 'var(--accent-primary)' }}>{ins.title}</div>
              <p style={{ margin: 0, fontSize: 13, color: 'var(--text-secondary)', lineHeight: 1.6 }}>{ins.body}</p>
            </div>
          ))}
        </div>
      </div>

      {/* Bottom 3-col Section */}
      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: 20 }}>

        {/* DS Pipeline */}
        <div className="glow-card" style={{ padding: 20 }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 16 }}>
            <div style={{ fontSize: 15, fontWeight: 700, color: 'var(--text-primary)' }}>Data Science Pipeline</div>
            <div className="overline">// PHASE 1–4</div>
          </div>
          <div style={{ position: 'relative' }}>
            <div style={{
              position: 'absolute', left: 9, top: 10, bottom: 10,
              width: 2, background: 'rgba(99,102,241,0.2)', zIndex: 0,
            }} />
            <div style={{ display: 'flex', flexDirection: 'column', gap: 12, position: 'relative', zIndex: 1 }}>
              {pipelineSteps.map((step, i) => (
                <div key={step} style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
                  <div style={{
                    width: 20, height: 20, borderRadius: '50%',
                    background: 'var(--bg-surface)',
                    color: 'var(--accent-primary)',
                    display: 'flex', alignItems: 'center', justifyContent: 'center',
                    flexShrink: 0,
                    fontSize: 11,
                    fontFamily: "'JetBrains Mono', monospace",
                    fontWeight: 700,
                    border: '1px solid rgba(99,102,241,0.3)',
                  }}>
                    {i + 1}
                  </div>
                  <span style={{ fontSize: 13, color: 'var(--text-secondary)' }}>{step}</span>
                </div>
              ))}
            </div>
          </div>
        </div>

        {/* Model Leaderboard */}
        <div className="glow-card" style={{ padding: 20 }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 16 }}>
            <div style={{ fontSize: 15, fontWeight: 700, color: 'var(--text-primary)' }}>Model Performance</div>
            <div className="overline">// RANKED BY F1-SCORE</div>
          </div>
          <div>
            <div style={{
              display: 'grid', gridTemplateColumns: '1fr 56px 72px',
              padding: '0 8px 8px',
              borderBottom: '1px solid var(--border-subtle)',
              marginBottom: 4,
            }}>
              <span style={{ fontSize: 11, color: 'var(--text-muted)', fontWeight: 600, textTransform: 'uppercase', letterSpacing: '0.06em' }}>Model</span>
              <span style={{ fontSize: 11, color: 'var(--text-muted)', fontWeight: 600, textTransform: 'uppercase', letterSpacing: '0.06em' }}>F1</span>
              <span style={{ fontSize: 11, color: 'var(--text-muted)', fontWeight: 600, textTransform: 'uppercase', letterSpacing: '0.06em' }}>ROC-AUC</span>
            </div>
            {models.map((m) => (
              <div key={m.name} style={{
                display: 'grid', gridTemplateColumns: '1fr 56px 72px',
                padding: '9px 8px',
                background: m.best ? 'rgba(99,102,241,0.05)' : 'transparent',
                borderRadius: m.best ? 6 : 0,
                fontWeight: m.best ? 600 : 400,
                alignItems: 'center',
              }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                  <span style={{ fontSize: 13, color: 'var(--text-primary)' }}>
                    {m.best ? '⭐ ' : '\u00a0\u00a0\u00a0'}{m.name}
                  </span>
                  {m.best && <span className="badge badge-indigo" style={{ fontSize: 10 }}>BEST</span>}
                </div>
                <span className="mono" style={{ fontSize: 13, color: 'var(--text-secondary)' }}>{m.f1}</span>
                <span className="mono" style={{ fontSize: 13, color: 'var(--text-secondary)' }}>{m.roc}</span>
              </div>
            ))}
          </div>
        </div>

        {/* Big Data Stack */}
        <div className="glow-card" style={{ padding: 20 }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 16 }}>
            <div style={{ fontSize: 15, fontWeight: 700, color: 'var(--text-primary)' }}>Infrastructure</div>
            <div className="overline">// BDA COMPONENTS</div>
          </div>
          <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
            {infraItems.map((item) => (
              <div key={item.name} style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                <div style={{ width: 8, height: 8, borderRadius: '50%', background: item.dot, flexShrink: 0 }} />
                <span style={{ fontSize: 13, color: 'var(--text-secondary)', flexGrow: 1 }}>{item.name}</span>
                <span className={item.badgeCls} style={{ fontSize: 11 }}>{item.label}</span>
              </div>
            ))}
          </div>
        </div>
      </div>

      {/* Accuracy Paradox Card */}
      <div className="glow-card" style={{
        marginTop: 20, padding: 24,
        borderLeft: '4px solid #e11d48',
        background: 'rgba(225,29,72,0.02)',
      }}>
        <div style={{ fontSize: 18, fontWeight: 700, color: '#0f172a', marginBottom: 20 }}>
          ⚠ The Accuracy Paradox — Why We Don't Use Accuracy
        </div>
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 32 }}>

          {/* Naive Model */}
          <div>
            <div style={{ fontSize: 14, fontWeight: 700, color: '#e11d48', marginBottom: 12 }}>
              Naive Model (99.83% accuracy)
            </div>
            <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
              {[
                { label: 'Accuracy', value: '99.83%', mark: '✓' },
                { label: 'Precision', value: 'N/A', mark: '✗' },
                { label: 'Recall', value: '0%', mark: '✗' },
                { label: 'F1', value: '0', mark: '✗' },
              ].map((row) => (
                <div key={row.label} style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                  <span style={{ fontSize: 13, color: 'var(--text-muted)' }}>{row.label}</span>
                  <span className="mono" style={{ fontSize: 13, color: row.mark === '✗' ? '#e11d48' : 'var(--text-secondary)' }}>
                    {row.value} {row.mark}
                  </span>
                </div>
              ))}
              <div style={{ marginTop: 4, fontSize: 13, fontWeight: 700, color: '#e11d48' }}>
                Fraud Caught: 0 out of 492
              </div>
            </div>
          </div>

          {/* XGBoost */}
          <div>
            <div style={{ fontSize: 14, fontWeight: 700, color: '#059669', marginBottom: 12 }}>
              XGBoost (F1: 0.89)
            </div>
            <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
              {[
                { label: 'Accuracy', value: '~99.9%', mark: '' },
                { label: 'Precision', value: '94%', mark: '' },
                { label: 'Recall', value: '84%', mark: '✓' },
                { label: 'F1', value: '0.89', mark: '✓' },
              ].map((row) => (
                <div key={row.label} style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                  <span style={{ fontSize: 13, color: 'var(--text-muted)' }}>{row.label}</span>
                  <span className="mono" style={{ fontSize: 13, color: row.mark === '✓' ? '#059669' : 'var(--text-secondary)' }}>
                    {row.value} {row.mark}
                  </span>
                </div>
              ))}
              <div style={{ marginTop: 4, fontSize: 13, fontWeight: 700, color: '#059669' }}>
                Fraud Caught: 96 out of 114 (test)
              </div>
            </div>
          </div>

        </div>
      </div>

    </div>
  )
}
