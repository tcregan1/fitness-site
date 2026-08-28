'use client'

import { useState, useMemo } from 'react'
import { useRouter } from 'next/navigation'
import type { Workout, ExerciseSet, Exercise } from '@/lib/data'

type Category = 'push' | 'pull' | 'legs'

const CATEGORY_ACCENT: Record<Category, string> = {
  push: '#F5C518',
  pull: '#4A9ECC',
  legs: '#8DB548',
}

function fmtDate(isoDate: string) {
  return new Date(isoDate).toLocaleDateString('en-GB', { day: 'numeric', month: 'short' })
}

function fmtSet(set: ExerciseSet) {
  return set.weight > 0 ? `${set.weight}×${set.reps}` : `${set.reps} reps`
}

interface SessionRow {
  date: string
  label: string
  sets: ExerciseSet[]
}

// One row per session (most recent first), each holding its sets in order.
function sessionRows(sets: ExerciseSet[], workouts: Workout[]): SessionRow[] {
  const setsByWorkout = new Map<number, ExerciseSet[]>()
  for (const s of sets) {
    const list = setsByWorkout.get(s.workoutId) ?? []
    list.push(s)
    setsByWorkout.set(s.workoutId, list)
  }
  for (const list of setsByWorkout.values()) list.sort((a, b) => a.setNumber - b.setNumber)

  return workouts
    .filter(w => setsByWorkout.has(w.id))
    .sort((a, b) => b.date.localeCompare(a.date))
    .map(w => ({ date: w.date, label: fmtDate(w.date), sets: setsByWorkout.get(w.id)! }))
}

interface ExerciseVolumeProps {
  exercise: Exercise
  sets: ExerciseSet[]
  workouts: Workout[]
  category?: string
}

export default function ExerciseVolume({ exercise, sets, workouts, category }: ExerciseVolumeProps) {
  const router = useRouter()
  const [sessionCount, setSessionCount] = useState(5)

  const accent = CATEGORY_ACCENT[category as Category] ?? '#F5C518'

  const fullRows = useMemo(() => sessionRows(sets, workouts), [sets, workouts])
  const rows = sessionCount > 0 ? fullRows.slice(0, sessionCount) : fullRows
  const maxSets = rows.reduce((max, r) => Math.max(max, r.sets.length), 0)

  return (
    <div className="page-content">
      <div className="insights-top-bar">
        <div className="volume-title-group">
          <button type="button" className="volume-back-button" onClick={() => router.back()}>
            ← Back
          </button>
          <h1 className="insights-page-title">{exercise.name} — Sets</h1>
        </div>
      </div>

      <div className="filter-bar">
        <div className="filter-field">
          <label className="filter-label" htmlFor="session-count">Sessions shown</label>
          <input
            id="session-count"
            className="filter-input filter-input--narrow"
            type="number"
            min={1}
            value={sessionCount}
            onChange={e => setSessionCount(Math.max(1, Number(e.target.value) || 1))}
          />
        </div>
      </div>

      <div className="volume-card">
        {rows.length === 0 ? (
          <div className="graph-empty">No data for this exercise</div>
        ) : (
          <div className="volume-table-wrap">
            <table className="volume-table">
              <thead>
                <tr>
                  <th>Date</th>
                  {Array.from({ length: maxSets }, (_, i) => (
                    <th key={i}>Set {i + 1}</th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {rows.map(row => (
                  <tr key={row.date}>
                    <td className="volume-table-date" style={{ color: accent }}>{row.label}</td>
                    {Array.from({ length: maxSets }, (_, i) => (
                      <td key={i}>{row.sets[i] ? fmtSet(row.sets[i]) : '—'}</td>
                    ))}
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </div>
  )
}
