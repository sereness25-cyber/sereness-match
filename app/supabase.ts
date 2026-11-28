import { createClient } from '@supabase/supabase-js'

export async function verifyLocalConnection(endpoint: URL, publishableKey: string): Promise<boolean> {
  const origin = endpoint.origin
  const client = createClient(origin, publishableKey, {
    auth: { persistSession: false, autoRefreshToken: false, detectSessionInUrl: false },
    global: {
      fetch: (input, init) => {
        const url = new URL(input instanceof Request ? input.url : input)
        if (url.origin !== origin) return Promise.reject(new TypeError('Unexpected development API origin'))
        return fetch(input, { ...init, credentials: 'omit', redirect: 'error' })
      },
    },
  })
  // A reachable Data API should enforce the expected anonymous denial.
  const { error } = await client.from('profiles').select('user_id').limit(0)
  return error?.code === '42501'
}
