'use client'

import { useEffect, useState } from 'react'
import type { Workout, ExerciseSet, Exercise } from '@/lib/data'
import { buildWorkoutsCsv, downloadCsv } from '@/lib/exportCsv'

type Goal = 'cutting' | 'maintaining' | 'bulking'

const GOALS: { key: Goal; label: string }[] = [
  { key: 'cutting', label: 'Cutting' },
  { key: 'maintaining', label: 'Maintaining' },
  { key: 'bulking', label: 'Bulking' },
]

const GOAL_BLURB: Record<Goal, string> = {
  cutting:
    "I'm currently cutting (eating in a calorie deficit) and want to hold on to as much strength and muscle as possible while losing fat. Tell me if my programming looks at risk of unnecessary muscle/strength loss, whether volume or intensity should change, and flag any lifts that seem to be stalling because of the deficit.",
  maintaining:
    "I'm currently maintaining — eating around maintenance calories, with the goal of holding my current strength and physique steady while staying consistent. Tell me if my programming looks well balanced, flag anything that looks stagnant, and suggest small tweaks to volume, intensity, or exercise variety if useful.",
  bulking:
    "I'm currently bulking (eating in a calorie surplus) with the goal of maximizing muscle and strength gains. Tell me if I'm progressing fast enough to justify the surplus, whether I should push volume or intensity harder, and flag any lifts that aren't progressing despite the extra calories.",
}

interface Profile {
  age: string
  height: string
  weight: string
  notes: string
  goal: Goal
}

const DEFAULT_PROFILE: Profile = {
  age: '21',
  height: "6'0\"",
  weight: '',
  notes: '',
  goal: 'cutting',
}

const STORAGE_KEY = 'fitness-site-llm-profile'

function buildPrompt(profile: Profile): string {
  const weightLine = profile.weight.trim()
    ? `- Current weight: ${profile.weight.trim()}`
    : '- Current weight: [fill this in]'

  const notesLine = profile.notes.trim() ? `- Anything else: ${profile.notes.trim()}` : null

  const lines = [
    'You are a strength coach. Here is some context about me:',
    `- Age: ${profile.age || '[fill this in]'}`,
    `- Height: ${profile.height || '[fill this in]'}`,
    weightLine,
    `- Goal: ${GOALS.find(g => g.key === profile.goal)!.label}`,
    ...(notesLine ? [notesLine] : []),
    '',
    GOAL_BLURB[profile.goal],
    '',
    "I've attached/pasted my full training log as a CSV (columns: Date, Workout Type, Exercise, Set Number, Weight (kg), Reps). Please review it and give me specific, actionable feedback:",
    '- Am I progressing at a reasonable rate for my goal?',
    '- Are there any lifts that look stalled or need a programming change?',
    '- Is my push/pull/legs balance and exercise selection sensible?',
    "- Anything else you'd flag from the data.",
  ]

  return lines.join('\n')
}

interface LlmExportProps {
  workouts: Workout[]
  sets: ExerciseSet[]
  exercises: Exercise[]
}

export default function LlmExport({ workouts, sets, exercises }: LlmExportProps) {
  const [profile, setProfile] = useState<Profile>(DEFAULT_PROFILE)
  const [copied, setCopied] = useState(false)

  // Load saved profile once on mount (after hydration, to avoid SSR mismatch).
  useEffect(() => {
    try {
      const raw = localStorage.getItem(STORAGE_KEY)
      if (raw) setProfile({ ...DEFAULT_PROFILE, ...JSON.parse(raw) })
    } catch {
      // ignore — fall back to defaults
    }
  }, [])

  useEffect(() => {
    try {
      localStorage.setItem(STORAGE_KEY, JSON.stringify(profile))
    } catch {
      // ignore — localStorage unavailable
    }
  }, [profile])

  function update<K extends keyof Profile>(key: K, value: Profile[K]) {
    setProfile(p => ({ ...p, [key]: value }))
  }

  const prompt = buildPrompt(profile)

  async function copyPrompt() {
    try {
      await navigator.clipboard.writeText(prompt)
      setCopied(true)
      setTimeout(() => setCopied(false), 2000)
    } catch {
      // clipboard unavailable — user can still select the text manually
    }
  }

  return (
    <section className="llm-export">
      <div className="graph-section-header">
        <h2 className="graph-section-title">Export & AI Coaching</h2>
      </div>

      <button
        type="button"
        className="upload-workout-button"
        onClick={() => downloadCsv('workouts.csv', buildWorkoutsCsv(workouts, exercises, sets))}
      >
        Download Workout CSV
      </button>

      <p className="llm-export-hint">
        Download the CSV above, then paste the prompt below into ChatGPT/Claude along with it for feedback.
      </p>

      <div className="llm-export-grid">
        <div className="filter-field">
          <label className="filter-label" htmlFor="llm-age">Age</label>
          <input
            id="llm-age"
            className="filter-input"
            value={profile.age}
            onChange={e => update('age', e.target.value)}
          />
        </div>
        <div className="filter-field">
          <label className="filter-label" htmlFor="llm-height">Height</label>
          <input
            id="llm-height"
            className="filter-input"
            value={profile.height}
            onChange={e => update('height', e.target.value)}
          />
        </div>
        <div className="filter-field">
          <label className="filter-label" htmlFor="llm-weight">Current weight</label>
          <input
            id="llm-weight"
            className="filter-input"
            placeholder="e.g. 80kg"
            value={profile.weight}
            onChange={e => update('weight', e.target.value)}
          />
        </div>
        <div className="filter-field llm-export-notes">
          <label className="filter-label" htmlFor="llm-notes">Anything else? (optional)</label>
          <input
            id="llm-notes"
            className="filter-input"
            placeholder="injuries, preferences, experience level..."
            value={profile.notes}
            onChange={e => update('notes', e.target.value)}
          />
        </div>
      </div>

      <div className="llm-goal-buttons">
        {GOALS.map(g => (
          <button
            key={g.key}
            type="button"
            className={`llm-goal-button${profile.goal === g.key ? ' llm-goal-button--active' : ''}`}
            onClick={() => update('goal', g.key)}
          >
            {g.label}
          </button>
        ))}
      </div>

      <div className="llm-prompt-wrap">
        <textarea className="llm-prompt-textarea" readOnly value={prompt} rows={12} />
        <button type="button" className="volume-back-button llm-copy-button" onClick={copyPrompt}>
          {copied ? 'Copied!' : 'Copy Prompt'}
        </button>
      </div>
    </section>
  )
}
