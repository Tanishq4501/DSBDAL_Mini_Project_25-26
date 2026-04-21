import { useCallback, useEffect, useRef, useState } from 'react'

function getWebSocketUrl() {
  if (typeof window === 'undefined') {
    return 'ws://localhost:8000/ws/stream'
  }

  if (import.meta.env.VITE_WS_BASE_URL) {
    return `${import.meta.env.VITE_WS_BASE_URL.replace(/\/$/, '')}/ws/stream`
  }

  const protocol = window.location.protocol === 'https:' ? 'wss' : 'ws'
  return `${protocol}://${window.location.hostname}:8000/ws/stream`
}

function normalizeTransaction(record, seqRef) {
  if (!record || record.event) {
    return null
  }

  const probability = Number(record.fraud_probability ?? record.probability ?? record.prob ?? 0)
  const amount = Number(record.Amount ?? record.amount ?? 0)
  const sequence = Number(record.sequence ?? record.seq ?? 0)
  const timestamp = record.timestamp ?? record.ts ?? new Date().toISOString()

  if (sequence > 0) {
    seqRef.current = Math.max(seqRef.current, sequence)
  } else {
    seqRef.current += 1
  }

  return {
    id: record.transaction_id ?? record.id ?? `TX-${seqRef.current.toString().padStart(5, '0')}`,
    amount: amount.toFixed(2),
    isFraud: Boolean(record.is_fraud ?? record.isFraud ?? record.prediction),
    prob: Number.isFinite(probability) ? probability : 0,
    ts: new Date(timestamp).toLocaleTimeString('en', { hour12: false }),
    seq: sequence > 0 ? sequence : seqRef.current,
    reviewed: null,   // null | 'confirmed' | 'cleared'
  }
}

// ── localStorage helpers ────────────────────────────────────────────────────
const LS_TX    = 'fraudshield_txList'
const LS_STATS = 'fraudshield_stats'
const LS_RATE  = 'fraudshield_rateHistory'

function lsGet(key, fallback) {
  try {
    const raw = localStorage.getItem(key)
    return raw ? JSON.parse(raw) : fallback
  } catch {
    return fallback
  }
}

function lsSet(key, value) {
  try { localStorage.setItem(key, JSON.stringify(value)) } catch {}
}

// ── Stream component ─────────────────────────────────────────────────────────
export default function Stream() {
  const [streaming, setStreaming] = useState(false)
  const [streamSource, setStreamSource] = useState('idle')

  // Initialise from localStorage so state survives navigation and page refresh
  const [txList, setTxList] = useState(() => lsGet(LS_TX, []))
  const [stats, setStats] = useState(() => lsGet(LS_STATS, { total: 0, fraud: 0, rate: 0 }))
  const [rateHistory, setRateHistory] = useState(() => lsGet(LS_RATE, []))

  // Toast notification queue — each entry auto-expires after 7 s
  const [toasts, setToasts] = useState([])

  const intervalRef = useRef(null)
  const wsRef = useRef(null)
  const fallbackTimerRef = useRef(null)
  const chartRef = useRef(null)
  const streamingRef = useRef(false)
  const seqRef = useRef(0)

  useEffect(() => {
    streamingRef.current = streaming
  }, [streaming])

  // Persist stream state to localStorage whenever it changes
  useEffect(() => { lsSet(LS_TX,    txList)      }, [txList])
  useEffect(() => { lsSet(LS_STATS, stats)        }, [stats])
  useEffect(() => { lsSet(LS_RATE,  rateHistory)  }, [rateHistory])

  const clearLocalInterval = useCallback(() => {
    clearInterval(intervalRef.current)
    intervalRef.current = null
  }, [])

  const clearFallbackTimer = useCallback(() => {
    clearTimeout(fallbackTimerRef.current)
    fallbackTimerRef.current = null
  }, [])

  const generateTx = useCallback(() => {
    // 8 % fraud rate — matches the Docker generator so the fallback looks realistic
    const isFraud = Math.random() < 0.08
    const prob = isFraud ? 0.65 + Math.random() * 0.34 : Math.random() * 0.09
    seqRef.current += 1

    return {
      id: `TX-${seqRef.current.toString().padStart(5, '0')}`,
      amount: (Math.random() * 480 + 0.5).toFixed(2),
      isFraud,
      prob,
      ts: new Date().toLocaleTimeString('en', { hour12: false }),
      seq: seqRef.current,
      reviewed: null,   // null | 'confirmed' | 'cleared'
    }
  }, [])

  const ingestBatch = useCallback((batch) => {
    setTxList((prev) => [...batch, ...prev].slice(0, 50))
    setStats((prev) => {
      const newTotal = prev.total + batch.length
      const newFraud = prev.fraud + batch.filter((t) => t.isFraud).length
      const rate = newTotal > 0 ? (newFraud / newTotal) * 100 : 0
      setRateHistory((history) => [...history, rate].slice(-60))
      return { total: newTotal, fraud: newFraud, rate }
    })

    // Push fraud hits into alerts store + toast queue
    const fraudHits = batch.filter((t) => t.isFraud)
    if (fraudHits.length > 0) {
      // 1️⃣ Persist to localStorage so Dashboard can read them
      try {
        const existing = JSON.parse(localStorage.getItem('fraudshield_alerts') || '[]')
        const newAlerts = fraudHits.map((t) => ({
          tx_id: t.id,
          amount: parseFloat(t.amount),
          probability: t.prob,
          risk: t.prob >= 0.9 ? 'critical' : 'high',
          ts: new Date().toISOString(),
        }))
        const merged = [...newAlerts, ...existing].slice(0, 50)
        localStorage.setItem('fraudshield_alerts', JSON.stringify(merged))
      } catch {}

      // 2️⃣ Push toast notifications — keep max 4 visible at once
      const newToasts = fraudHits.map((t) => ({
        id: `${Date.now()}-${Math.random()}`,
        tx_id: t.id,
        amount: t.amount,
        prob: t.prob,
        isCrit: t.prob >= 0.9,
      }))
      setToasts((prev) => [...newToasts, ...prev].slice(0, 4))

      // 3️⃣ Auto-dismiss each toast after 7 s
      newToasts.forEach((toast) => {
        setTimeout(() => {
          setToasts((prev) => prev.filter((t) => t.id !== toast.id))
        }, 7000)
      })
    }
  }, [])

  // Continuous local fallback: 1 transaction every 800 ms
  const startLocalInterval = useCallback(() => {
    clearLocalInterval()
    setStreamSource('local')
    intervalRef.current = setInterval(() => {
      ingestBatch([generateTx()])
    }, 800)
  }, [clearLocalInterval, generateTx, ingestBatch])

  const stopStream = useCallback(() => {
    streamingRef.current = false
    setStreaming(false)
    setStreamSource('idle')
    clearLocalInterval()
    clearFallbackTimer()
    if (wsRef.current) {
      wsRef.current.close()
      wsRef.current = null
    }
  }, [clearFallbackTimer, clearLocalInterval])

  const clearHistory = useCallback(() => {
    setTxList([])
    setStats({ total: 0, fraud: 0, rate: 0 })
    setRateHistory([])
    lsSet(LS_TX,    [])
    lsSet(LS_STATS, { total: 0, fraud: 0, rate: 0 })
    lsSet(LS_RATE,  [])
    seqRef.current = 0
  }, [])

  // decision: 'confirmed' (flagged as fraud) | 'cleared' (marked safe)
  const handleReview = useCallback((txId, decision) => {
    setTxList((prev) =>
      prev.map((tx) => tx.id === txId ? { ...tx, reviewed: decision } : tx)
    )
  }, [])

  const startStream = useCallback(() => {
    streamingRef.current = true
    clearLocalInterval()
    clearFallbackTimer()
    if (wsRef.current) {
      wsRef.current.close()
      wsRef.current = null
    }

    setStreaming(true)
    setStreamSource('connecting')

    try {
      let wsOpened = false
      const ws = new WebSocket(getWebSocketUrl())
      wsRef.current = ws

      ws.onopen = () => {
        wsOpened = true
        setStreamSource('kafka')
        clearLocalInterval()
        clearFallbackTimer()
      }

      ws.onmessage = (event) => {
        try {
          const payload = JSON.parse(event.data)
          // Ignore server-sent control events (error pings, etc.)
          if (payload.event) return

          const batch = (Array.isArray(payload) ? payload : [payload])
            .map((record) => normalizeTransaction(record, seqRef))
            .filter(Boolean)

          if (batch.length > 0) {
            setStreamSource('kafka')
            clearLocalInterval()
            clearFallbackTimer()
            ingestBatch(batch)
          }
        } catch (_) {
          // Ignore malformed frames and keep the stream alive.
        }
      }

      ws.onerror = () => {}
      ws.onclose = () => {
        wsRef.current = null
        if (!wsOpened && streamingRef.current) {
          startLocalInterval()
        }
      }
    } catch (_) {
      startLocalInterval()
      return
    }

    fallbackTimerRef.current = setTimeout(() => {
      if (streamingRef.current && wsRef.current?.readyState !== WebSocket.OPEN) {
        startLocalInterval()
      }
    }, 1500)
  }, [clearFallbackTimer, clearLocalInterval, ingestBatch, startLocalInterval, stopStream])

  useEffect(() => {
    if (streaming && streamSource === 'local') {
      startLocalInterval()
    }
    return () => clearLocalInterval()
  }, [clearLocalInterval, startLocalInterval, streamSource, streaming])

  useEffect(() => {
    return () => {
      clearLocalInterval()
      clearFallbackTimer()
      if (wsRef.current) {
        wsRef.current.close()
      }
    }
  }, [clearFallbackTimer, clearLocalInterval])

  useEffect(() => {
    const canvas = chartRef.current
    if (!canvas) return

    const ctx = canvas.getContext('2d')
    const dpr = window.devicePixelRatio || 1
    const rect = canvas.getBoundingClientRect()
    if (rect.width === 0 || rect.height === 0) return

    canvas.width = rect.width * dpr
    canvas.height = rect.height * dpr
    ctx.scale(dpr, dpr)

    const width = rect.width
    const height = rect.height
    const padL = 34
    const padR = 10
    const padT = 10
    const padB = 18
    const chartWidth = width - padL - padR
    const chartHeight = height - padT - padB
    const maxRate = Math.max(5, ...rateHistory, 0.5)

    const toX = (index) => padL + (index / 59) * chartWidth
    const toY = (value) => padT + chartHeight - (value / maxRate) * chartHeight

    ctx.clearRect(0, 0, width, height)
    ctx.strokeStyle = 'rgba(15, 23, 42, 0.08)'
    ctx.lineWidth = 1

    ;[0, 1, 2, 5].filter((value) => value <= maxRate).forEach((value) => {
      const y = toY(value)
      ctx.beginPath()
      ctx.moveTo(padL, y)
      ctx.lineTo(padL + chartWidth, y)
      ctx.stroke()
    })

    const expectedY = toY(0.17)
    ctx.strokeStyle = '#6366f1'
    ctx.setLineDash([4, 4])
    ctx.beginPath()
    ctx.moveTo(padL, expectedY)
    ctx.lineTo(padL + chartWidth, expectedY)
    ctx.stroke()
    ctx.setLineDash([])

    if (rateHistory.length >= 2) {
      ctx.beginPath()
      rateHistory.forEach((value, index) => {
        const x = toX(index)
        const y = toY(value)
        if (index === 0) {
          ctx.moveTo(x, y)
          return
        }

        const prevX = toX(index - 1)
        const prevY = toY(rateHistory[index - 1])
        const cpX = (prevX + x) / 2
        ctx.bezierCurveTo(cpX, prevY, cpX, y, x, y)
      })
      ctx.strokeStyle = '#0f766e'
      ctx.lineWidth = 2
      ctx.stroke()
    }
  }, [rateHistory])

  const probColor = (probability) => {
    if (probability < 0.3) return '#059669'
    if (probability < 0.6) return '#d97706'
    return '#e11d48'
  }

  const streamLabel =
    streamSource === 'kafka'
      ? 'Kafka live'
      : streamSource === 'local'
        ? 'Local fallback'
        : streamSource === 'connecting'
          ? 'Connecting'
          : 'Stopped'

  // Count transactions that are in REVIEW and haven't been actioned yet
  const pendingReviews = txList.filter(
    (tx) => !tx.isFraud && tx.prob > 0.3 && tx.reviewed === null
  ).length

  return (
    <div style={{ padding: '32px 32px 48px', background: 'var(--bg-base)', minHeight: '100vh' }}>

      {/* ── Toast notification stack ── fixed top-right, z above everything ── */}
      <div style={{
        position: 'fixed', top: 80, right: 24, zIndex: 9999,
        display: 'flex', flexDirection: 'column', gap: 10,
        pointerEvents: 'none',
      }}>
        {toasts.map((t) => (
          <div
            key={t.id}
            style={{
              pointerEvents: 'auto',
              width: 320,
              background: t.isCrit ? '#7f1d1d' : '#1a0a0a',
              border: `1.5px solid ${t.isCrit ? '#fca5a5' : '#f87171'}`,
              borderRadius: 10,
              padding: '14px 16px',
              boxShadow: '0 8px 32px rgba(225,29,72,0.35)',
              animation: 'slideInRight 0.25s ease',
              display: 'flex',
              gap: 12,
              alignItems: 'flex-start',
            }}
          >
            {/* icon */}
            <div style={{
              width: 34, height: 34, borderRadius: 8, flexShrink: 0,
              background: 'rgba(225,29,72,0.25)',
              display: 'flex', alignItems: 'center', justifyContent: 'center',
              fontSize: 16,
            }}>🚨</div>
            <div style={{ flex: 1 }}>
              <div style={{ fontSize: 12, fontWeight: 800, color: '#fca5a5', letterSpacing: '0.05em', marginBottom: 2 }}>
                {t.isCrit ? 'CRITICAL FRAUD DETECTED' : 'FRAUD DETECTED'}
              </div>
              <div className="mono" style={{ fontSize: 13, color: '#fff', fontWeight: 700, marginBottom: 4 }}>
                {t.tx_id}
              </div>
              <div style={{ display: 'flex', gap: 12, fontSize: 12 }}>
                <span style={{ color: '#fcd34d' }}>${Number(t.amount).toFixed(2)}</span>
                <span style={{ color: '#f87171' }}>{(t.prob * 100).toFixed(1)}% confidence</span>
              </div>
            </div>
            <button
              onClick={() => setToasts((prev) => prev.filter((x) => x.id !== t.id))}
              style={{
                background: 'none', border: 'none', color: '#fca5a5',
                cursor: 'pointer', fontSize: 16, lineHeight: 1, padding: '2px 4px',
                flexShrink: 0,
              }}
            >×</button>
          </div>
        ))}
      </div>

      <style>{`
        @keyframes slideInRight {
          from { opacity: 0; transform: translateX(60px); }
          to   { opacity: 1; transform: translateX(0); }
        }
      `}</style>

      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: 24 }}>
        <div>
          <div className="overline" style={{ marginBottom: 6 }}>// KAFKA + WEBSOCKET</div>
          <h1 style={{ fontSize: 28, fontWeight: 800, color: 'var(--text-primary)', letterSpacing: '-0.03em', margin: 0, lineHeight: 1.2 }}>
            Live Transaction Stream
          </h1>
        </div>
        <div style={{ display: 'flex', alignItems: 'center', gap: 10, paddingTop: 4 }}>
          <div
            style={{
              width: 8,
              height: 8,
              borderRadius: '50%',
              background: streaming ? '#059669' : '#94a3b8',
            }}
          />
          <span className={streaming ? 'badge badge-success' : 'badge'} style={!streaming ? { background: 'var(--bg-elevated)', color: 'var(--text-muted)', border: '1px solid var(--border-subtle)' } : undefined}>
            {streamLabel}
          </span>
        </div>
      </div>

      <div
        className="glow-card"
        style={{
          padding: '16px 20px',
          display: 'flex',
          alignItems: 'center',
          gap: 20,
          marginBottom: 20,
          flexWrap: 'wrap',
        }}
      >
        {/* Start / Stop — the only stream control */}
        <button
          onClick={streaming ? stopStream : startStream}
          className={streaming ? 'btn-ghost' : 'btn-primary'}
          style={{
            flexShrink: 0,
            display: 'flex',
            alignItems: 'center',
            gap: 7,
            minWidth: 130,
            justifyContent: 'center',
          }}
        >
          {streaming ? (
            <>
              <svg width="12" height="12" viewBox="0 0 24 24" fill="currentColor">
                <rect x="6" y="4" width="4" height="16" rx="1" />
                <rect x="14" y="4" width="4" height="16" rx="1" />
              </svg>
              Stop Stream
            </>
          ) : (
            <>
              <svg width="12" height="12" viewBox="0 0 24 24" fill="currentColor">
                <polygon points="5 3 19 12 5 21 5 3" />
              </svg>
              Start Stream
            </>
          )}
        </button>

        {/* Continuous indicator — visible while running */}
        {streaming && (
          <div style={{ display: 'flex', alignItems: 'center', gap: 6, fontSize: 12, color: 'var(--text-muted)' }}>
            <span
              className="pulse-dot"
              style={{ width: 7, height: 7, borderRadius: '50%', background: 'var(--success)', display: 'inline-block' }}
            />
            <span>Streaming continuously</span>
          </div>
        )}

        {/* Clear history — only when stopped */}
        {!streaming && (
          <button
            onClick={clearHistory}
            className="btn-ghost"
            title="Clear all persisted transaction history"
            style={{ flexShrink: 0, fontSize: 12, display: 'flex', alignItems: 'center', gap: 5 }}
          >
            <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
              <polyline points="3 6 5 6 21 6" />
              <path d="M19 6l-1 14H6L5 6" />
              <path d="M10 11v6M14 11v6" />
              <path d="M9 6V4h6v2" />
            </svg>
            Clear History
          </button>
        )}

        <div style={{ display: 'flex', gap: 16, marginLeft: 'auto', flexWrap: 'wrap' }}>
          <StatChip label="PROCESSED" value={stats.total} color="var(--accent-primary)" />
          <StatChip label="FRAUD" value={stats.fraud} color="var(--danger)" />
          <StatChip label="REVIEW" value={pendingReviews} color={pendingReviews > 0 ? 'var(--warning)' : 'var(--text-muted)'} />
          <StatChip label="RATE" value={`${stats.rate.toFixed(2)}%`} color={stats.rate > 1 ? 'var(--warning)' : 'var(--success)'} />
          <StatChip label="SOURCE" value={streamLabel.toUpperCase()} color={streamSource === 'local' ? 'var(--warning)' : 'var(--accent-primary)'} />
        </div>
      </div>

      {/* ── Inline fraud alert ticker (only visible when fraud has hit) ── */}
      {txList.some((t) => t.isFraud) && (
        <div style={{
          marginBottom: 16,
          padding: '10px 16px',
          background: 'rgba(225,29,72,0.07)',
          border: '1px solid rgba(225,29,72,0.25)',
          borderLeft: '4px solid #e11d48',
          borderRadius: 8,
          display: 'flex',
          alignItems: 'center',
          gap: 14,
          flexWrap: 'wrap',
        }}>
          <span style={{ fontSize: 16 }}>🚨</span>
          <div>
            <span style={{ fontSize: 13, fontWeight: 700, color: '#e11d48' }}>
              {txList.filter((t) => t.isFraud).length} fraud transaction{txList.filter((t) => t.isFraud).length !== 1 ? 's' : ''} detected
            </span>
            <span style={{ fontSize: 12, color: 'var(--text-muted)', marginLeft: 10 }}>
              in current session · check table below
            </span>
          </div>
          {/* Most recent fraud tx */}
          {(() => {
            const last = txList.find((t) => t.isFraud)
            if (!last) return null
            return (
              <div style={{ marginLeft: 'auto', display: 'flex', alignItems: 'center', gap: 10 }}>
                <span style={{ fontSize: 12, color: 'var(--text-muted)' }}>Latest:</span>
                <span className="mono" style={{ fontSize: 12, fontWeight: 700, color: '#e11d48' }}>{last.id}</span>
                <span className="mono" style={{ fontSize: 12, color: 'var(--text-secondary)' }}>${last.amount}</span>
                <span
                  className="badge badge-danger"
                  style={{ fontSize: 11 }}
                >
                  {(last.prob * 100).toFixed(1)}%
                </span>
              </div>
            )
          })()}
        </div>
      )}

      <div style={{ display: 'grid', gridTemplateColumns: '65fr 35fr', gap: 20 }}>
        <div className="glow-card" style={{ padding: 0, overflow: 'hidden' }}>
          <div
            style={{
              padding: '16px 20px',
              borderBottom: '1px solid var(--border-subtle)',
              display: 'flex',
              justifyContent: 'space-between',
              alignItems: 'center',
            }}
          >
            <div style={{ fontSize: 15, fontWeight: 700, color: 'var(--text-primary)' }}>Transaction Feed</div>
            <div className="overline">Last 50 transactions</div>
          </div>

          {txList.length === 0 && !streaming ? (
            <div
              style={{
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                height: 320,
                color: 'var(--text-muted)',
                fontSize: 14,
                flexDirection: 'column',
                gap: 10,
              }}
            >
              <img src="/fraud-alert.png" alt="" style={{ width: 48, height: 48, opacity: 0.35 }} />
              <span style={{ fontWeight: 600, color: 'var(--text-secondary)' }}>No transactions yet</span>
              <span style={{ fontSize: 12 }}>Press <strong>Start Stream</strong> to begin monitoring.</span>
              <span style={{ fontSize: 11, opacity: 0.7 }}>Transactions persist across navigation — use <strong>Clear</strong> to reset.</span>
            </div>
          ) : (
            <div style={{ maxHeight: 460, overflowY: 'auto' }}>
              <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 13 }}>
                <thead>
                  <tr style={{ background: 'var(--bg-elevated)' }}>
                    {['#', 'TX ID', 'Amount', 'Fraud Prob', 'Status', 'Time', 'Action'].map((heading) => (
                      <th
                        key={heading}
                        style={{
                          padding: '8px 12px',
                          textAlign: 'left',
                          fontSize: 11,
                          color: 'var(--text-muted)',
                          fontWeight: 600,
                          textTransform: 'uppercase',
                          letterSpacing: '0.06em',
                          fontFamily: "'JetBrains Mono', monospace",
                          borderBottom: '1px solid var(--border-subtle)',
                          position: 'sticky',
                          top: 0,
                          background: 'var(--bg-elevated)',
                        }}
                      >
                        {heading}
                      </th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {txList.map((tx) => (
                    <tr
                      key={tx.id}
                      style={{
                        background:
                          tx.reviewed === 'confirmed' ? 'rgba(225,29,72,0.05)' :
                          tx.reviewed === 'cleared'   ? 'rgba(5,150,105,0.04)' :
                          tx.isFraud                  ? 'rgba(225,29,72,0.04)' :
                          tx.prob > 0.3               ? 'rgba(217,119,6,0.03)' :
                          'transparent',
                        borderLeft:
                          tx.reviewed === 'confirmed' ? '3px solid #e11d48' :
                          tx.reviewed === 'cleared'   ? '3px solid #059669' :
                          tx.isFraud                  ? '3px solid #e11d48' :
                          tx.prob > 0.3               ? '3px solid #d97706' :
                          '3px solid transparent',
                        borderBottom: '1px solid var(--border-subtle)',
                      }}
                    >
                      <td className="mono" style={{ padding: '8px 12px', fontSize: 11, color: 'var(--text-muted)' }}>
                        {tx.seq}
                      </td>
                      <td className="mono" style={{ padding: '8px 12px', fontSize: 12 }}>
                        {tx.id}
                      </td>
                      <td className="mono" style={{ padding: '8px 12px', fontSize: 13 }}>
                        {tx.amount}
                      </td>
                      <td style={{ padding: '8px 12px' }}>
                        <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                          <div style={{ width: 80, height: 6, borderRadius: 99, background: 'var(--bg-elevated)', overflow: 'hidden', flexShrink: 0 }}>
                            <div
                              style={{
                                width: `${Math.min(100, tx.prob * 100)}%`,
                                height: '100%',
                                background: probColor(tx.prob),
                                borderRadius: 99,
                              }}
                            />
                          </div>
                          <span className="mono" style={{ fontSize: 11, color: 'var(--text-muted)', minWidth: 34 }}>
                            {(tx.prob * 100).toFixed(1)}%
                          </span>
                        </div>
                      </td>
                      {/* Status badge */}
                      <td style={{ padding: '8px 12px' }}>
                        {tx.reviewed === 'confirmed' ? (
                          <span className="badge badge-danger" title="Manually confirmed as fraud">⚑ CONFIRMED</span>
                        ) : tx.reviewed === 'cleared' ? (
                          <span className="badge badge-success" title="Manually cleared as safe">✓ CLEARED</span>
                        ) : tx.isFraud ? (
                          <span className="badge badge-danger">FRAUD</span>
                        ) : tx.prob > 0.3 ? (
                          <span className="badge badge-warning">REVIEW</span>
                        ) : (
                          <span className="badge badge-success">SAFE</span>
                        )}
                      </td>

                      {/* Time */}
                      <td className="mono" style={{ padding: '8px 12px', fontSize: 12, color: 'var(--text-muted)' }}>
                        {tx.ts}
                      </td>

                      {/* Action — only shown for unreviewed REVIEW transactions */}
                      <td style={{ padding: '6px 12px' }}>
                        {!tx.isFraud && tx.prob > 0.3 && tx.reviewed === null ? (
                          <div style={{ display: 'flex', gap: 4 }}>
                            <button
                              onClick={() => handleReview(tx.id, 'confirmed')}
                              title="Confirm as fraud"
                              style={{
                                padding: '3px 8px',
                                fontSize: 10,
                                fontWeight: 700,
                                borderRadius: 5,
                                border: '1px solid rgba(225,29,72,0.35)',
                                background: 'rgba(225,29,72,0.07)',
                                color: '#e11d48',
                                cursor: 'pointer',
                                letterSpacing: '0.04em',
                                whiteSpace: 'nowrap',
                              }}
                            >
                              ⚑ Fraud
                            </button>
                            <button
                              onClick={() => handleReview(tx.id, 'cleared')}
                              title="Mark as safe"
                              style={{
                                padding: '3px 8px',
                                fontSize: 10,
                                fontWeight: 700,
                                borderRadius: 5,
                                border: '1px solid rgba(5,150,105,0.35)',
                                background: 'rgba(5,150,105,0.07)',
                                color: '#059669',
                                cursor: 'pointer',
                                letterSpacing: '0.04em',
                                whiteSpace: 'nowrap',
                              }}
                            >
                              ✓ Safe
                            </button>
                          </div>
                        ) : (
                          <span style={{ fontSize: 11, color: 'var(--text-muted)', opacity: 0.4 }}>—</span>
                        )}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>

        <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
          <div className="glow-card" style={{ padding: 20 }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 12 }}>
              <div style={{ fontSize: 14, fontWeight: 700, color: 'var(--text-primary)' }}>Fraud Rate Over Time</div>
              <div className="overline">// LIVE</div>
            </div>
            <canvas ref={chartRef} style={{ width: '100%', height: 120, display: 'block' }} />
            <div style={{ display: 'flex', justifyContent: 'space-between', marginTop: 10 }}>
              <div style={{ fontSize: 12, color: 'var(--text-muted)' }}>
                Current:{' '}
                <span className="mono" style={{ color: stats.rate > 1 ? 'var(--warning)' : 'var(--success)', fontWeight: 600 }}>
                  {stats.rate.toFixed(2)}%
                </span>
              </div>
              <div style={{ fontSize: 12, color: 'var(--text-muted)' }}>
                Expected:{' '}
                <span className="mono" style={{ color: 'var(--accent-primary)', fontWeight: 600 }}>0.17%</span>
              </div>
            </div>
          </div>

          <div className="glow-card" style={{ padding: 20 }}>
            <div style={{ fontSize: 14, fontWeight: 700, color: 'var(--text-primary)', marginBottom: 14 }}>Session Stats</div>
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12 }}>
              <SummaryTile label="Total Processed" value={stats.total} color="var(--accent-primary)" />
              <SummaryTile label="Fraud Detected" value={stats.fraud} color="var(--danger)" />
              <SummaryTile label="Pending Review" value={pendingReviews} color={pendingReviews > 0 ? 'var(--warning)' : 'var(--text-muted)'} />
              <SummaryTile label="Current Rate" value={`${stats.rate.toFixed(2)}%`} color={stats.rate > 1 ? 'var(--warning)' : 'var(--success)'} />
              <SummaryTile
                label="Confirmed Fraud"
                value={txList.filter(t => t.reviewed === 'confirmed').length}
                color="var(--danger)"
              />
              <SummaryTile
                label="Cleared Safe"
                value={txList.filter(t => t.reviewed === 'cleared').length}
                color="var(--success)"
              />
            </div>
          </div>

          <div className="glow-card" style={{ padding: 20 }}>
            <div style={{ marginBottom: 10 }}>
              <div style={{ fontSize: 14, fontWeight: 700, color: 'var(--text-primary)' }}>Kafka Architecture</div>
              <div className="overline" style={{ marginTop: 2 }}>// LIVE PIPELINE</div>
            </div>

            <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: 6, flexWrap: 'wrap' }}>
                <PillBox>Generator</PillBox>
                <Arrow />
                <PillBox highlight>
                  fraud-transactions
                  <br />
                  <span style={{ fontSize: 9, opacity: 0.7 }}>(Kafka topic)</span>
                </PillBox>
                <Arrow />
                <PillBox>FastAPI WebSocket</PillBox>
              </div>
              <div style={{ display: 'flex', justifyContent: 'flex-end' }}>
                <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 4 }}>
                  <div style={{ fontSize: 10, color: 'var(--text-muted)', fontFamily: "'JetBrains Mono', monospace" }}>v</div>
                  <PillBox>ML Scoring</PillBox>
                  <div style={{ fontSize: 10, color: 'var(--text-muted)', fontFamily: "'JetBrains Mono', monospace" }}>v</div>
                  <PillBox danger>Fraud Alerts</PillBox>
                </div>
              </div>
            </div>

            <p style={{ margin: '12px 0 0', fontSize: 11, color: 'var(--text-muted)', lineHeight: 1.6 }}>
              The page connects to the backend WebSocket first. If the backend or Kafka broker is unavailable,
              it falls back to a local generator so the dashboard remains usable.
            </p>
          </div>
        </div>
      </div>
    </div>
  )
}

function StatChip({ label, value, color }) {
  return (
    <div
      style={{
        padding: '6px 14px',
        background: 'var(--bg-elevated)',
        borderRadius: 8,
        border: '1px solid var(--border-subtle)',
        textAlign: 'center',
      }}
    >
      <div
        style={{
          fontSize: 10,
          color: 'var(--text-muted)',
          textTransform: 'uppercase',
          letterSpacing: '0.07em',
          marginBottom: 2,
          fontFamily: "'JetBrains Mono', monospace",
        }}
      >
        {label}
      </div>
      <div className="mono" style={{ fontSize: 18, fontWeight: 700, color, lineHeight: 1 }}>
        {value}
      </div>
    </div>
  )
}

function SummaryTile({ label, value, color }) {
  return (
    <div
      style={{
        padding: '12px',
        background: 'var(--bg-elevated)',
        borderRadius: 8,
        border: '1px solid var(--border-subtle)',
      }}
    >
      <div style={{ fontSize: 11, color: 'var(--text-muted)', marginBottom: 4 }}>{label}</div>
      <div className="mono" style={{ fontSize: 22, fontWeight: 700, color, lineHeight: 1 }}>
        {value}
      </div>
    </div>
  )
}

function PillBox({ children, highlight, danger }) {
  return (
    <div
      style={{
        padding: '4px 10px',
        background: danger ? 'rgba(225,29,72,0.08)' : highlight ? 'rgba(99,102,241,0.08)' : 'var(--bg-elevated)',
        border: `1px solid ${danger ? 'rgba(225,29,72,0.3)' : highlight ? 'rgba(99,102,241,0.25)' : 'var(--border-subtle)'}`,
        borderRadius: 6,
        fontSize: 11,
        color: danger ? '#e11d48' : highlight ? 'var(--accent-primary)' : 'var(--text-secondary)',
        fontFamily: "'JetBrains Mono', monospace",
        lineHeight: 1.4,
        textAlign: 'center',
        whiteSpace: 'pre-wrap',
      }}
    >
      {children}
    </div>
  )
}

function Arrow() {
  return (
    <span style={{ fontSize: 13, color: 'var(--text-muted)', fontFamily: "'JetBrains Mono', monospace" }}>
      -&gt;
    </span>
  )
}
