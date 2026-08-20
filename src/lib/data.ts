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

export async function getFitnessData(): Promise<FitnessData> {
  const supabase = getSupabaseServerClient()

  const [workoutsRes, exercisesRes, setsRes] = await Promise.all([
    supabase.from('workouts').select('workout_id, date, workout_type').order('date', { ascending: true }),
    supabase.from('exercise_reference').select('exercise_id, exercise'),
    supabase.from('exercise_sets').select('set_id, workout_id, exercise_id, set_number, weight, reps'),
  ])

  if (workoutsRes.error) throw workoutsRes.error
  if (exercisesRes.error) throw exercisesRes.error
  if (setsRes.error) throw setsRes.error

  const workouts: Workout[] = (workoutsRes.data ?? []).map(w => ({
    id: w.workout_id,
    date: w.date,
    type: w.workout_type,
  }))

  const exercises: Exercise[] = (exercisesRes.data ?? []).map(e => ({
    id: e.exercise_id,
    name: e.exercise,
  }))

  const sets: ExerciseSet[] = (setsRes.data ?? []).map(s => ({
    setId: s.set_id,
    workoutId: s.workout_id,
    exerciseId: s.exercise_id,
    setNumber: s.set_number,
    weight: Number(s.weight),
    reps: s.reps,
  }))

  return { workouts, exercises, sets }
}
