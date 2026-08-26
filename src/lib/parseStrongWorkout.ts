const MONTHS: Record<string, number> = {
  january: 1, february: 2, march: 3, april: 4, may: 5, june: 6,
  july: 7, august: 8, september: 9, october: 10, november: 11, december: 12,
}

export interface ParsedSet {
  weight: number
  reps: number
}

export interface ParsedExercise {
  name: string
  sets: ParsedSet[]
}

export interface ParsedWorkout {
  workoutType: string
  date: string // YYYY-MM-DD
  exercises: ParsedExercise[]
}

function parseDate(line: string): string {
  // "Wednesday, 19 August 2026 at 17:09"
  const match = line.match(/^\w+,\s*(\d{1,2})\s+(\w+)\s+(\d{4})\s+at\s+\d{1,2}:\d{2}$/i)
  if (!match) throw new Error(`Couldn't parse date from "${line}"`)
  const [, day, monthName, year] = match
  const month = MONTHS[monthName.toLowerCase()]
  if (!month) throw new Error(`Unrecognised month in "${line}"`)
  return `${year}-${String(month).padStart(2, '0')}-${day.padStart(2, '0')}`
}

function parseSetLine(line: string): ParsedSet {
  const rest = line.replace(/^Set\s+\d+:\s*/i, '').trim()

  const weighted = rest.match(/^([\d.]+)\s*kg\s*[x×]\s*(\d+)/i)
  if (weighted) {
    return { weight: parseFloat(weighted[1]), reps: parseInt(weighted[2], 10) }
  }

  const bodyweight = rest.match(/^(\d+)\s*reps?$/i)
  if (bodyweight) {
    return { weight: 0, reps: parseInt(bodyweight[1], 10) }
  }

  throw new Error(`Couldn't parse set line "${line}"`)
}

export function parseStrongWorkoutText(raw: string): ParsedWorkout {
  const text = raw.replace(/\r\n/g, '\n').trim()
  const blocks = text.split(/\n\s*\n/).map(b => b.trim()).filter(Boolean)
  if (blocks.length < 2) throw new Error('Text is too short to be a Strong workout export')

  const headerLines = blocks[0].split('\n').map(l => l.trim())
  if (headerLines.length < 2) throw new Error('Missing workout type/date header')
  const workoutType = headerLines[0].toLowerCase()
  const date = parseDate(headerLines[1])

  const exercises: ParsedExercise[] = []
  for (const block of blocks.slice(1)) {
    const lines = block.split('\n').map(l => l.trim()).filter(l => l && !/^https?:\/\//i.test(l))
    if (lines.length === 0) continue
    const [name, ...setLines] = lines
    const sets = setLines.map(parseSetLine)
    if (sets.length === 0) throw new Error(`No sets found for exercise "${name}"`)
    exercises.push({ name, sets })
  }

  if (exercises.length === 0) throw new Error('No exercises found in workout text')

  return { workoutType, date, exercises }
}
