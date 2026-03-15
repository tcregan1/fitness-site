import { NextResponse } from 'next/server'
import { getFitnessData } from '@/lib/sheets'

// Cache for 5 minutes — re-fetches automatically on the next request after that.
// After you add Watchdog + pipeline, you can drop this to 60 seconds if you want
// near-real-time updates without rebuilding.
export const revalidate = 300

export async function GET() {
  try {
    const data = await getFitnessData()
    return NextResponse.json(data)
  } catch (err) {
    console.error('Failed to fetch fitness data:', err)
    return NextResponse.json({ error: 'Failed to load data' }, { status: 500 })
  }
}