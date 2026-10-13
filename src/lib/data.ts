import { getSupabaseServerClient } from './supabase'

export interface Workout {
  id: number
  date: string
  type: string
}

export interface ExerciseSet {
  setId: number
  workoutId: number
  exerciseId: number
  setNumber: number
  weight: number
  reps: number
}

export interface Exercise {
  id: number
  name: string
}

export interface FitnessData {
  workouts: Workout[]
  exercises: Exercise[]
  sets: ExerciseSet[]
}

// Supabase's API returns at most 1000 rows per request, so a plain select
// silently drops everything past that. Fetch in pages until a short page comes back.
const PAGE_SIZE = 1000

async function fetchAllRows<T>(
  fetchPage: (from: number, to: number) => PromiseLike<{ data: T[] | null; error: unknown }>
): Promise<T[]> {
  const rows: T[] = []
  for (let from = 0; ; from += PAGE_SIZE) {
    const { data, error } = await fetchPage(from, from + PAGE_SIZE - 1)
    if (error) throw error
    rows.push(...(data ?? []))
    if (!data || data.length < PAGE_SIZE) return rows
  }
}

export async function getFitnessData(): Promise<FitnessData> {
  const supabase = getSupabaseServerClient()

  const [workoutRows, exerciseRows, setRows] = await Promise.all([
    fetchAllRows((from, to) =>
      supabase
        .from('workouts')
        .select('workout_id, date, workout_type')
        .order('date', { ascending: true })
        .order('workout_id', { ascending: true })
        .range(from, to)
    ),
    fetchAllRows((from, to) =>
      supabase
        .from('exercise_reference')
        .select('exercise_id, exercise')
        .order('exercise_id', { ascending: true })
        .range(from, to)
    ),
    fetchAllRows((from, to) =>
      supabase
        .from('exercise_sets')
        .select('set_id, workout_id, exercise_id, set_number, weight, reps')
        .order('set_id', { ascending: true })
        .range(from, to)
    ),
  ])

  const workouts: Workout[] = workoutRows.map(w => ({
    id: w.workout_id,
    date: w.date,
    type: w.workout_type,
  }))

  const exercises: Exercise[] = exerciseRows.map(e => ({
    id: e.exercise_id,
    name: e.exercise,
  }))

  const sets: ExerciseSet[] = setRows.map(s => ({
    setId: s.set_id,
    workoutId: s.workout_id,
    exerciseId: s.exercise_id,
    setNumber: s.set_number,
    weight: Number(s.weight),
    reps: s.reps,
  }))

  return { workouts, exercises, sets }
}
