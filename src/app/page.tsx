import { getFitnessData } from '@/lib/data'
import LiftGraphs from '@/components/LiftGraphs'

export const revalidate = 60

export default async function Home() {
  const { workouts, exercises, sets } = await getFitnessData()

  return (
    <main>
      <LiftGraphs workouts={workouts} exercises={exercises} sets={sets} />
    </main>
  )
}
