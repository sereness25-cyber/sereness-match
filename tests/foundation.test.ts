import assert from 'node:assert/strict'
import test from 'node:test'
import { ApiError, createApi } from '../app/api.ts'
import { readConfig } from '../app/config.ts'
import { authenticateDemo, logoutDemo } from '../app/demo-auth.ts'
import { fresh } from '../app/repository.ts'

test('環境を明示的に分け、誤設定をデモへ戻さない', () => {
  assert.deepEqual(readConfig({}), { mode: 'demo' })
  assert.deepEqual(readConfig({ VITE_APP_MODE: 'online' }), { mode: 'online' })
  assert.deepEqual(readConfig({ VITE_APP_MODE: 'production' }), { mode: 'invalid' })
  assert.deepEqual(readConfig({ VITE_APP_MODE: 'online', VITE_SUPABASE_URL: 'http://example.com',
    VITE_SUPABASE_PUBLIC_KEY: 'sb_publishable_fixture' }), { mode: 'invalid' })
  assert.deepEqual(readConfig({ VITE_APP_MODE: 'online', VITE_SUPABASE_URL: 'https://example.com',
    VITE_SUPABASE_PUBLIC_KEY: 'sb_secret_fixture' }), { mode: 'invalid' })
  assert.equal(readConfig({ VITE_APP_MODE: 'online', VITE_SUPABASE_URL: 'http://127.0.0.1:54321',
    VITE_SUPABASE_PUBLIC_KEY: 'sb_publishable_fixture' }).mode, 'online')
})

test('APIは許可した接続先だけを使用し、失敗内容に秘密を含めない', async () => {
  let calls = 0
  const adapter = createApi(new URL('https://example.com'), 'public-fixture', async (url, init) => {
    calls++
    assert.equal(String(url), 'https://example.com/rest/v1/profiles')
    assert.equal(new Headers(init?.headers).get('Authorization'), 'Bearer fake-token')
    assert.equal(init?.redirect, 'error')
    return new Response('internal-fixture', { status: 403 })
  })
  await assert.rejects(() => adapter.request('//invalid.example/'), TypeError)
  assert.equal(calls, 0)
  await assert.rejects(() => adapter.request('/rest/v1/profiles', { accessToken: 'fake-token' }),
    error => error instanceof ApiError && error.status === 403 && !error.message.includes('internal-fixture'))
  assert.equal(calls, 1)
})

test('デモ認証は架空アカウントを切り替え、パスワードを永続化しない', () => {
  const state = fresh()
  const input = { email: 'demo@example.test', password: 'fixture-password', confirmation: 'fixture-password',
    birth: '1990-01-01', gender: '女性', region: '秋田市' }
  assert.ok(authenticateDemo(state, false, input))
  assert.ok(authenticateDemo(state, true, { ...input, confirmation: 'bad' }))
  assert.equal(authenticateDemo(state, true, input), undefined)
  assert.equal(state.signedIn, true)
  assert.ok(!JSON.stringify(state).includes(input.password))
  logoutDemo(state)
  assert.equal(state.signedIn, false)
  assert.equal(authenticateDemo(state, false, input), undefined)
})
