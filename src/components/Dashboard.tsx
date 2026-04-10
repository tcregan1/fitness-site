'use client'

import { useMemo } from 'react'
import type { FitnessData } from '@/lib/sheets'
import type { StreakData, VolumeBalance } from '@/lib/insights'
import MetricCard from './MetricCard'
import PRList from './PRlist'
import VolumeSplit from './VolumeSplit'

interface DashboardProps {
  data:          FitnessData
  streak:        StreakData
  volumeBalance: VolumeBalance
}

function workoutTypeColor(type: string) {
  if (type.includes('push')) return 'var(--accent)'
  if (type.includes('pull')) return 'var(--accent-pull)'
  if (type.includes('legs')) return 'var(--accent-legs)'
  return 'var(--text-tertiary)'
}

function capitalize(s: string) {
  return s.charAt(0).toUpperCase() + s.slice(1)
}

export default function Dashboard({ data, streak, volumeBalance }: DashboardProps) {
  const { workouts, sets } = data

  const now       = new Date()
  const thisMonth = now.getMonth()
  const thisYear  = now.getFullYear()
  const monthName = now.toLocaleString('en-GB', { month: 'long' })

  // Sessions this month
  const monthWorkouts = useMemo(
    () => workouts.filter(w => {
      const d = new Date(w.date)
      return d.getMonth() === thisMonth && d.getFullYear() === thisYear
    }),
    [workouts, thisMonth, thisYear]
  )

  // Volume this month (kg)
  const monthWorkoutIds = useMemo(() => new Set(monthWorkouts.map(w => w.id)), [monthWorkouts])
  const volumeThisMonth = useMemo(
    () => sets
      .filter(s => monthWorkoutIds.has(s.workoutId))
      .reduce((acc, s) => acc + s.weight * s.reps, 0),
    [sets, monthWorkoutIds]
  )

  // Last 5 sessions
  const recentSessions = useMemo(() => {
    return [...workouts]
      .sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime())
      .slice(0, 5)
      .map(w => {
        const wSets  = sets.filter(s => s.workoutId === w.id)
        const volume = wSets.reduce((acc, s) => acc + s.weight * s.reps, 0)
        const totalSets = wSets.length
        return { ...w, volume, totalSets }
      })
  }, [workouts, sets])

  const streakColor =
    streak.status === 'on_track' ? 'var(--color-success)' :
    streak.status === 'warning'  ? 'var(--color-warning)' :
    'var(--color-danger)'

  const volumeFormatted = volumeThisMonth >= 1000
    ? `${(volumeThisMonth / 1000).toFixed(1)}t`
    : `${Math.round(volumeThisMonth).toLocaleString()}kg`

  return (
    <div className="dash">

      {/* ── Top metrics ── */}
      <div className="top-row top-row--3">
        <MetricCard
          label={`Volume — ${monthName}`}
          value={volumeFormatted}
          sub={`across ${monthWorkouts.length} session${monthWorkouts.length !== 1 ? 's' : ''}`}
        />
        <MetricCard
          label="Sessions this month"
          value={monthWorkouts.length}
          sub={monthName}
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

      {/* ── Middle row: Recent sessions + Volume split ── */}
      <div className="two-col">

        {/* Recent sessions */}
        <div className="card">
          <p className="card-title">Recent sessions</p>
          <div className="recent-sessions">
            {recentSessions.length === 0 && (
              <p className="empty-state" style={{ padding: '8px 0' }}>No sessions yet.</p>
            )}
            {recentSessions.map(w => {
              const color = workoutTypeColor(w.type)
              return (
                <div key={w.id} className="recent-session-row">
                  <span className="recent-session-dot" style={{ background: color }} />
                  <div className="recent-session-info">
                    <p className="recent-session-type" style={{ color }}>
                      {capitalize(w.type)}
                    </p>
                    <p className="recent-session-date">
                      {new Date(w.date).toLocaleDateString('en-GB', {
                        weekday: 'short', day: 'numeric', month: 'short',
                      })}
                    </p>
                  </div>
                  <div className="recent-session-stats">
                    <span className="recent-session-vol">
                      {Math.round(w.volume).toLocaleString()} kg
                    </span>
                    <span className="recent-session-sets">
                      {w.totalSets} sets
                    </span>
                  </div>
                </div>
              )
            })}
          </div>
        </div>

        <VolumeSplit volumeBalance={volumeBalance} />

      </div>

      {/* ── PRs full width ── */}
      <div className="card">
        <p className="card-title">Personal records</p>
        <PRList sets={sets} exercises={data.exercises} />
      </div>

    </div>
  )
}