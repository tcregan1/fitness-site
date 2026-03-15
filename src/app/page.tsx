import Dashboard from '@/components/Dashboard'
import { getFitnessData } from '@/lib/sheets'
import { computeStreak, computeVolumeBalance } from '@/lib/insights'

export const revalidate = 300

export default async function Home() {
  const data          = await getFitnessData()
  const streak        = computeStreak(data.workouts)
  const volumeBalance = computeVolumeBalance(data.workouts, data.sets)

  return (
    <main>
      <Dashboard data={data} streak={streak} volumeBalance={volumeBalance} />
    </main>
  )
}