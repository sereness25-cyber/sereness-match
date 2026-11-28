import assert from 'node:assert/strict'
import { execFileSync } from 'node:child_process'
import { randomUUID } from 'node:crypto'
import { fileURLToPath } from 'node:url'
import { createClient } from '@supabase/supabase-js'

const { LOCAL_API_URL: api, LOCAL_DB_URL: db, LOCAL_PUBLISHABLE_KEY: key, LOCAL_SERVICE_KEY: service } = process.env
assert.equal(new URL(api).origin,'http://127.0.0.1:54321')
assert.equal(new URL(db).hostname,'127.0.0.1')
assert.equal(new URL(db).port,'54322')
assert.ok(key?.startsWith('sb_publishable_') && service)
const options={auth:{persistSession:false,autoRefreshToken:false,detectSessionInUrl:false}}
const server=createClient(api,service,options)
const anon=createClient(api,key,options)
const users={}
const password=randomUUID()+'-fixture'
for(const handle of ['alice','bob','premium','support','young','stopped','outsider','reviewer','other-admin']){
  const email='c-'+handle+'@example.com'
  const created=await server.auth.admin.createUser({email,password,email_confirm:true})
  assert.equal(created.error,null,'create '+handle)
  const client=createClient(api,key,options)
  const session=await client.auth.signInWithPassword({email,password})
  assert.equal(session.error,null,'auth '+handle)
  assert.equal(session.data.user.id,created.data.user.id)
  users[handle]={id:created.data.user.id,client}
}
const psql=(args,detail)=>execFileSync('psql',[db,'-v','ON_ERROR_STOP=1',...args],{
  encoding:'utf8',stdio:detail?['ignore','pipe','inherit']:'inherit',
})
for(const path of ['matching-fixtures.sql','matching-rls.sql']) psql(['-f',fileURLToPath(new URL(path,import.meta.url))])
const query=sql=>psql(['-At','-c',sql],true).trim()
const uuid=value=>{
  assert.match(value,/^[0-9a-f]{8}(?:-[0-9a-f]{4}){3}-[0-9a-f]{12}$/i)
  return "'"+value+"'::uuid"
}
const {alice,bob,premium,support,young,stopped,outsider,reviewer}=users
const other=users['other-admin']
const rpc=(user,name,args)=>user.client.rpc(name,args)
const ok=(result,label)=>{assert.equal(result.error,null,label);return result.data}
const denied=(result,label)=>assert.equal(result.error?.code,'42501',label)
const balance=async user=>ok(await rpc(user,'get_daily_like_balance'), 'balance')[0]
const like=(user,target,kind='normal',body=null,id=randomUUID())=>
  rpc(user,'send_like',{p_target:target.id,p_kind:kind,p_body:body,p_request:id})
const thank=(user,id)=>rpc(user,'thank_like',{p_like:id})
const rows=(user,table)=>user.client.from(table).select('*')
const send=(user,id,body='架空の本文',request=randomUUID())=>
  rpc(user,'send_text_message',{p_thread:id,p_body:body,p_request:request})

for(const [member,quota] of [[alice,5],[bob,20],[premium,20],[support,20]]){
  const b=await balance(member)
  assert.equal(b.granted_count,quota)
  assert.equal(b.remaining_count,quota)
}
denied(await anon.from('messages').select('id'),'anonymous messages')
denied(await anon.rpc('get_daily_like_balance'),'anonymous quota')
denied(await like(alice,young),'target age missing')
denied(await like(young,alice),'sender age missing')
denied(await like(alice,stopped),'target stopped')
denied(await like(stopped,alice),'sender stopped')
assert.equal((await like(alice,alice)).error?.code,'22023')
assert.equal((await like(alice,bob,'message',' ')).error?.code,'22023')
ok(await rpc(alice,'skip_member',{p_target:outsider.id}),'skip')
assert.equal((await balance(alice)).used_count,0)
denied(await send(alice,randomUUID()),'pre-match sending')

const retryId=randomUUID()
const forward=ok(await like(alice,bob,'normal',null,retryId),'initial like')
assert.equal(ok(await like(alice,bob,'normal',null,retryId),'retry'),forward)
assert.equal((await like(alice,bob)).error?.code,'23505','duplicate')
assert.equal((await like(alice,premium,'normal',null,retryId)).error?.code,'22023','request ID cannot change payload')
const reverse=ok(await like(bob,alice,'message','復路の架空メッセージ'),'reverse like')
assert.equal((await balance(alice)).used_count,1)
assert.equal((await balance(bob)).used_count,3)
assert.deepEqual(ok(await rows(alice,'matches'),'crossing likes only'),[])
denied(await thank(alice,forward),'sender cannot thank own like')
denied(await thank(outsider,forward),'outsider cannot thank')

const thanked=await Promise.all([thank(bob,forward),thank(alice,reverse),thank(bob,forward)])
const [x,y,z]=thanked.map(result=>ok(result,'parallel thanks')[0])
assert.deepEqual(x,y)
assert.deepEqual(y,z)
assert.equal(query('select count(*) from public.conversations where match_id='+uuid(x.match_id)),'1')
assert.equal(query('select count(*) from public.conversation_members where conversation_id='+uuid(x.conversation_id)),'2')
assert.equal((await balance(bob)).used_count,3)

ok(await like(alice,premium,'message','残数を減らす'),'three-unit debit')
const quotaRace=await Promise.all([like(alice,support),like(alice,outsider)])
assert.equal(quotaRace.filter(r=>r.error===null).length,1)
assert.equal(quotaRace.filter(r=>r.error?.code==='P0001').length,1)
assert.equal((await balance(alice)).remaining_count,0)
assert.equal((await balance(alice)).used_count,5)
assert.equal(query('select sum(cost) from public.likes where sender_id='+uuid(alice.id)),'5')
assert.equal((await like(alice,reviewer)).error?.code,'P0001','exhausted quota')

const thread=x.conversation_id
const req=randomUUID()
const message=ok(await send(bob,thread,'架空の証拠',req),'participant writes')
assert.equal(ok(await send(bob,thread,'架空の証拠',req),'message retry'),message)
assert.deepEqual(ok(await rows(alice,'messages'),'participant read').map(r=>r.id),[message])
assert.deepEqual(ok(await rows(outsider,'messages'),'outsider reads no rows'),[])
denied(await send(outsider,thread),'third-party send')
denied(await alice.client.from('messages').insert({
  conversation_id:thread,sender_id:bob.id,body:'forbidden',client_request_id:randomUUID(),
}),'direct spoofed insert')
denied(await alice.client.from('daily_like_balances').update({used_count:0}).eq('user_id',alice.id),'direct balance update')
for(const state of ["age_verified_at=null","status='suspended'"]){
  query('update public.accounts set '+state+' where id='+uuid(bob.id))
  denied(await send(alice,thread),'counterparty became ineligible')
  denied(await send(bob,thread),'ineligible participant cannot send')
  assert.deepEqual(ok(await rows(alice,'messages'),'membership no longer sufficient'),[])
  query("update public.accounts set status='active',age_verified_at=now() where id="+uuid(bob.id))
}
const [blocking,racingMessage]=await Promise.all([
  rpc(bob,'block_member',{p_target:alice.id}),send(alice,thread,'同時操作の架空文'),
])
ok(blocking,'block succeeded')
if(racingMessage.error) denied(racingMessage,'message lost race to block')
assert.equal(query('select count(*) from public.messages where conversation_id='+uuid(thread)),racingMessage.error?'1':'2')
for(const [actor,target] of [[alice,bob],[bob,alice]]){
  denied(await send(actor,thread),'blocked send')
  denied(await like(actor,target),'blocked like')
  assert.deepEqual(ok(await rows(actor,'messages'),'blocked conversation hidden'),[])
  assert.deepEqual(ok(await actor.client.from('profiles').select('user_id').eq('user_id',target.id),'blocked profile hidden'),[])
}
denied(await thank(bob,forward),'blocked thanks')
assert.deepEqual(ok(await rows(alice,'blocks'),'block target cannot list block'),[])

denied(await rpc(outsider,'submit_report',{p_target:bob.id,p_message:message,p_reason:'架空の不正参照'}),'unrelated evidence source')
const report=ok(await rpc(alice,'submit_report',{p_target:bob.id,p_message:message,p_reason:'架空の通報理由'}),'report after block')
denied(await alice.client.from('report_evidence').select('id'),'member cannot read evidence rows')
denied(await rpc(alice,'read_report_evidence',{p_report:report,p_reason:'確認'}),'member cannot read evidence RPC')
denied(await rpc(reviewer,'read_report_evidence',{p_report:report,p_reason:'確認'}),'assignment required')
query('update public.reports set assigned_admin_id=(select id from public.admins where auth_user_id='+uuid(other.id)+') where id='+uuid(report))
denied(await rpc(other,'read_report_evidence',{p_report:report,p_reason:'確認'}),'permission required even if assigned')
query('update public.reports set assigned_admin_id=(select id from public.admins where auth_user_id='+uuid(reviewer.id)+') where id='+uuid(report))
const evidence=ok(await rpc(reviewer,'read_report_evidence',{p_report:report,p_reason:'審査の架空理由'}),'evidence reader')
assert.equal(evidence[0].snapshot.body,'架空の証拠')
assert.equal(query('select count(*) from public.audit_logs where report_id='+uuid(report)+" and reason='審査の架空理由'"),'1')
ok(await rpc(bob,'unblock_member',{p_target:alice.id}),'unblock')
denied(await send(alice,thread),'unblock does not restore access')
denied(await thank(bob,forward),'unblock does not restore match')

const lastLike=ok(await like(premium,support),'like for block vs match race')
const [closing,racingMatch]=await Promise.all([
  rpc(premium,'block_member',{p_target:support.id}),thank(support,lastLike),
])
ok(closing,'pair block during establishment')
if(racingMatch.error) denied(racingMatch,'pending thanks denied by block')
else assert.equal(query('select status from public.conversations where id='+uuid(racingMatch.data[0].conversation_id)),'closed')
assert.equal(query('select count(*) from public.matches where user_a_id=least('+uuid(premium.id)+','+uuid(support.id)+') and user_b_id=greatest('+uuid(premium.id)+','+uuid(support.id)+') and status=\'active\''),'0')

const finalLike=ok(await like(reviewer,other),'unmatch fixture like')
const end=ok(await thank(other,finalLike),'unmatch fixture match')[0]
const retained=ok(await send(other,end.conversation_id),'unmatch fixture message')
ok(await rpc(reviewer,'end_match',{p_match:end.match_id}),'end match')
denied(await send(other,end.conversation_id),'ended match is closed')
assert.equal(query('select count(*) from public.messages where id='+uuid(retained)),'1')
assert.equal(query('select count(*) from public.messages where id='+uuid(message)),'1')
console.log('Phase 2-C SQL and API passed: quotas, retries, rollbacks, parallel spending and thanks, block races, access control, evidence and audit.')
