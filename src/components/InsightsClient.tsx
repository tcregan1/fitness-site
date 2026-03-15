'use client'

import { useState, useEffect, useRef, useMemo } from 'react'
import { Chart, registerables } from 'chart.js'
import type { InsightsData, WorkoutCategory, OverloadTarget } from '@/lib/insights'
import type { Workout, ExerciseSet, Exercise } from '@/lib/sheets'

Chart.register(...registerables)

interface InsightsClientProps {
  insights:  InsightsData
  workouts:  Workout[]
  sets:      ExerciseSet[]
  exercises: Exercise[]
}

const CATEGORY_TABS: { label: string; value: WorkoutCategory | 'all' }[] = [
  { label: 'All',  value: 'all'  },
  { label: 'Push', value: 'push' },
  { label: 'Pull', value: 'pull' },
  { label: 'Legs', value: 'legs' },
]

const CATEGORY_LIFTS: Record<WorkoutCategory, string[]> = {
  push: ['Incline Bench Press (Dumbbell)', 'Bench Press (Dumbbell)', 'Pec Deck (Machine)', 'Seated Overhead Press (Dumbbell)', 'Lateral Raise (Dumbbell)'],
  pull: ['Pendlay Row (Barbell)', 'Bent Over Row (Barbell)', 'Lat Pulldown (Cable)', 'Seated Row (Machine)', 'Seated Row (Cable)'],
  legs: ['Squat (Barbell)', 'Seated Leg Press (Machine)', 'Leg Extension (Machine)', 'Lying Leg Curl (Machine)'],
}

const STATUS_COLORS: Record<OverloadTarget['status'], string> = {
  increase_weight: 'var(--color-success)',
  increase_reps:   'var(--color-warning)',
  maintain:        'var(--text-tertiary)',
}

const STATUS_LABELS: Record<OverloadTarget['status'], string> = {
  increase_weight: 'Add weight',
  increase_reps:   'Add reps',
  maintain:        'Maintain',
}

const STATUS_TOOLTIPS: Record<OverloadTarget['status'], string> = {
  increase_weight: 'You hit your target reps on all sets last session. Add 2.5kg next time and aim for the same rep count.',
  increase_reps:   'You got close to your target reps but not all sets. Keep the same weight and aim to complete every set before adding load.',
  maintain:        'Reps were well below target last session. Focus on consistency and technique at this weight before progressing.',
}

const CATEGORY_ACCENT: Record<WorkoutCategory, string> = {
  push: '#E85D24',
  pull: '#3B8BD4',
  legs: '#1D9E75',
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

// ── Info tooltip ──────────────────────────────────────────────────────────────

function InfoTooltip({ text }: { text: string }) {
  const [open, setOpen] = useState(false)
  const ref = useRef<HTMLDivElement>(null)

  useEffect(() => {
    if (!open) return
    const handle = (e: MouseEvent) => {
      if (ref.current && !ref.current.contains(e.target as Node)) setOpen(false)
    }
    document.addEventListener('mousedown', handle)
    return () => document.removeEventListener('mousedown', handle)
  }, [open])

  return (
    <div className="tooltip-wrap" ref={ref}>
      <button className="tooltip-trigger" onClick={() => setOpen(o => !o)} aria-label="More info">ⓘ</button>
      {open && <div className="tooltip-box">{text}</div>}
    </div>
  )
}

// ── Mini lift chart ───────────────────────────────────────────────────────────

function MiniChart({ liftName, workouts, sets, exercises, timeFilter, accent }: {
  liftName: string; workouts: Workout[]; sets: ExerciseSet[]
  exercises: Exercise[]; timeFilter: TimeFilter; accent: string
}) {
  const canvasRef = useRef<HTMLCanvasElement>(null)
  const chartRef  = useRef<Chart | null>(null)

  const exerciseId = useMemo(() => exercises.find(e => e.name === liftName)?.id, [exercises, liftName])

  const chartData = useMemo(() => {
    if (!exerciseId) return { labels: [], data: [] }
    const cutoff = timeFilter.months ? new Date() : null
    if (cutoff) cutoff.setMonth(cutoff.getMonth() - timeFilter.months!)
    const filtered = cutoff ? workouts.filter(w => new Date(w.date) >= cutoff!) : workouts
    const best: Record<number, number> = {}
    sets.forEach(s => {
      if (s.exerciseId === exerciseId && (!best[s.workoutId] || s.weight > best[s.workoutId]))
        best[s.workoutId] = s.weight
    })
    const pts = [...filtered]
      .sort((a, b) => new Date(a.date).getTime() - new Date(b.date).getTime())
      .filter(w => best[w.id] !== undefined)
      .map(w => ({ label: fmtDate(w.date), value: best[w.id] }))
    return { labels: pts.map(p => p.label), data: pts.map(p => p.value) }
  }, [exerciseId, workouts, sets, timeFilter])

  useEffect(() => {
    if (!canvasRef.current || !chartData.data.length) return
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
          backgroundColor: accent + '12',
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
        responsive: true, maintainAspectRatio: false,
        plugins: { legend: { display: false }, tooltip: { callbacks: { label: ctx => ` ${ctx.raw} kg` } } },
        scales: {
          x: { ticks: { color: tickColor, font: { size: 10 }, autoSkip: true, maxTicksLimit: 5, maxRotation: 0 }, grid: { display: false }, border: { display: false } },
          y: { suggestedMin: Math.min(...vals) - 4, suggestedMax: Math.max(...vals) + 4, ticks: { color: tickColor, font: { size: 10 }, callback: v => `${v}kg` }, grid: { color: gridColor }, border: { display: false } },
        },
      },
    })
    return () => { chartRef.current?.destroy() }
  }, [chartData, accent])

  if (!chartData.data.length) return null

  return (
    <div className="mini-chart-card">
      <p className="mini-chart-title">{liftName.replace(/\s*\(.*?\)/g, '')}</p>
      <div className="mini-chart-wrap"><canvas ref={canvasRef} /></div>
    </div>
  )
}

// ── Main ─────────────────────────────────────────────────────────────────────

export default function InsightsClient({ insights, workouts, sets, exercises }: InsightsClientProps) {
  const { overloadTargets, streak } = insights
  const [activeTab,  setActiveTab]  = useState<WorkoutCategory | 'all'>('all')
  const [timeFilter, setTimeFilter] = useState<TimeFilter>(TIME_FILTERS[2])

  const filteredTargets = activeTab === 'all'
    ? overloadTargets
    : overloadTargets.filter(t => t.category === activeTab)

  const graphCategories: WorkoutCategory[] =
    activeTab === 'all' ? ['push', 'pull', 'legs'] : [activeTab]

  // ── Build 3 meaningful insight cards ──────────────────────────────────────

  // Card 1: Most ready to progress (highest priority overload target)
  const nextUp = overloadTargets.find(t => t.status === 'increase_weight')
    ?? overloadTargets.find(t => t.status === 'increase_reps')

  // Card 2: Weakest lift — the one with the biggest gap between current weight and where it should be
  // Proxy: maintain status + lowest weight relative to its own PR
  const weakest = [...overloadTargets]
    .filter(t => t.status === 'maintain')
    .sort((a, b) => (a.targetWeight / a.currentPR) - (b.targetWeight / b.currentPR))[0]
    ?? overloadTargets.find(t => t.status === 'increase_reps')

  // Card 3: Which category hasn't been trained recently
  const sortedWorkouts = [...workouts].sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime())
  const lastPush = sortedWorkouts.find(w => w.type.includes('push'))
  const lastPull = sortedWorkouts.find(w => w.type.includes('pull'))
  const lastLegs = sortedWorkouts.find(w => w.type.includes('legs'))

  function daysSince(w: typeof lastPush) {
    if (!w) return 999
    return Math.floor((Date.now() - new Date(w.date).getTime()) / 86400000)
  }

  const pushDays = daysSince(lastPush)
  const pullDays = daysSince(lastPull)
  const legsDays = daysSince(lastLegs)

  const neglectedCat = pushDays >= pullDays && pushDays >= legsDays ? { name: 'Push', days: pushDays, color: CATEGORY_ACCENT.push } :
                       pullDays >= legsDays ? { name: 'Pull', days: pullDays, color: CATEGORY_ACCENT.pull } :
                       { name: 'Legs', days: legsDays, color: CATEGORY_ACCENT.legs }

  const neglectedMsg = neglectedCat.days > 6
    ? `Your last ${neglectedCat.name.toLowerCase()} session was ${neglectedCat.days} days ago. Schedule one soon to keep your split balanced.`
    : `Your ${neglectedCat.name.toLowerCase()} session was ${neglectedCat.days} days ago — you're on track.`

  const neglectedAccent = neglectedCat.days > 6 ? 'var(--color-warning)' : 'var(--color-success)'

  return (
    <div className="page-content">

      {/* ── Top 3 insight cards ── */}
      <div className="top-insights-grid">

        {nextUp && (
          <div className="insight-card" style={{ borderTopColor: STATUS_COLORS[nextUp.status] }}>
            <div className="insight-card-header">
              <p className="insight-card-label">Up next</p>
              <InfoTooltip text={STATUS_TOOLTIPS[nextUp.status]} />
            </div>
            <p className="insight-card-value" style={{ color: STATUS_COLORS[nextUp.status] }}>
              {nextUp.targetWeight}kg
            </p>
            <p className="insight-card-name">{nextUp.exerciseName.replace(/\s*\(.*?\)/g, '')}</p>
            <p className="insight-card-body">{nextUp.message}</p>
          </div>
        )}

        {weakest && weakest.exerciseName !== nextUp?.exerciseName && (
          <div className="insight-card" style={{ borderTopColor: 'var(--color-danger)' }}>
            <div className="insight-card-header">
              <p className="insight-card-label">Needs work</p>
              <InfoTooltip text="This lift is furthest from progression. Focus on form and consistency before adding weight." />
            </div>
            <p className="insight-card-value" style={{ color: 'var(--color-danger)' }}>
              {weakest.targetWeight}kg
            </p>
            <p className="insight-card-name">{weakest.exerciseName.replace(/\s*\(.*?\)/g, '')}</p>
            <p className="insight-card-body">{weakest.message}</p>
          </div>
        )}

        <div className="insight-card" style={{ borderTopColor: neglectedAccent }}>
          <div className="insight-card-header">
            <p className="insight-card-label">{neglectedCat.name} session</p>
            <InfoTooltip text="Tracks how many days since your last push, pull and legs session, and flags the one you've left longest." />
          </div>
          <p className="insight-card-value" style={{ color: neglectedAccent }}>
            {neglectedCat.days}d ago
          </p>
          <p className="insight-card-name">
            {streak.daysSinceLast === 0 ? 'Trained today' : `Last session ${fmtDate(streak.lastWorkout)}`}
          </p>
          <p className="insight-card-body">{neglectedMsg}</p>
        </div>

      </div>

      {/* ── Progressive overload targets ── */}
      <section className="insights-section">
        <div className="overload-header-row">
          <h2 className="section-title" style={{ marginBottom: 0 }}>Progressive overload targets</h2>
          <div className="category-tabs">
            {CATEGORY_TABS.map(tab => (
              <button
                key={tab.value}
                className={`category-tab ${activeTab === tab.value ? 'active' : ''} ${tab.value !== 'all' ? tab.value : ''}`}
                onClick={() => setActiveTab(tab.value)}
              >
                {tab.label}
                <span className="tab-count">
                  {tab.value === 'all'
                    ? overloadTargets.length
                    : overloadTargets.filter(t => t.category === tab.value).length}
                </span>
              </button>
            ))}
          </div>
        </div>

        <div className="overload-list">
          {filteredTargets.length === 0 && (
            <p className="empty-state">No exercises for this category yet.</p>
          )}
          {filteredTargets.map(target => {
            const shortName   = target.exerciseName.replace(/\s*\(.*?\)/g, '')
            const statusColor = STATUS_COLORS[target.status]
            return (
              <div key={target.exerciseName} className="overload-card">
                <div className="overload-top">
                  <div className="overload-left">
                    <p className="overload-name">{shortName}</p>
                    <p className="overload-message">{target.message}</p>
                  </div>
                  <div className="overload-right">
                    <p className="overload-target" style={{ color: statusColor }}>{target.targetWeight}kg</p>
                    <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                      <span className="overload-badge" style={{ color: statusColor, borderColor: statusColor }}>
                        {STATUS_LABELS[target.status]}
                      </span>
                      <InfoTooltip text={STATUS_TOOLTIPS[target.status]} />
                    </div>
                  </div>
                </div>
                <div className="overload-meta">
                  <span>PR: {target.currentPR}kg</span>
                  <span>Target: {target.targetReps} reps</span>
                  <span>Last: {new Date(target.lastSession).toLocaleDateString('en-GB', { day: 'numeric', month: 'short' })}</span>
                </div>
              </div>
            )
          })}
        </div>
      </section>

      {/* ── Lift progression graphs ── */}
      <section className="insights-section">
        <div className="overload-header-row">
          <h2 className="section-title" style={{ marginBottom: 0 }}>Lift progression</h2>
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

        {graphCategories.map(cat => (
          <div key={cat} className="category-graph-group">
            <p className="category-graph-label" style={{ color: CATEGORY_ACCENT[cat] }}>
              {cat.charAt(0).toUpperCase() + cat.slice(1)}
            </p>
            <div className="mini-charts-grid">
              {CATEGORY_LIFTS[cat].map(liftName => (
                <MiniChart
                  key={liftName}
                  liftName={liftName}
                  workouts={workouts}
                  sets={sets}
                  exercises={exercises}
                  timeFilter={timeFilter}
                  accent={CATEGORY_ACCENT[cat]}
                />
              ))}
            </div>
          </div>
        ))}
      </section>

    </div>
  )
}