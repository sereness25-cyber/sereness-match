import './style.css'

type Session = { access_token: string; refresh_token: string; expires_at: number; user: { id: string } }
type Profile = { user_id: string; display_name: string; region: string; bio: string; discoverable: boolean }
type AuthResult = Partial<Session> & { expires_in?: number }

export function startOnline(rawUrl: string | undefined, key: string | undefined) {
  const mount = document.querySelector<HTMLElement>('#app')!
  const panel = document.createElement('main')
  const header = document.createElement('header')
  header.textContent = 'Sereness Match · Supabase接続テスト'
  mount.replaceChildren(header, panel)
  let api: URL
  if (!rawUrl || !key || key.startsWith('sb_secret_')) {
    panel.textContent = 'ローカルSupabaseのURLと公開用APIキーを設定してください。'
    return
  }
  try {
    api = new URL(rawUrl)
    if (!['http:','https:'].includes(api.protocol) ||
        !['127.0.0.1','localhost'].includes(api.hostname) || api.username || api.password) throw Error()
  } catch {
    panel.textContent = 'テスト用にローカルSupabaseのURLを指定してください。'
    return
  }
  const apiKey = key
  // Reject legacy service-role JWTs as well as the new secret key format.
  if (!apiKey.startsWith('sb_publishable_')) {
    try {
      const payload = apiKey.split('.')[1].replace(/-/g,'+').replace(/_/g,'/')
      if (JSON.parse(atob(payload)).role !== 'anon') throw Error()
    } catch {
      panel.textContent = 'Supabaseの公開用APIキーを指定してください。'
      return
    }
  }

  const storageKey = 'sereness-local-session:' + api.origin
  let session: Session | null = null
  let profiles: Profile[] = []
  let page: 'login' | 'register' | 'profiles' | 'edit' | 'detail' = 'login'
  let selected: Profile | undefined
  let notice = ''
  let busy = false
  try { session = JSON.parse(sessionStorage.getItem(storageKey) ?? 'null') }
  catch { /* session storage is optional */ }

  async function request<T>(path: string, method='GET', body?: unknown, token?: string): Promise<T> {
    const response = await fetch(new URL(path,api), {
      method,
      headers: {
        apikey:apiKey, ...(token ? { Authorization:'Bearer '+token } : {}),
        ...(body === undefined ? {} : { 'Content-Type':'application/json' }),
      },
      body:body===undefined ? undefined : JSON.stringify(body),
    })
    if (!response.ok) throw new Error('HTTP '+response.status)
    const text = await response.text()
    return text ? JSON.parse(text) as T : undefined as T
  }
  function save(result: AuthResult | null) {
    session = result?.access_token && result.refresh_token && result.user?.id
      ? {access_token:result.access_token,refresh_token:result.refresh_token,user:{id:result.user.id},
        expires_at:result.expires_at ?? Math.floor(Date.now()/1000)+(result.expires_in ?? 0)}
      : null
    try {
      if (session) sessionStorage.setItem(storageKey,JSON.stringify(session))
      else sessionStorage.removeItem(storageKey)
    } catch { /* continue with the in-memory session */ }
  }
  async function accessToken() {
    if (session && session.expires_at <= Date.now()/1000+30) {
      try { save(await request<AuthResult>('/auth/v1/token?grant_type=refresh_token','POST',{refresh_token:session.refresh_token})) }
      catch { save(null) }
    }
    if (!session) {
      profiles = []
      page = 'login'
      throw new Error('session expired')
    }
    return session.access_token
  }
  async function loadProfiles() {
    const token = await accessToken()
    profiles = await request<Profile[]>('/rest/v1/match_profiles?select=user_id,display_name,region,bio,discoverable&order=display_name,user_id','GET',undefined,token)
    page = 'profiles'
  }
  function element<K extends keyof HTMLElementTagNameMap>(tag: K, text='') {
    const node=document.createElement(tag)
    node.textContent=text
    return node
  }
  function button(label: string, action: () => void, secondary=false) {
    const node=element('button',label)
    node.type='button'
    node.disabled=busy
    if (secondary) node.className='secondary'
    node.addEventListener('click',action)
    return node
  }
  function actions(...buttons: HTMLButtonElement[]) {
    const node=element('div')
    node.className='actions'
    node.append(...buttons)
    return node
  }
  function navigate(next: typeof page) { page=next; notice=''; render() }
  function perform(action: () => Promise<void>, error: string) {
    if (busy) return
    busy=true
    notice=''
    panel.setAttribute('aria-busy','true')
    panel.querySelectorAll('button').forEach(button=>button.disabled=true)
    void action().catch(()=>{ notice=error }).finally(()=>{
      busy=false
      render()
    })
  }
  function field(name: string, label: string, type='text', initial='', limit=0) {
    const container=element('label',label)
    const input=element(type==='textarea'?'textarea':'input')
    if(input instanceof HTMLInputElement) input.type=type
    input.name=name
    input.value=initial
    input.required=name!=='bio'
    if(limit) input.maxLength=limit
    container.append(input)
    return container
  }
  function form(label: string, submit: (values: FormData) => void) {
    const node=element('form')
    node.className='box'
    const send=element('button',label)
    send.type='submit'
    node.addEventListener('submit', event=>{event.preventDefault();submit(new FormData(node))})
    return { node,send }
  }
  function renderAuth() {
    const registering=page==='register'
    const title=registering?'テストアカウントを登録':'テストアカウントでログイン'
    const {node,send}=form(registering?'登録する':'ログイン',values=>perform(async()=>{
      const email=String(values.get('email')??'').trim()
      const password=String(values.get('password')??'')
      if(!/^[^@\s]+@example\.com$/i.test(email)) {
        notice='example.com の架空メールアドレスを使ってください。'
        return
      }
      const result=await request<AuthResult>(registering?'/auth/v1/signup':'/auth/v1/token?grant_type=password','POST',{email,password})
      save(result)
      if (session) await loadProfiles()
      else {
        page='login'
        notice='登録を受け付けました。確認が必要な場合はローカルの確認メールを開いてからログインしてください。'
      }
    },registering?'登録できませんでした。ローカルSupabaseの設定と入力内容を確認してください。':'ログインできませんでした。テストアカウントと接続設定を確認してください。'))
    node.append(field('email','テスト用メールアドレス','email'),field('password','パスワード','password'),send)
    panel.append(element('h1',title),element('p','Supabaseへの接続を確認する画面です。架空のアカウントを使ってください。'),node,
      button(registering?'ログイン画面へ':'新規登録へ',()=>navigate(registering?'login':'register'),true))
  }
  function renderEdit() {
    const own=profiles.find(p=>p.user_id===session?.user.id)
    const {node,send}=form('プロフィールを保存',values=>perform(async()=>{
      const token=await accessToken()
      const display_name=String(values.get('display_name')??'').trim()
      const region=String(values.get('region')??'').trim()
      if(!display_name||!region) { notice='ニックネームと居住地域を入力してください。';return }
      const profile={user_id:session!.user.id,display_name,region,bio:String(values.get('bio')??''),discoverable:values.has('discoverable')}
      const { user_id, ...editable }=profile
      if (own) {
        await request('/rest/v1/match_profiles?user_id=eq.'+encodeURIComponent(user_id),'PATCH',editable,token)
      } else {
        await request('/rest/v1/match_profiles','POST',profile,token)
      }
      await loadProfiles()
      notice='プロフィールを保存しました。'
    },'プロフィールを保存できませんでした。'))
    const check=element('input')
    check.type='checkbox'
    check.name='discoverable'
    check.checked=own?.discoverable??false
    const label=element('label','検索結果に表示する')
    label.className='check'
    label.prepend(check)
    node.append(field('display_name','ニックネーム','text',own?.display_name,30),
      field('region','居住地域','text',own?.region,50),field('bio','自己紹介','textarea',own?.bio,500),label,send)
    panel.append(element('h1','プロフィール編集'),node,button('会員一覧へ',()=>navigate('profiles'),true))
  }
  function renderProfiles() {
    const profileList=element('div')
    profileList.className='grid'
    const matches=profiles.filter(p=>p.user_id!==session?.user.id)
    for(const profile of matches) {
      const card=element('article')
      card.className='card'
      card.append(element('h2',profile.display_name),element('p',profile.region),
        button(profile.display_name+'のプロフィールを見る',()=>{selected=profile;navigate('detail')},true))
      profileList.append(card)
    }
    panel.append(element('h1','会員一覧'),
      actions(button('自分のプロフィールを編集',()=>navigate('edit')),button('一覧を更新',()=>perform(loadProfiles,'一覧を読み込めませんでした。'),true),
        button('ログアウト',()=>perform(async()=>{
          const token=session?.access_token
          save(null)
          profiles=[]
          selected=undefined
          page='login'
          if(token) await request('/auth/v1/logout','POST',{},token)
        },'この画面からログアウトしました。サーバー側のセッション終了は確認できませんでした。'),true)),
      matches.length?profileList:element('p','表示できる会員はいません。'))
  }
  function render() {
    panel.removeAttribute('aria-busy')
    panel.replaceChildren()
    if(notice) {
      const feedback=element('p',notice)
      feedback.className='notice'
      feedback.setAttribute('role','status')
      panel.append(feedback)
    }
    if(page==='login'||page==='register') renderAuth()
    else if(page==='edit') renderEdit()
    else if(page==='detail'&&selected) {
      panel.append(button('会員一覧へ',()=>navigate('profiles'),true),element('h1',selected.display_name),
        element('p',selected.region),element('h2','自己紹介'),element('p',selected.bio||'自己紹介は未登録です。'))
    } else renderProfiles()
  }

  render()
  if(session) perform(loadProfiles,'セッションを再開できませんでした。もう一度ログインしてください。')
}
