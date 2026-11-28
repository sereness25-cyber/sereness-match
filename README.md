# Sereness Match

恋活・婚活を支援するアプリです。Phase 1は、既存のWebデモを保全したうえで開発とテストを再現できる状態にします。

## 起動

Node.js 22.13以降の22系または24以上、npm、ブラウザ回帰用のGoogle Chromeを使います。以下はリポジトリルートで実行します。

```sh
npm install
npm run dev
```

表示されたローカルURLで `demo@example.test` と8文字以上の架空パスワードを使って仮登録します。「あかり」か「ゆうた」にいいねを返すと、架空のマッチングとチャットを試せます。

ルートの `index.html` は既存公開版です。Vite版の入口は `app/index.html` です。ブラウザ保存は旧公開版が `serenessDemo`、Viteデモが `sereness-v04` です。

## 検証とビルド

```sh
npm run lint
npm run typecheck
npm test
npm run build
npm run preview
npm run build:admin
npm run build:pages
npm run build:online-preview
npm run test:browser
```

| コマンド | 結果 |
|---|---|
| `build` | `dist/`。Viteの相対パス出力で、WebプレビューとCapacitor同期に利用 |
| `build:admin` | `dist-admin/`。架空データを表示する独立ビルド。開発サーバーは `npm run dev:admin` |
| `build:pages` | `dist-pages/`。GitHub Pagesの `/sereness-match/` を想定したデモ専用成果物 |
| `build:online-preview` | `dist-online/`。オンライン準備画面と接続せずに起動することの確認用 |
| `test:browser` | 直前の管理者・Pages・オンライン準備ビルドをChromeで検証 |

GitHub Pagesの公開用ルートと公開設定は現行のままです。CIは検証のみです。Pages向け成果物の配信元切替やマージは別途承認した段階で行います。

## モードと環境変数

通常はデモで起動します。切り替える場合は `.env.example` をコピーして `app/.env.local` を作成します。

- `VITE_APP_MODE=demo` は端末内の架空データを使います。
- `VITE_APP_MODE=online` は準備画面を表示します。通信処理の接続はPhase 2です。
- `VITE_SUPABASE_URL` と `VITE_SUPABASE_PUBLIC_KEY` はPhase 2向けです。Phase 1では空欄で動きます。サーバー専用のキーは `VITE_` の変数やGitに設定しないでください。

`demo-view.ts` は画面描画、`main.ts` は画面遷移と操作、`demo-data.ts` は架空データ、`demo-auth.ts` は仮認証、`repository.ts` は保存とデモの業務規則、`config.ts` と `api.ts` はモード・通信境界を担当します。

## ネイティブ向けの基盤

アプリIDの候補は `jp.sereness.match` です。ネイティブ環境を準備した後、初回のみ各ターゲットで `npx cap add android` または `npx cap add ios` を実行します。同期は `npm run cap:sync` です。今回の動作判定はWebを対象とします。

再開は [docs/HANDOVER.md](docs/HANDOVER.md) を参照してください。
