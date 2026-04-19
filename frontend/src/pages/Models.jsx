import { useEffect, useRef, useState } from 'react'

const models = [
  { name: 'XGBoost',             type: 'Gradient Boost',     precision: 0.94, recall: 0.84, f1: 0.89, roc: 0.987, pr: 0.86, best: true  },
  { name: 'Random Forest',       type: 'Ensemble',           precision: 0.96, recall: 0.82, f1: 0.88, roc: 0.985, pr: 0.84, best: false },
  { name: 'Logistic Regression', type: 'Linear',             precision: 0.87, recall: 0.76, f1: 0.81, roc: 0.977, pr: 0.72, best: false },
  { name: 'Isolation Forest',    type: 'Anomaly Detection',  precision: 0.34, recall: 0.28, f1: 0.31, roc: 0.633, pr: 0.21, best: false },
]

function metricColor(v) {
  if (v >= 0.85) return '#059669'
  if (v >= 0.5)  return '#d97706'
  return '#e11d48'
}

function typeBadge(type) {
  const map = {
    'Gradient Boost':    'badge-violet',
    'Ensemble':          'badge-indigo',
    'Linear':            'badge-cyan',
    'Anomaly Detection': 'badge-warning',
  }
  return map[type] || 'badge-indigo'
}

export default function Models() {
  const confRef = useRef(null)
  const rocRef  = useRef(null)
  const [sortCol, setSortCol] = useState('f1')
  const [sortDir, setSortDir] = useState('desc')

  const handleSort = (col) => {
    if (sortCol === col) setSortDir(d => d === 'desc' ? 'asc' : 'desc')
    else { setSortCol(col); setSortDir('desc') }
  }

  const sorted = [...models].sort((a, b) => {
    const av = a[sortCol], bv = b[sortCol]
    if (typeof av === 'number') return sortDir === 'desc' ? bv - av : av - bv
    return sortDir === 'desc' ? String(bv).localeCompare(String(av)) : String(av).localeCompare(String(bv))
  })

  // Confusion Matrix canvas
  useEffect(() => {
    const canvas = confRef.current
    if (!canvas) return
    const ctx = canvas.getContext('2d')
    const dpr = window.devicePixelRatio || 1
    const W = 200, H = 160
    canvas.width = W * dpr
    canvas.height = H * dpr
    ctx.scale(dpr, dpr)

    const cells = [
      { label: '56,827', sub: 'True Neg',  bg: 'rgba(5,150,105,0.13)',  color: '#059669', r: 0, c: 0 },
      { label: '6',      sub: 'False Pos', bg: 'rgba(217,119,6,0.13)',   color: '#d97706', r: 0, c: 1 },
      { label: '18',     sub: 'False Neg', bg: 'rgba(225,29,72,0.13)',   color: '#e11d48', r: 1, c: 0 },
      { label: '96 ✓',   sub: 'True Pos',  bg: 'rgba(5,150,105,0.20)',   color: '#059669', r: 1, c: 1 },
    ]

    const padTop = 22, padLeft = 58
    const cellW = (W - padLeft) / 2
    const cellH = (H - padTop) / 2

    // Column headers
    ctx.font = '10px Inter, sans-serif'
    ctx.fillStyle = '#94a3b8'
    ctx.textAlign = 'center'
    ctx.fillText('Pred Legit', padLeft + cellW * 0.5, 14)
    ctx.fillText('Pred Fraud', padLeft + cellW * 1.5, 14)

    // Row headers
    ctx.save()
    ctx.translate(14, padTop + cellH * 0.5)
    ctx.rotate(-Math.PI / 2)
    ctx.fillText('Actual Legit', 0, 0)
    ctx.restore()
    ctx.save()
    ctx.translate(14, padTop + cellH * 1.5)
    ctx.rotate(-Math.PI / 2)
    ctx.fillText('Actual Fraud', 0, 0)
    ctx.restore()

    cells.forEach(({ label, sub, bg, color, r, c }) => {
      const x = padLeft + c * cellW
      const y = padTop + r * cellH

      ctx.fillStyle = bg
      ctx.fillRect(x + 1, y + 1, cellW - 2, cellH - 2)

      ctx.font = 'bold 13px JetBrains Mono, monospace'
      ctx.fillStyle = color
      ctx.textAlign = 'center'
      ctx.fillText(label, x + cellW / 2, y + cellH / 2 - 2)

      ctx.font = '10px Inter, sans-serif'
      ctx.fillStyle = '#94a3b8'
      ctx.fillText(sub, x + cellW / 2, y + cellH / 2 + 14)
    })

    // Grid lines
    ctx.strokeStyle = 'rgba(0,0,0,0.08)'
    ctx.lineWidth = 1
    ctx.strokeRect(padLeft, padTop, W - padLeft, H - padTop)
    ctx.beginPath()
    ctx.moveTo(padLeft + cellW, padTop)
    ctx.lineTo(padLeft + cellW, H)
    ctx.moveTo(padLeft, padTop + cellH)
    ctx.lineTo(W, padTop + cellH)
    ctx.stroke()
  }, [])

  // ROC-AUC bar chart
  useEffect(() => {
    const canvas = rocRef.current
    if (!canvas) return
    const ctx = canvas.getContext('2d')
    const dpr = window.devicePixelRatio || 1
    const W = canvas.offsetWidth
    const H = 200
    canvas.width = W * dpr
    canvas.height = H * dpr
    ctx.scale(dpr, dpr)

    const data = [
      { name: 'XGBoost',       val: 0.987, color: '#6366f1' },
      { name: 'Random Forest', val: 0.985, color: '#0891b2' },
      { name: 'Logistic Reg.', val: 0.977, color: '#7c3aed' },
      { name: 'Isolation F.',  val: 0.633, color: '#d97706' },
    ]

    const padLeft = 108, padRight = 52, padTop = 10, padBottom = 28
    const chartW = W - padLeft - padRight
    const chartH = H - padTop - padBottom
    const barH = 28, barGap = 14

    // Dashed center line at 0.5
    const lineX = padLeft + (0.5) * chartW
    ctx.strokeStyle = 'rgba(0,0,0,0.18)'
    ctx.lineWidth = 1
    ctx.setLineDash([4, 4])
    ctx.beginPath()
    ctx.moveTo(lineX, padTop)
    ctx.lineTo(lineX, padTop + chartH)
    ctx.stroke()
    ctx.setLineDash([])
    ctx.font = '10px JetBrains Mono, monospace'
    ctx.fillStyle = '#94a3b8'
    ctx.textAlign = 'center'
    ctx.fillText('Random (0.5)', lineX, padTop + chartH + 18)

    let start = null
    const duration = 700

    const draw = (ts) => {
      if (!start) start = ts
      const progress = Math.min((ts - start) / duration, 1)
      const ease = 1 - Math.pow(1 - progress, 3)

      ctx.clearRect(padLeft, padTop, chartW, chartH + padBottom)

      // Redraw dashed line (cleared above)
      ctx.strokeStyle = 'rgba(0,0,0,0.18)'
      ctx.lineWidth = 1
      ctx.setLineDash([4, 4])
      ctx.beginPath()
      ctx.moveTo(lineX, padTop)
      ctx.lineTo(lineX, padTop + chartH)
      ctx.stroke()
      ctx.setLineDash([])
      ctx.font = '10px JetBrains Mono, monospace'
      ctx.fillStyle = '#94a3b8'
      ctx.textAlign = 'center'
      ctx.fillText('Random (0.5)', lineX, padTop + chartH + 18)

      data.forEach((d, i) => {
        const y = padTop + i * (barH + barGap)
        const targetW = d.val * chartW
        const currentW = targetW * ease

        // Model name
        ctx.font = '600 12px JetBrains Mono, monospace'
        ctx.fillStyle = '#475569'
        ctx.textAlign = 'right'
        ctx.fillText(d.name, padLeft - 8, y + barH / 2 + 5)

        // Bar
        const r = 4
        ctx.beginPath()
        ctx.moveTo(padLeft, y)
        if (currentW > r) {
          ctx.lineTo(padLeft + currentW - r, y)
          ctx.quadraticCurveTo(padLeft + currentW, y, padLeft + currentW, y + r)
          ctx.lineTo(padLeft + currentW, y + barH - r)
          ctx.quadraticCurveTo(padLeft + currentW, y + barH, padLeft + currentW - r, y + barH)
        } else {
          ctx.lineTo(padLeft + currentW, y)
          ctx.lineTo(padLeft + currentW, y + barH)
        }
        ctx.lineTo(padLeft, y + barH)
        ctx.closePath()
        ctx.fillStyle = d.color
        ctx.globalAlpha = 0.82
        ctx.fill()
        ctx.globalAlpha = 1

        // Value label
        if (progress > 0.3) {
          ctx.font = '700 12px JetBrains Mono, monospace'
          ctx.fillStyle = d.color
          ctx.textAlign = 'left'
          ctx.fillText(d.val.toFixed(3), padLeft + targetW + 6, y + barH / 2 + 5)
        }
      })

      if (progress < 1) requestAnimationFrame(draw)
    }

    requestAnimationFrame(draw)
  }, [])

  const cols = [
    { key: 'name',      label: 'Model'     },
    { key: 'type',      label: 'Type'      },
    { key: 'precision', label: 'Precision' },
    { key: 'recall',    label: 'Recall'    },
    { key: 'f1',        label: 'F1-Score'  },
    { key: 'roc',       label: 'ROC-AUC'   },
    { key: 'pr',        label: 'PR-AUC'    },
  ]

  return (
    <div style={{ padding: '32px 40px', maxWidth: 1200, margin: '0 auto' }}>

      {/* ── Page Header ── */}
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: 24, gap: 24 }}>
        <div>
          <div className="overline">// PHASE 3 &amp; 4 — TRAINING &amp; EVALUATION</div>
          <h1 style={{ fontSize: 30, fontWeight: 800, color: '#0f172a', margin: '6px 0 8px' }}>Machine Learning Models</h1>
          <p style={{ fontSize: 14, color: '#475569', margin: 0 }}>
            Four models trained on 80/20 stratified split · Evaluated on precision, recall, F1, ROC-AUC
          </p>
        </div>
        <div style={{ display: 'flex', gap: 8, alignItems: 'center', flexShrink: 0 }}>
          <span className="badge-indigo">Best: XGBoost</span>
          <span className="badge-success">F1: 0.89</span>
        </div>
      </div>

      {/* ── Best Model Banner ── */}
      <div className="glow-card bracket" style={{
        padding: 28,
        marginBottom: 24,
        border: '2px solid rgba(99,102,241,0.35)',
        background: 'rgba(99,102,241,0.03)',
      }}>
        <div style={{ display: 'grid', gridTemplateColumns: '40fr 30fr 30fr', gap: 28, alignItems: 'start' }}>

          {/* LEFT */}
          <div>
            <div className="overline">// PRODUCTION MODEL</div>
            <div className="text-glow" style={{ fontSize: 24, fontWeight: 700, margin: '6px 0 8px' }}>XGBoost Classifier</div>
            <p style={{ fontSize: 14, color: '#475569', marginBottom: 12 }}>
              Gradient boosting ensemble with scale_pos_weight for class imbalance. Best F1 and PR-AUC across all models.
            </p>
            <div style={{
              background: 'var(--bg-elevated)',
              borderRadius: 8,
              padding: 12,
              fontFamily: 'JetBrains Mono, monospace',
              fontSize: 12,
              color: '#475569',
              border: '1px solid var(--border-subtle)',
              lineHeight: 1.8,
            }}>
              <div>n_estimators=<span style={{ color: '#6366f1' }}>200</span></div>
              <div>max_depth=<span style={{ color: '#6366f1' }}>6</span></div>
              <div>learning_rate=<span style={{ color: '#6366f1' }}>0.10</span></div>
              <div>scale_pos_weight=<span style={{ color: '#6366f1' }}>auto</span></div>
              <div>eval_metric=<span style={{ color: '#0891b2' }}>'aucpr'</span></div>
            </div>
          </div>

          {/* CENTER — 2×2 metrics */}
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12 }}>
            {[
              { label: 'PRECISION', value: '0.94', color: '#0891b2', size: 24 },
              { label: 'RECALL',    value: '0.84', color: '#059669', size: 24 },
              { label: 'F1-SCORE',  value: '0.89', color: '#6366f1', size: 28 },
              { label: 'ROC-AUC',   value: '0.987',color: '#7c3aed', size: 24 },
            ].map(m => (
              <div key={m.label} style={{
                background: 'var(--bg-elevated)',
                borderRadius: 8,
                padding: '12px 10px',
                textAlign: 'center',
                border: '1px solid var(--border-subtle)',
              }}>
                <div style={{ fontSize: 9, fontFamily: 'JetBrains Mono, monospace', color: '#94a3b8', textTransform: 'uppercase', letterSpacing: '0.08em', marginBottom: 6 }}>{m.label}</div>
                <div style={{ fontSize: m.size, fontWeight: m.label === 'F1-SCORE' ? 800 : 700, color: m.color }}>{m.value}</div>
              </div>
            ))}
          </div>

          {/* RIGHT — Confusion matrix */}
          <div>
            <div style={{ fontSize: 11, fontFamily: 'JetBrains Mono, monospace', color: '#94a3b8', textTransform: 'uppercase', letterSpacing: '0.06em', marginBottom: 10 }}>
              Confusion Matrix
            </div>
            <canvas ref={confRef} style={{ width: 200, height: 160, display: 'block' }} />
          </div>
        </div>
      </div>

      {/* ── Models Table ── */}
      <div className="glow-card" style={{ marginBottom: 24, padding: 0, overflow: 'hidden' }}>
        <div style={{ padding: '16px 24px', borderBottom: '1px solid var(--border-subtle)', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
          <div className="section-title">Model Comparison</div>
          <div className="overline">// SORTED BY {sortCol.toUpperCase()}</div>
        </div>
        <div style={{ overflowX: 'auto' }}>
          <table style={{ width: '100%', borderCollapse: 'collapse' }}>
            <thead>
              <tr style={{ borderBottom: '1px solid var(--border-subtle)' }}>
                {cols.map(col => (
                  <th key={col.key}
                    onClick={() => handleSort(col.key)}
                    style={{
                      padding: '12px 16px',
                      textAlign: col.key === 'name' || col.key === 'type' ? 'left' : 'right',
                      fontFamily: 'JetBrains Mono, monospace',
                      fontSize: 11,
                      textTransform: 'uppercase',
                      letterSpacing: '0.06em',
                      color: sortCol === col.key ? '#6366f1' : '#94a3b8',
                      cursor: 'pointer',
                      userSelect: 'none',
                      whiteSpace: 'nowrap',
                      fontWeight: 600,
                    }}>
                    {col.label} {sortCol === col.key ? (sortDir === 'desc' ? '↓' : '↑') : ''}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              {sorted.map(m => (
                <tr key={m.name} style={{
                  background: m.best ? 'rgba(99,102,241,0.05)' : 'transparent',
                  borderBottom: '1px solid var(--border-subtle)',
                  transition: 'background 0.15s',
                }}>
                  <td style={{ padding: '13px 16px', whiteSpace: 'nowrap' }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                      <span style={{ fontSize: 13, fontWeight: 600, color: '#0f172a' }}>
                        {m.best ? '⭐ ' : ''}{m.name}
                      </span>
                      {m.best && <span className="badge-indigo">BEST</span>}
                    </div>
                  </td>
                  <td style={{ padding: '13px 16px' }}>
                    <span className={typeBadge(m.type)}>{m.type}</span>
                  </td>
                  {(['precision','recall','f1','roc','pr']).map(k => (
                    <td key={k} style={{ padding: '13px 16px', textAlign: 'right' }}>
                      <span style={{
                        fontFamily: 'JetBrains Mono, monospace',
                        fontSize: 13,
                        fontWeight: 600,
                        color: metricColor(m[k]),
                      }}>{m[k].toFixed(2)}</span>
                    </td>
                  ))}
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>

      {/* ── Two column: ROC + Why not Accuracy ── */}
      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 20, marginBottom: 20 }}>

        {/* ROC-AUC Bar Chart */}
        <div className="glow-card" style={{ padding: 20 }}>
          <div className="overline">// AREA UNDER CURVE</div>
          <div className="section-title" style={{ marginBottom: 14 }}>ROC-AUC Comparison</div>
          <canvas ref={rocRef} style={{ width: '100%', height: 200, display: 'block' }} />
        </div>

        {/* Why Not Accuracy */}
        <div className="glow-card" style={{ padding: 20 }}>
          <div className="overline">// THE PARADOX</div>
          <div className="section-title" style={{ marginBottom: 14 }}>Why Not Accuracy?</div>

          {/* Naive model card */}
          <div style={{
            borderLeft: '3px solid #e11d48',
            background: 'rgba(225,29,72,0.03)',
            borderRadius: 8,
            padding: 14,
            marginBottom: 12,
          }}>
            <div style={{ fontSize: 14, fontWeight: 700, color: '#e11d48', marginBottom: 8 }}>
              ❌ Naive Model: 99.83% Accuracy
            </div>
            <div style={{ display: 'flex', gap: 16, fontSize: 12, color: '#475569', marginBottom: 10, flexWrap: 'wrap' }}>
              <span>Accuracy <span style={{ color: '#059669' }}>✓ 99.83%</span></span>
              <span>Recall <span style={{ color: '#e11d48' }}>✗ 0%</span></span>
              <span>Fraud Caught <span style={{ color: '#e11d48' }}>✗ 0/492</span></span>
            </div>
            <div style={{ display: 'flex', gap: 3, flexWrap: 'wrap', marginBottom: 6 }}>
              {Array.from({ length: 20 }, (_, i) => (
                <div key={i} style={{
                  width: 10, height: 10, borderRadius: '50%',
                  background: i === 0 ? '#e11d48' : '#d1d5db',
                }} />
              ))}
            </div>
            <div style={{ fontSize: 11, color: '#94a3b8', fontFamily: 'JetBrains Mono, monospace' }}>All predicted as Legit</div>
          </div>

          {/* XGBoost card */}
          <div style={{
            borderLeft: '3px solid #059669',
            background: 'rgba(5,150,105,0.03)',
            borderRadius: 8,
            padding: 14,
          }}>
            <div style={{ fontSize: 14, fontWeight: 700, color: '#059669', marginBottom: 8 }}>
              ✅ XGBoost: F1-Score 0.89
            </div>
            <div style={{ display: 'flex', gap: 16, fontSize: 12, color: '#475569', marginBottom: 10, flexWrap: 'wrap' }}>
              <span>Recall <span style={{ color: '#059669' }}>✓ 84%</span></span>
              <span>Precision <span style={{ color: '#059669' }}>✓ 94%</span></span>
              <span>Fraud Caught <span style={{ color: '#059669' }}>✓ 96/114</span></span>
            </div>
            <div style={{ display: 'flex', gap: 3, flexWrap: 'wrap', marginBottom: 6 }}>
              {Array.from({ length: 20 }, (_, i) => (
                <div key={i} style={{
                  width: 10, height: 10, borderRadius: '50%',
                  background: i < 17 ? '#059669' : '#e11d48',
                }} />
              ))}
            </div>
            <div style={{ fontSize: 11, color: '#94a3b8', fontFamily: 'JetBrains Mono, monospace' }}>84% fraud caught</div>
          </div>
        </div>
      </div>

      {/* ── Model Cards ── */}
      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 16 }}>

        {/* Logistic Regression */}
        <div className="glow-card" style={{ padding: 20 }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 4 }}>
            <span className="badge-cyan">Linear</span>
            <span style={{ fontSize: 13, color: '#475569' }}>Baseline · Linear Model</span>
          </div>
          <div style={{ fontSize: 16, fontWeight: 700, color: '#0f172a', margin: '8px 0 6px' }}>Logistic Regression</div>
          <p style={{ fontSize: 13, color: '#475569', marginBottom: 10, lineHeight: 1.6 }}>
            Learns a linear decision boundary using regularized coefficients. Uses class_weight='balanced' to handle imbalance.
          </p>
          <div style={{
            background: 'var(--bg-elevated)',
            borderRadius: 6,
            padding: '8px 12px',
            fontFamily: 'JetBrains Mono, monospace',
            fontSize: 11,
            color: '#475569',
            marginBottom: 12,
            border: '1px solid var(--border-subtle)',
          }}>
            C=0.01, max_iter=1000, solver='lbfgs', class_weight='balanced'
          </div>
          <div style={{ display: 'flex', gap: 12, fontSize: 12 }}>
            <span>F1: <strong style={{ color: '#d97706' }}>0.81</strong></span>
            <span>Recall: <strong style={{ color: '#d97706' }}>0.76</strong></span>
          </div>
        </div>

        {/* Random Forest */}
        <div className="glow-card" style={{ padding: 20 }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 4 }}>
            <span className="badge-indigo">Ensemble</span>
          </div>
          <div style={{ fontSize: 16, fontWeight: 700, color: '#0f172a', margin: '8px 0 6px' }}>Random Forest</div>
          <p style={{ fontSize: 13, color: '#475569', marginBottom: 10, lineHeight: 1.6 }}>
            200 decision trees via bootstrap sampling. Each tree uses random feature subsets. Final prediction: majority vote.
          </p>
          <div style={{
            background: 'var(--bg-elevated)',
            borderRadius: 6,
            padding: '8px 12px',
            fontFamily: 'JetBrains Mono, monospace',
            fontSize: 11,
            color: '#475569',
            marginBottom: 12,
            border: '1px solid var(--border-subtle)',
          }}>
            n_estimators=100, max_depth=15, oob_score=True
          </div>
          <div style={{ display: 'flex', gap: 12, fontSize: 12 }}>
            <span>F1: <strong style={{ color: '#059669' }}>0.88</strong></span>
            <span>Precision: <strong style={{ color: '#059669' }}>0.96</strong> (highest)</span>
          </div>
        </div>

        {/* XGBoost */}
        <div className="glow-card" style={{ padding: 20, border: '1px solid rgba(99,102,241,0.25)' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 4 }}>
            <span className="badge-violet">Gradient Boost</span>
            <span style={{ fontSize: 13, color: '#475569' }}>Best Model ⭐</span>
          </div>
          <div style={{ fontSize: 16, fontWeight: 700, color: '#0f172a', margin: '8px 0 6px' }}>XGBoost</div>
          <p style={{ fontSize: 13, color: '#475569', marginBottom: 10, lineHeight: 1.6 }}>
            Gradient boosting: sequential trees that correct previous errors. scale_pos_weight adjusts for class imbalance.
          </p>
          <div style={{
            background: 'var(--bg-elevated)',
            borderRadius: 6,
            padding: '8px 12px',
            fontFamily: 'JetBrains Mono, monospace',
            fontSize: 11,
            color: '#475569',
            marginBottom: 12,
            border: '1px solid var(--border-subtle)',
          }}>
            n_estimators=200, max_depth=6, lr=0.1
          </div>
          <div style={{ display: 'flex', gap: 12, fontSize: 12 }}>
            <span>F1: <strong style={{ color: '#059669' }}>0.89</strong></span>
            <span>ROC-AUC: <strong style={{ color: '#059669' }}>0.987</strong></span>
          </div>
        </div>

        {/* Isolation Forest */}
        <div className="glow-card" style={{ padding: 20 }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 4 }}>
            <span className="badge-warning">Anomaly Detection</span>
            <span style={{ fontSize: 13, color: '#475569' }}>Unsupervised</span>
          </div>
          <div style={{ fontSize: 16, fontWeight: 700, color: '#0f172a', margin: '8px 0 6px' }}>Isolation Forest</div>
          <p style={{ fontSize: 13, color: '#475569', marginBottom: 10, lineHeight: 1.6 }}>
            Anomaly detection via random feature splits. Fraud transactions have shorter isolation path lengths.
          </p>
          <div style={{
            background: 'var(--bg-elevated)',
            borderRadius: 6,
            padding: '8px 12px',
            fontFamily: 'JetBrains Mono, monospace',
            fontSize: 11,
            color: '#475569',
            marginBottom: 12,
            border: '1px solid var(--border-subtle)',
          }}>
            contamination=0.001727, n_estimators=200
          </div>
          <div style={{ display: 'flex', gap: 10, fontSize: 12, alignItems: 'center', flexWrap: 'wrap' }}>
            <span>F1: <strong style={{ color: '#e11d48' }}>0.31</strong></span>
            <span className="badge-warning">No labels used in training</span>
            <span style={{ color: '#94a3b8' }}>(Weakest — unsupervised)</span>
          </div>
        </div>

      </div>
    </div>
  )
}
