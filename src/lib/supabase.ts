import { createClient } from '@supabase/supabase-js'

// Uses the publishable/anon key. Tables have a public-read RLS policy (see
// migration allow_public_read_access), so this key can read but never write.
export function getSupabaseServerClient() {
  const url = process.env.SUPABASE_URL
  const key = process.env.SUPABASE_ANON_KEY

  if (!url || !key) {
    throw new Error('Missing SUPABASE_URL or SUPABASE_ANON_KEY env vars')
  }

  return createClient(url, key, {
    auth: { persistSession: false },
  })
}
