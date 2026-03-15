interface MetricCardProps {
  label:       string
  value:       string | number
  sub?:        string
  valueColor?: string
}

export default function MetricCard({ label, value, sub, valueColor }: MetricCardProps) {
  return (
    <div className="metric-card">
      <p className="metric-label">{label}</p>
      <p className="metric-value" style={valueColor ? { color: valueColor } : undefined}>
        {value}
      </p>
      {sub && <p className="metric-sub">{sub}</p>}
    </div>
  )
}