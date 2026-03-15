'use client'

import { useMemo, useEffect, useRef } from 'react'
import { Chart, registerables } from 'chart.js'
import type { Workout, ExerciseSet, Exercise } from '@/lib/sheets'

Chart.register(...registerables)

interface ThisWeekClientProps {
  workouts:  Workout[]
  sets:      ExerciseSet[]
  exercises: Exercise[]
}

function getWeekBounds(weeksAgo: number) {
  const now   = new Date()
  const day   = now.getDay()
  const monday = new Date(now)
  monday.setDate(now.getDate() - ((day + 6) % 7) - weeksAgo * 7)
  monday.setHours(0, 0, 0, 0)
  const sunday = new Date(monday)
  sunday.setDate(monday.getDate() + 6)
  sunday.setHours(23, 59, 59, 999)
  return { start: monday, end: sunday }
}

function deltaLabel(curr: number, prev: number) {
  if (prev === 0) return null
  const pct = Math.round(((curr - prev) / prev) * 100)
  if (pct === 0) return { text: 'same as last week', color: 'var(--text-tertiary)' }
  return {
    text: `${pct > 0 ? '+' : ''}${pct}% vs last week`,
    color: pct > 0 ? 'var(--color-success)' : 'var(--color-danger)',
  }
}

function capitalize(s: string) {
  return s.charAt(0).toUpperCase() + s.slice(1)
}

interface CompareBarProps {
  label:    string
  thisVal:  number
  lastVal:  number
  unit:     string
  accent:   string
}

function CompareBar({ label, thisVal, lastVal, unit, accent }: CompareBarProps) {
  const max  = Math.max(thisVal, lastVal, 1)
  const delta = deltaLabel(thisVal, lastVal)
  return (
    <div className="compare-row">
      <p className="compare-label">{label}</p>
      <div className="compare-bars">
        <div className="compare-bar-group">
          <span className="compare-bar-label">This week</span>
          <div className="compare-bar-track">
            <div className="compare-bar-fill this" style={{ width: `${(thisVal / max) * 100}%`, background: accent }} />
          </div>
          <span className="compare-bar-value">{Math.round(thisVal).toLocaleString()}{unit}</span>
        </div>
        <div className="compare-bar-group">
          <span className="compare-bar-label">Last week</span>
          <div className="compare-bar-track">
            <div className="compare-bar-fill last" style={{ width: `${(lastVal / max) * 100}%` }} />
          </div>
          <span className="compare-bar-value">{Math.round(lastVal).toLocaleString()}{unit}</span>
        </div>
      </div>
      {delta && <p className="compare-delta" style={{ color: delta.color }}>{delta.text}</p>}
    </div>
  )
}

export default function ThisWeekClient({ workouts, sets, exercises }: ThisWeekClientProps) {
  const thisWeek = getWeekBounds(0)
  const lastWeek = getWeekBounds(1)

  const exerciseMap = useMemo(
    () => new Map(exercises.map(e => [e.id, e.name])),
    [exercises]
  )

  const { thisWorkouts, lastWorkouts, thisSets, lastSets } = useMemo(() => {
    const thisWorkouts = workouts.filter(w => {
      const d = new Date(w.date)
      return d >= thisWeek.start && d <= thisWeek.end
    })
    const lastWorkouts = workouts.filter(w => {
      const d = new Date(w.date)
      return d >= lastWeek.start && d <= lastWeek.end
    })
    const thisIds = new Set(thisWorkouts.map(w => w.id))
    const lastIds = new Set(lastWorkouts.map(w => w.id))
    return {
      thisWorkouts,
      lastWorkouts,
      thisSets: sets.filter(s => thisIds.has(s.workoutId)),
      lastSets: sets.filter(s => lastIds.has(s.workoutId)),
    }
  }, [workouts, sets])

  const thisVolume = thisSets.reduce((a, s) => a + s.weight * s.reps, 0)
  const lastVolume = lastSets.reduce((a, s) => a + s.weight * s.reps, 0)

  // Per-category volume
  function categoryVolume(wList: Workout[], sList: ExerciseSet[], cat: string) {
    const ids = new Set(wList.filter(w => w.type.includes(cat)).map(w => w.id))
    return sList.filter(s => ids.has(s.workoutId)).reduce((a, s) => a + s.weight * s.reps, 0)
  }

  const cats = ['push', 'pull', 'legs'] as const
  const catColors = { push: '#E85D24', pull: '#3B8BD4', legs: '#1D9E75' }

  // Lift comparison — best weight this week vs last week for key compounds
  const KEY_LIFTS = [
    'Incline Bench Press (Dumbbell)',
    'Squat (Barbell)',
    'Pendlay Row (Barbell)',
    'Lat Pulldown (Cable)',
    'Seated Leg Press (Machine)',
  ]

  const liftComparisons = useMemo(() => {
    return KEY_LIFTS.map(name => {
      const eid = exercises.find(e => e.name === name)?.id
      if (!eid) return null
      const bestThis = Math.max(0, ...thisSets.filter(s => s.exerciseId === eid).map(s => s.weight))
      const bestLast = Math.max(0, ...lastSets.filter(s => s.exerciseId === eid).map(s => s.weight))
      if (bestThis === 0 && bestLast === 0) return null
      return { name: name.replace(/\s*\(.*?\)/g, ''), bestThis, bestLast }
    }).filter(Boolean) as { name: string; bestThis: number; bestLast: number }[]
  }, [exercises, thisSets, lastSets])

  const weekLabel = (bounds: { start: Date; end: Date }) =>
    `${bounds.start.toLocaleDateString('en-GB', { day: 'numeric', month: 'short' })} – ${bounds.end.toLocaleDateString('en-GB', { day: 'numeric', month: 'short' })}`

  const noData = thisWorkouts.length === 0 && lastWorkouts.length === 0

  return (
    <div className="page-content">

      {/* ── Week headers ── */}
      <div className="week-headers">
        <div className="week-header this">
          <p className="week-header-label">This week</p>
          <p className="week-header-dates">{weekLabel(thisWeek)}</p>
          <p className="week-header-count">{thisWorkouts.length} session{thisWorkouts.length !== 1 ? 's' : ''}</p>
        </div>
        <div className="week-divider" />
        <div className="week-header last">
          <p className="week-header-label">Last week</p>
          <p className="week-header-dates">{weekLabel(lastWeek)}</p>
          <p className="week-header-count">{lastWorkouts.length} session{lastWorkouts.length !== 1 ? 's' : ''}</p>
        </div>
      </div>

      {noData ? (
        <p className="empty-state">No workout data for these two weeks yet.</p>
      ) : (
        <>
          {/* ── Volume comparison ── */}
          <section className="insights-section">
            <h2 className="section-title">Volume</h2>
            <CompareBar label="Total" thisVal={thisVolume} lastVal={lastVolume} unit=" kg" accent="#888780" />
            {cats.map(cat => (
              <CompareBar
                key={cat}
                label={cat.charAt(0).toUpperCase() + cat.slice(1)}
                thisVal={categoryVolume(thisWorkouts, thisSets, cat)}
                lastVal={categoryVolume(lastWorkouts, lastSets, cat)}
                unit=" kg"
                accent={catColors[cat]}
              />
            ))}
          </section>

          {/* ── Session breakdown ── */}
          <div className="two-col">
            <section className="insights-section">
              <h2 className="section-title">This week's sessions</h2>
              {thisWorkouts.length === 0
                ? <p className="empty-state" style={{ padding: '8px 0' }}>No sessions yet this week.</p>
                : thisWorkouts.map(w => {
                  const wSets   = sets.filter(s => s.workoutId === w.id)
                  const vol     = wSets.reduce((a, s) => a + s.weight * s.reps, 0)
                  return (
                    <div key={w.id} className="week-session">
                      <p className="week-session-type" style={{ color: w.type.includes('push') ? '#E85D24' : w.type.includes('pull') ? '#3B8BD4' : w.type.includes('legs') ? '#1D9E75' : 'var(--text-tertiary)' }}>
                        {capitalize(w.type)}
                      </p>
                      <p className="week-session-meta">
                        {new Date(w.date).toLocaleDateString('en-GB', { weekday: 'short', day: 'numeric', month: 'short' })}
                        {' · '}{Math.round(vol).toLocaleString()} kg
                      </p>
                    </div>
                  )
                })
              }
            </section>

            <section className="insights-section">
              <h2 className="section-title">Last week's sessions</h2>
              {lastWorkouts.length === 0
                ? <p className="empty-state" style={{ padding: '8px 0' }}>No sessions last week.</p>
                : lastWorkouts.map(w => {
                  const wSets = sets.filter(s => s.workoutId === w.id)
                  const vol   = wSets.reduce((a, s) => a + s.weight * s.reps, 0)
                  return (
                    <div key={w.id} className="week-session">
                      <p className="week-session-type" style={{ color: w.type.includes('push') ? '#E85D24' : w.type.includes('pull') ? '#3B8BD4' : w.type.includes('legs') ? '#1D9E75' : 'var(--text-tertiary)' }}>
                        {capitalize(w.type)}
                      </p>
                      <p className="week-session-meta">
                        {new Date(w.date).toLocaleDateString('en-GB', { weekday: 'short', day: 'numeric', month: 'short' })}
                        {' · '}{Math.round(vol).toLocaleString()} kg
                      </p>
                    </div>
                  )
                })
              }
            </section>
          </div>

          {/* ── Key lift comparison ── */}
          {liftComparisons.length > 0 && (
            <section className="insights-section">
              <h2 className="section-title">Key lifts</h2>
              {liftComparisons.map(lc => (
                <CompareBar
                  key={lc.name}
                  label={lc.name}
                  thisVal={lc.bestThis}
                  lastVal={lc.bestLast}
                  unit=" kg"
                  accent="#E85D24"
                />
              ))}
            </section>
          )}
        </>
      )}
    </div>
  )
}