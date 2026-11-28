import assert from 'node:assert/strict'
import { execFileSync } from 'node:child_process'
import { randomUUID } from 'node:crypto'
import { fileURLToPath } from 'node:url'
import { createClient } from '@supabase/supabase-js'

const { LOCAL_API_URL: api, LOCAL_DB_URL: db, LOCAL_PUBLISHABLE_KEY: key, LOCAL_SERVICE_KEY: service } = process.env
assert.equal(new URL(api).origin,'http://127.0.0.1:54321','The suite requires the reserved local API origin')
assert.equal(new URL(db).hostname,'127.0.0.1')
assert.equal(new URL(db).port,'54322')
assert.ok(key?.startsWith('sb_publishable_') && service)

const options = { auth: { persistSession:false, autoRefreshToken:false, detectSessionInUrl:false } }
const provisioner=createClient(api,service,options)
const anonymous=createClient(api,key,options)
const accounts={}
const password=randomUUID()+'-fixture'
const fixtureNames=['alice','bob','unverified','suspended','admin']
const runSql=name=>execFileSync('psql',[db,'-v','ON_ERROR_STOP=1','-f',fileURLToPath(new URL(name,import.meta.url))],{stdio:'inherit'})
const denied=(result,label)=>assert.equal(result.error?.code,'42501',label)
const resultRows=(result,label)=>{
  assert.equal(result.error,null,label)
  return result.data
}

for (const name of fixtureNames) {
  const email='p2-'+name+'@example.com'
  const {data,error}=await provisioner.auth.admin.createUser({email,password,email_confirm:true})
  assert.equal(error,null,'provision '+name)
  const client=createClient(api,key,options)
  const auth=await client.auth.signInWithPassword({email,password})
  assert.equal(auth.error,null,'authenticate '+name)
  assert.equal(auth.data.user.id,data.user.id)
  accounts[name]={client,id:data.user.id}
}
runSql('./fixtures.sql')
runSql('./member_rls.sql')
console.log('SQL: clean migration, 9 RLS tables, fixture access, denied writes and isolation passed.')

const {alice,bob,unverified,suspended,admin}=accounts
denied(await anonymous.from('account_private').select('user_id'),'anonymous cannot read private data')
denied(await anonymous.from('profiles').select('user_id'),'anonymous cannot browse')
const own=resultRows(await alice.client.from('profiles').update({bio:'API fixture edit'}).eq('user_id',alice.id).select('bio'),'own profile edit')
assert.deepEqual(own,[{bio:'API fixture edit'}])
assert.deepEqual(resultRows(await alice.client.from('profiles').update({bio:'forbidden'}).eq('user_id',bob.id).select('bio'),'other update has no rows'),[])
assert.deepEqual(resultRows(await bob.client.from('profiles').select('bio').eq('user_id',bob.id),'verify unchanged'),[{bio:''}])
assert.deepEqual(resultRows(await alice.client.from('account_private').select('user_id'),'own private data'),[{user_id:alice.id}])
assert.deepEqual(resultRows(await alice.client.from('account_private').select('user_id').eq('user_id',bob.id),'other private data filter'),[])
denied(await alice.client.from('account_private').select('legal_name').eq('user_id',alice.id),'restricted column denied even to owner')
assert.deepEqual(resultRows(await bob.client.from('profiles').select('user_id').eq('user_id',alice.id),'private profile hidden'),[])
assert.deepEqual(resultRows(await suspended.client.from('profiles').select('user_id'),'suspended read returns no rows'),[])
assert.deepEqual(resultRows(await suspended.client.from('profiles').update({bio:'forbidden'}).eq('user_id',suspended.id).select('bio'),'suspended write returns no rows'),[])
assert.deepEqual(resultRows(await unverified.client.from('accounts').select('age_verified_at'),'unverified fixture'),[{age_verified_at:null}])
denied(await unverified.client.from('accounts').update({age_verified_at:new Date().toISOString()}).eq('id',unverified.id),'cannot approve own account')
denied(await unverified.client.from('verification_requests').update({status:'approved'}).eq('user_id',unverified.id),'cannot approve own review')
denied(await alice.client.from('admins').insert({auth_user_id:alice.id,is_active:true,display_name:'forbidden',role_id:randomUUID()}),'cannot self-promote')
assert.deepEqual(resultRows(await alice.client.from('admins').select('auth_user_id'),'member cannot read admin rows'),[])
assert.deepEqual(resultRows(await admin.client.from('admins').select('auth_user_id'),'admin assignment'),[{auth_user_id:admin.id}])
assert.deepEqual(resultRows(await admin.client.from('account_private').select('user_id'),'no broad admin access'),[])
console.log('API: five real local Auth sessions, owner edit, denied cross-user edits/private data, suspended access and self-escalation passed.')
