import { google } from 'googleapis'

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

function getAuth() {
  // Expects GOOGLE_SERVICE_ACCOUNT_KEY env var to be the full JSON string
  // of your service_account.json — set this in Vercel's environment variables
  const key = JSON.parse(process.env.GOOGLE_SERVICE_ACCOUNT_KEY!)
  return new google.auth.GoogleAuth({
    credentials: key,
    scopes: ['https://www.googleapis.com/auth/spreadsheets.readonly'],
  })
}

async function getSheet(spreadsheetId: string, range: string) {
  const auth = getAuth()
  const sheets = google.sheets({ version: 'v4', auth })
  const res = await sheets.spreadsheets.values.get({ spreadsheetId, range })
  const rows = res.data.values ?? []
  if (rows.length === 0) return []
  const [headers, ...data] = rows
  return data.map(row =>
    Object.fromEntries(headers.map((h: string, i: number) => [h, row[i] ?? '']))
  )
}

export async function getFitnessData(): Promise<FitnessData> {
  const spreadsheetId = process.env.GOOGLE_SHEET_ID!

  const [rawWorkouts, rawExercises, rawSets] = await Promise.all([
    getSheet(spreadsheetId, 'workouts'),
    getSheet(spreadsheetId, 'exercise_reference'),
    getSheet(spreadsheetId, 'exercise_sets'),
  ])

  const workouts: Workout[] = rawWorkouts.map((r: any) => ({
    id: Math.round(parseFloat(r.workout_id)),
    date: r.date,
    type: r.workout_type?.toLowerCase().trim() ?? '',
  }))

  const exercises: Exercise[] = rawExercises.map((r: any) => ({
    id: Math.round(parseFloat(r.exercise_id)),
    name: r.exercise,
  }))

  const sets: ExerciseSet[] = rawSets
    .map((r: any) => {
      try {
        return {
          setId:      Math.round(parseFloat(r.set_id)),
          workoutId:  Math.round(parseFloat(r.workout_id)),
          exerciseId: Math.round(parseFloat(r.exercise_id)),
          setNumber:  Math.round(parseFloat(r.set_number)),
          weight:     parseFloat(r.weight),
          reps:       Math.round(parseFloat(r.reps)),
        }
      } catch {
        return null
      }
    })
    .filter(Boolean) as ExerciseSet[]

  return { workouts, exercises, sets }
}