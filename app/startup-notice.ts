import './style.css'

export function showStartupNotice(online = false) {
  const main = document.createElement('main')
  const heading = document.createElement('h1')
  heading.textContent = 'Sereness Match'
  const status = document.createElement('p')
  status.className = 'notice'
  status.setAttribute('role', 'status')
  status.textContent = online
    ? 'ローカルSupabaseの接続設定がありません。'
    : '起動設定を確認してください。'
  main.append(heading, status)
  document.querySelector('#app')?.replaceChildren(main)
}
