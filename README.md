# Sereness Match

Ver.0.4のローカル試用版。秋田を舞台とした架空会員のマッチングを試せます。

## Webの開発と確認

Node.js 22.12以上とnpmを使います。

```sh
npm ci
npm run dev
npm test
npm run build
npm run preview
```

開発サーバーのURLを開き、`demo@example.test` と8文字以上の任意のテスト用パスワードで仮登録してください。ログインは既存のローカル試用データを再開する機能です。メールアドレスとパスワードは保存しません。架空会員「あかり」と「ゆうた」からはあらかじめいいねが届いており、いいねを返すと試用チャットが開きます。

会員向けの成果物は `dist/` です。ルートの `index.html` は既存GitHub Pages用の試作版です。新しいWeb版を公開する工程では、`dist/` を配信するようPagesの公開元を切り替えてください。アセットは相対パスで出力します。

## 管理者デモ

```sh
npm run dev:admin
npm run build:admin
```

開発サーバーはループバックで起動します。管理者デモは架空データの閲覧用で、成果物は `dist-admin/` に出力します。公開対象は `dist/` に限ります。ブランチを直接配信するPagesでは `admin/` を除外するため、既存PagesのJekyllビルド設定を維持してください。

## Capacitor

```sh
npm run build
npx cap add android
npx cap add ios
npm run cap:sync
npx cap open android
npx cap open ios
```

`cap add` は各プラットフォームで初回のみ実行します。AndroidのネイティブビルドにはAndroid StudioとAndroid SDK、iOSにはmacOSとXcodeが必要です。アプリIDは暫定の `jp.sereness.match` です。ネイティブプロジェクトはこの段階ではローカルで生成します。

## データ

`app/data.ts` は架空の会員・イベント・プラン、`app/repository.ts` はローカル保存とマッチングの規則、`app/main.ts` は画面と操作を担当します。旧試作版とVer.0.4の保存領域は独立しています。ライフサイクル管理と正式な認証、オンラインデータへの接続は後工程です。
