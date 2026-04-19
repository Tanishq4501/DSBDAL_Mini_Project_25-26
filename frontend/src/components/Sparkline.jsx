import { useRef, useEffect } from 'react'

/**
 * Sparkline — canvas sparkline, white-theme compatible
 *
 * Props:
 *   data   {number[]} — array of numeric values (min 2 points)
 *   color  {string}   — hex color string, e.g. '#6366f1'
 *   width  {number}   — logical width in px  (default 120)
 *   height {number}   — logical height in px (default 40)
 *   filled {boolean}  — draw gradient area fill (default true)
 */
export default function Sparkline({
  data = [],
  color = '#6366f1',
  width = 120,
  height = 40,
  filled = true,
}) {
  const canvasRef = useRef(null)

  useEffect(() => {
    const canvas = canvasRef.current
    if (!canvas || !data || data.length < 2) return

    const ctx = canvas.getContext('2d')
    const dpr = window.devicePixelRatio || 1

    // Hi-DPI backing store
    canvas.width  = width  * dpr
    canvas.height = height * dpr
    ctx.scale(dpr, dpr)

    ctx.clearRect(0, 0, width, height)

    // Scale data to canvas coordinates
    const min   = Math.min(...data)
    const max   = Math.max(...data)
    const range = max - min || 1

    const padX   = 2
    const padY   = 5
    const innerW = width  - padX * 2
    const innerH = height - padY * 2

    const pts = data.map((v, i) => ({
      x: padX + (i / (data.length - 1)) * innerW,
      y: padY + (1 - (v - min) / range) * innerH,
    }))

    // Resolve CSS var if needed
    const resolvedColor = color.startsWith('var(')
      ? (
          getComputedStyle(canvas)
            .getPropertyValue(color.replace(/^var\(/, '').replace(/\)$/, '').trim())
            .trim() || '#6366f1'
        )
      : color

    /* ── Build smooth bezier path ── */
    function buildPath(path2d) {
      path2d.moveTo(pts[0].x, pts[0].y)
      for (let i = 1; i < pts.length; i++) {
        const prev = pts[i - 1]
        const curr = pts[i]
        if (i === 1) {
          path2d.quadraticCurveTo(
            prev.x, prev.y,
            (prev.x + curr.x) / 2,
            (prev.y + curr.y) / 2,
          )
        } else {
          const pp = pts[i - 2]
          path2d.bezierCurveTo(
            (pp.x   + 2 * prev.x) / 3,
            (pp.y   + 2 * prev.y) / 3,
            (2 * prev.x + curr.x) / 3,
            (2 * prev.y + curr.y) / 3,
            (prev.x + curr.x) / 2,
            (prev.y + curr.y) / 2,
          )
        }
      }
      // Final segment to last point
      const last       = pts[pts.length - 1]
      const secondLast = pts[pts.length - 2]
      path2d.quadraticCurveTo(secondLast.x, secondLast.y, last.x, last.y)
    }

    /* ── Area fill ── */
    if (filled) {
      const fillPath = new Path2D()
      const last = pts[pts.length - 1]
      fillPath.moveTo(pts[0].x, padY + innerH) // bottom-left anchor
      fillPath.lineTo(pts[0].x, pts[0].y)      // up to first point
      buildPath(fillPath)
      fillPath.lineTo(last.x, padY + innerH)   // down to bottom-right
      fillPath.closePath()

      const grad = ctx.createLinearGradient(0, padY, 0, padY + innerH)
      grad.addColorStop(0,   hexToRgba(resolvedColor, 0.20))
      grad.addColorStop(0.65, hexToRgba(resolvedColor, 0.06))
      grad.addColorStop(1,   hexToRgba(resolvedColor, 0))

      ctx.save()
      ctx.fillStyle = grad
      ctx.fill(fillPath)
      ctx.restore()
    }

    /* ── Stroke line ── */
    const linePath = new Path2D()
    buildPath(linePath)
    ctx.strokeStyle = resolvedColor
    ctx.lineWidth   = 2
    ctx.lineJoin    = 'round'
    ctx.lineCap     = 'round'
    ctx.stroke(linePath)

    /* ── End dot ── */
    const last = pts[pts.length - 1]
    ctx.beginPath()
    ctx.arc(last.x, last.y, 4, 0, Math.PI * 2)
    ctx.fillStyle = resolvedColor
    ctx.fill()
  }, [data, color, width, height, filled])

  return (
    <canvas
      ref={canvasRef}
      style={{ width, height, display: 'block' }}
    />
  )
}

/* ── Utility: hex → rgba ── */
function hexToRgba(hex, alpha) {
  if (!hex || !hex.startsWith('#')) return `rgba(99,102,241,${alpha})`
  let h = hex.replace('#', '')
  if (h.length === 3) h = h.split('').map((c) => c + c).join('')
  const r = parseInt(h.slice(0, 2), 16)
  const g = parseInt(h.slice(2, 4), 16)
  const b = parseInt(h.slice(4, 6), 16)
  return `rgba(${r},${g},${b},${alpha})`
}
