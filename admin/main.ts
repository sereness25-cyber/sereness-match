import './style.css'

const sections = [
  { title:'ダッシュボード', columns:['指標','件数'], rows:[['登録会員', '6'],['審査待ち','2'],['新着通報','1']] },
  { title:'会員管理', columns:['会員','状態'], rows:[['あかり（架空）','利用中'],['みさき（架空）','利用中']] },
  { title:'本人・年齢確認審査', columns:['会員','審査'], rows:[['ゆうた（架空）','年齢確認待ち']] },
  { title:'プロフィール審査', columns:['会員','審査'], rows:[['けんじ（架空）','自己紹介を確認']] },
  { title:'写真審査', columns:['会員','審査'], rows:[['さくら（架空）','写真確認待ち']] },
  { title:'通報管理', columns:['通報番号','状態'], rows:[['DEMO-01','未対応']] },
  { title:'利用停止管理', columns:['会員','状態'], rows:[['デモ会員A','一時停止']] },
  { title:'イベント管理', columns:['イベント','状態'], rows:[['恋活イベント（架空）','下書き']] },
  { title:'予約管理', columns:['予約','状態'], rows:[['婚活相談（架空）','受付済み']] },
  { title:'お知らせ管理', columns:['お知らせ','状態'], rows:[['試作版のお知らせ','表示中']] },
  { title:'会員プラン管理', columns:['プラン','料金'], rows:[['無料会員','未設定'],['有料会員','未設定'],['婚活サポート会員','未設定']] },
  { title:'売上管理', columns:['期間','試用集計'], rows:[['今月','0円']] },
  { title:'利用状況分析', columns:['指標','試用集計'], rows:[['架空のマッチング数','2']] },
  { title:'管理操作履歴', columns:['操作者','操作'], rows:[['デモ管理者','確認用データの作成']] },
]
const app = document.querySelector('#app')!
function render(index:number) {
  const section=sections[index] ?? sections[0]
  app.innerHTML='<header><strong>Sereness Match</strong><span>管理者デモ</span></header><div class="layout"><nav aria-label="管理メニュー">'+
    sections.map((s,i)=>'<a href="#'+i+'"'+(s===section?' aria-current="page"':'')+'>'+s.title+'</a>').join('')+
    '</nav><main><h1>'+section.title+'</h1><p>架空データの表示確認</p><table><thead><tr>'+
    section.columns.map(c=>'<th scope="col">'+c+'</th>').join('')+'</tr></thead><tbody>'+
    section.rows.map(row=>'<tr>'+row.map(cell=>'<td>'+cell+'</td>').join('')+'</tr>').join('')+'</tbody></table></main></div>'
}
const route = () => render(Number(location.hash.slice(1)))
window.addEventListener('hashchange',route)
route()
