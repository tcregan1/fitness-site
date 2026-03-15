import Dashboard from '@/components/Dashboard'
import type { FitnessData } from '@/lib/sheets'

// Revalidate every 5 minutes — matches the API route cache
export const revalidate = 300

async function getData(): Promise<FitnessData> {
  // In production this calls the deployed URL.
  // In development it calls localhost:3000.
  const baseUrl = process.env.NEXT_PUBLIC_BASE_URL ?? 'http://localhost:3000'
  const res = await fetch(`${baseUrl}/api/fitness`, { next: { revalidate: 300 } })
  if (!res.ok) throw new Error('Failed to fetch fitness data')
  return res.json()
}

export default async function Home() {
  const data = await getData()

  return (
    <main>
      <header className="site-header">
        <h1 className="site-title">Training</h1>
      </header>
      <Dashboard data={data} />
    </main>
  )
}