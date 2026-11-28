import { readConfig } from './config'
import { startDemo } from './main'
import { showStartupNotice } from './startup-notice'

const mode = import.meta.env.VITE_APP_MODE
const config = readConfig({
  VITE_APP_MODE: mode,
  VITE_SUPABASE_URL: import.meta.env.VITE_SUPABASE_URL,
  VITE_SUPABASE_PUBLIC_KEY: import.meta.env.VITE_SUPABASE_PUBLIC_KEY,
})

if (config.mode === 'demo') {
  startDemo()
} else {
  showStartupNotice()
}
