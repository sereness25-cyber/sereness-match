import { App } from '@capacitor/app'
import { Capacitor } from '@capacitor/core'
import { Keyboard } from '@capacitor/keyboard'
import { SplashScreen } from '@capacitor/splash-screen'
import { services } from './demo-data'
import { demoSelectors } from './demo-selectors'
import { renderDemo } from './demo-view'
import { authenticateDemo, logoutDemo } from './demo-auth'
import { block, fresh, LocalRepository, postMessage, sendLike, withdrawLike } from './repository'

export function startDemo() {
  const app = document.querySelector<HTMLElement>('#app')!
  const repo = new LocalRepository(localStorage)
  let state = repo.load()
  let filters = {...state.filters}
  let likesTab = 0
  let status = ''
  const icon = new URL('./icon.svg', document.baseURI).href
  const member = (id:string) => demoSelectors(state).member(id)
  const hasMatch = (id:string) => demoSelectors(state).hasMatch(id)
  const currentPlan = () => demoSelectors(state).currentPlan()
  function persist(message = '') {
    try { repo.save(state); status = message }
    catch { status = 'ブラウザに保存できませんでした。この画面を閉じると変更が失われる場合があります。' }
  }
  function go(path:string, replace=false) {
    const next = '#' + path
    if (location.hash === next) { render(); return }
    if (replace) { history.replaceState(null,'',next); render() }
    else location.hash = path
  }
  function render() {
    const [requestedPage,id,origin]=location.hash.slice(1).split('/')
    let page=requestedPage
    const publicPages=['welcome','login','register','terms','privacy']
    if (!page || (!state.signedIn&&!publicPages.includes(page)) || (state.signedIn&&['welcome','login','register'].includes(page))) {
      page=state.signedIn?'home':'welcome'
      history.replaceState(null,'','#'+page)
    }
    if (page==='member' && member(id) && state.history[0]!==id) {
      state.history=[id,...state.history.filter(x=>x!==id)]
      persist(status)
    }
    if (page==='chat' && hasMatch(id)) {
      const unread=state.messages.filter(m=>m.memberId===id&&m.from==='member'&&!m.read)
      unread.forEach(m=>m.read=true)
      if(unread.length) persist(status)
    }
    app.innerHTML=renderDemo({state,filters,likesTab,status,page,id,origin,icon})
    status=''
  }
  app.addEventListener('click',event=>{
    const target=(event.target as HTMLElement).closest<HTMLButtonElement>('button[data-action]')
    if(!target) return
    const {action,value:id=''}=target.dataset
    switch(action) {
      case 'like': {
        if (!member(id)) return
        const result=sendLike(state,id,currentPlan().likes)
        const messages={ blocked:'ブロック中の会員には送れません。', duplicate:'すでにいいねを送信済みです。', limit:'いいね残数がありません。', sent:'いいねを送りました。', matched:'' }
        persist(messages[result])
        if(result==='matched') { go('match/'+id); return }
        break
      }
      case 'unlike':
        if(hasMatch(id)&&!confirm('いいねを取り消すと、試用マッチングとチャット履歴が削除されます。続けますか？')) return
        withdrawLike(state,id); persist('いいねを取り消しました。'); break
      case 'favorite': state.favorites=state.favorites.includes(id)?state.favorites.filter(x=>x!==id):[...state.favorites,id]; persist(); break
      case 'likes-tab': likesTab=Number(id); break
      case 'filters-clear': filters={}; state.filters={}; persist('検索条件を解除しました。'); break
      case 'block': if(!confirm('この会員をブロックしますか？')) return; block(state,id); persist('会員をブロックしました。'); go('blocked'); return
      case 'unblock': state.blocked=state.blocked.filter(x=>x!==id); persist('ブロックを解除しました。'); break
      case 'report': {
        const reason=prompt('通報理由（試用記録）')
        if(!reason?.trim()) return
        state.reports.push({memberId:id,reason:reason.trim().slice(0,500),at:new Date().toISOString()})
        persist('通報を試用データに記録しました。')
        break
      }
      case 'template': {
        const field=document.querySelector<HTMLTextAreaElement>('#message')!
        field.value='はじめまして。よかったらお話ししませんか？'
        field.focus()
        return
      }
      case 'demo-read': state.messages.filter(m=>m.memberId===id&&m.from==='self').forEach(m=>m.read=true); persist(); break
      case 'book': {
        const item=services.find(s=>s.id===id)
        if(!item) return
        const records=item.type==='event'?state.eventBookings:state.consultationBookings
        if(!records.some(b=>b.serviceId===id)) records.push({serviceId:id,at:new Date().toISOString()})
        persist('試用予約を記録しました。')
        break
      }
      case 'cancel-booking':
        state.eventBookings=state.eventBookings.filter(b=>b.serviceId!==id)
        state.consultationBookings=state.consultationBookings.filter(b=>b.serviceId!==id)
        persist('試用予約を取り消しました。'); break
      case 'photo': state.photos=id?[id,...state.photos.filter(x=>x!==id)].slice(0,3):[]; persist('テスト写真を更新しました。'); break
      case 'verify': if(id==='identity'||id==='age') {state.verification[id]='審査待ち（試用）';persist()} break
      case 'logout': logoutDemo(state); persist(); go('welcome',true); return
      case 'delete':
        if(!confirm('このブラウザの試用アカウントと履歴を削除しますか？')) return
        state=fresh(); filters={}; likesTab=0; persist('試用データを削除しました。'); go('welcome',true); return
    }
    render()
  })
  app.addEventListener('submit',event=>{
    event.preventDefault()
    const form=event.target as HTMLFormElement
    const fields=new FormData(form)
    const value=(key:string)=>String(fields.get(key)??'').trim()
    switch(form.dataset.form) {
      case 'register': case 'login': {
        const error=authenticateDemo(state,form.dataset.form==='register',{email:value('email'),
          password:value('password'),confirmation:value('confirm'),birth:value('birth'),gender:value('gender'),region:value('region')})
        if(error){alert(error);return}
        persist(); go('home',true); return
      }
      case 'search': {
        const submitter=(event as SubmitEvent).submitter as HTMLButtonElement|null
        const next=Object.fromEntries([...fields].map(([key,value])=>[key,String(value).trim()]))
        if((next.minAge&&next.maxAge&&Number(next.minAge)>Number(next.maxAge))||
           (next.minHeight&&next.maxHeight&&Number(next.minHeight)>Number(next.maxHeight))) {alert('検索範囲の下限・上限を確認してください。');return}
        filters=next
        if(submitter?.name==='save'){state.filters=filters;persist('検索条件を保存しました。')}
        break
      }
      case 'chat': if(postMessage(state,form.dataset.id!,value('message'))) persist(); break
      case 'profile':
        if(!value('name')||!value('region')) {alert('ニックネームと居住地域を入力してください。');return}
        state.profile={...state.profile,name:value('name'),region:value('region'),hobbies:value('hobbies'),bio:value('bio')}
        persist('プロフィールを保存しました。'); break
      case 'settings':
        state.notifications={messages:fields.has('messages'),likes:fields.has('likes')}
        state.privacy={footprints:fields.has('footprints'),online:fields.has('online')}
        persist('設定を保存しました。'); break
    }
    render()
  })
  window.addEventListener('hashchange',()=>{window.scrollTo(0,0);render()})
  render()
  if(Capacitor.isNativePlatform()) {
    void SplashScreen.hide()
    if(Capacitor.getPlatform()==='ios') {
      void Keyboard.addListener('keyboardWillShow',()=>document.body.classList.add('keyboard'))
      void Keyboard.addListener('keyboardWillHide',()=>document.body.classList.remove('keyboard'))
    }
    if(Capacitor.getPlatform()==='android') {
      void App.addListener('backButton',({canGoBack})=>{
        if(document.activeElement?.matches('input, textarea')) { (document.activeElement as HTMLElement).blur();return }
        if(canGoBack) history.back()
        else if(state.signedIn&&location.hash!=='#home') go('home',true)
        else void App.exitApp()
      })
    }
  } else if(import.meta.env.PROD&&'serviceWorker' in navigator) {
    void navigator.serviceWorker.register(new URL('./sw.js',document.baseURI)).catch(()=>{})
  }
}
