import { readConfig } from './config'
import { showStartupNotice } from './startup-notice'

const config = readConfig({
  VITE_APP_MODE: 'online',
  VITE_SUPABASE_URL: import.meta.env.VITE_SUPABASE_URL,
  VITE_SUPABASE_PUBLIC_KEY: import.meta.env.VITE_SUPABASE_PUBLIC_KEY,
})
showStartupNotice(config.mode === 'online')
