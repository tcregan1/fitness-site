import { notFound } from 'next/navigation'
import { getFitnessData } from '@/lib/data'
import ExerciseVolume from '@/components/ExerciseVolume'

export const revalidate = 60

export default async function ExercisePage({
  params,
  searchParams,
}: {
  params: Promise<{ id: string }>
  searchParams: Promise<{ category?: string }>
}) {
  const { id } = await params
  const { category } = await searchParams
  const exerciseId = Number(id)

  const { workouts, exercises, sets } = await getFitnessData()
  const exercise = exercises.find(e => e.id === exerciseId)

  if (!exercise) notFound()

  const exerciseSets = sets.filter(s => s.exerciseId === exerciseId)

  return (
    <main>
      <ExerciseVolume exercise={exercise} sets={exerciseSets} workouts={workouts} category={category} />
    </main>
  )
}
