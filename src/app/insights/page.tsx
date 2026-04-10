import { getFitnessData } from '@/lib/sheets'
import InsightsClient from '@/components/InsightsClient'

export const revalidate = 300

export default async function InsightsPage() {
  const data = await getFitnessData()

  return (
    <main>
      <InsightsClient
        workouts={data.workouts}
        sets={data.sets}
        exercises={data.exercises}
      />
    </main>
  )
}