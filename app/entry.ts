import { readConfig } from './config'
import { startDemo } from './main'
import './style.css'

const mode = import.meta.env.VITE_APP_MODE
const config = readConfig({
  VITE_APP_MODE: mode,
  VITE_SUPABASE_URL: import.meta.env.VITE_SUPABASE_URL,
  VITE_SUPABASE_PUBLIC_KEY: import.meta.env.VITE_SUPABASE_PUBLIC_KEY,
})

if ((!mode || mode === 'demo') && config.mode === 'demo') {
  startDemo()
} else {
  const main = document.createElement('main')
  const heading = document.createElement('h1')
  heading.textContent = 'Sereness Match'
  const status = document.createElement('p')
  status.className = 'notice'
  status.setAttribute('role', 'status')
  status.textContent = config.mode === 'invalid'
    ? '起動設定を確認してください。'
    : 'オンライン環境の準備中です。接続はPhase 2で行います。'
  main.append(heading, status)
  document.querySelector('#app')?.replaceChildren(main)
}
