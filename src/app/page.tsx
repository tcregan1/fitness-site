import Dashboard from '@/components/Dashboard'
import { getFitnessData } from '@/lib/sheets'

export const revalidate = 300

export default async function Home() {
  const data = await getFitnessData()

  return (
    <main>
      <header className="site-header">
        <h1 className="site-title">Training</h1>
      </header>
      <Dashboard data={data} />
    </main>
  )
}