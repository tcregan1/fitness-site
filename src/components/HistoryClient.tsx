'use client'

import { useState, useMemo } from 'react'
import type { Workout, ExerciseSet, Exercise } from '@/lib/sheets'

interface HistoryClientProps {
  workouts:  Workout[]
  sets:      ExerciseSet[]
  exercises: Exercise[]
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

export default function HistoryClient({ workouts, sets, exercises }: HistoryClientProps) {
  const [expandedId, setExpandedId] = useState<number | null>(null)

  const exerciseMap = useMemo(
    () => new Map(exercises.map(e => [e.id, e.name])),
    [exercises]
  )

  const sorted = useMemo(
    () => [...workouts].sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime()),
    [workouts]
  )

  return (
    <div className="page-content">
      <div className="history-list">
        {sorted.map(workout => {
          const workoutSets  = sets.filter(s => s.workoutId === workout.id)
          const totalVolume  = workoutSets.reduce((a, s) => a + s.weight * s.reps, 0)
          const totalSets    = workoutSets.length
          const isExpanded   = expandedId === workout.id
          const typeColor    = workoutTypeColor(workout.type)

          // Group sets by exercise for the expanded view
          const byExercise: Record<number, ExerciseSet[]> = {}
          workoutSets.forEach(s => {
            if (!byExercise[s.exerciseId]) byExercise[s.exerciseId] = []
            byExercise[s.exerciseId].push(s)
          })

          return (
            <div key={workout.id} className="history-card">
              <button
                className="history-row"
                onClick={() => setExpandedId(isExpanded ? null : workout.id)}
              >
                <div className="history-left">
                  <span
                    className="history-type-dot"
                    style={{ background: typeColor }}
                  />
                  <div>
                    <p className="history-date">
                      {new Date(workout.date).toLocaleDateString('en-GB', {
                        weekday: 'short', day: 'numeric', month: 'short', year: 'numeric'
                      })}
                    </p>
                    <p className="history-type" style={{ color: typeColor }}>
                      {capitalize(workout.type)}
                    </p>
                  </div>
                </div>
                <div className="history-right">
                  <div className="history-stat">
                    <span className="history-stat-value">{Math.round(totalVolume).toLocaleString()}</span>
                    <span className="history-stat-label">kg vol</span>
                  </div>
                  <div className="history-stat">
                    <span className="history-stat-value">{totalSets}</span>
                    <span className="history-stat-label">sets</span>
                  </div>
                  <span className={`history-chevron ${isExpanded ? 'open' : ''}`}>›</span>
                </div>
              </button>

              {isExpanded && (
                <div className="history-detail">
                  {Object.entries(byExercise).map(([eidStr, exSets]) => {
                    const eid       = Number(eidStr)
                    const name      = exerciseMap.get(eid) ?? 'Unknown'
                    const shortName = name.replace(/\s*\(.*?\)/g, '')
                    const sorted    = [...exSets].sort((a, b) => a.setNumber - b.setNumber)
                    return (
                      <div key={eid} className="history-exercise">
                        <p className="history-exercise-name">{shortName}</p>
                        <div className="history-sets">
                          {sorted.map(s => (
                            <span key={s.setId} className="history-set-pill">
                              {s.weight}kg × {s.reps}
                            </span>
                          ))}
                        </div>
                      </div>
                    )
                  })}
                </div>
              )}
            </div>
          )
        })}
      </div>
    </div>
  )
}