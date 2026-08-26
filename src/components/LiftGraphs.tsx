'use client'

import { useState, useEffect, useRef, useMemo } from 'react'
import { Chart, registerables } from 'chart.js'
import type { Workout, ExerciseSet, Exercise } from '@/lib/data'
import UploadWorkout from '@/components/UploadWorkout'

Chart.register(...registerables)

// ── Category inference ────────────────────────────────────────────────────
// Every exercise lands in exactly one of the three sections. Each is bucketed
// by whichever of push/pull/legs it was most often logged under historically.
// Sessions labelled something else (upper, evening workout, afternoon workout)
// don't count as a vote either way.

type Category = 'push' | 'pull' | 'legs'

const CATEGORY_ORDER: Category[] = ['push', 'pull', 'legs']

const CATEGORY_ACCENT: Record<Category, string> = {
  push: '#F5C518',
  pull: '#4A9ECC',
  legs: '#8DB548',
}

const CATEGORY_LABEL: Record<Category, string> = {
  push: 'Push',
  pull: 'Pull',
  legs: 'Legs',
}

// A few exercises were only ever logged on ambiguously-named days (evening
// workout, afternoon workout) and so have zero push/pull/legs voting signal
// from history. Classify those by what they actually train.
const CATEGORY_OVERRIDE: Record<string, Category> = {
  'Bent Over Row (Barbell)': 'pull',
  'Reverse Curl (Barbell)': 'pull',
  'Front Raise (Cable)': 'push',
}

function inferCategory(exercise: Exercise, sets: ExerciseSet[], workouts: Workout[]): Category {
  const typeById = new Map(workouts.map(w => [w.id, w.type]))
  const counts = { push: 0, pull: 0, legs: 0 }

  for (const s of sets) {
    if (s.exerciseId !== exercise.id) continue
    const type = typeById.get(s.workoutId) ?? ''
    if (type.includes('push')) counts.push++
    else if (type.includes('pull')) counts.pull++
    else if (type.includes('legs')) counts.legs++
  }

  const max = Math.max(counts.push, counts.pull, counts.legs)
  if (max === 0) return CATEGORY_OVERRIDE[exercise.name] ?? 'push'
  if (counts.push === max) return 'push'
  if (counts.pull === max) return 'pull'
  return 'legs'
}

// ── Helpers ──────────────────────────────────────────────────────────────

function fmtDate(isoDate: string) {
  return new Date(isoDate).toLocaleDateString('en-GB', { day: 'numeric', month: 'short' })
}

function shortName(name: string) {
  return name.replace(/\s*\(.*?\)/g, '')
}

interface SeriesPoint {
  date: string
  label: string
  value: number
}

// Top set weight per session, sorted chronologically, within [from, to].
function topSetSeries(
  exerciseId: number,
  sets: ExerciseSet[],
  workouts: Workout[],
  from: string,
  to: string,
): SeriesPoint[] {
  const bestByWorkout = new Map<number, number>()
  for (const s of sets) {
    if (s.exerciseId !== exerciseId) continue
    const prev = bestByWorkout.get(s.workoutId)
    if (prev === undefined || s.weight > prev) bestByWorkout.set(s.workoutId, s.weight)
  }

  return workouts
    .filter(w => w.date >= from && w.date <= to && bestByWorkout.has(w.id))
    .sort((a, b) => a.date.localeCompare(b.date))
    .map(w => ({ date: w.date, label: fmtDate(w.date), value: bestByWorkout.get(w.id)! }))
}

// ── Individual graph card ───────────────────────────────────────────────────

function ExerciseGraph({
  exercise,
  series,
  accent,
}: {
  exercise: Exercise
  series: SeriesPoint[]
  accent: string
}) {
  const canvasRef = useRef<HTMLCanvasElement>(null)
  const chartRef = useRef<Chart | null>(null)

  useEffect(() => {
    if (!canvasRef.current || series.length === 0) return

    if (chartRef.current) chartRef.current.destroy()

    const vals = series.map(p => p.value)
    chartRef.current = new Chart(canvasRef.current, {
      type: 'line',
      data: {
        labels: series.map(p => p.label),
        datasets: [{
          data: vals,
          borderColor: accent,
          backgroundColor: accent + '15',
          borderWidth: 2,
          pointRadius: 4,
          pointBackgroundColor: accent,
          pointBorderColor: '#0e0e0c',
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
            ticks: { color: '#9c9a92', font: { size: 10 }, autoSkip: true, maxTicksLimit: 6, maxRotation: 0 },
            grid: { display: false },
            border: { display: false },
          },
          y: {
            suggestedMin: Math.min(...vals) - 4,
            suggestedMax: Math.max(...vals) + 4,
            ticks: { color: '#9c9a92', font: { size: 10 }, callback: v => `${v}kg` },
            grid: { color: 'rgba(255,255,255,0.06)' },
            border: { display: false },
          },
        },
      },
    })

    return () => { chartRef.current?.destroy() }
  }, [series, accent])

  const pr = series.length ? Math.max(...series.map(p => p.value)) : null

  return (
    <div className="exercise-graph-card">
      <div className="graph-card-header">
        <div className="graph-card-title-group">
          <p className="graph-card-title">{shortName(exercise.name)}</p>
          {pr !== null && <span className="graph-card-pr" style={{ color: accent }}>PR {pr}kg</span>}
        </div>
      </div>
      <div className="graph-chart-area">
        {series.length === 0 ? (
          <div className="graph-empty">No data for this range</div>
        ) : (
          <div className="graph-canvas-wrap">
            <canvas ref={canvasRef} />
          </div>
        )}
      </div>
    </div>
  )
}

// ── Section (one per push / pull / legs) ────────────────────────────────────
// Each section owns its own filters — min sessions logged, exercise search,
// date range — independent of the other two sections.

function CategorySection({
  category,
  exercises,
  sets,
  workouts,
  accent,
  minDate,
  maxDate,
}: {
  category: Category
  exercises: Exercise[]
  sets: ExerciseSet[]
  workouts: Workout[]
  accent: string
  minDate: string
  maxDate: string
}) {
  const [minSessions, setMinSessions] = useState(3)

  const cards = exercises
    .map(e => ({ exercise: e, series: topSetSeries(e.id, sets, workouts, minDate, maxDate) }))
    .filter(({ series }) => series.length > minSessions)

  const idPrefix = `${category}`

  return (
    <section className="insights-graph-section">
      <div className="graph-section-header">
        <div className="graph-section-title-row">
          <span className="graph-section-dot" style={{ background: accent }} />
          <h2 className="graph-section-title" style={{ color: accent }}>{CATEGORY_LABEL[category]}</h2>
          <span className="graph-section-count">{cards.length} of {exercises.length} exercises</span>
        </div>
      </div>

      <div className="filter-bar">
        <div className="filter-field">
          <label className="filter-label" htmlFor={`${idPrefix}-min-sessions`}>Min sessions (&gt;)</label>
          <input
            id={`${idPrefix}-min-sessions`}
            className="filter-input filter-input--narrow"
            type="number"
            min={0}
            value={minSessions}
            onChange={e => setMinSessions(Math.max(0, Number(e.target.value) || 0))}
          />
        </div>
      </div>

      <div className="exercise-graph-grid">
        {cards.length === 0 ? (
          <div className="graph-empty">No lifts match these filters</div>
        ) : (
          cards.map(({ exercise, series }) => (
            <ExerciseGraph key={exercise.id} exercise={exercise} series={series} accent={accent} />
          ))
        )}
      </div>
    </section>
  )
}

// ── Main ─────────────────────────────────────────────────────────────────

interface LiftGraphsProps {
  workouts: Workout[]
  sets: ExerciseSet[]
  exercises: Exercise[]
}

export default function LiftGraphs({ workouts, sets, exercises }: LiftGraphsProps) {
  const { minDate, maxDate } = useMemo(() => {
    if (workouts.length === 0) return { minDate: '', maxDate: '' }
    const dates = workouts.map(w => w.date).sort()
    return { minDate: dates[0], maxDate: dates[dates.length - 1] }
  }, [workouts])

  // Categorise every exercise once, from full history — always push, pull, or legs.
  const categorised = useMemo(() => {
    const byCategory: Record<Category, Exercise[]> = { push: [], pull: [], legs: [] }
    for (const e of exercises) {
      if (!sets.some(s => s.exerciseId === e.id)) continue
      byCategory[inferCategory(e, sets, workouts)].push(e)
    }
    for (const cat of CATEGORY_ORDER) {
      byCategory[cat].sort((a, b) => shortName(a.name).localeCompare(shortName(b.name)))
    }
    return byCategory
  }, [exercises, sets, workouts])

  return (
    <div className="page-content">
      <div className="insights-top-bar">
        <h1 className="insights-page-title">Lift Progress</h1>
        <UploadWorkout />
      </div>

      {CATEGORY_ORDER.map(cat => (
        <CategorySection
          key={cat}
          category={cat}
          exercises={categorised[cat]}
          sets={sets}
          workouts={workouts}
          accent={CATEGORY_ACCENT[cat]}
          minDate={minDate}
          maxDate={maxDate}
        />
      ))}
    </div>
  )
}
