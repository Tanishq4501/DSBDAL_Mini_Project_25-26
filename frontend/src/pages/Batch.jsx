import { useEffect, useRef, useState } from 'react'
import { getBatchAnalytics } from '../api/api'

// ── helpers ─────────────────────────────────────────────────────────────────

function fmt(n, decimals = 2) {
  if (n == null || isNaN(n)) return '—'
  return Number(n).toLocaleString('en-US', { maximumFractionDigits: decimals })
}

function fmtAmount(n) {
  if (n == null || isNaN(n)) return '—'
  return '$' + Number(n).toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })
}

function sourceBadge(source) {
  const map = {
    hadoop_output: { label: 'Hadoop MapReduce', color: '#f97316', bg: 'rgba(249,115,22,0.10)', border: 'rgba(249,115,22,0.30)' },
    spark:         { label: 'PySpark',           color: '#e11d48', bg: 'rgba(225,29,72,0.10)',  border: 'rgba(225,29,72,0.30)'  },
    pandas_local_fallback: { label: 'Pandas Local', color: '#0891b2', bg: 'rgba(8,145,178,0.10)', border: 'rgba(8,145,178,0.30)' },
    mock:          { label: 'Demo Data',          color: '#6366f1', bg: 'rgba(99,102,241,0.10)', border: 'rgba(99,102,241,0.30)' },
  }
  const s = map[source] || map.mock
  return (
    <span style={{
      fontSize: 11, fontWeight: 700, fontFamily: "'JetBrains Mono', monospace",
      letterSpacing: '0.06em', padding: '3px 10px', borderRadius: 6,
      color: s.color, background: s.bg, border: `1px solid ${s.border}`,
    }}>
      {s.label.toUpperCase()}
    </span>
  )
}

// ── sub-components ───────────────────────────────────────────────────────────

function MetricCard({ label, value, sub, color = 'var(--accent-primary)', icon }) {
  return (
    <div className="glow-card" style={{ padding: '18px 20px', display: 'flex', flexDirection: 'column', gap: 4 }}>
      <div style={{ display: 'flex', alignItems: 'center', gap: 7, marginBottom: 2 }}>
        {icon && <span style={{ fontSize: 16 }}>{icon}</span>}
        <span style={{ fontSize: 11, color: 'var(--text-muted)', fontWeight: 600,
          textTransform: 'uppercase', letterSpacing: '0.07em',
          fontFamily: "'JetBrains Mono', monospace" }}>
          {label}
        </span>
      </div>
      <div className="mono" style={{ fontSize: 26, fontWeight: 800, color, lineHeight: 1.1 }}>
        {value}
      </div>
      {sub && <div style={{ fontSize: 11, color: 'var(--text-muted)', marginTop: 2 }}>{sub}</div>}
    </div>
  )
}

function PipelineStep({ icon, title, detail, color = '#6366f1', last = false }) {
  return (
    <div style={{ display: 'flex', alignItems: 'stretch', gap: 0 }}>
      <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', width: 36, flexShrink: 0 }}>
        <div style={{
          width: 32, height: 32, borderRadius: '50%', flexShrink: 0,
          background: `${color}18`, border: `2px solid ${color}50`,
          display: 'flex', alignItems: 'center', justifyContent: 'center',
          fontSize: 14, zIndex: 1,
        }}>
          {icon}
        </div>
        {!last && <div style={{ flex: 1, width: 2, background: `${color}25`, margin: '4px 0' }} />}
      </div>
      <div style={{ paddingLeft: 12, paddingBottom: last ? 0 : 20, paddingTop: 4 }}>
        <div style={{ fontSize: 13, fontWeight: 700, color: 'var(--text-primary)', lineHeight: 1.2 }}>{title}</div>
        <div style={{ fontSize: 11, color: 'var(--text-muted)', marginTop: 2, lineHeight: 1.5 }}>{detail}</div>
      </div>
    </div>
  )
}

function BarComparison({ fraudAvg, legitAvg }) {
  const max = Math.max(fraudAvg, legitAvg)
  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
      {[
        { label: 'Fraud Avg Amount', value: fraudAvg, color: '#e11d48' },
        { label: 'Legit Avg Amount', value: legitAvg, color: '#059669' },
      ].map(({ label, value, color }) => (
        <div key={label}>
          <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 6 }}>
            <span style={{ fontSize: 12, color: 'var(--text-secondary)', fontWeight: 600 }}>{label}</span>
            <span className="mono" style={{ fontSize: 13, fontWeight: 700, color }}>{fmtAmount(value)}</span>
          </div>
          <div style={{ height: 10, borderRadius: 99, background: 'var(--bg-elevated)', overflow: 'hidden' }}>
            <div style={{
              height: '100%', borderRadius: 99, background: color,
              width: `${max > 0 ? (value / max) * 100 : 0}%`,
              transition: 'width 0.8s ease',
            }} />
          </div>
        </div>
      ))}
    </div>
  )
}

function DonutRing({ pct, color = '#e11d48', size = 110 }) {
  const canvasRef = useRef(null)
  useEffect(() => {
    const canvas = canvasRef.current
    if (!canvas) return
    const dpr = window.devicePixelRatio || 1
    canvas.width  = size * dpr
    canvas.height = size * dpr
    const ctx = canvas.getContext('2d')
    ctx.scale(dpr, dpr)
    const cx = size / 2, cy = size / 2, r = size / 2 - 8
    const start = -Math.PI / 2
    const end   = start + (pct / 100) * 2 * Math.PI
    ctx.clearRect(0, 0, size, size)
    // track
    ctx.beginPath(); ctx.arc(cx, cy, r, 0, 2 * Math.PI)
    ctx.strokeStyle = 'var(--bg-elevated)'; ctx.lineWidth = 12; ctx.stroke()
    // fill
    ctx.beginPath(); ctx.arc(cx, cy, r, start, end)
    ctx.strokeStyle = color; ctx.lineWidth = 12
    ctx.lineCap = 'round'; ctx.stroke()
  }, [pct, color, size])

  return (
    <div style={{ position: 'relative', width: size, height: size, flexShrink: 0 }}>
      <canvas ref={canvasRef} style={{ width: size, height: size }} />
      <div style={{
        position: 'absolute', inset: 0,
        display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center',
      }}>
        <div className="mono" style={{ fontSize: 17, fontWeight: 800, color, lineHeight: 1 }}>
          {pct.toFixed(4)}%
        </div>
        <div style={{ fontSize: 9, color: 'var(--text-muted)', marginTop: 2 }}>FRAUD RATE</div>
      </div>
    </div>
  )
}

// ── main page ─────────────────────────────────────────────────────────────────

export default function Batch() {
  const [data, setData]     = useState(null)
  const [loading, setLoading] = useState(true)
  const [error, setError]   = useState(null)

  useEffect(() => {
    getBatchAnalytics()
      .then(r => { setData(r.data); setLoading(false) })
      .catch(() => { setError('Could not reach backend'); setLoading(false) })
  }, [])

  const refresh = () => {
    setLoading(true); setError(null)
    getBatchAnalytics()
      .then(r => { setData(r.data); setLoading(false) })
      .catch(() => { setError('Could not reach backend'); setLoading(false) })
  }

  if (loading) {
    return (
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center',
        height: '60vh', flexDirection: 'column', gap: 16 }}>
        <div style={{ width: 36, height: 36, border: '3px solid var(--border-subtle)',
          borderTop: '3px solid var(--accent-primary)', borderRadius: '50%',
          animation: 'spin 0.9s linear infinite' }} />
        <span style={{ fontSize: 14, color: 'var(--text-muted)' }}>Loading batch analytics…</span>
      </div>
    )
  }

  if (error || !data) {
    return (
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center',
        height: '60vh', flexDirection: 'column', gap: 12 }}>
        <span style={{ fontSize: 28 }}>⚠️</span>
        <span style={{ fontSize: 14, color: 'var(--text-muted)' }}>{error || 'No data available'}</span>
        <button className="btn-primary" onClick={refresh}>Retry</button>
      </div>
    )
  }

  const { source, summary, rows, note } = data
  const fraudRow = rows?.find(r => r.class === 1) || {}
  const legitRow = rows?.find(r => r.class === 0) || {}

  const totalTx    = summary?.total_transactions       ?? 0
  const fraudCount = summary?.fraud_transactions        ?? 0
  const legitCount = summary?.legitimate_transactions   ?? 0
  const fraudRate  = summary?.fraud_rate_pct            ?? 0
  const totalAmt   = summary?.total_amount              ?? 0

  return (
    <div style={{ padding: '0 0 48px' }}>
      {/* ── Header ── */}
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: 24 }}>
        <div>
          <div className="overline" style={{ marginBottom: 6 }}>// HADOOP · SPARK · MAPREDUCE</div>
          <h1 style={{ fontSize: 28, fontWeight: 800, color: 'var(--text-primary)',
            letterSpacing: '-0.03em', margin: 0, lineHeight: 1.2 }}>
            Batch Analytics
          </h1>
          <p style={{ fontSize: 13, color: 'var(--text-muted)', marginTop: 6, marginBottom: 0 }}>
            Historical fraud aggregation via Hadoop Streaming MapReduce &amp; PySpark MLlib
          </p>
        </div>
        <div style={{ display: 'flex', alignItems: 'center', gap: 10, paddingTop: 4 }}>
          {sourceBadge(source)}
          <button className="btn-ghost" onClick={refresh} style={{ fontSize: 12 }}>↺ Refresh</button>
        </div>
      </div>

      {/* ── Source note ── */}
      {note && (
        <div style={{
          marginBottom: 20, padding: '10px 16px', borderRadius: 8,
          background: 'rgba(99,102,241,0.06)', border: '1px solid rgba(99,102,241,0.18)',
          fontSize: 12, color: 'var(--text-secondary)',
        }}>
          ℹ️ &nbsp;{note}
        </div>
      )}

      {/* ── Key Metrics ── */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(5, 1fr)', gap: 14, marginBottom: 24 }}>
        <MetricCard label="Total Transactions" value={fmt(totalTx, 0)} icon="📊"
          sub="Processed by MapReduce" color="var(--accent-primary)" />
        <MetricCard label="Fraud Detected" value={fmt(fraudCount, 0)} icon="⚑"
          sub={`${fraudRate.toFixed(4)}% of total`} color="var(--danger)" />
        <MetricCard label="Legitimate" value={fmt(legitCount, 0)} icon="✓"
          sub="Clean transactions" color="var(--success)" />
        <MetricCard label="Fraud Rate" value={`${fraudRate.toFixed(4)}%`} icon="📈"
          sub="Class imbalance" color={fraudRate > 1 ? 'var(--warning)' : 'var(--danger)'} />
        <MetricCard label="Total Volume" value={fmtAmount(totalAmt)} icon="💳"
          sub="All transactions" color="var(--text-primary)" />
      </div>

      {/* ── Main grid ── */}
      <div style={{ display: 'grid', gridTemplateColumns: '1fr 360px', gap: 20, marginBottom: 20 }}>

        {/* MapReduce output table */}
        <div className="glow-card" style={{ padding: 0, overflow: 'hidden' }}>
          <div style={{ padding: '16px 20px', borderBottom: '1px solid var(--border-subtle)',
            display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
            <div>
              <div style={{ fontSize: 15, fontWeight: 700, color: 'var(--text-primary)' }}>
                MapReduce Reducer Output
              </div>
              <div className="overline" style={{ marginTop: 2 }}>
                {source === 'hadoop_output' ? '// LIVE — hadoop-output/results.txt' : '// DEMO DATA'}
              </div>
            </div>
            <span style={{ fontSize: 11, fontFamily: "'JetBrains Mono', monospace",
              color: 'var(--text-muted)', background: 'var(--bg-elevated)',
              padding: '2px 8px', borderRadius: 4, border: '1px solid var(--border-subtle)' }}>
              mapper.py → reducer.py
            </span>
          </div>

          {/* Table */}
          <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 13 }}>
            <thead>
              <tr style={{ background: 'var(--bg-elevated)' }}>
                {['Class', 'Label', 'Count', 'Total Amount', 'Avg Amount', 'Share of Total'].map(h => (
                  <th key={h} style={{
                    padding: '10px 16px', textAlign: 'left', fontSize: 10, fontWeight: 600,
                    color: 'var(--text-muted)', textTransform: 'uppercase', letterSpacing: '0.07em',
                    fontFamily: "'JetBrains Mono', monospace",
                    borderBottom: '1px solid var(--border-subtle)',
                  }}>{h}</th>
                ))}
              </tr>
            </thead>
            <tbody>
              {rows?.map(row => {
                const isFraud = row.class === 1
                const sharePct = totalTx > 0 ? (row.count / totalTx) * 100 : 0
                return (
                  <tr key={row.class} style={{
                    background: isFraud ? 'rgba(225,29,72,0.03)' : 'transparent',
                    borderLeft: `3px solid ${isFraud ? '#e11d48' : '#059669'}`,
                    borderBottom: '1px solid var(--border-subtle)',
                  }}>
                    <td className="mono" style={{ padding: '12px 16px', fontSize: 13, fontWeight: 700,
                      color: isFraud ? 'var(--danger)' : 'var(--success)' }}>
                      {row.class}
                    </td>
                    <td style={{ padding: '12px 16px' }}>
                      <span className={`badge ${isFraud ? 'badge-danger' : 'badge-success'}`}>
                        {row.label.toUpperCase()}
                      </span>
                    </td>
                    <td className="mono" style={{ padding: '12px 16px', fontWeight: 600 }}>
                      {fmt(row.count, 0)}
                    </td>
                    <td className="mono" style={{ padding: '12px 16px' }}>{fmtAmount(row.total_amount)}</td>
                    <td className="mono" style={{ padding: '12px 16px' }}>{fmtAmount(row.avg_amount)}</td>
                    <td style={{ padding: '12px 16px' }}>
                      <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                        <div style={{ width: 80, height: 6, borderRadius: 99,
                          background: 'var(--bg-elevated)', overflow: 'hidden', flexShrink: 0 }}>
                          <div style={{
                            width: `${Math.min(100, sharePct)}%`, height: '100%', borderRadius: 99,
                            background: isFraud ? '#e11d48' : '#059669',
                          }} />
                        </div>
                        <span className="mono" style={{ fontSize: 11, color: 'var(--text-muted)' }}>
                          {sharePct.toFixed(2)}%
                        </span>
                      </div>
                    </td>
                  </tr>
                )
              })}
            </tbody>
          </table>

          {/* Raw output preview */}
          <div style={{ padding: '12px 20px', borderTop: '1px solid var(--border-subtle)',
            background: 'var(--bg-elevated)' }}>
            <div className="overline" style={{ marginBottom: 6 }}>// RAW REDUCER OUTPUT</div>
            <pre className="mono" style={{
              fontSize: 11, color: 'var(--text-secondary)', margin: 0, lineHeight: 1.6,
              whiteSpace: 'pre-wrap',
            }}>
              {rows?.map(r =>
                `${r.class}\t${r.count}\t${r.total_amount}\t${r.avg_amount}`
              ).join('\n') || '(no output)'}
            </pre>
            <div style={{ fontSize: 10, color: 'var(--text-muted)', marginTop: 6 }}>
              Format: &lt;class&gt; TAB &lt;count&gt; TAB &lt;total_amount&gt; TAB &lt;avg_amount&gt;
            </div>
          </div>
        </div>

        {/* Right panel */}
        <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>

          {/* Fraud rate donut */}
          <div className="glow-card" style={{ padding: 20 }}>
            <div style={{ fontSize: 14, fontWeight: 700, color: 'var(--text-primary)', marginBottom: 16 }}>
              Fraud Rate
            </div>
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 20 }}>
              <DonutRing pct={fraudRate} color="#e11d48" size={110} />
              <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
                {[
                  { label: 'Fraud', count: fraudCount, color: '#e11d48' },
                  { label: 'Legit', count: legitCount, color: '#059669' },
                ].map(({ label, count, color }) => (
                  <div key={label} style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                    <div style={{ width: 8, height: 8, borderRadius: '50%', background: color, flexShrink: 0 }} />
                    <div style={{ fontSize: 12, color: 'var(--text-secondary)' }}>{label}</div>
                    <div className="mono" style={{ fontSize: 12, fontWeight: 700, color, marginLeft: 4 }}>
                      {fmt(count, 0)}
                    </div>
                  </div>
                ))}
                <div style={{ fontSize: 10, color: 'var(--text-muted)', marginTop: 4, lineHeight: 1.5 }}>
                  578:1 class imbalance<br />
                  Recall &gt; Accuracy
                </div>
              </div>
            </div>
          </div>

          {/* Avg amount comparison */}
          <div className="glow-card" style={{ padding: 20 }}>
            <div style={{ fontSize: 14, fontWeight: 700, color: 'var(--text-primary)', marginBottom: 16 }}>
              Average Transaction Amount
            </div>
            <BarComparison
              fraudAvg={fraudRow.avg_amount ?? 0}
              legitAvg={legitRow.avg_amount ?? 0}
            />
            <div style={{ marginTop: 14, fontSize: 11, color: 'var(--text-muted)', lineHeight: 1.6 }}>
              Fraudulent transactions often have smaller amounts to avoid detection triggers,
              though the mean is skewed by a few high-value outliers.
            </div>
          </div>

          {/* Class imbalance visual */}
          <div className="glow-card" style={{ padding: 20 }}>
            <div style={{ fontSize: 14, fontWeight: 700, color: 'var(--text-primary)', marginBottom: 12 }}>
              Class Distribution
            </div>
            <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
              {[
                { label: 'Legitimate', count: legitCount, total: totalTx, color: '#059669' },
                { label: 'Fraud',      count: fraudCount, total: totalTx, color: '#e11d48' },
              ].map(({ label, count, total, color }) => {
                const pct = total > 0 ? (count / total) * 100 : 0
                return (
                  <div key={label}>
                    <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 4 }}>
                      <span style={{ fontSize: 12, color: 'var(--text-secondary)' }}>{label}</span>
                      <span className="mono" style={{ fontSize: 11, color }}>
                        {fmt(count, 0)} ({pct.toFixed(3)}%)
                      </span>
                    </div>
                    <div style={{ height: 8, borderRadius: 99, background: 'var(--bg-elevated)', overflow: 'hidden' }}>
                      <div style={{
                        height: '100%', borderRadius: 99, background: color,
                        width: `${Math.max(pct, 0.5)}%`, transition: 'width 1s ease',
                      }} />
                    </div>
                  </div>
                )
              })}
            </div>
          </div>
        </div>
      </div>

      {/* ── Pipeline sections ── */}
      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 20 }}>

        {/* Hadoop Streaming pipeline */}
        <div className="glow-card" style={{ padding: 20 }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 20 }}>
            <div>
              <div style={{ fontSize: 15, fontWeight: 700, color: 'var(--text-primary)' }}>
                Hadoop Streaming Pipeline
              </div>
              <div className="overline" style={{ marginTop: 2 }}>// YARN + HDFS</div>
            </div>
            <span style={{
              fontSize: 10, fontWeight: 700, padding: '3px 8px', borderRadius: 5,
              background: source === 'hadoop_output' ? 'rgba(5,150,105,0.1)' : 'rgba(99,102,241,0.1)',
              color: source === 'hadoop_output' ? '#059669' : '#6366f1',
              border: `1px solid ${source === 'hadoop_output' ? 'rgba(5,150,105,0.3)' : 'rgba(99,102,241,0.3)'}`,
              fontFamily: "'JetBrains Mono', monospace",
            }}>
              {source === 'hadoop_output' ? '✓ COMPLETED' : '○ DEMO'}
            </span>
          </div>

          <PipelineStep icon="📄" color="#f97316"
            title="creditcard.csv → HDFS"
            detail="jobsubmitter copies dataset into HDFS at /fraud/input/creditcard.csv via hdfs dfs -put" />
          <PipelineStep icon="🗺" color="#f97316"
            title="mapper.py — Map Phase"
            detail="Reads CSV rows, emits (class_label, amount, 1) key-value pairs to stdout" />
          <PipelineStep icon="🔀" color="#f97316"
            title="Hadoop Shuffle & Sort"
            detail="Hadoop sorts all mapper output by key before sending to reducers" />
          <PipelineStep icon="➕" color="#f97316"
            title="reducer.py — Reduce Phase"
            detail="Aggregates count + total_amount per class. Emits: class TAB count TAB total TAB avg" />
          <PipelineStep icon="💾" color="#f97316"
            title="HDFS Output → results.txt"
            detail="Output written to /fraud/output/ on HDFS, then hdfs dfs -getmerge copies to local hadoop-output/results.txt"
            last />
        </div>

        {/* PySpark pipeline */}
        <div className="glow-card" style={{ padding: 20 }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 20 }}>
            <div>
              <div style={{ fontSize: 15, fontWeight: 700, color: 'var(--text-primary)' }}>
                PySpark MLlib Pipeline
              </div>
              <div className="overline" style={{ marginTop: 2 }}>// DISTRIBUTED ML</div>
            </div>
            <span style={{
              fontSize: 10, fontWeight: 700, padding: '3px 8px', borderRadius: 5,
              background: 'rgba(8,145,178,0.1)', color: '#0891b2',
              border: '1px solid rgba(8,145,178,0.3)',
              fontFamily: "'JetBrains Mono', monospace",
            }}>
              local[*] MODE
            </span>
          </div>

          <PipelineStep icon="📂" color="#0891b2"
            title="Load from HDFS / Local CSV"
            detail="SparkSession reads creditcard.csv with inferred schema. Falls back to local pandas if Spark unavailable." />
          <PipelineStep icon="🧩" color="#0891b2"
            title="VectorAssembler"
            detail="Combines Time + Amount + V1–V28 into a single dense feature vector column" />
          <PipelineStep icon="⚖️" color="#0891b2"
            title="StandardScaler"
            detail="Zero-means and unit-normalises the assembled feature vector (withMean=True, withStd=True)" />
          <PipelineStep icon="🌲" color="#0891b2"
            title="GBTClassifier"
            detail="Gradient Boosted Trees classifier trained on the scaled features with Class as label" />
          <PipelineStep icon="📊" color="#0891b2"
            title="Batch Aggregation"
            detail="groupBy(Class).agg(count, avg(Amount)) to produce summary statistics for the dashboard"
            last />
        </div>
      </div>

      {/* ── Infrastructure status ── */}
      <div className="glow-card" style={{ padding: 20, marginTop: 20 }}>
        <div style={{ fontSize: 15, fontWeight: 700, color: 'var(--text-primary)', marginBottom: 16 }}>
          Big Data Infrastructure
        </div>
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: 12 }}>
          {[
            { name: 'HDFS NameNode',      port: ':9870', icon: '🐘', url: 'http://localhost:9870',  color: '#f97316' },
            { name: 'YARN ResourceMgr',   port: ':8088', icon: '🧵', url: 'http://localhost:8088',  color: '#f97316' },
            { name: 'MR History Server',  port: ':19888',icon: '📜', url: 'http://localhost:19888', color: '#f97316' },
            { name: 'FastAPI Backend',    port: ':8000', icon: '⚡', url: 'http://localhost:8000/docs', color: '#6366f1' },
          ].map(({ name, port, icon, url, color }) => (
            <a key={name} href={url} target="_blank" rel="noopener noreferrer"
              style={{ textDecoration: 'none' }}>
              <div style={{
                padding: '14px 16px', borderRadius: 10, cursor: 'pointer',
                background: 'var(--bg-elevated)', border: '1px solid var(--border-subtle)',
                transition: 'all 0.15s ease',
                display: 'flex', alignItems: 'center', gap: 10,
              }}
                onMouseEnter={e => { e.currentTarget.style.borderColor = color; e.currentTarget.style.background = `${color}08` }}
                onMouseLeave={e => { e.currentTarget.style.borderColor = ''; e.currentTarget.style.background = 'var(--bg-elevated)' }}
              >
                <span style={{ fontSize: 20 }}>{icon}</span>
                <div>
                  <div style={{ fontSize: 12, fontWeight: 700, color: 'var(--text-primary)' }}>{name}</div>
                  <div className="mono" style={{ fontSize: 10, color, marginTop: 1 }}>{port}</div>
                </div>
                <span style={{ marginLeft: 'auto', fontSize: 10, color: 'var(--text-muted)' }}>↗</span>
              </div>
            </a>
          ))}
        </div>
      </div>

      <style>{`@keyframes spin { to { transform: rotate(360deg) } }`}</style>
    </div>
  )
}
