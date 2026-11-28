import { resolve } from 'node:path'
import { defineConfig, loadEnv } from 'vite'

export default defineConfig(({ mode }) => {
  const allowed = ['VITE_APP_MODE', 'VITE_SUPABASE_URL', 'VITE_SUPABASE_PUBLIC_KEY']
  const env = loadEnv(mode, resolve('app'), 'VITE_')
  if (Object.keys(env).some(key => !allowed.includes(key)) ||
      (env.VITE_SUPABASE_PUBLIC_KEY && !env.VITE_SUPABASE_PUBLIC_KEY.startsWith('sb_publishable_'))) {
    throw new Error('公開用のVite環境変数だけを指定してください。設定値はログに表示されません。')
  }
  const demoBuild = mode === 'pages'
  const onlinePreview = mode === 'online-preview'
  const online = !demoBuild && (onlinePreview || env.VITE_APP_MODE === 'online')
  return {
    root: 'app',
    base: './',
    resolve: { preserveSymlinks: true },
    plugins: online ? [{
      name: 'sereness-online-entry',
      transformIndexHtml: {
        order: 'pre',
        handler: html => html.replace('src="/entry.ts"', 'src="/online-entry.ts"'),
      },
    }] : [],
    define: demoBuild || onlinePreview ? {
      'import.meta.env.VITE_APP_MODE': JSON.stringify(demoBuild ? 'demo' : 'online'),
      'import.meta.env.VITE_SUPABASE_URL': 'undefined',
      'import.meta.env.VITE_SUPABASE_PUBLIC_KEY': 'undefined',
    } : {},
    build: { outDir: '../dist', emptyOutDir: true },
  }
})
