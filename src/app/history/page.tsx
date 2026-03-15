import { getFitnessData } from '@/lib/sheets'
import HistoryClient from '@/components/HistoryClient'

export const revalidate = 300

export default async function HistoryPage() {
  const data = await getFitnessData()
  return (
    <main>
      <HistoryClient
        workouts={data.workouts}
        sets={data.sets}
        exercises={data.exercises}
      />
    </main>
  )
}