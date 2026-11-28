import assert from 'node:assert/strict'
import { spawn } from 'node:child_process'
import { randomUUID } from 'node:crypto'
import { setTimeout } from 'node:timers/promises'
import { pathToFileURL } from 'node:url'

const { chromium } = await import(pathToFileURL(process.env.PLAYWRIGHT_MODULE).href)
const url = 'http://127.0.0.1:4175'
const server = spawn(process.execPath,['node_modules/vite/bin/vite.js','preview','--host','127.0.0.1','--port','4175','--strictPort'],{stdio:'inherit'})
let browser
try {
  for(let i=0;i<40;i++) {
    if(server.exitCode!==null) throw Error('Vite preview exited')
    if(await fetch(url).then(r=>r.ok,()=>false)) break
    if(i===39) throw Error('Vite preview did not start')
    await setTimeout(250)
  }
  browser=await chromium.launch({channel:'chrome',headless:true})
  const compileErrors=[]
  const suffix=randomUUID().slice(0,10)
  const password='Sereness-local-'+suffix
  const email=name=>({ '非公開会員':'hidden', '公開会員':'visible', '閲覧会員':'viewer' }[name])+'.'+suffix+'@example.com'
  async function register(name, publicProfile) {
    const context=await browser.newContext({viewport:{width:390,height:844}})
    const page=await context.newPage()
    page.setDefaultTimeout(10000)
    page.on('pageerror',error=>compileErrors.push(error.message))
    await page.goto(url)
    await page.getByRole('button',{name:'新規登録へ'}).click()
    await page.getByLabel('テスト用メールアドレス').fill(email(name))
    await page.getByLabel('パスワード').fill(password)
    await page.getByRole('button',{name:'登録する'}).click()
    await page.getByRole('heading',{name:'会員一覧'}).waitFor()
    await page.getByRole('button',{name:'自分のプロフィールを編集'}).click()
    await page.getByLabel('ニックネーム').fill(name)
    await page.getByLabel('居住地域').fill('秋田市')
    await page.getByLabel('自己紹介').fill('架空の自己紹介 · '+name)
    if(publicProfile) await page.getByLabel('検索結果に表示する').check()
    await page.getByRole('button',{name:'プロフィールを保存'}).click()
    await page.getByText('プロフィールを保存しました。').waitFor()
    return page
  }
  await register('非公開会員',false)
  const publisher=await register('公開会員',true)
  const viewer=await register('閲覧会員',false)
  await viewer.getByRole('button',{name:'公開会員のプロフィールを見る',exact:true}).click()
  await viewer.getByRole('heading',{name:'公開会員',exact:true}).waitFor()
  await viewer.getByText('架空の自己紹介 · 公開会員',{exact:true}).waitFor()
  await viewer.getByRole('button',{name:'会員一覧へ'}).click()
  assert.equal(await viewer.getByRole('button',{name:'非公開会員のプロフィールを見る',exact:true}).count(),0)
  await publisher.getByRole('button',{name:'自分のプロフィールを編集'}).click()
  await publisher.getByLabel('検索結果に表示する').uncheck()
  await publisher.getByRole('button',{name:'プロフィールを保存'}).click()
  await publisher.getByText('プロフィールを保存しました。').waitFor()
  await viewer.getByRole('button',{name:'一覧を更新'}).click()
  await viewer.getByText('表示できる会員はいません。').waitFor()
  await viewer.evaluate(()=>{
    const key=Object.keys(sessionStorage).find(name=>name.startsWith('sereness-local-session:'))
    const session=JSON.parse(sessionStorage.getItem(key))
    session.expires_at=0
    sessionStorage.setItem(key,JSON.stringify(session))
  })
  await viewer.reload()
  await viewer.getByRole('heading',{name:'会員一覧'}).waitFor()
  await viewer.getByRole('button',{name:'ログアウト'}).click()
  await viewer.getByRole('heading',{name:'テストアカウントでログイン'}).waitFor()
  await viewer.getByLabel('テスト用メールアドレス').fill(email('閲覧会員'))
  await viewer.getByLabel('パスワード').fill(password)
  await viewer.getByRole('button',{name:'ログイン',exact:true}).click()
  await viewer.getByRole('heading',{name:'会員一覧'}).waitFor()
  assert.deepEqual(compileErrors,[])
  console.log('Browser integration passed: signup, login, reload, profile editing, public/private access, profile details and logout.')
} finally {
  await browser?.close()
  server.kill()
}
