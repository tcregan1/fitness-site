import { NextResponse } from 'next/server'
import { getSupabaseAdminClient } from '@/lib/supabase'
import { parseStrongWorkoutText } from '@/lib/parseStrongWorkout'

export async function POST(request: Request) {
  const body = await request.json().catch(() => null)
  const text = body?.text

  if (typeof text !== 'string' || !text.trim()) {
    return NextResponse.json({ error: 'No workout text provided' }, { status: 400 })
  }

  let parsed
  try {
    parsed = parseStrongWorkoutText(text)
  } catch (err) {
    return NextResponse.json({ error: err instanceof Error ? err.message : 'Failed to parse workout' }, { status: 400 })
  }

  const supabase = getSupabaseAdminClient()

  const { data: existing, error: existingErr } = await supabase
    .from('workouts')
    .select('workout_id')
    .eq('date', parsed.date)
    .maybeSingle()

  if (existingErr) return NextResponse.json({ error: existingErr.message }, { status: 500 })
  if (existing) {
    return NextResponse.json({ error: `A workout already exists for ${parsed.date}` }, { status: 409 })
  }

  const { data: exerciseRows, error: exerciseErr } = await supabase
    .from('exercise_reference')
    .select('exercise_id, exercise')

  if (exerciseErr) return NextResponse.json({ error: exerciseErr.message }, { status: 500 })

  const idByName = new Map((exerciseRows ?? []).map(e => [e.exercise.toLowerCase(), e.exercise_id as number]))
  let nextExerciseId = Math.max(0, ...(exerciseRows ?? []).map(e => e.exercise_id as number)) + 1

  const newExerciseRows: { exercise_id: number; exercise: string }[] = []
  for (const ex of parsed.exercises) {
    const key = ex.name.toLowerCase()
    if (!idByName.has(key)) {
      idByName.set(key, nextExerciseId)
      newExerciseRows.push({ exercise_id: nextExerciseId, exercise: ex.name })
      nextExerciseId++
    }
  }

  if (newExerciseRows.length > 0) {
    const { error } = await supabase.from('exercise_reference').insert(newExerciseRows)
    if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  }

  const { data: maxWorkoutRow, error: maxWorkoutErr } = await supabase
    .from('workouts')
    .select('workout_id')
    .order('workout_id', { ascending: false })
    .limit(1)
    .maybeSingle()

  if (maxWorkoutErr) return NextResponse.json({ error: maxWorkoutErr.message }, { status: 500 })
  const workoutId = (maxWorkoutRow?.workout_id ?? 0) + 1

  const { error: workoutInsertErr } = await supabase
    .from('workouts')
    .insert({ workout_id: workoutId, date: parsed.date, workout_type: parsed.workoutType })

  if (workoutInsertErr) return NextResponse.json({ error: workoutInsertErr.message }, { status: 500 })

  const { data: maxSetRow, error: maxSetErr } = await supabase
    .from('exercise_sets')
    .select('set_id')
    .order('set_id', { ascending: false })
    .limit(1)
    .maybeSingle()

  if (maxSetErr) return NextResponse.json({ error: maxSetErr.message }, { status: 500 })
  let setId = (maxSetRow?.set_id ?? 0) + 1

  const setRows = parsed.exercises.flatMap(ex => {
    const exerciseId = idByName.get(ex.name.toLowerCase())!
    return ex.sets.map((s, i) => ({
      set_id: setId++,
      workout_id: workoutId,
      exercise_id: exerciseId,
      set_number: i + 1,
      weight: s.weight,
      reps: s.reps,
    }))
  })

  const { error: setsInsertErr } = await supabase.from('exercise_sets').insert(setRows)
  if (setsInsertErr) return NextResponse.json({ error: setsInsertErr.message }, { status: 500 })

  return NextResponse.json({
    ok: true,
    date: parsed.date,
    workoutType: parsed.workoutType,
    exerciseCount: parsed.exercises.length,
    setCount: setRows.length,
    newExercises: newExerciseRows.map(e => e.exercise),
  })
}
