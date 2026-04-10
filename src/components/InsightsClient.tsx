'use client'

import { useState, useEffect, useRef, useMemo } from 'react'
import { Chart, registerables } from 'chart.js'
import type { Workout, ExerciseSet, Exercise } from '@/lib/sheets'

Chart.register(...registerables)

// ── PPL category mapping ──────────────────────────────────────────────────────
// Exercises are bucketed by name. Anything not listed falls into a catch-all
// that is inferred from the workout type it most commonly appears in.

const PUSH_EXERCISES = new Set([
  'Incline Bench Press (Dumbbell)',
  'Bench Press (Dumbbell)',
  'Bench Press (Barbell)',
  'Pec Deck (Machine)',
  'Chest Fly (Dumbbell)',
  'Chest Fly (Cable)',
  'Chest Press (Machine)',
  'Seated Overhead Press (Dumbbell)',
  'Overhead Press (Barbell)',
  'Lateral Raise (Dumbbell)',
  'Lateral Raise (Cable)',
  'Front Raise (Dumbbell)',
  'Tricep Pushdown (Cable)',
  'Tricep Extension (Dumbbell)',
  'Skull Crusher (Barbell)',
  'Dip (Bodyweight)',
  'Push Up (Bodyweight)',
])

const PULL_EXERCISES = new Set([
  'Pendlay Row (Barbell)',
  'Bent Over Row (Barbell)',
  'Bent Over Row (Dumbbell)',
  'Lat Pulldown (Cable)',
  'Seated Row (Cable)',
  'Seated Row (Machine)',
  'Face Pull (Cable)',
  'Reverse Fly (Dumbbell)',
  'Reverse Fly (Machine)',
  'Pull Up (Bodyweight)',
  'Chin Up (Bodyweight)',
  'Shrug (Dumbbell)',
  'Shrug (Barbell)',
  'Bicep Curl (Dumbbell)',
  'Bicep Curl (Barbell)',
  'Bicep Curl (Cable)',
  'Hammer Curl (Dumbbell)',
  'Preacher Curl (Machine)',
])

const LEGS_EXERCISES = new Set([
  'Squat (Barbell)',
  'Front Squat (Barbell)',
  'Seated Leg Press (Machine)',
  'Leg Extension (Machine)',
  'Lying Leg Curl (Machine)',
  'Seated Leg Curl (Machine)',
  'Romanian Deadlift (Barbell)',
  'Romanian Deadlift (Dumbbell)',
  'Hip Thrust (Barbell)',
  'Hip Thrust (Machine)',
  'Calf Raise (Machine)',
  'Calf Raise (Dumbbell)',
  'Hack Squat (Machine)',
  'Bulgarian Split Squat (Dumbbell)',
  'Lunge (Dumbbell)',
  'Leg Abduction (Machine)',
  'Leg Adduction (Machine)',
  'Glute Kickback (Machine)',
])

type PPLCategory = 'push' | 'pull' | 'legs'

const CATEGORY_ACCENT: Record<PPLCategory, string> = {
  push: '#E85D24',
  pull: '#3B8BD4',
  legs: '#1D9E75',
}

const CATEGORY_LABEL: Record<PPLCategory, string> = {
  push: 'Push',
  pull: 'Pull',
  legs: 'Legs',
}

const TIME_FILTERS = [
  { label: '1 month',  months: 1    },
  { label: '3 months', months: 3    },
  { label: 'All time', months: null },
] as const
type TimeFilter = typeof TIME_FILTERS[number]

function fmtDate(dateStr: string) {
  return new Date(dateStr).toLocaleDateString('en-GB', { day: 'numeric', month: 'short' })
}

function shortName(name: string) {
  return name.replace(/\s*\(.*?\)/g, '')
}

// ── Infer category from workout type associations ─────────────────────────────

function inferCategory(
  exerciseId: number,
  sets: ExerciseSet[],
  workouts: Workout[],
): PPLCategory | null {
  const workoutMap = new Map(workouts.map(w => [w.id, w.type]))
  const counts: Record<PPLCategory, number> = { push: 0, pull: 0, legs: 0 }
  sets.forEach(s => {
    if (s.exerciseId !== exerciseId) return
    const type = workoutMap.get(s.workoutId) ?? ''
    if (type.includes('push')) counts.push++
    else if (type.includes('pull')) counts.pull++
    else if (type.includes('legs')) counts.legs++
  })
  const max = Math.max(counts.push, counts.pull, counts.legs)
  if (max === 0) return null
  if (counts.push === max) return 'push'
  if (counts.pull === max) return 'pull'
  return 'legs'
}

// ── Deduplication ─────────────────────────────────────────────────────────────
// Some exercises appear twice with different IDs (e.g. Seated Row x2).
// Keep the ID with the most set records; merge the rest under that ID.

function deduplicateExercises(
  exercises: Exercise[],
  sets: ExerciseSet[],
): { exercises: Exercise[]; sets: ExerciseSet[] } {
  // Group by normalised name
  const groups: Record<string, Exercise[]> = {}
  exercises.forEach(e => {
    const key = e.name.trim().toLowerCase()
    if (!groups[key]) groups[key] = []
    groups[key].push(e)
  })

  const idRemap = new Map<number, number>() // old id → canonical id

  const dedupedExercises: Exercise[] = []
  Object.values(groups).forEach(group => {
    if (group.length === 1) {
      dedupedExercises.push(group[0])
      return
    }
    // Pick the one with the most sets as the canonical
    const counts = group.map(e => ({ e, count: sets.filter(s => s.exerciseId === e.id).length }))
    counts.sort((a, b) => b.count - a.count)
    const canonical = counts[0].e
    dedupedExercises.push(canonical)
    counts.slice(1).forEach(({ e }) => idRemap.set(e.id, canonical.id))
  })

  const dedupedSets = sets.map(s => {
    const remapped = idRemap.get(s.exerciseId)
    return remapped ? { ...s, exerciseId: remapped } : s
  })

  return { exercises: dedupedExercises, sets: dedupedSets }
}

// ── Individual graph card ─────────────────────────────────────────────────────

function ExerciseGraph({
  exercise,
  workouts,
  sets,
  timeFilter,
  accent,
  visible,
  onToggle,
}: {
  exercise: Exercise
  workouts: Workout[]
  sets: ExerciseSet[]
  timeFilter: TimeFilter
  accent: string
  visible: boolean
  onToggle: () => void
}) {
  const canvasRef = useRef<HTMLCanvasElement>(null)
  const chartRef  = useRef<Chart | null>(null)

  const chartData = useMemo(() => {
    const cutoff = timeFilter.months ? new Date() : null
    if (cutoff) cutoff.setMonth(cutoff.getMonth() - timeFilter.months!)
    const filtered = cutoff
      ? workouts.filter(w => new Date(w.date) >= cutoff!)
      : workouts

    const best: Record<number, number> = {}
    sets.forEach(s => {
      if (s.exerciseId !== exercise.id) return
      if (!best[s.workoutId] || s.weight > best[s.workoutId])
        best[s.workoutId] = s.weight
    })

    const pts = [...filtered]
      .sort((a, b) => new Date(a.date).getTime() - new Date(b.date).getTime())
      .filter(w => best[w.id] !== undefined)
      .map(w => ({ label: fmtDate(w.date), value: best[w.id] }))

    return { labels: pts.map(p => p.label), data: pts.map(p => p.value) }
  }, [exercise.id, workouts, sets, timeFilter])

  useEffect(() => {
    if (!canvasRef.current || !chartData.data.length || !visible) return
    const isDark    = window.matchMedia('(prefers-color-scheme: dark)').matches
    const gridColor = isDark ? 'rgba(255,255,255,0.06)' : 'rgba(0,0,0,0.06)'
    const tickColor = isDark ? '#9c9a92' : '#73726c'
    const pointBg   = isDark ? '#242420' : '#ffffff'

    if (chartRef.current) chartRef.current.destroy()

    const vals = chartData.data
    chartRef.current = new Chart(canvasRef.current, {
      type: 'line',
      data: {
        labels: chartData.labels,
        datasets: [{
          data: vals,
          borderColor: accent,
          backgroundColor: accent + '15',
          borderWidth: 2,
          pointRadius: 4,
          pointBackgroundColor: accent,
          pointBorderColor: pointBg,
          pointBorderWidth: 1.5,
          tension: 0.3,
          fill: true,
        }],
      },
      options: {
        responsive: true,
        maintainAspectRatio: false,
        plugins: {
          legend: { display: false },
          tooltip: { callbacks: { label: ctx => ` ${ctx.raw} kg` } },
        },
        scales: {
          x: {
            ticks: { color: tickColor, font: { size: 10 }, autoSkip: true, maxTicksLimit: 6, maxRotation: 0 },
            grid: { display: false },
            border: { display: false },
          },
          y: {
            suggestedMin: Math.min(...vals) - 4,
            suggestedMax: Math.max(...vals) + 4,
            ticks: { color: tickColor, font: { size: 10 }, callback: v => `${v}kg` },
            grid: { color: gridColor },
            border: { display: false },
          },
        },
      },
    })
    return () => { chartRef.current?.destroy() }
  }, [chartData, accent, visible])

  const hasData = chartData.data.length > 0
  const pr      = hasData ? Math.max(...chartData.data) : null

  return (
    <div className={`exercise-graph-card ${!visible ? 'graph-hidden' : ''}`}>
      {/* Header row */}
      <div className="graph-card-header">
        <div className="graph-card-title-group">
          <p className="graph-card-title">{shortName(exercise.name)}</p>
          {pr !== null && visible && (
            <span className="graph-card-pr" style={{ color: accent }}>PR {pr}kg</span>
          )}
        </div>
        <button
          className={`graph-visibility-btn ${visible ? 'shown' : 'hidden'}`}
          onClick={onToggle}
          aria-label={visible ? 'Hide graph' : 'Show graph'}
          title={visible ? 'Hide' : 'Show'}
        >
          {visible ? (
            // Eye open
            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
              <path d="M1 12s4-8 11-8 11 8 11 8-4 8-11 8-11-8-11-8z"/>
              <circle cx="12" cy="12" r="3"/>
            </svg>
          ) : (
            // Eye off
            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
              <path d="M17.94 17.94A10.07 10.07 0 0 1 12 20c-7 0-11-8-11-8a18.45 18.45 0 0 1 5.06-5.94"/>
              <path d="M9.9 4.24A9.12 9.12 0 0 1 12 4c7 0 11 8 11 8a18.5 18.5 0 0 1-2.16 3.19"/>
              <line x1="1" y1="1" x2="23" y2="23"/>
            </svg>
          )}
        </button>
      </div>

      {/* Chart area — only rendered when visible */}
      {visible && (
        <div className="graph-chart-area">
          {!hasData ? (
            <div className="graph-empty">No data for this period</div>
          ) : (
            <div className="graph-canvas-wrap">
              <canvas ref={canvasRef} />
            </div>
          )}
        </div>
      )}
    </div>
  )
}

// ── Main ─────────────────────────────────────────────────────────────────────

interface InsightsClientProps {
  workouts:  Workout[]
  sets:      ExerciseSet[]
  exercises: Exercise[]
}

export default function InsightsClient({ workouts, sets, exercises }: InsightsClientProps) {
  const [timeFilter, setTimeFilter] = useState<TimeFilter>(TIME_FILTERS[2])

  // Deduplicate exercises & remap sets
  const { exercises: dedupExercises, sets: dedupSets } = useMemo(
    () => deduplicateExercises(exercises, sets),
    [exercises, sets]
  )

  // Categorise each exercise
  const categorised = useMemo<Record<PPLCategory, Exercise[]>>(() => {
    const result: Record<PPLCategory, Exercise[]> = { push: [], pull: [], legs: [] }

    dedupExercises.forEach(e => {
      // Check explicit map first
      const name = e.name
      let cat: PPLCategory | null = null
      if (PUSH_EXERCISES.has(name)) cat = 'push'
      else if (PULL_EXERCISES.has(name)) cat = 'pull'
      else if (LEGS_EXERCISES.has(name)) cat = 'legs'
      else cat = inferCategory(e.id, dedupSets, workouts)

      if (!cat) return

      // Only include if this exercise actually has data
      const hasData = dedupSets.some(s => s.exerciseId === e.id)
      if (!hasData) return

      result[cat].push(e)
    })

    // Sort each category alphabetically by short name
    ;(['push', 'pull', 'legs'] as PPLCategory[]).forEach(cat => {
      result[cat].sort((a, b) => shortName(a.name).localeCompare(shortName(b.name)))
    })

    return result
  }, [dedupExercises, dedupSets, workouts])

  // Visibility state keyed by exercise id
  const [visibility, setVisibility] = useState<Record<number, boolean>>({})

  // Initialise visibility once exercises are known
  useEffect(() => {
    setVisibility(prev => {
      const next = { ...prev }
      dedupExercises.forEach(e => {
        if (next[e.id] === undefined) next[e.id] = true
      })
      return next
    })
  }, [dedupExercises])

  const toggleVisibility = (id: number) => {
    setVisibility(prev => ({ ...prev, [id]: !prev[id] }))
  }

  const toggleAll = (cat: PPLCategory, show: boolean) => {
    setVisibility(prev => {
      const next = { ...prev }
      categorised[cat].forEach(e => { next[e.id] = show })
      return next
    })
  }

  const categories: PPLCategory[] = ['push', 'pull', 'legs']

  return (
    <div className="page-content">

      {/* ── Global time filter ── */}
      <div className="insights-top-bar">
        <h1 className="insights-page-title">Exercise Graphs</h1>
        <div className="toggle-group">
          {TIME_FILTERS.map(tf => (
            <button
              key={tf.label}
              className={`toggle-btn ${timeFilter.label === tf.label ? 'active' : ''}`}
              onClick={() => setTimeFilter(tf)}
            >
              {tf.label}
            </button>
          ))}
        </div>
      </div>

      {/* ── PPL sections ── */}
      {categories.map(cat => {
        const exs      = categorised[cat]
        if (exs.length === 0) return null
        const accent   = CATEGORY_ACCENT[cat]
        const allShown = exs.every(e => visibility[e.id] !== false)
        const anyShown = exs.some(e => visibility[e.id] !== false)

        return (
          <section key={cat} className="insights-graph-section">
            {/* Section header */}
            <div className="graph-section-header">
              <div className="graph-section-title-row">
                <span className="graph-section-dot" style={{ background: accent }} />
                <h2 className="graph-section-title" style={{ color: accent }}>
                  {CATEGORY_LABEL[cat]}
                </h2>
                <span className="graph-section-count">{exs.length} exercises</span>
              </div>
              {/* Bulk show/hide */}
              <div className="graph-section-bulk">
                <button
                  className="graph-bulk-btn"
                  onClick={() => toggleAll(cat, true)}
                  disabled={allShown}
                >
                  Show all
                </button>
                <button
                  className="graph-bulk-btn"
                  onClick={() => toggleAll(cat, false)}
                  disabled={!anyShown}
                >
                  Hide all
                </button>
              </div>
            </div>

            {/* Graph grid — visible first, hidden sink to bottom */}
            <div className="exercise-graph-grid">
              {[...exs].sort((a, b) => {
                const aVis = visibility[a.id] !== false ? 0 : 1
                const bVis = visibility[b.id] !== false ? 0 : 1
                return aVis - bVis
              }).map(e => (
                <ExerciseGraph
                  key={e.id}
                  exercise={e}
                  workouts={workouts}
                  sets={dedupSets}
                  timeFilter={timeFilter}
                  accent={accent}
                  visible={visibility[e.id] !== false}
                  onToggle={() => toggleVisibility(e.id)}
                />
              ))}
            </div>
          </section>
        )
      })}

    </div>
  )
}