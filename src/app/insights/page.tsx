import { getFitnessData } from '@/lib/sheets'
import { computeInsights } from '@/lib/insights'
import InsightsClient from '@/components/InsightsClient'

export const revalidate = 300

export default async function InsightsPage() {
  const data     = await getFitnessData()
  const insights = computeInsights(data.workouts, data.sets, data.exercises)

  return (
    <main>
      <InsightsClient
        insights={insights}
        workouts={data.workouts}
        sets={data.sets}
        exercises={data.exercises}
      />
    </main>
  )
}