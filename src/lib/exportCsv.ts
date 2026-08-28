import type { Workout, ExerciseSet, Exercise } from '@/lib/data'

function csvField(value: string | number): string {
  const s = String(value)
  return /[",\n]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s
}

// Flat, chronological Date/Workout Type/Exercise/Set/Weight/Reps table —
// readable as-is and easy to paste or attach when asking an LLM for feedback.
export function buildWorkoutsCsv(workouts: Workout[], exercises: Exercise[], sets: ExerciseSet[]): string {
  const workoutById = new Map(workouts.map(w => [w.id, w]))
  const exerciseById = new Map(exercises.map(e => [e.id, e]))

  const rows = sets
    .map(s => ({ set: s, workout: workoutById.get(s.workoutId), exercise: exerciseById.get(s.exerciseId) }))
    .filter((r): r is { set: ExerciseSet; workout: Workout; exercise: Exercise } => !!r.workout && !!r.exercise)
    .sort((a, b) => a.workout.date.localeCompare(b.workout.date) || a.set.workoutId - b.set.workoutId || a.set.setNumber - b.set.setNumber)

  const header = ['Date', 'Workout Type', 'Exercise', 'Set Number', 'Weight (kg)', 'Reps']
  const lines = [header.join(',')]

  for (const { set, workout, exercise } of rows) {
    lines.push([
      csvField(workout.date),
      csvField(workout.type),
      csvField(exercise.name),
      csvField(set.setNumber),
      csvField(set.weight),
      csvField(set.reps),
    ].join(','))
  }

  return lines.join('\n')
}

export function downloadCsv(filename: string, csv: string) {
  const blob = new Blob([csv], { type: 'text/csv;charset=utf-8;' })
  const url = URL.createObjectURL(blob)
  const a = document.createElement('a')
  a.href = url
  a.download = filename
  document.body.appendChild(a)
  a.click()
  document.body.removeChild(a)
  URL.revokeObjectURL(url)
}
