import { ageOn, type State } from './repository.ts'

interface Credentials {
  email: string
  password: string
  confirmation: string
  birth: string
  gender: string
  region: string
}

export function authenticateDemo(state: State, registering: boolean, input: Credentials): string | undefined {
  if (!/^[-a-z0-9._+]+@example\.test$/i.test(input.email)) return 'example.test ドメインの架空メールアドレスを使ってください。'
  if (registering) {
    if (input.password !== input.confirmation) return 'パスワード確認が一致しません。'
    const age = ageOn(input.birth)
    if (!Number.isFinite(age) || age < 18 || age > 120) return '18〜120歳になる架空の生年月日を入力してください。'
    if (state.account) return 'このブラウザには試用アカウントがあります。テストログインを選んでください。'
    state.account = { id: 'self', birth: input.birth, gender: input.gender, region: input.region, plan: 'free' }
    state.profile = { name: 'テスト会員', age, gender: input.gender, region: input.region }
  } else if (!state.account) {
    return 'このブラウザで先に仮登録してください。'
  }
  state.signedIn = true
}

export function logoutDemo(state: State) {
  state.signedIn = false
}
