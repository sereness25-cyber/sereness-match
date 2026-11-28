import js from '@eslint/js'
import globals from 'globals'
import tseslint from 'typescript-eslint'

export default [
  { ignores: ['dist*/**', 'android/**', 'ios/**'] },
  js.configs.recommended,
  ...tseslint.configs.recommended,
  { files: ['app/**/*.ts', 'admin/**/*.ts'], languageOptions: { globals: globals.browser } },
  { files: ['app/public/sw.js'], languageOptions: { globals: globals.serviceworker } },
  { files: ['tests/**/*.{ts,mjs}', 'supabase/tests/*.mjs', '*.config.{ts,mjs}'], languageOptions: { globals: globals.node } },
]
