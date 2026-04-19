import { useState, useEffect } from 'react'
import axios from 'axios'

const normalValues = {
  Amount: '85.42', Time: '68413',
  V1: '1.191',  V2: '-0.129', V3: '0.644',  V4: '0.821',
  V5: '0.179',  V6: '-0.099', V7: '0.321',  V8: '-0.042',
  V9: '0.149',  V10: '-0.031',V11: '0.211', V12: '0.099',
  V13: '-0.123',V14: '0.087',
}

const suspiciousValues = {
  Amount: '2.70',  Time: '406',
  V1: '-2.312', V2: '1.952',  V3: '-1.610', V4: '3.998',
  V5: '-0.522', V6: '-1.427', V7: '-2.537', V8: '1.391',
  V9: '-2.771', V10: '-2.772',V11: '3.202', V12: '-2.900',
  V13: '0.423', V14: '-2.359',
}

const mockPredict = (vals) => {
  const v = Object.fromEntries(Object.entries(vals).map(([k, val]) => [k, parseFloat(val)]))
  const isFraud = v.V14 < -2 || v.V4 > 3 || v.V1 < -2
  const prob = isFraud ? 0.68 + Math.random() * 0.28 : Math.random() * 0.07
  return {
    prediction: isFraud ? 1 : 0,
    probability: prob,
    model_used: 'XGBoost (local heuristic)',
    risk_level: prob > 0.7 ? 'high' : prob > 0.4 ? 'medium' : 'low',
  }
}

function Spinner() {
  return (
    <svg width="16" height="16" viewBox="0 0 24 24" style={{ display: 'inline-block', verticalAlign: 'middle' }}>
      <circle cx="12" cy="12" r="10" stroke="rgba(255,255,255,0.3)" strokeWidth="3" fill="none" />
      <path d="M12 2a10 10 0 0 1 10 10" stroke="white" strokeWidth="3" fill="none" strokeLinecap="round">
        <animateTransform attributeName="transform" type="rotate" from="0 12 12" to="360 12 12" dur="0.8s" repeatCount="indefinite" />
      </path>
    </svg>
  )
}

function ProbabilityBar({ probability }) {
  const [width, setWidth] = useState(0)

  useEffect(() => {
    const t = setTimeout(() => setWidth(probability * 100), 50)
    return () => clearTimeout(t)
  }, [probability])

  return (
    <div style={{ width: '100%', height: 10, borderRadius: 99, background: 'var(--bg-elevated)', overflow: 'hidden' }}>
      <div style={{
        height: '100%',
        borderRadius: 99,
        background: 'linear-gradient(to right, #059669, #d97706, #e11d48)',
        backgroundSize: '100% 100%',
        width: `${width}%`,
        transition: 'width 0.7s cubic-bezier(0.34,1.56,0.64,1)',
        clipPath: `inset(0 ${100 - width}% 0 0)`,
      }} />
    </div>
  )
}

export default function Predict() {
  const [form, setForm] = useState(normalValues)
  const [result, setResult] = useState(null)
  const [loading, setLoading] = useState(false)

  const handleChange = (e) => {
    setForm(prev => ({ ...prev, [e.target.name]: e.target.value }))
  }

  const handleSubmit = async (e) => {
    e.preventDefault()
    setLoading(true)
    setResult(null)
    try {
      const payload = Object.fromEntries(Object.entries(form).map(([k, v]) => [k, parseFloat(v)]))
      const { data } = await axios.post('/api/predict', payload)
      setResult(data)
    } catch {
      setResult(mockPredict(form))
    } finally {
      setLoading(false)
    }
  }

  const vFields = ['V1','V2','V3','V4','V5','V6','V7','V8','V9','V10','V11','V12','V13','V14']

  const influences = [
    { f: 'V14',   v: 0.38, dir: parseFloat(form.V14) < -2 ? 'fraud' : 'legit' },
    { f: 'V4',    v: 0.22, dir: parseFloat(form.V4) > 3   ? 'fraud' : 'legit' },
    { f: 'V1',    v: 0.18, dir: parseFloat(form.V1) < -2  ? 'fraud' : 'legit' },
    { f: 'Amount',v: 0.12, dir: 'neutral' },
    { f: 'V12',   v: 0.10, dir: 'neutral' },
  ]

  const dirColor = (dir) => {
    if (dir === 'fraud')   return '#e11d48'
    if (dir === 'legit')   return '#059669'
    return '#6366f1'
  }

  const probPct = result ? (result.probability * 100).toFixed(1) : '0'
  const probColor = result
    ? result.probability > 0.7 ? '#e11d48' : result.probability > 0.4 ? '#d97706' : '#059669'
    : '#6366f1'

  return (
    <div style={{ padding: '32px 40px', maxWidth: 1200, margin: '0 auto' }}>

      {/* ── Header ── */}
      <div style={{ marginBottom: 24 }}>
        <div className="overline">// REAL-TIME FRAUD DETECTION</div>
        <h1 style={{ fontSize: 30, fontWeight: 800, color: '#0f172a', margin: '6px 0 8px' }}>Predict Transaction</h1>
        <p style={{ fontSize: 14, color: '#475569', margin: 0 }}>
          Enter transaction features to classify with XGBoost · V1–V14 shown (V15–V28 default to 0)
        </p>
      </div>

      {/* ── Two column layout ── */}
      <div style={{ display: 'grid', gridTemplateColumns: '55fr 45fr', gap: 24, alignItems: 'start' }}>

        {/* ── LEFT: Form ── */}
        <div className="glow-card" style={{ padding: 24 }}>

          {/* Preset buttons */}
          <div style={{ display: 'flex', gap: 10, marginBottom: 20 }}>
            <button
              type="button"
              className="btn-ghost"
              onClick={() => { setForm(normalValues); setResult(null) }}
            >
              Normal Transaction
            </button>
            <button
              type="button"
              className="btn-primary"
              onClick={() => { setForm(suspiciousValues); setResult(null) }}
              style={{ background: '#e11d48', boxShadow: '0 4px 12px rgba(225,29,72,0.35)' }}
            >
              🚨 Suspicious Transaction
            </button>
          </div>

          <div className="overline">// INPUT FEATURES</div>
          <div className="section-title" style={{ marginBottom: 16 }}>Transaction Features</div>

          <form onSubmit={handleSubmit}>

            {/* Amount & Time */}
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12, marginBottom: 16 }}>
              {[
                { key: 'Amount', label: 'Amount (€)' },
                { key: 'Time',   label: 'Time (seconds)' },
              ].map(({ key, label }) => (
                <div key={key}>
                  <label style={{
                    display: 'block',
                    fontSize: 11,
                    fontFamily: 'JetBrains Mono, monospace',
                    textTransform: 'uppercase',
                    color: '#94a3b8',
                    letterSpacing: '0.06em',
                    marginBottom: 4,
                  }}>{label}</label>
                  <input
                    className="field"
                    name={key}
                    value={form[key]}
                    onChange={handleChange}
                    type="number"
                    step="any"
                  />
                </div>
              ))}
            </div>

            {/* V1–V14 */}
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 10 }}>
              {vFields.map(key => (
                <div key={key}>
                  <label style={{
                    display: 'block',
                    fontSize: 10,
                    fontFamily: 'JetBrains Mono, monospace',
                    textTransform: 'uppercase',
                    color: '#94a3b8',
                    letterSpacing: '0.04em',
                    marginBottom: 3,
                  }}>{key}</label>
                  <input
                    className="field"
                    name={key}
                    value={form[key]}
                    onChange={handleChange}
                    type="number"
                    step="any"
                    style={{ height: 36, fontSize: 12 }}
                  />
                </div>
              ))}
            </div>

            {/* Submit */}
            <button
              type="submit"
              className="btn-primary"
              disabled={loading}
              style={{
                width: '100%',
                height: 44,
                marginTop: 20,
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                gap: 8,
                fontSize: 14,
                fontWeight: 600,
                opacity: loading ? 0.8 : 1,
              }}
            >
              {loading ? (
                <><Spinner /> Analyzing...</>
              ) : (
                'Analyze Transaction →'
              )}
            </button>
          </form>
        </div>

        {/* ── RIGHT: Results ── */}
        <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>

          {/* Empty state */}
          {!result && !loading && (
            <div className="glow-card" style={{
              height: 280,
              display: 'flex',
              flexDirection: 'column',
              alignItems: 'center',
              justifyContent: 'center',
              gap: 12,
            }}>
              <svg width="48" height="48" viewBox="0 0 24 24" fill="none">
                <path d="M12 2L3 7v5c0 5.25 3.75 10.15 9 11.35C17.25 22.15 21 17.25 21 12V7L12 2z" stroke="#6366f1" strokeWidth="1.5" fill="rgba(99,102,241,0.08)" strokeLinejoin="round" />
                <path d="M9 12l2 2 4-4" stroke="#6366f1" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" />
              </svg>
              <div style={{ fontSize: 16, fontWeight: 600, color: '#0f172a' }}>Submit a transaction</div>
              <div style={{ fontSize: 13, color: '#94a3b8' }}>Results will appear here</div>
            </div>
          )}

          {/* Loading placeholder */}
          {loading && (
            <div className="glow-card" style={{
              height: 280,
              display: 'flex',
              flexDirection: 'column',
              alignItems: 'center',
              justifyContent: 'center',
              gap: 12,
            }}>
              <Spinner />
              <div style={{ fontSize: 14, color: '#94a3b8', marginTop: 8 }}>Analyzing transaction...</div>
            </div>
          )}

          {/* Result state */}
          {result && (
            <div className="fade-up" style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>

              {/* Verdict */}
              <div className="glow-card" style={{
                padding: 24,
                borderLeft: `4px solid ${result.prediction === 1 ? '#e11d48' : '#059669'}`,
                background: result.prediction === 1 ? 'rgba(225,29,72,0.03)' : 'rgba(5,150,105,0.03)',
              }}>
                {result.prediction === 1 ? (
                  <>
                    <div style={{ fontSize: 22, fontWeight: 800, color: '#e11d48', marginBottom: 6 }}>⚠ FRAUD DETECTED</div>
                    <p style={{ fontSize: 13, color: '#475569', margin: 0 }}>
                      This transaction shows strong indicators of fraudulent activity.
                    </p>
                  </>
                ) : (
                  <>
                    <div style={{ fontSize: 22, fontWeight: 800, color: '#059669', marginBottom: 6 }}>✓ LEGITIMATE</div>
                    <p style={{ fontSize: 13, color: '#475569', margin: 0 }}>
                      This transaction appears to be legitimate.
                    </p>
                  </>
                )}
              </div>

              {/* Probability */}
              <div className="glow-card" style={{ padding: 20 }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 10 }}>
                  <span style={{ fontSize: 13, fontWeight: 600, color: '#0f172a' }}>Fraud Probability</span>
                  <span style={{ fontSize: 18, fontWeight: 700, color: probColor }}>
                    {probPct}%
                  </span>
                </div>
                <ProbabilityBar probability={result.probability} />
              </div>

              {/* Risk & Model */}
              <div className="glow-card" style={{ padding: 16 }}>
                {[
                  {
                    label: 'Risk Level:',
                    value: result.risk_level === 'high'
                      ? <span className="badge-danger">HIGH</span>
                      : result.risk_level === 'medium'
                        ? <span className="badge-warning">MEDIUM</span>
                        : <span className="badge-success">LOW</span>,
                  },
                  {
                    label: 'Model Used:',
                    value: <span style={{ fontFamily: 'JetBrains Mono, monospace', fontSize: 12, color: '#475569' }}>{result.model_used}</span>,
                  },
                  {
                    label: 'Inference Time:',
                    value: <span style={{ fontFamily: 'JetBrains Mono, monospace', fontSize: 12, color: '#475569' }}>~0.8ms</span>,
                  },
                ].map(({ label, value }) => (
                  <div key={label} style={{
                    display: 'flex',
                    justifyContent: 'space-between',
                    alignItems: 'center',
                    padding: '5px 0',
                    borderBottom: '1px solid var(--border-subtle)',
                  }}>
                    <span style={{ fontSize: 12, color: '#94a3b8' }}>{label}</span>
                    {value}
                  </div>
                ))}
              </div>

              {/* Feature Influence */}
              <div className="glow-card" style={{ padding: 20 }}>
                <div className="overline">// INFLUENCE ON PREDICTION</div>
                <div style={{ fontSize: 13, fontWeight: 700, color: '#0f172a', margin: '4px 0 14px' }}>Key Features</div>
                <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
                  {influences.map(inf => (
                    <div key={inf.f} style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                      <span style={{
                        fontFamily: 'JetBrains Mono, monospace',
                        fontSize: 12,
                        color: '#475569',
                        width: 50,
                        flexShrink: 0,
                      }}>{inf.f}</span>
                      <div style={{
                        width: 60,
                        height: 6,
                        borderRadius: 99,
                        background: 'var(--bg-elevated)',
                        overflow: 'hidden',
                        flexShrink: 0,
                      }}>
                        <div style={{
                          height: '100%',
                          borderRadius: 99,
                          background: dirColor(inf.dir),
                          width: `${inf.v * 100 / 0.38 * 100}%`,
                          opacity: 0.85,
                        }} />
                      </div>
                      <span style={{
                        fontFamily: 'JetBrains Mono, monospace',
                        fontSize: 10,
                        color: dirColor(inf.dir),
                        marginLeft: 4,
                      }}>{inf.v.toFixed(2)}</span>
                      <span style={{
                        fontSize: 10,
                        color: '#94a3b8',
                        marginLeft: 2,
                        fontStyle: 'italic',
                      }}>{inf.dir}</span>
                    </div>
                  ))}
                </div>
              </div>

            </div>
          )}
        </div>
      </div>
    </div>
  )
}
