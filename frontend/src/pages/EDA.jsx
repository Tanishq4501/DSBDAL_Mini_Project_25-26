import { useEffect, useRef } from 'react'

export default function EDA() {
  const barRef = useRef(null)
  const amtRef = useRef(null)
  const corrRef = useRef(null)

  // Class Imbalance horizontal bar chart
  useEffect(() => {
    const canvas = barRef.current
    if (!canvas) return
    const ctx = canvas.getContext('2d')
    const dpr = window.devicePixelRatio || 1
    const W = canvas.offsetWidth
    const H = 180
    canvas.width = W * dpr
    canvas.height = H * dpr
    ctx.scale(dpr, dpr)

    const legit = 284315
    const fraud = 492
    const paddingLeft = 90
    const paddingRight = 110
    const maxBarW = W - paddingLeft - paddingRight
    const bars = [
      { label: 'Legitimate', count: legit, pct: '99.83%', color: '#0891b2' },
      { label: 'Fraud',      count: fraud, pct: '0.17%',  color: '#e11d48' },
    ]

    let start = null
    const duration = 800

    const draw = (ts) => {
      if (!start) start = ts
      const progress = Math.min((ts - start) / duration, 1)
      const ease = 1 - Math.pow(1 - progress, 3)
      ctx.clearRect(0, 0, W, H)

      bars.forEach((bar, i) => {
        const y = 30 + i * 68
        const rawWidth = (bar.count / legit) * maxBarW
        const targetW = Math.max(rawWidth, bar.count === fraud ? 4 : 0)
        const currentW = targetW * ease

        ctx.font = '600 13px JetBrains Mono, monospace'
        ctx.fillStyle = '#475569'
        ctx.textAlign = 'right'
        ctx.fillText(bar.label, paddingLeft - 8, y + 25)

        const r = 6
        ctx.beginPath()
        if (currentW > r) {
          ctx.moveTo(paddingLeft, y + 4)
          ctx.lineTo(paddingLeft + currentW - r, y + 4)
          ctx.quadraticCurveTo(paddingLeft + currentW, y + 4, paddingLeft + currentW, y + 4 + r)
          ctx.lineTo(paddingLeft + currentW, y + 44 - r)
          ctx.quadraticCurveTo(paddingLeft + currentW, y + 44, paddingLeft + currentW - r, y + 44)
          ctx.lineTo(paddingLeft, y + 44)
        } else {
          ctx.rect(paddingLeft, y + 4, Math.max(currentW, 1), 40)
        }
        ctx.closePath()
        ctx.fillStyle = bar.color
        ctx.globalAlpha = 0.82
        ctx.fill()
        ctx.globalAlpha = 1

        if (progress > 0.25) {
          ctx.font = '600 12px JetBrains Mono, monospace'
          ctx.fillStyle = bar.color
          ctx.textAlign = 'left'
          ctx.fillText(`${bar.count.toLocaleString()} (${bar.pct})`, paddingLeft + Math.max(targetW, 6) + 8, y + 27)
        }
      })

      if (progress < 1) requestAnimationFrame(draw)
    }

    requestAnimationFrame(draw)
  }, [])

  // Amount Distribution grouped bar chart
  useEffect(() => {
    const canvas = amtRef.current
    if (!canvas) return
    const ctx = canvas.getContext('2d')
    const dpr = window.devicePixelRatio || 1
    const W = canvas.offsetWidth
    const H = 220
    canvas.width = W * dpr
    canvas.height = H * dpr
    ctx.scale(dpr, dpr)

    const buckets = [
      { label: '€0–10',    legit: 51420, fraud: 98 },
      { label: '€10–50',   legit: 87340, fraud: 142 },
      { label: '€50–100',  legit: 55210, fraud: 87 },
      { label: '€100–200', legit: 48820, fraud: 73 },
      { label: '€200–500', legit: 32180, fraud: 52 },
      { label: '€500+',    legit: 9345,  fraud: 21 },
    ]

    const padLeft = 12, padRight = 12, padTop = 20, padBottom = 36
    const chartW = W - padLeft - padRight
    const chartH = H - padTop - padBottom
    const maxVal = 87340
    const groupW = chartW / buckets.length
    const barW = groupW * 0.32
    const gap = groupW * 0.04

    let start = null
    const duration = 800

    const draw = (ts) => {
      if (!start) start = ts
      const progress = Math.min((ts - start) / duration, 1)
      const ease = 1 - Math.pow(1 - progress, 3)
      ctx.clearRect(0, 0, W, H)

      // Gridlines
      ctx.strokeStyle = 'rgba(0,0,0,0.06)'
      ctx.lineWidth = 1
      for (let i = 0; i <= 4; i++) {
        const y = padTop + chartH - (chartH / 4) * i
        ctx.beginPath()
        ctx.moveTo(padLeft, y)
        ctx.lineTo(padLeft + chartW, y)
        ctx.stroke()
      }

      buckets.forEach((b, i) => {
        const x = padLeft + i * groupW + groupW * 0.12
        const legitH = (b.legit / maxVal) * chartH * ease
        const fraudH = (b.fraud / maxVal) * chartH * ease

        ctx.globalAlpha = 0.8
        ctx.fillStyle = '#0891b2'
        ctx.fillRect(x, padTop + chartH - legitH, barW, legitH)

        ctx.fillStyle = '#e11d48'
        ctx.globalAlpha = 0.85
        ctx.fillRect(x + barW + gap, padTop + chartH - fraudH, barW, fraudH)
        ctx.globalAlpha = 1

        ctx.font = '10px JetBrains Mono, monospace'
        ctx.fillStyle = '#94a3b8'
        ctx.textAlign = 'center'
        ctx.fillText(b.label, x + barW + gap / 2, H - 10)
      })

      if (progress < 1) requestAnimationFrame(draw)
    }

    requestAnimationFrame(draw)
  }, [])

  // Correlation horizontal bar chart
  useEffect(() => {
    const canvas = corrRef.current
    if (!canvas) return
    const ctx = canvas.getContext('2d')
    const dpr = window.devicePixelRatio || 1
    const W = canvas.offsetWidth
    const H = 240
    canvas.width = W * dpr
    canvas.height = H * dpr
    ctx.scale(dpr, dpr)

    const corrs = [
      { f: 'V17', v: 0.327, neg: true },
      { f: 'V14', v: 0.303, neg: true },
      { f: 'V12', v: 0.261, neg: true },
      { f: 'V10', v: 0.217, neg: true },
      { f: 'V16', v: 0.197, neg: true },
      { f: 'V3',  v: 0.193, neg: true },
      { f: 'V7',  v: 0.188, neg: true },
      { f: 'V11', v: 0.155, neg: false },
      { f: 'V4',  v: 0.133, neg: false },
      { f: 'V2',  v: 0.092, neg: false },
    ]

    const padLeft = 36, padRight = 44, padTop = 8
    const maxBarW = W - padLeft - padRight
    const rowH = 20, rowGap = 4
    const maxVal = 0.327

    corrs.forEach((c, i) => {
      const y = padTop + i * (rowH + rowGap)
      const barW = (c.v / maxVal) * maxBarW
      const color = c.neg ? '#e11d48' : '#0891b2'

      ctx.fillStyle = color
      ctx.globalAlpha = 0.72
      ctx.fillRect(padLeft, y + 5, barW, rowH - 10)
      ctx.globalAlpha = 1

      ctx.font = '11px JetBrains Mono, monospace'
      ctx.fillStyle = '#475569'
      ctx.textAlign = 'right'
      ctx.fillText(c.f, padLeft - 4, y + rowH - 5)

      ctx.font = '10px JetBrains Mono, monospace'
      ctx.fillStyle = color
      ctx.textAlign = 'left'
      ctx.fillText(c.v.toFixed(3), padLeft + barW + 4, y + rowH - 5)
    })
  }, [])

  return (
    <div style={{ padding: '32px 40px', maxWidth: 1200, margin: '0 auto' }}>

      {/* ── Page Header ── */}
      <div style={{ marginBottom: 28, display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', gap: 24 }}>
        <div>
          <div className="overline">// PHASE 1 — EXPLORATORY DATA ANALYSIS</div>
          <h1 style={{ fontSize: 30, fontWeight: 800, color: '#0f172a', margin: '6px 0 8px' }}>Dataset Analysis</h1>
          <p style={{ fontSize: 14, color: '#475569', margin: 0 }}>
            Kaggle Credit Card Fraud Detection · 284,807 rows · September 2013, European cardholders
          </p>
        </div>
        <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap', justifyContent: 'flex-end', flexShrink: 0 }}>
          {['30 Features', 'No Missing Values', '1,081 Duplicates Removed'].map(pill => (
            <span key={pill} style={{
              background: 'var(--bg-elevated)',
              border: '1px solid var(--border-subtle)',
              padding: '6px 12px',
              borderRadius: 99,
              fontFamily: 'JetBrains Mono, monospace',
              fontSize: 12,
              color: '#475569',
              whiteSpace: 'nowrap',
            }}>{pill}</span>
          ))}
        </div>
      </div>

      {/* ── Stats Row ── */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4,1fr)', gap: 16, marginBottom: 24 }}>
        {[
          { title: 'Total (raw)',   value: '284,807', sub: '283,726 after deduplication',  color: '#0891b2' },
          { title: 'Fraud Cases',  value: '492',     sub: '0.1727% of transactions',       color: '#e11d48' },
          { title: 'Feature Count',value: '30',      sub: 'Time, V1–V28, Amount',          color: '#7c3aed' },
          { title: 'Time Period',  value: '48 hrs',  sub: '2 days, September 2013',         color: '#6366f1' },
        ].map(card => (
          <div key={card.title} className="glow-card bracket" style={{ padding: 18, borderLeft: `3px solid ${card.color}` }}>
            <div style={{ fontSize: 11, color: '#94a3b8', fontFamily: 'JetBrains Mono, monospace', marginBottom: 6, textTransform: 'uppercase', letterSpacing: '0.06em' }}>
              {card.title}
            </div>
            <div style={{ fontSize: 26, fontWeight: 800, color: '#0f172a', marginBottom: 4 }}>{card.value}</div>
            <div style={{ fontSize: 12, color: '#475569' }}>{card.sub}</div>
          </div>
        ))}
      </div>

      {/* ── Section 1: Class Imbalance ── */}
      <div className="glow-card" style={{ padding: 24, marginBottom: 20 }}>
        <div style={{ marginBottom: 16 }}>
          <div className="overline">// WHY ACCURACY FAILS</div>
          <div className="section-title">Class Imbalance — The Core Challenge</div>
        </div>
        <div style={{ display: 'grid', gridTemplateColumns: '55fr 45fr', gap: 28, alignItems: 'start' }}>
          <div>
            <canvas ref={barRef} style={{ width: '100%', height: 180, display: 'block' }} />
          </div>
          <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
            {[
              { label: 'Total transactions', value: '284,807',                             color: '#0f172a', size: 14, weight: 700 },
              { label: 'Fraud count',        value: '492',                                 color: '#e11d48', size: 14, weight: 700 },
              { label: 'Fraud rate',         value: '0.1727%',                             color: '#d97706', size: 14, weight: 700 },
              { label: 'Imbalance ratio',    value: '578:1',                               color: '#e11d48', size: 20, weight: 800 },
              { label: 'Naive accuracy',     value: '⚠ 99.83%',                            color: '#d97706', size: 14, weight: 700 },
              { label: 'True challenge',     value: 'Recall matters, not Accuracy',        color: '#6366f1', size: 13, weight: 600, italic: true },
            ].map(row => (
              <div key={row.label} style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: 8 }}>
                <span style={{ fontSize: 11, fontFamily: 'JetBrains Mono, monospace', color: '#94a3b8', flexShrink: 0 }}>{row.label}</span>
                <span style={{
                  fontSize: row.size,
                  fontWeight: row.weight,
                  color: row.color,
                  fontStyle: row.italic ? 'italic' : 'normal',
                  textAlign: 'right',
                }}>{row.value}</span>
              </div>
            ))}
          </div>
        </div>
      </div>

      {/* ── Section 2: Two Columns ── */}
      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 20, marginBottom: 20 }}>

        {/* Amount Distribution */}
        <div className="glow-card" style={{ padding: 20 }}>
          <div className="overline">// AMOUNT ANALYSIS</div>
          <div className="section-title" style={{ marginBottom: 12 }}>Transaction Amount by Class</div>
          <canvas ref={amtRef} style={{ width: '100%', height: 220, display: 'block' }} />
          <div style={{ display: 'flex', gap: 12, marginTop: 10, flexWrap: 'wrap', alignItems: 'center' }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: 5 }}>
              <span style={{ width: 10, height: 10, borderRadius: 2, background: '#0891b2', display: 'inline-block' }} />
              <span style={{ fontSize: 11, color: '#475569' }}>Legitimate</span>
            </div>
            <div style={{ display: 'flex', alignItems: 'center', gap: 5 }}>
              <span style={{ width: 10, height: 10, borderRadius: 2, background: '#e11d48', display: 'inline-block' }} />
              <span style={{ fontSize: 11, color: '#475569' }}>Fraud</span>
            </div>
          </div>
          <div style={{ display: 'flex', gap: 8, marginTop: 10, flexWrap: 'wrap' }}>
            <span className="badge-cyan">Avg Legit: €88.29</span>
            <span className="badge-danger">Avg Fraud: €122.21</span>
            <span className="badge-warning">Fraud median: €9.25</span>
          </div>
        </div>

        {/* Feature Correlations */}
        <div className="glow-card" style={{ padding: 20 }}>
          <div className="overline">// TOP 10 PREDICTORS</div>
          <div className="section-title" style={{ marginBottom: 12 }}>Feature Correlation with Fraud</div>
          <canvas ref={corrRef} style={{ width: '100%', height: 240, display: 'block' }} />
          <p style={{ fontSize: 11, color: '#94a3b8', marginTop: 10, marginBottom: 0, fontStyle: 'italic', lineHeight: 1.5 }}>
            Negative correlation = higher feature value → less likely fraud (and vice versa)
          </p>
        </div>
      </div>

      {/* ── Section 3: Dataset Schema ── */}
      <div className="glow-card" style={{ padding: 24, marginBottom: 20 }}>
        <div style={{ marginBottom: 16 }}>
          <div className="overline">// FEATURE DEFINITIONS</div>
          <div className="section-title">Dataset Schema</div>
        </div>
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 28, alignItems: 'start' }}>
          <p style={{ fontSize: 14, color: '#475569', lineHeight: 1.75, margin: 0 }}>
            The dataset contains transactions made by European cardholders over two days in September 2013.
            Features <strong>V1–V28</strong> are the result of a PCA transformation applied to protect user confidentiality — original feature names are unavailable due to privacy constraints.
            Only <strong>Time</strong> and <strong>Amount</strong> have not been transformed.
            <strong> Time</strong> represents seconds elapsed between each transaction and the dataset's first transaction.
            <strong> Amount</strong> is the transaction value in EUR. The <strong>Class</strong> response variable is 1 for fraud and 0 for legitimate.
          </p>
          <div style={{
            background: 'var(--bg-elevated)',
            borderRadius: 8,
            padding: 16,
            fontFamily: 'JetBrains Mono, monospace',
            fontSize: 12,
            border: '1px solid var(--border-subtle)',
          }}>
            <div style={{ display: 'grid', gridTemplateColumns: '80px 56px 1fr', rowGap: 8, columnGap: 12 }}>
              <span style={{ color: '#94a3b8', fontWeight: 700, fontSize: 11 }}>Column</span>
              <span style={{ color: '#94a3b8', fontWeight: 700, fontSize: 11 }}>Type</span>
              <span style={{ color: '#94a3b8', fontWeight: 700, fontSize: 11 }}>Description</span>
              <span style={{ gridColumn: '1/-1', borderBottom: '1px solid var(--border-subtle)', paddingBottom: 4 }} />
              <span style={{ color: '#6366f1' }}>Time</span>
              <span style={{ color: '#0891b2' }}>float</span>
              <span style={{ color: '#475569' }}>Seconds from first transaction</span>
              <span style={{ color: '#6366f1' }}>V1–V28</span>
              <span style={{ color: '#0891b2' }}>float</span>
              <span style={{ color: '#475569' }}>PCA components (anonymized)</span>
              <span style={{ color: '#6366f1' }}>Amount</span>
              <span style={{ color: '#0891b2' }}>float</span>
              <span style={{ color: '#475569' }}>Transaction amount (EUR)</span>
              <span style={{ color: '#6366f1' }}>Class</span>
              <span style={{ color: '#0891b2' }}>int</span>
              <span style={{ color: '#475569' }}>0 = Legit &nbsp;│&nbsp; <span style={{ color: '#e11d48' }}>1 = Fraud</span></span>
            </div>
          </div>
        </div>
      </div>

      {/* ── Section 4: Insight Cards ── */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3,1fr)', gap: 16 }}>
        <div className="glow-card" style={{ padding: 18, borderLeft: '3px solid #0891b2' }}>
          <div style={{ fontSize: 14, fontWeight: 700, color: '#0f172a', marginBottom: 8 }}>💡 Amount Pattern</div>
          <p style={{ fontSize: 13, color: '#475569', margin: 0, lineHeight: 1.65 }}>
            Fraud skews lower (median €9.25 vs €22.00). But high-value fraud exists up to €2,125.
          </p>
        </div>
        <div className="glow-card" style={{ padding: 18, borderLeft: '3px solid #7c3aed' }}>
          <div style={{ fontSize: 14, fontWeight: 700, color: '#0f172a', marginBottom: 8 }}>⏱ Time Pattern</div>
          <p style={{ fontSize: 13, color: '#475569', margin: 0, lineHeight: 1.65 }}>
            Fraud peaks in low-activity hours (1–4am). Legitimate transactions follow a clear day-cycle.
          </p>
        </div>
        <div className="glow-card" style={{ padding: 18, borderLeft: '3px solid #6366f1' }}>
          <div style={{ fontSize: 14, fontWeight: 700, color: '#0f172a', marginBottom: 8 }}>📊 V14 Signal</div>
          <p style={{ fontSize: 13, color: '#475569', margin: 0, lineHeight: 1.65 }}>
            V14 &lt; -5 is the strongest single predictor of fraud. Likely represents anonymized transaction velocity.
          </p>
        </div>
      </div>

    </div>
  )
}
