'use client'

import { useMemo } from 'react'
import type { FitnessData } from '@/lib/sheets'
import MetricCard from './MetricCard'
import PRList from './PRlist'
import LiftProgression from './LiftProgression'

interface DashboardProps {
  data: FitnessData
}

function workoutColor(type: string) {
  if (type.includes('push')) return 'rgba(232,93,36,0.75)'
  if (type.includes('pull')) return 'rgba(59,139,212,0.75)'
  if (type.includes('legs')) return 'rgba(29,158,117,0.75)'
  return 'rgba(136,135,128,0.55)'
}

export default function Dashboard({ data }: DashboardProps) {
  const { workouts, exercises, sets } = data

  const now = new Date()
  const thisMonth = now.getMonth()
  const thisYear  = now.getFullYear()
  const monthName = now.toLocaleString('en-GB', { month: 'long' })

  const workoutsThisMonth = useMemo(
    () =>
      workouts.filter(w => {
        const d = new Date(w.date)
        return d.getMonth() === thisMonth && d.getFullYear() === thisYear
      }).length,
    [workouts, thisMonth, thisYear]
  )

  return (
    <div className="dash">

      {/* ── Top metrics ── */}
      <div className="top-row">
        <MetricCard
          label="This month"
          value={workoutsThisMonth}
          sub={`${monthName} workouts`}
        />
        <MetricCard
          label="Total sets"
          value={sets.length.toLocaleString()}
          sub="all time"
        />
      </div>

      {/* ── Main content ── */}
      <div className="two-col">
        <LiftProgression workouts={workouts} sets={sets} exercises={exercises} />
        <div className="card">
          <p className="card-title">Personal records</p>
          <PRList sets={sets} exercises={exercises} />
        </div>
      </div>

    </div>
  )
}