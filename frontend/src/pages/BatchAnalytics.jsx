import { useEffect, useMemo, useState } from 'react'
import { getBatchAnalytics } from '../api/api'

const currencyFmt = new Intl.NumberFormat('en-US', {
  style: 'currency',
  currency: 'EUR',
  maximumFractionDigits: 2,
})

const numberFmt = new Intl.NumberFormat('en-US')

function RowBar({ value, max, color }) {
  const width = max > 0 ? Math.max((value / max) * 100, 1.5) : 0
  return (
    <div style={{ width: '100%', height: 10, borderRadius: 99, background: 'var(--bg-elevated)', overflow: 'hidden' }}>
      <div
        style={{
          width: `${width}%`,
          height: '100%',
          borderRadius: 99,
          background: color,
          transition: 'width 0.45s ease',
        }}
      />
    </div>
  )
}

export default function BatchAnalytics() {
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')
  const [payload, setPayload] = useState(null)

  useEffect(() => {
    let mounted = true

    async function load() {
      setLoading(true)
      setError('')
      try {
        const { data } = await getBatchAnalytics()
        if (mounted) setPayload(data)
      } catch (err) {
        if (mounted) {
          setError(err?.message || 'Failed to load batch analytics.')
        }
      } finally {
        if (mounted) setLoading(false)
      }
    }

    load()
    return () => {
      mounted = false
    }
  }, [])

  const rows = payload?.rows || []
  const summary = payload?.summary || {
    total_transactions: 0,
    fraud_transactions: 0,
    legitimate_transactions: 0,
    fraud_rate_pct: 0,
    total_amount: 0,
  }

  const maxCount = useMemo(
    () => rows.reduce((max, row) => Math.max(max, row.count || 0), 0),
    [rows]
  )

  const sourceBadge = payload?.source === 'hadoop_output' ? 'Hadoop Output' : 'Demo Data'

  return (
    <div style={{ padding: '32px 40px', maxWidth: 1200, margin: '0 auto' }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', gap: 16, marginBottom: 24 }}>
        <div>
          <div className="overline">// PHASE 5 — BATCH ANALYTICS</div>
          <h1 style={{ margin: '6px 0 8px', fontSize: 30, fontWeight: 800, color: '#0f172a' }}>Hadoop and Spark Summary</h1>
          <p style={{ margin: 0, fontSize: 14, color: '#475569' }}>
            Historical aggregation from Hadoop reducer output for large-scale trend analysis.
          </p>
        </div>
        <span className="badge badge-indigo" style={{ fontSize: 11 }}>{sourceBadge}</span>
      </div>

      {loading && (
        <div className="glow-card" style={{ padding: 24, color: 'var(--text-secondary)' }}>
          Loading batch analytics...
        </div>
      )}

      {!loading && error && (
        <div className="glow-card" style={{ padding: 24, borderLeft: '3px solid #e11d48' }}>
          <div className="overline" style={{ color: '#e11d48', marginBottom: 6 }}>LOAD ERROR</div>
          <div style={{ color: 'var(--text-secondary)', fontSize: 14 }}>{error}</div>
        </div>
      )}

      {!loading && !error && (
        <>
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: 16, marginBottom: 20 }}>
            <div className="glow-card bracket" style={{ padding: 18, borderLeft: '3px solid #0891b2' }}>
              <div className="overline" style={{ marginBottom: 6 }}>TOTAL TX</div>
              <div style={{ fontSize: 28, fontWeight: 800, color: '#0f172a' }}>{numberFmt.format(summary.total_transactions)}</div>
            </div>
            <div className="glow-card bracket" style={{ padding: 18, borderLeft: '3px solid #e11d48' }}>
              <div className="overline" style={{ marginBottom: 6 }}>FRAUD TX</div>
              <div style={{ fontSize: 28, fontWeight: 800, color: '#e11d48' }}>{numberFmt.format(summary.fraud_transactions)}</div>
            </div>
            <div className="glow-card bracket" style={{ padding: 18, borderLeft: '3px solid #059669' }}>
              <div className="overline" style={{ marginBottom: 6 }}>FRAUD RATE</div>
              <div style={{ fontSize: 28, fontWeight: 800, color: '#059669' }}>{summary.fraud_rate_pct.toFixed(4)}%</div>
            </div>
            <div className="glow-card bracket" style={{ padding: 18, borderLeft: '3px solid #6366f1' }}>
              <div className="overline" style={{ marginBottom: 6 }}>TOTAL AMOUNT</div>
              <div style={{ fontSize: 24, fontWeight: 800, color: '#0f172a' }}>{currencyFmt.format(summary.total_amount)}</div>
            </div>
          </div>

          <div className="glow-card" style={{ padding: 20, marginBottom: 16 }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 14 }}>
              <div style={{ fontSize: 16, fontWeight: 700, color: 'var(--text-primary)' }}>Reducer Output Breakdown</div>
              <div className="overline">// class count total_amount avg_amount</div>
            </div>

            <div style={{ display: 'grid', gridTemplateColumns: '120px 120px 1fr 160px 160px', gap: 12, padding: '0 0 8px', borderBottom: '1px solid var(--border-subtle)' }}>
              <div className="overline">Class</div>
              <div className="overline">Count</div>
              <div className="overline">Share</div>
              <div className="overline">Total Amount</div>
              <div className="overline">Avg Amount</div>
            </div>

            <div style={{ display: 'flex', flexDirection: 'column', gap: 10, marginTop: 10 }}>
              {rows.map((row) => {
                const share = summary.total_transactions > 0
                  ? ((row.count / summary.total_transactions) * 100).toFixed(3)
                  : '0.000'
                const color = row.class === 1 ? '#e11d48' : '#0891b2'
                return (
                  <div key={row.class} style={{ display: 'grid', gridTemplateColumns: '120px 120px 1fr 160px 160px', gap: 12, alignItems: 'center' }}>
                    <div>
                      <span className="badge" style={{
                        background: row.class === 1 ? 'rgba(225,29,72,0.14)' : 'rgba(8,145,178,0.14)',
                        color,
                        border: `1px solid ${row.class === 1 ? 'rgba(225,29,72,0.28)' : 'rgba(8,145,178,0.28)'}`,
                      }}>
                        {row.label}
                      </span>
                    </div>
                    <div className="mono" style={{ fontSize: 13, color: 'var(--text-secondary)' }}>{numberFmt.format(row.count)}</div>
                    <div>
                      <RowBar value={row.count} max={maxCount} color={color} />
                      <div className="mono" style={{ marginTop: 4, fontSize: 11, color: 'var(--text-muted)' }}>{share}%</div>
                    </div>
                    <div className="mono" style={{ fontSize: 13, color: 'var(--text-secondary)' }}>{currencyFmt.format(row.total_amount)}</div>
                    <div className="mono" style={{ fontSize: 13, color: 'var(--text-secondary)' }}>{currencyFmt.format(row.avg_amount)}</div>
                  </div>
                )
              })}
            </div>
          </div>

          <div className="glow-card" style={{ padding: 18, borderLeft: '3px solid #6366f1' }}>
            <div className="overline" style={{ marginBottom: 6 }}>PIPELINE NOTE</div>
            <div style={{ fontSize: 13, color: 'var(--text-secondary)', lineHeight: 1.6 }}>
              This page is batch-focused. Kafka stream insights are available in Live Stream, while this view shows offline
              Hadoop-style aggregate metrics from reducer output.
            </div>
            {payload?.hadoop_output_path && (
              <div className="mono" style={{ marginTop: 8, fontSize: 11, color: 'var(--text-muted)' }}>
                Source file: {payload.hadoop_output_path}
              </div>
            )}
            {payload?.note && (
              <div style={{ marginTop: 8, fontSize: 12, color: '#d97706' }}>
                {payload.note}
              </div>
            )}
          </div>
        </>
      )}
    </div>
  )
}
