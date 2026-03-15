'use client'

import type { VolumeBalance } from '@/lib/insights'

interface VolumeSplitProps {
  volumeBalance: VolumeBalance
}

export default function VolumeSplit({ volumeBalance }: VolumeSplitProps) {
  const rows = [
    { label: 'Push', pct: volumeBalance.pushPct, kg: volumeBalance.push, cls: 'push' },
    { label: 'Pull', pct: volumeBalance.pullPct, kg: volumeBalance.pull, cls: 'pull' },
    { label: 'Legs', pct: volumeBalance.legsPct, kg: volumeBalance.legs, cls: 'legs' },
  ]

  return (
    <div className="card">
      <p className="card-title">Volume split <span className="card-title-sub">last 4 weeks</span></p>
      <div className="volume-split-bars">
        {rows.map(row => (
          <div key={row.label} className="vs-row">
            <span className="vs-label">{row.label}</span>
            <div className="vs-bar-wrap">
              <div className={`vs-bar ${row.cls}`} style={{ width: `${row.pct}%` }} />
            </div>
            <span className="vs-pct">{row.pct}%</span>
            <span className="vs-kg">{row.kg.toLocaleString()} kg</span>
          </div>
        ))}
      </div>
      {volumeBalance.warning && (
        <p className="vs-warning">{volumeBalance.warning}</p>
      )}
    </div>
  )
}