'use client'

import { useMemo } from 'react'
import type { ExerciseSet, Exercise } from '@/lib/sheets'

// Compounds shown first, in this order
const COMPOUND_ORDER = [
  'Squat (Barbell)',
  'Bent Over Row (Barbell)',
  'Pendlay Row (Barbell)',
  'Bench Press (Dumbbell)',
  'Incline Bench Press (Dumbbell)',
  'Seated Leg Press (Machine)',
  'Lat Pulldown (Cable)',
  'Seated Row (Cable)',
  'Seated Row (Machine)',
  'Seated Overhead Press (Dumbbell)',
]

interface PRListProps {
  sets: ExerciseSet[]
  exercises: Exercise[]
}

export default function PRList({ sets, exercises }: PRListProps) {
  const exerciseMap = useMemo(
    () => new Map(exercises.map(e => [e.id, e.name])),
    [exercises]
  )

  const prs = useMemo(() => {
    const best: Record<number, number> = {}
    sets.forEach(s => {
      if (!best[s.exerciseId] || s.weight > best[s.exerciseId]) {
        best[s.exerciseId] = s.weight
      }
    })

    const entries = Object.entries(best).map(([id, weight]) => ({
      id: Number(id),
      name: exerciseMap.get(Number(id)) ?? '',
      weight,
    }))

    entries.sort((a, b) => {
      const ai = COMPOUND_ORDER.indexOf(a.name)
      const bi = COMPOUND_ORDER.indexOf(b.name)
      if (ai !== -1 && bi !== -1) return ai - bi
      if (ai !== -1) return -1
      if (bi !== -1) return 1
      return b.weight - a.weight
    })

    return entries.slice(0, 9)
  }, [sets, exerciseMap])

  const maxWeight = prs[0]?.weight ?? 1

  return (
    <div className="pr-list">
      {prs.map(pr => {
        const pct = Math.round((pr.weight / maxWeight) * 100)
        const shortName = pr.name.replace(/\s*\(.*?\)/g, '')
        return (
          <div key={pr.id} className="pr-row">
            <span className="pr-name">{shortName}</span>
            <div className="pr-bar-wrap">
              <div className="pr-bar" style={{ width: `${pct}%` }} />
            </div>
            <span className="pr-weight">{pr.weight} kg</span>
          </div>
        )
      })}
    </div>
  )
}