'use client'

import { useRef, useState } from 'react'
import { useRouter } from 'next/navigation'

type Status =
  | { kind: 'idle' }
  | { kind: 'busy'; done: number; total: number }
  | { kind: 'ok'; message: string }
  | { kind: 'error'; message: string }

async function uploadOne(file: File) {
  const text = await file.text()
  const res = await fetch('/api/upload-workout', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ text }),
  })
  const data = await res.json()
  if (!res.ok) throw new Error(data.error ?? 'Upload failed')
  return data
}

export default function UploadWorkout() {
  const inputRef = useRef<HTMLInputElement>(null)
  const [status, setStatus] = useState<Status>({ kind: 'idle' })
  const router = useRouter()

  async function handleFiles(files: File[]) {
    const succeeded: string[] = []
    const failed: string[] = []

    for (let i = 0; i < files.length; i++) {
      setStatus({ kind: 'busy', done: i, total: files.length })
      const file = files[i]
      try {
        const data = await uploadOne(file)
        succeeded.push(`${data.workoutType} — ${data.date}`)
      } catch (err) {
        failed.push(`${file.name}: ${err instanceof Error ? err.message : 'Upload failed'}`)
      }
    }

    if (failed.length === 0) {
      setStatus({ kind: 'ok', message: `Uploaded ${succeeded.length} workout${succeeded.length === 1 ? '' : 's'}: ${succeeded.join(', ')}` })
    } else if (succeeded.length === 0) {
      setStatus({ kind: 'error', message: `All ${failed.length} uploads failed — ${failed.join('; ')}` })
    } else {
      setStatus({
        kind: 'error',
        message: `Uploaded ${succeeded.length}, failed ${failed.length} — ${failed.join('; ')}`,
      })
    }

    if (succeeded.length > 0) router.refresh()
  }

  const isBusy = status.kind === 'busy'

  return (
    <div className="upload-workout">
      <input
        ref={inputRef}
        type="file"
        accept=".txt,text/plain"
        multiple
        className="upload-workout-input"
        onChange={e => {
          const files = Array.from(e.target.files ?? [])
          if (files.length > 0) handleFiles(files)
          e.target.value = ''
        }}
      />
      <button
        type="button"
        className="upload-workout-button"
        onClick={() => inputRef.current?.click()}
        disabled={isBusy}
      >
        {isBusy ? `Uploading ${status.done + 1}/${status.total}…` : 'Upload Workouts'}
      </button>
      {status.kind === 'ok' && <span className="upload-workout-status upload-workout-status--ok">{status.message}</span>}
      {status.kind === 'error' && <span className="upload-workout-status upload-workout-status--error">{status.message}</span>}
    </div>
  )
}
