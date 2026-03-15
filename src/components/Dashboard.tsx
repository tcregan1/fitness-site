'use client'

import { useMemo } from 'react'
import type { FitnessData } from '@/lib/sheets'
import type { StreakData, VolumeBalance } from '@/lib/insights'
import MetricCard from './MetricCard'
import PRList from './PRlist'
import LiftProgression from './LiftProgression'
import VolumeSplit from './VolumeSplit'

interface DashboardProps {
  data:          FitnessData
  streak:        StreakData
  volumeBalance: VolumeBalance
}

export default function Dashboard({ data, streak, volumeBalance }: DashboardProps) {
  const { workouts, exercises, sets } = data

  const now       = new Date()
  const thisMonth = now.getMonth()
  const thisYear  = now.getFullYear()
  const monthName = now.toLocaleString('en-GB', { month: 'long' })

  const workoutsThisMonth = useMemo(
    () => workouts.filter(w => {
      const d = new Date(w.date)
      return d.getMonth() === thisMonth && d.getFullYear() === thisYear
    }).length,
    [workouts, thisMonth, thisYear]
  )

  const streakColor =
    streak.status === 'on_track' ? 'var(--color-success)' :
    streak.status === 'warning'  ? 'var(--color-warning)' :
    'var(--color-danger)'

  return (
    <div className="dash">

      <div className="top-row top-row--3">
        <MetricCard
          label="This month"
          value={workoutsThisMonth}
          sub={`${monthName} workouts`}
        />
        <MetricCard
          label="Current streak"
          value={`${streak.currentStreak}w`}
          sub={streak.message}
          valueColor={streakColor}
        />
        <MetricCard
          label="Days since last"
          value={`${streak.daysSinceLast}d`}
          sub={streak.lastWorkout !== '—'
            ? new Date(streak.lastWorkout).toLocaleDateString('en-GB', { day: 'numeric', month: 'short' })
            : '—'}
          valueColor={streakColor}
        />
      </div>

      <LiftProgression workouts={workouts} sets={sets} exercises={exercises} />

      <div className="two-col">
        <VolumeSplit volumeBalance={volumeBalance} />
        <div className="card">
          <p className="card-title">Personal records</p>
          <PRList sets={sets} exercises={exercises} />
        </div>
      </div>

    </div>
  )
}