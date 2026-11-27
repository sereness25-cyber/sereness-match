export interface Profile {
  id: string; name: string; age: number; region: string; gender: string; height: number
  job: string; income: string; hobbies: string; history: string; children: string
  intent: string; drinking: string; smoking: string; login: string; verified: boolean
  bio: string; values: string; portrait: string; joined: number; photos: string[]
}
export const members: Profile[] = [
  ['akari','あかり',34,'秋田市','女性',158,'会社員','300〜499万円','カフェ巡り・映画','初婚','なし','2〜3年以内','ときどき','吸わない','オンライン',true,'🌷'],
  ['misaki','みさき',39,'横手市','女性',162,'自営業','500〜699万円','旅行・料理','再婚','あり','良い人がいれば','飲まない','吸わない','24時間以内',true,'🌿'],
  ['yuta','ゆうた',36,'秋田市','男性',174,'会社員','500〜699万円','音楽・ドライブ','初婚','なし','1年以内','ときどき','吸わない','オンライン',true,'☕'],
  ['kenji','けんじ',45,'由利本荘市','男性',176,'公務員','700万円以上','読書・散歩','再婚','あり','良い人がいれば','ときどき','吸わない','1週間以内',true,'🍂'],
  ['sakura','さくら',42,'大仙市','女性',160,'会社員','300〜499万円','パン・温泉','再婚','なし','2〜3年以内','飲まない','吸わない','24時間以内',false,'🌸'],
  ['naoki','なおき',32,'秋田市','男性',169,'自営業','300〜499万円','ゲーム・カフェ','初婚','なし','良い人がいれば','飲まない','吸う','1週間以内',false,'🌱'],
].map(([id,name,age,region,gender,height,job,income,hobbies,history,children,intent,drinking,smoking,login,verified,portrait], i) => ({
  id: String(id), name: String(name), age: Number(age), region: String(region), gender: String(gender), height: Number(height),
  job: String(job), income: String(income), hobbies: String(hobbies), history: String(history), children: String(children),
  intent: String(intent), drinking: String(drinking), smoking: String(smoking), login: String(login), verified: Boolean(verified),
  portrait: String(portrait), bio: String(hobbies) + 'が好きです。ゆっくりお話しできる方と出会いたいです。',
  values: 'お互いの時間を大切にしたい', joined: i, photos: [],
}))

export const services = [
  { id:'koi', title:'恋活イベント', type:'event', detail:'少人数でゆっくりお話しできる交流会。' },
  { id:'kon', title:'婚活イベント', type:'event', detail:'結婚を考えている方同士の交流会。' },
  { id:'friends', title:'飲み友イベント', type:'event', detail:'カフェバーで趣味の合う友達を探す交流会。' },
  { id:'meeting', title:'カフェでの顔合わせ予約', type:'event', detail:'カフェでの顔合わせを申し込めます。' },
  { id:'consult', title:'婚活・恋愛相談', type:'consult', detail:'婚活や恋愛について相談できます。' },
  { id:'intro', title:'カウンセラーからのお相手紹介', type:'consult', detail:'希望に合うお相手について相談できます。' },
  { id:'review', title:'プロフィール診断', type:'consult', detail:'プロフィールの見直しを相談できます。' },
  { id:'remarry', title:'再婚活サポート', type:'consult', detail:'再婚に向けた活動について相談できます。' },
] as const
export const plans = [
  { id:'free', name:'無料会員', price:null, likes:10, benefits:['会員検索'] },
  { id:'paid', name:'有料会員', price:null, likes:30, benefits:['会員検索','いいね枠の追加'] },
  { id:'support', name:'婚活サポート会員', price:null, likes:50, benefits:['会員検索','婚活相談'] },
]
export const announcements = [
  { title:'試作版のお知らせ', body:'会員・イベント・確認マークは架空のテストデータです。' },
  { title:'セレネスでの交流会', body:'恋活、婚活、飲み友イベントの予約操作を試せます。' },
  { title:'キャンペーン情報', body:'現在、開催中のキャンペーンはありません。' },
]
export const fields = {
  region:'居住地域', gender:'性別', job:'職業', income:'年収', history:'結婚歴',
  children:'子どもの有無', intent:'結婚への意思', drinking:'飲酒', smoking:'喫煙', login:'ログイン状況',
} as const
export function searchMembers(people: Profile[], filters: Record<string,string>) {
  const result = people.filter(p =>
    Object.keys(fields).every(key => !filters[key] || p[key as keyof typeof fields] === filters[key]) &&
    (!filters.minAge || p.age >= Number(filters.minAge)) &&
    (!filters.maxAge || p.age <= Number(filters.maxAge)) &&
    (!filters.minHeight || p.height >= Number(filters.minHeight)) &&
    (!filters.maxHeight || p.height <= Number(filters.maxHeight)) &&
    (!filters.hobbies || p.hobbies.includes(filters.hobbies.trim())) &&
    (!filters.verified || p.verified === (filters.verified === 'yes')),
  )
  if (filters.sort === 'age') result.sort((a,b) => a.age-b.age)
  if (filters.sort === 'new') result.sort((a,b) => b.joined-a.joined)
  if (filters.sort === 'login') {
    const rank = ['オンライン','24時間以内','1週間以内']
    result.sort((a,b) => rank.indexOf(a.login)-rank.indexOf(b.login))
  }
  return result
}
