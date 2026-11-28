import { announcements, fields, members, plans, searchMembers, services, type Profile } from './demo-data'
import { demoSelectors } from './demo-selectors'
import type { State } from './repository'

interface DemoView {
  state: State
  filters: Record<string,string>
  likesTab: number
  status: string
  page: string
  id: string
  origin: string
  icon: string
}

export function renderDemo({state,filters,likesTab,status,page,id,origin,icon}: DemoView):string {
  const {visible,member,likesFrom,likesTo,hasMatch,currentPlan}=demoSelectors(state)
  const tabs = [['home','⌂','ホーム'],['search','⌕','さがす'],['likes','♡','いいね'],['messages','✉','メッセージ'],['sereness','☕','セレネス'],['me','♙','マイページ']]
  const likeTabs = ['もらったいいね','送ったいいね','マッチング済み','お気に入り','足あと','閲覧履歴']
  const date = (value:string) => new Date(value).toLocaleString('ja-JP', {dateStyle:'short',timeStyle:'short'})
  const escape = (value:unknown) => String(value ?? '').replace(/[&<>"']/g, c => ({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]!))
  const button = (label:string, action:string, value='', className='') =>
    '<button type="button" class="' + className + '" data-action="' + action + '" data-value="' + escape(value) + '">' + escape(label) + '</button>'
  const link = (label:string, route:string) => '<a class="button secondary" href="#' + route + '">' + escape(label) + '</a>'
  const section = (title:string, content:string) => '<section><h2>' + title + '</h2>' + content + '</section>'
  const empty = (text:string) => '<p class="box muted">' + text + '</p>'
  const input = (name:string,label:string,type='text',value='',attributes='') =>
    '<label>' + label + '<input name="' + name + '" type="' + type + '" value="' + escape(value) + '" ' + attributes + '></label>'
  const select = (name:string,label:string,options:string[],value='',blank='指定なし') =>
    '<label>' + label + '<select name="' + name + '">' + (blank ? '<option value="">' + blank + '</option>' : '') +
    options.map(o => '<option' + (value===o ? ' selected' : '') + '>' + escape(o) + '</option>').join('') + '</select></label>'
  function portrait(p: Profile, large=false) {
    return '<div class="portrait' + (large ? ' large' : '') + '" aria-label="架空プロフィールのイラスト">' + p.portrait + '</div>'
  }
  type ProfileOrigin = 'home' | 'search' | 'likes' | 'messages' | 'chat' | 'match'
  const profileRoute = (p:Profile, origin:ProfileOrigin) => 'member/'+p.id+'/'+origin
  function cards(people:Profile[], scrolling=false, origin:ProfileOrigin='home') {
    if (!people.length) return empty('表示できる会員はいません。')
    return '<div class="' + (scrolling ? 'rail' : 'grid') + '">' + people.map(p =>
      '<article class="card"><a class="member-link" href="#' + profileRoute(p,origin) + '">' + portrait(p) +
      '<h3>' + p.name + ' <small>' + p.age + '歳</small></h3><span>プロフィールを見る ›</span></a>' +
      '<small>' + p.region + (p.verified ? ' ・ 確認済（架空）' : '') + '</small><p>' + p.hobbies + '</p>' +
      button(likesTo().includes(p.id) ? '♥ いいね済み' : '♡ いいね','like',p.id,'secondary') + '</article>',
    ).join('') + '</div>'
  }
  function home() {
    const people = visible()
    return '<div class="hero"><p class="muted">秋田で、心が通う出会いを。</p><h1>今日、新しい出会いを。</h1><p>自分のペースで、恋活・婚活。</p>' + link('お相手をさがす','search') + '</div>' +
      section('本日のおすすめ',cards(people.slice(0,2))) +
      section('おすすめ会員',cards(people,true)) +
      section('新規登録会員',cards(searchMembers(people,{sort:'new'}).slice(0,3),true)) +
      section('最近ログインした会員',cards(people.filter(p=>p.login!=='1週間以内'),true)) +
      section('運営からのお知らせ',news())
  }
  function news() {
    return announcements.map(n=>'<details class="box"><summary>'+n.title+'</summary><p>'+n.body+'</p></details>').join('')
  }
  function search() {
    return '<h1>お相手をさがす</h1><form class="box" data-form="search"><div class="pair">' +
      input('minAge','最低年齢','number',filters.minAge,'min="18"') + input('maxAge','最高年齢','number',filters.maxAge,'min="18"') +
      '</div>' + select('region',fields.region,[...new Set(members.map(p=>p.region))],filters.region) + '<details><summary>詳しい条件</summary><div class="pair">' +
      input('minHeight','最低身長（cm）','number',filters.minHeight,'min="100"') + input('maxHeight','最高身長（cm）','number',filters.maxHeight,'min="100"') +
      Object.entries(fields).filter(([key])=>key!=='region').map(([key,label]) =>
        select(key,label,[...new Set(members.map(p=>p[key as keyof typeof fields]))],filters[key]),
      ).join('') + input('hobbies','趣味','text',filters.hobbies) +
      '<label>本人確認状況<select name="verified"><option value="">指定なし</option><option value="yes"' + (filters.verified==='yes'?' selected':'') +
      '>確認済</option><option value="no"' + (filters.verified==='no'?' selected':'') + '>未確認</option></select></label></div></details>' +
      '<label>並び替え<select name="sort">' + [['','おすすめ順'],['new','新規登録順'],['login','最近ログイン順'],['age','年齢の若い順']].map(([key,label])=>
        '<option value="'+key+'"'+((filters.sort??'')===key?' selected':'')+'>'+label+'</option>',
      ).join('') + '</select></label><div class="actions"><button>検索する</button><button name="save" value="yes" class="secondary">条件を保存</button>' +
      button('条件を解除','filters-clear','','secondary') + '</div></form>' +
      section('検索結果',cards(searchMembers(visible(),filters),false,'search'))
  }
  function details(p:Profile, origin:string) {
    const back = ['home','search','likes','messages'].includes(origin) ? origin :
      (origin==='chat'||origin==='match') && hasMatch(p.id) ? origin+'/'+p.id : 'search'
    return link('‹ 戻る',back) + portrait(p,true) +
      '<div class="pair photo-strip"><div class="portrait">☕</div><div class="portrait">🌿</div></div><h1>' + p.name + ' ' + p.age + '歳</h1>' +
      '<p>' + p.region + ' ・ ' + p.login + (p.verified ? ' ・ ✓ 本人確認済（架空）' : ' ・ 本人確認未完了') + '</p>' +
      '<div class="actions">' + (likesTo().includes(p.id) ? button('いいねを取り消す','unlike',p.id) : button('♡ いいね','like',p.id)) +
      button(state.favorites.includes(p.id) ? '★ お気に入り解除' : '☆ お気に入り','favorite',p.id,'secondary') + '</div>' +
      section('自己紹介','<p>'+p.bio+'</p>') + section('基本プロフィール','<dl class="box">' +
        Object.entries(fields).filter(([key])=>!['region','intent','login'].includes(key)).map(([key,label])=>
          '<dt>'+label+'</dt><dd>'+p[key as keyof typeof fields]+'</dd>').join('') +
        '<dt>身長</dt><dd>'+p.height+' cm</dd><dt>趣味</dt><dd>'+p.hobbies+'</dd><dt>価値観</dt><dd>'+p.values+'</dd><dt>結婚への意思</dt><dd>'+p.intent+'</dd></dl>') +
      '<div class="actions">'+button('通報','report',p.id,'secondary')+button('ブロック','block',p.id,'secondary')+'</div>'
  }
  function connectionList() {
    const ids = [likesFrom(),likesTo(),state.matches.map(m=>m.memberId),state.favorites,state.footprints,state.history][likesTab]
    return '<h1>いいね</h1><div class="segments" aria-label="いいねの分類">' +
      likeTabs.map((tab,i)=>button(tab,'likes-tab',String(i),i===likesTab?'':'secondary')).join('') +
      '</div>' + cards(ids.map(member).filter((p):p is Profile=>Boolean(p)),false,'likes')
  }
  function messages() {
    return '<h1>メッセージ</h1>' + (state.matches.length ? state.matches.map(m => {
      const p=member(m.memberId)
      if (!p) return ''
      const thread=state.messages.filter(x=>x.memberId===p.id)
      const last=thread.at(-1)
      const unread=thread.filter(x=>x.from==='member'&&!x.read).length
      return '<a class="box thread" href="#chat/'+p.id+'"><strong>'+p.portrait+' '+p.name+'</strong>'+
        (unread?'<span class="badge">'+unread+'</span>':'')+'<p>'+escape(last?.text ?? 'メッセージを始める')+'</p></a>'
    }).join('') : empty('マッチングするとメッセージを送れます。'))
  }
  function chat(p:Profile) {
    return '<div class="actions">'+link('‹ メッセージ一覧','messages')+
      link('相手のプロフィールを見る',profileRoute(p,'chat'))+'</div><h1>'+p.portrait+' '+p.name+'</h1><p class="muted">ローカルメッセージの試用中</p>' +
      '<div class="conversation">' + state.messages.filter(m=>m.memberId===p.id).map(m=>
        '<article class="bubble '+m.from+'"><p>'+escape(m.text)+'</p><small>'+date(m.at)+(m.from==='self'?(m.read?' ・ 既読':' ・ 未読'):'')+'</small></article>',
      ).join('') + '</div><form class="box" data-form="chat" data-id="'+p.id+'"><label>メッセージ<textarea id="message" name="message" required maxlength="1000"></textarea></label>' +
      '<div class="actions"><button>送信</button>'+button('定型文を入力','template','','secondary')+button('既読をシミュレート','demo-read',p.id,'secondary')+'</div></form>' +
      '<div class="actions">'+button('通報','report',p.id,'secondary')+button('ブロック','block',p.id,'secondary')+'</div>'
  }
  function sereness() {
    return '<div class="hero"><h1>Café &amp; Bar Sereness</h1><p>出会いのその先も、セレネスで。</p></div>' +
      section('店舗情報','<p class="box">秋田のカフェ＆バー。所在地・営業時間は正式公開時に掲載します。</p>') +
      section('イベント・相談予約',services.map(s=>'<article class="box"><h3>'+s.title+'</h3><p>'+s.detail+'</p>'+link('詳細を見る','service/'+s.id)+'</article>').join('')) +
      section('お知らせ',news())
  }
  function service(id:string) {
    const item=services.find(s=>s.id===id)
    if (!item) return empty('サービスが見つかりません。')
    const booked=[...state.eventBookings,...state.consultationBookings].some(b=>b.serviceId===id)
    return link('‹ セレネス','sereness')+'<h1>'+item.title+'</h1><article class="box"><p>'+item.detail+'</p><p class="muted">試用予約として履歴に記録します。</p>'+
      (booked?button('試用予約を取り消す','cancel-booking',id,'secondary'):button('試用予約する','book',id))+'</article>'
  }
  function myPage() {
    const plan=currentPlan()
    const p=state.profile
    return '<h1>マイページ</h1><div class="box"><h2>'+escape(p.name||'テスト会員')+'</h2><p>'+
      escape(p.region)+(p.age?' ・ '+p.age+'歳':'')+'</p>'+(p.bio?'<p>'+escape(p.bio)+'</p>':'')+
      '<p>'+plan.name+' ・ いいね残数 '+Math.max(0,plan.likes-likesTo().length)+'</p>'+link('プロフィール編集・写真','edit')+'</div>' +
      '<div class="box actions">'+link('本人・年齢確認','verification')+link('会員プラン','plans')+link('予約履歴','bookings')+link('通知・プライバシー設定','settings')+
      link('ブロック一覧','blocked')+link('お問い合わせ','contact')+link('利用規約','terms')+link('プライバシーポリシー','privacy')+'</div>' +
      '<div class="box actions">'+button('ログアウト','logout','','secondary')+button('退会・テストデータ削除','delete','','secondary')+'</div>'
  }
  function edit() {
    const p=state.profile
    return '<h1>プロフィール編集</h1><form class="box" data-form="profile">'+input('name','ニックネーム','text',p.name,'required maxlength="30"')+
      input('region','居住地域','text',p.region,'required maxlength="30"')+input('hobbies','趣味','text',p.hobbies,'maxlength="80"')+
      '<label>自己紹介<textarea name="bio" maxlength="500">'+escape(p.bio)+'</textarea></label><button>保存する</button></form>'+
      section('写真（テスト素材）','<div class="box">'+(state.photos.length?'<p style="font-size:2em">'+state.photos.map(escape).join(' ')+'</p>':'<p>写真未設定</p>')+
      '<div class="actions">'+['🌷','🌿','☕','🌸'].map(e=>button(e,'photo',e,'secondary')).join('')+button('写真を削除','photo','','secondary')+'</div></div>')
  }
  function settings() {
    return '<h1>通知・プライバシー設定</h1><form class="box" data-form="settings">' +
      [['messages','新着メッセージ',state.notifications.messages],['likes','新着いいね',state.notifications.likes],
        ['footprints','足あとを残す',state.privacy.footprints],['online','ログイン状況を表示',state.privacy.online]].map(([key,label,on])=>
        '<label class="check"><input type="checkbox" name="'+key+'"'+(on?' checked':'')+'>'+label+'</label>',
      ).join('')+'<button>設定を保存</button><p class="muted">設定値を試用データに保存します。</p></form>'
  }
  function bookings() {
    return '<h1>予約履歴</h1>'+([['イベント予約',state.eventBookings],['婚活相談予約',state.consultationBookings]] as const).map(([label,items])=>
      section(label,items.length?items.map(b=>'<article class="box"><strong>'+escape(services.find(s=>s.id===b.serviceId)?.title)+'</strong><p>'+date(b.at)+'</p>'+
        button('取り消す','cancel-booking',b.serviceId,'secondary')+'</article>').join(''):empty('履歴はありません。')),
    ).join('')
  }
  function auth(page:string) {
    if (page==='welcome') return '<div class="welcome"><img src="'+icon+'" alt=""><h1>Sereness Match</h1><p>秋田で、心が通う出会いを。<br>自分のペースで、恋活・婚活。</p><div class="actions">'+
      link('新規会員登録','register')+link('ログイン','login')+'</div><div class="actions">'+link('利用規約','terms')+link('プライバシーポリシー','privacy')+'</div></div>'
    const register=page==='register'
    return link('‹ ウェルカム','welcome')+'<h1>'+(register?'新規会員登録':'ログイン')+'</h1><p class="notice">仮認証です。入力例の架空情報とテスト用パスワードを使ってください。</p>'+
      '<form class="box" data-form="'+page+'">'+input('email','テスト用メールアドレス','email','demo@example.test','required autocomplete="off"')+
      input('password','テスト用パスワード','password','','required minlength="8" autocomplete="off"')+
      (register?input('confirm','パスワード確認','password','','required minlength="8" autocomplete="off"')+
        input('birth','生年月日（架空）','date','1992-06-15','required')+select('gender','性別',['指定しない','女性','男性','その他'],'指定しない','')+
        select('region','居住地域',['秋田市','横手市','由利本荘市','大仙市','その他'],'秋田市','')+
        '<label class="check"><input type="checkbox" required>試用版の利用規約に同意</label><label class="check"><input type="checkbox" required>試用版のプライバシーポリシーに同意</label>'+
        '<div class="actions">'+link('利用規約','terms')+link('プライバシーポリシー','privacy')+'</div>':'')+'<button>'+(register?'仮登録する':'テストログイン')+'</button></form>'
  }
  const legal = {
    terms:['利用規約','試用版は架空会員で操作を確認するためのものです。実際の出会い、予約、本人確認、決済は提供していません。'],
    privacy:['プライバシーポリシー','試用データはこのブラウザに保存されます。入力したメールアドレスとパスワードは保存されません。実在する方の個人情報は入力しないでください。'],
    contact:['お問い合わせ','お問い合わせの受付は正式運用時に開始します。'],
  }
    let content:string
    switch (page) {
      case 'home': content=home(); break
      case 'search': content=search(); break
      case 'likes': content=connectionList(); break
      case 'messages': content=messages(); break
      case 'sereness': content=sereness(); break
      case 'me': content=myPage(); break
      case 'welcome': case 'login': case 'register': content=auth(page); break
      case 'terms': case 'privacy': case 'contact': {
        const [title,body]=legal[page]
        content=link('‹ 戻る',state.signedIn?'me':'welcome')+'<h1>'+title+'</h1><p class="box">'+body+'</p>'
        break
      }
      case 'member': {
        const p=member(id)
        content=p?details(p,origin):empty('会員を表示できません。')+link('さがす','search')
        break
      }
      case 'match': {
        const p=member(id)
        content=p&&hasMatch(id)?'<div class="hero"><h1>マッチング成立</h1><p>'+p.name+'さんとマッチングしました。</p>'+
          '<div class="actions">'+link('メッセージを送る','chat/'+id)+
          link('相手のプロフィールを見る',profileRoute(p,'match'))+'</div></div>':empty('マッチングが見つかりません。')
        break
      }
      case 'chat': {
        const p=member(id)
        content=p&&hasMatch(id)?chat(p):empty('チャットを開けません。')
        break
      }
      case 'service': content=service(id); break
      case 'bookings': content=bookings(); break
      case 'settings': content=settings(); break
      case 'edit': content=edit(); break
      case 'plans': content='<h1>会員プラン</h1>'+plans.map(p=>'<article class="box"><h2>'+p.name+(currentPlan().id===p.id?'（現在）':'')+
        '</h2><p>'+(p.price===null?'料金未設定':p.price+'円')+' ・ いいね枠 '+p.likes+'</p><p>'+p.benefits.join('、')+'</p></article>').join(''); break
      case 'verification': content='<h1>本人・年齢確認</h1><p class="notice">書類を使わず、申請状態だけを記録します。</p>'+
        (['identity','age'] as const).map((key,i)=>'<article class="box"><h2>'+['本人確認','年齢確認'][i]+'</h2><p>'+state.verification[key]+'</p>'+
          button('試用申請する','verify',key,'secondary')+'</article>').join(''); break
      case 'blocked': content='<h1>ブロック一覧</h1>'+state.blocked.map(id=>'<article class="box">'+escape(members.find(p=>p.id===id)?.name)+
        ' '+button('解除','unblock',id,'secondary')+'</article>').join('')+(state.blocked.length?'':empty('ブロック中の会員はいません。')); break
      default: content=empty('ページが見つかりません。')+link('ホームへ','home')
    }
    const active = ({member:'search',match:'likes',chat:'messages',service:'sereness'} as Record<string,string>)[page] ?? (tabs.some(t=>t[0]===page)?page:'me')
    const unread=state.messages.filter(m=>m.from==='member'&&!m.read).length
    const incoming=likesFrom().filter(id=>!hasMatch(id)&&member(id)).length
    const nav = state.signedIn ? '<nav aria-label="メインメニュー">'+tabs.map(([key,symbol,label])=>{
      const count=key==='likes'?incoming:key==='messages'?unread:0
      return '<a href="#'+key+'"'+(active===key?' aria-current="page"':'')+'><span class="nav-icon">'+symbol+'</span>'+label+
        (count?'<span class="badge" aria-label="'+count+'件">'+count+'</span>':'')+'</a>'
    }).join('')+'</nav>' : ''
    return '<header><a href="#'+(state.signedIn?'home':'welcome')+'"><img src="'+icon+'" alt=""> Sereness Match</a><small>試作版</small></header>'+
      '<main class="'+(nav?'has-nav':'')+'">'+(status?'<p class="notice" role="status">'+escape(status)+'</p>':'')+content+'</main>'+nav
}
