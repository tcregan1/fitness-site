import { getFitnessData } from '@/lib/sheets'
import ThisWeekClient from '@/components/ThisWeekClient'

export const revalidate = 300

export default async function ThisWeekPage() {
  const data = await getFitnessData()
  return (
    <main>
      <ThisWeekClient
        workouts={data.workouts}
        sets={data.sets}
        exercises={data.exercises}
      />
    </main>
  )
}