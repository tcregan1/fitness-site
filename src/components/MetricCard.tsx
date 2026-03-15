interface MetricCardProps {
  label: string
  value: string | number
  sub?: string
}

export default function MetricCard({ label, value, sub }: MetricCardProps) {
  return (
    <div className="metric-card">
      <p className="metric-label">{label}</p>
      <p className="metric-value">{value}</p>
      {sub && <p className="metric-sub">{sub}</p>}
    </div>
  )
}