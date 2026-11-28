import assert from 'node:assert/strict'
import { execFileSync } from 'node:child_process'
import { randomUUID } from 'node:crypto'

const { LOCAL_API_URL: api, LOCAL_DB_URL: db, LOCAL_ANON_KEY: key, LOCAL_SERVICE_KEY: service } = process.env
for (const url of [api, db]) {
  assert.ok(['127.0.0.1', 'localhost'].includes(new URL(url).hostname), 'Use a disposable local stack')
}
assert.ok(key && service, 'Local Supabase API keys are required')

async function call(path, { token, apiKey = key, body, expected = 200, method = body === undefined ? 'GET' : 'POST' } = {}) {
  const response = await fetch(new URL(path, api), {
    method,
    headers: {
      apikey: apiKey,
      ...(token ? { Authorization: 'Bearer ' + token } : {}),
      ...(body !== undefined ? { 'Content-Type': 'application/json' } : {}),
    },
    body: body === undefined ? undefined : JSON.stringify(body),
  })
  assert.ok([expected].flat().includes(response.status), method + ' ' + path + ' returned HTTP ' + response.status)
  const text = await response.text()
  return text ? JSON.parse(text) : null
}

const suffix = randomUUID()
const password = 'Local-test-' + suffix
const users = []
const auth = '/auth/v1'
const rest = '/rest/v1'
try {
  for (const name of ['alice', 'bob', 'charlie']) {
    const email = name + '+' + suffix + '@example.com'
    const user = await call(auth + '/admin/users', { apiKey: service, token: service, body: { email, password, email_confirm: true }, expected: [200, 201] })
    users.push({ id: user.id })
    const session = await call(auth + '/token?grant_type=password', { body: { email, password } })
    users.at(-1).token = session.access_token
    await call(rest + '/match_profiles', {
      token: session.access_token,
      body: { user_id: user.id, display_name: name, region: '秋田市', discoverable: name !== 'charlie' },
      expected: 201,
    })
  }
  const [alice, bob, charlie] = users
  const rpc = (name, user, body, expected = 200) =>
    call(rest + '/rpc/' + name, { token: user.token, body, expected })
  const rows = (table, user) => call(rest + '/' + table + '?select=*', { token: user.token })

  await call(rest + '/match_profiles?select=user_id', { expected: [401, 403] })
  assert.deepEqual((await rows('match_profiles', alice)).map(row => row.user_id).sort(), [alice.id, bob.id].sort())
  assert.equal(await rpc('send_match_like', alice, { target: bob.id }), null)
  const pair = await rpc('send_match_like', bob, { target: alice.id })
  assert.match(pair, /^[0-9a-f-]{36}$/)
  assert.equal(await rpc('send_match_like', bob, { target: alice.id }), pair)
  assert.equal((await rows('match_pairs', alice)).length, 1)

  const message = { thread_id: pair, message_body: '架空のメッセージ' }
  await rpc('send_match_message', alice, message, 403)
  const proof = users.map(({ id }) => {
    assert.match(id, /^[0-9a-f-]{36}$/)
    return "('" + id + "', now(), now())"
  }).join(',')
  execFileSync('psql', [db, '-v', 'ON_ERROR_STOP=1', '-c',
    'insert into match_private.verifications (user_id, identity_verified_at, age_verified_at) values ' + proof],
    { stdio: 'ignore' })
  await rpc('send_match_message', alice, message)
  assert.equal((await rows('match_messages', bob)).at(0)?.body, message.message_body)
  assert.deepEqual(await rows('match_messages', charlie), [])
  await rpc('send_match_message', charlie, message, 403)

  await rpc('block_match_member', bob, { target: alice.id }, [200, 204])
  assert.deepEqual(await rows('match_messages', alice), [])
  assert.deepEqual(await rows('match_pairs', alice), [])
  await rpc('send_match_like', alice, { target: bob.id }, 403)
  console.log('Local Supabase Auth, Data API, matching, message and block checks passed.')
} finally {
  for (const user of users) {
    await call(auth + '/admin/users/' + user.id, { apiKey: service, token: service, method: 'DELETE', expected: [200, 204] })
  }
}
