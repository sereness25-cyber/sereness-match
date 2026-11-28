export type AppConfig =
  | { mode: 'demo' }
  | { mode: 'online'; endpoint?: URL; publicKey?: string }
  | { mode: 'invalid' }

type ConfigInput = {
  VITE_APP_MODE?: string
  VITE_SUPABASE_URL?: string
  VITE_SUPABASE_PUBLIC_KEY?: string
}

export function readConfig(env: ConfigInput): AppConfig {
  const mode = env.VITE_APP_MODE
  if (!mode || mode === 'demo') return { mode: 'demo' }
  if (mode !== 'online') return { mode: 'invalid' }
  const url = env.VITE_SUPABASE_URL?.trim()
  const key = env.VITE_SUPABASE_PUBLIC_KEY?.trim()
  if (!url && !key) return { mode: 'online' }
  if (!url || !key?.startsWith('sb_publishable_')) return { mode: 'invalid' }
  try {
    const endpoint = new URL(url)
    const loopback = ['localhost', '127.0.0.1', '[::1]'].includes(endpoint.hostname)
    if ((endpoint.protocol !== 'https:' && !(loopback && endpoint.protocol === 'http:')) ||
        endpoint.username || endpoint.password || endpoint.search || endpoint.hash || endpoint.pathname !== '/') {
      return { mode: 'invalid' }
    }
    return { mode: 'online', endpoint, publicKey: key }
  } catch {
    return { mode: 'invalid' }
  }
}
