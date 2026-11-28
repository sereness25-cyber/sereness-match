import assert from 'node:assert/strict'
import { readFile, readdir } from 'node:fs/promises'
import { createServer } from 'node:http'
import { chromium } from 'playwright-core'

const build=new URL('../../dist-local-supabase/',import.meta.url)
const types={html:'text/html; charset=utf-8',js:'application/javascript',css:'text/css',svg:'image/svg+xml',png:'image/png',webmanifest:'application/manifest+json'}
const secrets=[process.env.LOCAL_SERVICE_KEY,process.env.LOCAL_NEW_SECRET_KEY].filter(Boolean)
assert.ok(secrets.length,'Expected a local test credential for artifact checking')
const assets=new URL('assets/',build)
for (const name of await readdir(assets)) {
  const content=await readFile(new URL(name,assets),'utf8')
  assert.ok(secrets.every(secret=>!content.includes(secret)),'Server credential found in browser bundle')
  assert.doesNotMatch(content,/sb_secret_[A-Za-z0-9_-]{12,}|sereness-v04/)
}

const server=createServer(async(req,res)=>{
  const path=new URL(req.url,'http://127.0.0.1').pathname.slice(1)
  try {
    if(!/^[\w./-]*$/.test(path)||path.includes('..')) throw Error('invalid path')
    const file=path||'index.html'
    res.setHeader('Content-Type',types[file.split('.').at(-1)]??'application/octet-stream')
    res.end(await readFile(new URL(file,build)))
  } catch {res.writeHead(404).end()}
})
await new Promise(resolve=>server.listen(0,'127.0.0.1',resolve))
let browser
try {
  browser=await chromium.launch({channel:'chrome',headless:true})
  const page=await browser.newPage()
  const apiRequests=[]
  const localOrigin=new URL(process.env.VITE_SUPABASE_URL).origin
  page.on('request',request=>{
    if(new URL(request.url()).origin===localOrigin) apiRequests.push(request)
  })
  await page.goto('http://127.0.0.1:'+server.address().port+'/')
  await page.getByText('ローカルSupabaseに接続しました。匿名アクセス制限を確認済みです。').waitFor({timeout:10000})
  assert.ok(apiRequests.some(request=>request.method()==='GET' && new URL(request.url()).pathname==='/rest/v1/profiles'))
  assert.equal(await page.getByRole('link',{name:'新規会員登録'}).count(),0)
  console.log('Browser: local SDK connection, anonymous policy, and absence of server keys and demo fixtures passed.')
} finally {
  await browser?.close()
  server.close()
}
