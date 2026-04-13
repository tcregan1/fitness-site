'use client'

import { useState, useMemo, useEffect, useRef } from 'react'
import { Chart, registerables } from 'chart.js'
import type { Workout, ExerciseSet, Exercise } from '@/lib/sheets'

Chart.register(...registerables)

// Lifts shown as toggle pills — order = display order
const SELECTOR_LIFTS = [
  'Incline Bench Press (Dumbbell)',
  'Squat (Barbell)',
  'Bent Over Row (Barbell)',
  'Pendlay Row (Barbell)',
  'Seated Leg Press (Machine)',
  'Lat Pulldown (Cable)',
  'Seated Overhead Press (Dumbbell)',
]

const TIME_FILTERS = [
  { label: '1 month', months: 1 },
  { label: '3 months', months: 3 },
  { label: '6 months', months: 6 },
  { label: 'All time', months: null },
] as const

type TimeFilter = typeof TIME_FILTERS[number]

interface LiftProgressionProps {
  workouts: Workout[]
  sets: ExerciseSet[]
  exercises: Exercise[]
}

function fmtDate(dateStr: string) {
  return new Date(dateStr).toLocaleDateString('en-GB', {
    day: 'numeric',
    month: 'short',
  })
}

export default function LiftProgression({ workouts, sets, exercises }: LiftProgressionProps) {
  const canvasRef = useRef<HTMLCanvasElement>(null)
  const chartRef = useRef<Chart | null>(null)

  const [activeLift, setActiveLift] = useState(SELECTOR_LIFTS[0])
  const [timeFilter, setTimeFilter] = useState<TimeFilter>(TIME_FILTERS[3])

  const exerciseMap = useMemo(
    () => new Map(exercises.map(e => [e.name, e.id])),
    [exercises]
  )

  // Filter workouts by selected time window
  const filteredWorkouts = useMemo(() => {
    if (!timeFilter.months) return workouts
    const cutoff = new Date()
    cutoff.setMonth(cutoff.getMonth() - timeFilter.months)
    return workouts.filter(w => new Date(w.date) >= cutoff)
  }, [workouts, timeFilter])

  // Build data points: best weight per session for the active lift
  const chartData = useMemo(() => {
    const eid = exerciseMap.get(activeLift)
    if (!eid) return { labels: [], data: [] }

    const bestByWorkout: Record<number, number> = {}
    sets.forEach(s => {
      if (s.exerciseId === eid) {
        if (!bestByWorkout[s.workoutId] || s.weight > bestByWorkout[s.workoutId]) {
          bestByWorkout[s.workoutId] = s.weight
        }
      }
    })

    const points = filteredWorkouts
      .filter(w => bestByWorkout[w.id] !== undefined)
      .map(w => ({ label: fmtDate(w.date), value: bestByWorkout[w.id] }))

    return {
      labels: points.map(p => p.label),
      data: points.map(p => p.value),
    }
  }, [activeLift, filteredWorkouts, sets, exerciseMap])

  // Determine which lifts actually have data so we can hide empty toggles
  const availableLifts = useMemo(() => {
    return SELECTOR_LIFTS.filter(name => {
      const eid = exerciseMap.get(name)
      return eid && sets.some(s => s.exerciseId === eid)
    })
  }, [sets, exerciseMap])

  // Draw / update chart
  useEffect(() => {
    if (!canvasRef.current) return

    // Destroy BEFORE creating — prevents the cleanup killing the new instance
    if (chartRef.current) {
      chartRef.current.destroy()
      chartRef.current = null
    }

    const vals = chartData.data
    if (vals.length === 0) return

    const isDark =
      document.documentElement.classList.contains('dark') ||
      window.matchMedia('(prefers-color-scheme: dark)').matches
    const gridColor = isDark ? 'rgba(255,255,255,0.06)' : 'rgba(0,0,0,0.06)'
    const tickColor = isDark ? '#9c9a92' : '#73726c'
    const pointBg   = isDark ? '#1a1a18' : '#ffffff'

    const min = Math.min(...vals)
    const max = Math.max(...vals)

    chartRef.current = new Chart(canvasRef.current, {
      type: 'line',
      data: {
        labels: chartData.labels,
        datasets: [
          {
            data: vals,
            borderColor: '#E85D24',
            backgroundColor: 'rgba(232,93,36,0.07)',
            borderWidth: 2,
            pointRadius: 5,
            pointBackgroundColor: '#E85D24',
            pointBorderColor: pointBg,
            pointBorderWidth: 2,
            tension: 0.3,
            fill: true,
          },
        ],
      },
      options: {
        responsive: true,
        maintainAspectRatio: false,
        plugins: {
          legend: { display: false },
          tooltip: {
            callbacks: { label: ctx => ` ${ctx.raw} kg` },
          },
        },
        scales: {
          x: {
            ticks: {
              color: tickColor,
              font: { size: 11 },
              autoSkip: true,      // was false — caused overflow with more data points
              maxTicksLimit: 10,   // cap labels so they don't crash the render
              maxRotation: 30,
            },
            grid: { display: false },
            border: { display: false },
          },
          y: {
            suggestedMin: min - 4,
            suggestedMax: max + 4,
            ticks: { color: tickColor, font: { size: 11 }, callback: v => `${v} kg` },
            grid: { color: gridColor },
            border: { display: false },
          },
        },
      },
    })

    return () => {
      chartRef.current?.destroy()
      chartRef.current = null
    }
  }, [chartData])

  const shortName = (name: string) => name.replace(/\s*\(.*?\)/g, '')

  return (
    <div className="card">
      <div className="lift-header">
        <p className="card-title">Lift progression</p>
        {/* Time filter */}
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

      {/* Lift selector */}
      <div className="lift-selector">
        {availableLifts.map(name => (
          <button
            key={name}
            className={`lift-btn ${activeLift === name ? 'active' : ''}`}
            onClick={() => setActiveLift(name)}
          >
            {shortName(name)}
          </button>
        ))}
      </div>

      {/* Chart */}
      <div className="chart-wrap">
        {chartData.data.length === 0 ? (
          <div className="chart-empty">No data for this period</div>
        ) : (
          <canvas ref={canvasRef} />
        )}
      </div>
    </div>
  )
}