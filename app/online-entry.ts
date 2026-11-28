import { readConfig } from './config'
import { showStartupNotice } from './startup-notice'

const config = readConfig({
  VITE_APP_MODE: 'online',
  VITE_SUPABASE_URL: import.meta.env.VITE_SUPABASE_URL,
  VITE_SUPABASE_PUBLISHABLE_KEY: import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY,
})
showStartupNotice(config.mode === 'online')

if (config.mode === 'online' && config.endpoint && config.publicKey) {
  const status = document.querySelector('[role="status"]')
  if (status) status.textContent = 'ローカルSupabaseへの接続を確認しています。'
  const endpoint = config.endpoint
  const key = config.publicKey
  void import('./supabase').then(({ verifyLocalConnection }) => verifyLocalConnection(endpoint, key))
    .then(ready => {
      if (status) status.textContent = ready
        ? 'ローカルSupabaseに接続しました。匿名アクセス制限を確認済みです。'
        : 'ローカルSupabaseの接続またはアクセス制限を確認できませんでした。'
    }).catch(() => {
      if (status) status.textContent = 'ローカルSupabaseの接続を確認できませんでした。'
    })
}
