import type { Workout, ExerciseSet, Exercise } from './sheets'

// ── Types ───────────────────────────────────────────────────────────────────

export type WorkoutCategory = 'push' | 'pull' | 'legs'

export interface OverloadTarget {
  exerciseName: string
  category:     WorkoutCategory
  currentPR:    number
  targetWeight: number
  targetReps:   number
  lastSession:  string
  status:       'increase_weight' | 'increase_reps' | 'maintain'
  message:      string
}

export interface VolumeBalance {
  push:    number
  pull:    number
  legs:    number
  total:   number
  pushPct: number
  pullPct: number
  legsPct: number
  warning: string | null
}

export interface StreakData {
  currentStreak:  number
  longestStreak:  number
  totalWorkouts:  number
  lastWorkout:    string
  daysSinceLast:  number
  status:         'on_track' | 'warning' | 'overdue'
  message:        string
}

export interface GeneralInsight {
  type:    'success' | 'warning' | 'info'
  heading: string
  body:    string
}

export interface InsightsData {
  overloadTargets: OverloadTarget[]
  volumeBalance:   VolumeBalance
  streak:          StreakData
  generalInsight:  GeneralInsight
}

// ── Helpers ─────────────────────────────────────────────────────────────────

function daysBetween(a: Date, b: Date) {
  return Math.floor(Math.abs(b.getTime() - a.getTime()) / (1000 * 60 * 60 * 24))
}

function workoutCategory(type: string): WorkoutCategory | 'other' {
  if (type.includes('push')) return 'push'
  if (type.includes('pull')) return 'pull'
  if (type.includes('legs')) return 'legs'
  return 'other'
}

// Derive the most likely category for an exercise from which workout types
// it appears in — ignores 'other' (early sessions before PPL naming)
function deriveExerciseCategory(
  exerciseId: number,
  sets: ExerciseSet[],
  workouts: Workout[]
): WorkoutCategory | null {
  const workoutMap = new Map(workouts.map(w => [w.id, w.type]))
  const counts: Record<string, number> = { push: 0, pull: 0, legs: 0 }

  sets
    .filter(s => s.exerciseId === exerciseId)
    .forEach(s => {
      const type = workoutMap.get(s.workoutId) ?? ''
      const cat  = workoutCategory(type)
      if (cat !== 'other') counts[cat]++
    })

  const best = Object.entries(counts).sort((a, b) => b[1] - a[1])[0]
  return best && best[1] > 0 ? (best[0] as WorkoutCategory) : null
}

// ── Exercise config ──────────────────────────────────────────────────────────

const TRACKED_EXERCISES: Record<string, number> = {
  'Squat (Barbell)':                          8,
  'Bent Over Row (Barbell)':                  8,
  'Pendlay Row (Barbell)':                    8,
  'Bench Press (Dumbbell)':                  10,
  'Incline Bench Press (Dumbbell)':          10,
  'Pec Deck (Machine)':                      12,
  'Seated Leg Press (Machine)':              12,
  'Lat Pulldown (Cable)':                    10,
  'Seated Row (Cable)':                      10,
  'Seated Row (Machine)':                    10,
  'Seated Overhead Press (Dumbbell)':        10,
  'Leg Extension (Machine)':                 12,
  'Lying Leg Curl (Machine)':                12,
  'Lateral Raise (Dumbbell)':                15,
  'Bicep Curl (Cable)':                      12,
  'Triceps Pushdown (Cable - Straight Bar)': 12,
  'Triceps Extension':                       12,
  'Face Pull (Cable)':                       15,
  'Hammer Curl (Dumbbell)':                  12,
}

// Weight increment per exercise — based on realistic equipment jumps:
// Barbell: 2.5kg | Dumbbell compound: 2.5kg | Machine/Cable: 5kg | Light isolation: 1.25kg
const WEIGHT_INCREMENT: Record<string, number> = {
  'Squat (Barbell)':                          2.5,
  'Bent Over Row (Barbell)':                  2.5,
  'Pendlay Row (Barbell)':                    2.5,
  'Bench Press (Dumbbell)':                   2.5,
  'Incline Bench Press (Dumbbell)':           2.5,
  'Seated Overhead Press (Dumbbell)':         2.5,
  'Pec Deck (Machine)':                       5,
  'Seated Leg Press (Machine)':               5,
  'Lat Pulldown (Cable)':                     5,
  'Seated Row (Cable)':                       5,
  'Seated Row (Machine)':                     5,
  'Leg Extension (Machine)':                  5,
  'Lying Leg Curl (Machine)':                 5,
  'Lateral Raise (Dumbbell)':                 1.25,
  'Bicep Curl (Cable)':                       2.5,
  'Triceps Pushdown (Cable - Straight Bar)':  2.5,
  'Triceps Extension':                        2.5,
  'Face Pull (Cable)':                        2.5,
  'Hammer Curl (Dumbbell)':                   2.5,
}

// ── Progressive overload ─────────────────────────────────────────────────────

export function computeOverloadTargets(
  workouts: Workout[],
  sets: ExerciseSet[],
  exercises: Exercise[]
): OverloadTarget[] {
  const nameToId = new Map(exercises.map(e => [e.name, e.id]))

  const sorted = [...workouts].sort(
    (a, b) => new Date(b.date).getTime() - new Date(a.date).getTime()
  )

  const targets: OverloadTarget[] = []

  for (const [liftName, targetReps] of Object.entries(TRACKED_EXERCISES)) {
    const eid = nameToId.get(liftName)
    if (!eid) continue

    const exerciseSets = sets.filter(s => s.exerciseId === eid && s.weight > 0)
    if (!exerciseSets.length) continue

    const category = deriveExerciseCategory(eid, sets, workouts)
    if (!category) continue

    const lastWorkout = sorted.find(w =>
      exerciseSets.some(s => s.workoutId === w.id)
    )
    if (!lastWorkout) continue

    const lastSets   = exerciseSets.filter(s => s.workoutId === lastWorkout.id)
    const topWeight  = Math.max(...lastSets.map(s => s.weight))
    const setsAtTop  = lastSets.filter(s => s.weight === topWeight)
    const allHitReps = setsAtTop.every(s => s.reps >= targetReps)
    const avgReps    = setsAtTop.reduce((a, s) => a + s.reps, 0) / setsAtTop.length
    const allTimePR  = Math.max(...exerciseSets.map(s => s.weight))

    let status:       OverloadTarget['status']
    let targetWeight: number
    let message:      string

    if (allHitReps) {
      const increment = WEIGHT_INCREMENT[liftName] ?? 2.5
      status       = 'increase_weight'
      targetWeight = topWeight + increment
      message      = `Hit all reps at ${topWeight}kg — go for ${targetWeight}kg next session`
    } else if (avgReps >= targetReps * 0.8) {
      status       = 'increase_reps'
      targetWeight = topWeight
      message      = `Stay at ${topWeight}kg and aim for ${targetReps} reps on all sets`
    } else {
      status       = 'maintain'
      targetWeight = topWeight
      message      = `Consolidate at ${topWeight}kg before progressing`
    }

    targets.push({
      exerciseName: liftName,
      category,
      currentPR: allTimePR,
      targetWeight,
      targetReps,
      lastSession: lastWorkout.date,
      status,
      message,
    })
  }

  const statusOrder = { increase_weight: 0, increase_reps: 1, maintain: 2 }
  return targets.sort((a, b) => statusOrder[a.status] - statusOrder[b.status])
}

// ── Volume balance ───────────────────────────────────────────────────────────

export function computeVolumeBalance(
  workouts: Workout[],
  sets: ExerciseSet[],
  weeks = 4
): VolumeBalance {
  const cutoff = new Date()
  cutoff.setDate(cutoff.getDate() - weeks * 7)

  const recentWorkouts = workouts.filter(w => new Date(w.date) >= cutoff)
  const recentIds      = new Set(recentWorkouts.map(w => w.id))
  const recentSets     = sets.filter(s => recentIds.has(s.workoutId))

  const vol: Record<string, number> = { push: 0, pull: 0, legs: 0 }

  recentWorkouts.forEach(w => {
    const cat = workoutCategory(w.type)
    if (cat === 'other') return
    const workoutSets = recentSets.filter(s => s.workoutId === w.id)
    vol[cat] += workoutSets.reduce((a, s) => a + s.weight * s.reps, 0)
  })

  const total   = vol.push + vol.pull + vol.legs || 1
  const pushPct = Math.round((vol.push / total) * 100)
  const pullPct = Math.round((vol.pull / total) * 100)
  const legsPct = Math.round((vol.legs / total) * 100)

  let warning: string | null = null
  if (pushPct > pullPct + 20)      warning = 'Push volume is significantly higher than pull — consider adding a pull session'
  else if (pullPct > pushPct + 20) warning = 'Pull volume is significantly higher than push'
  else if (legsPct < 20)           warning = "Leg volume is low — don't skip leg day"

  return {
    push: Math.round(vol.push), pull: Math.round(vol.pull), legs: Math.round(vol.legs),
    total: Math.round(total), pushPct, pullPct, legsPct, warning,
  }
}

// ── Streak ───────────────────────────────────────────────────────────────────

export function computeStreak(workouts: Workout[]): StreakData {
  if (!workouts.length) {
    return {
      currentStreak: 0, longestStreak: 0, totalWorkouts: 0,
      lastWorkout: '—', daysSinceLast: 0,
      status: 'overdue', message: 'No workouts logged yet',
    }
  }

  const sorted = [...workouts].sort(
    (a, b) => new Date(b.date).getTime() - new Date(a.date).getTime()
  )

  const today         = new Date()
  const lastDate      = new Date(sorted[0].date)
  const daysSinceLast = daysBetween(today, lastDate)

  const weekCounts: Record<string, number> = {}
  sorted.forEach(w => {
    const d    = new Date(w.date)
    const jan1 = new Date(d.getFullYear(), 0, 1)
    const week = `${d.getFullYear()}-W${Math.ceil(
      ((d.getTime() - jan1.getTime()) / 86400000 + jan1.getDay() + 1) / 7
    )}`
    weekCounts[week] = (weekCounts[week] ?? 0) + 1
  })

  const weeks = Object.keys(weekCounts).sort().reverse()
  let streak = 0, longestStreak = 0
  for (const week of weeks) {
    if (weekCounts[week] >= 2) { streak++; if (streak > longestStreak) longestStreak = streak }
    else streak = 0
  }

  const currentStreak = daysSinceLast <= 9 ? streak : 0

  const status: StreakData['status'] =
    daysSinceLast <= 2 ? 'on_track' :
    daysSinceLast <= 5 ? 'warning'  : 'overdue'

  const message =
    daysSinceLast <= 2 ? 'Great consistency — keep it up' :
    daysSinceLast <= 5 ? `${daysSinceLast} days since last session — time to train` :
    `${daysSinceLast} days since last session — get back in the gym`

  return {
    currentStreak, longestStreak, totalWorkouts: workouts.length,
    lastWorkout: sorted[0].date, daysSinceLast, status, message,
  }
}

// ── General insight ──────────────────────────────────────────────────────────

export function computeGeneralInsight(
  workouts: Workout[],
  sets: ExerciseSet[],
  targets: OverloadTarget[],
  streak: StreakData,
  volume: VolumeBalance
): GeneralInsight {
  if (streak.status === 'overdue') {
    return {
      type: 'warning',
      heading: `${streak.daysSinceLast} days without training`,
      body: 'Your last session was a while ago. Getting back in with even a lighter session will help maintain your progress.',
    }
  }

  if (volume.warning) {
    const dominant =
      volume.pushPct > volume.pullPct && volume.pushPct > volume.legsPct ? 'push' :
      volume.pullPct > volume.legsPct ? 'pull' : 'legs'
    const pct = dominant === 'push' ? volume.pushPct : dominant === 'pull' ? volume.pullPct : volume.legsPct
    return {
      type: 'warning',
      heading: 'Volume imbalance detected',
      body: `${volume.warning}. Your ${dominant} sessions make up ${pct}% of total volume over the last 4 weeks.`,
    }
  }

  const readyToProgress = targets.filter(t => t.status === 'increase_weight')
  if (readyToProgress.length >= 3) {
    const names = readyToProgress.slice(0, 3).map(t => t.exerciseName.replace(/\s*\(.*?\)/g, '')).join(', ')
    return {
      type: 'success',
      heading: `${readyToProgress.length} lifts ready to progress`,
      body: `You've hit your rep targets on ${names}${readyToProgress.length > 3 ? ' and more' : ''}. Time to add weight next session.`,
    }
  }

  const recentTypes = [...workouts]
    .sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime())
    .slice(0, 4)
    .map(w => workoutCategory(w.type))

  if (!recentTypes.includes('legs')) {
    return {
      type: 'info',
      heading: 'No leg session in your last 4 workouts',
      body: 'Consider scheduling a leg day soon to keep your training balanced.',
    }
  }

  return {
    type: 'success',
    heading: streak.currentStreak > 1 ? `${streak.currentStreak}-week streak` : 'Training on track',
    body: `You've logged ${streak.totalWorkouts} total workouts with a solid push/pull/legs split. Keep the consistency going.`,
  }
}

// ── Combined ─────────────────────────────────────────────────────────────────

export function computeInsights(
  workouts: Workout[],
  sets: ExerciseSet[],
  exercises: Exercise[]
): InsightsData {
  const overloadTargets = computeOverloadTargets(workouts, sets, exercises)
  const volumeBalance   = computeVolumeBalance(workouts, sets)
  const streak          = computeStreak(workouts)
  const generalInsight  = computeGeneralInsight(workouts, sets, overloadTargets, streak, volumeBalance)

  return { overloadTargets, volumeBalance, streak, generalInsight }
}