export default function BrandMark({ size = 32, className = '', style = {}, alt = 'FraudShield logo' }) {
  return (
    <div
      className={`brand-mark ${className}`.trim()}
      style={{ width: size, height: size, ...style }}
      aria-hidden="true"
    >
      <img src="/fraud-alert.png" alt={alt} />
    </div>
  )
}