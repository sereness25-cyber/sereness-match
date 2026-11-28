# Phase 0 テスト報告

## Phase 1の検証

対象は最新仕様を保持した `codex/phase-1-foundation`。アプリの通信先はテストダブルを使う。GitHub ActionsはPRで読み取り権限の検証のみを実行する。

| 項目 | 結果 |
|---|---|
| 依存導入・開発サーバー | 成功。npm installで依存を解決。npm run devでViteを起動し、同じ設定の開発サーバーからHTMLとエントリーモジュールのHTTP 200を確認 |
| lint・型チェック・自動テスト | 成功。ESLint、TypeScript、自動テスト7件（デモ認証、設定、API境界、検索、相互いいね、保存等） |
| Web／管理者／Pages／オンライン準備ビルド | 成功。4成果物を生成。Pagesの /sereness-match/ パスを使用してブラウザで確認 |
| Chrome回帰 | 成功。Chromeの幅390px。新規登録・ログイン・ログアウト、6タブ、検索・保存、プロフィール導線、いいね・チャット、予約、通報・ブロック、管理者14画面、PWAのオフライン再読み込み、オンライン準備の外部通信なし |
| 仕様・公開入口 | mainの9仕様、index.html、画像を差分検査。公開配信の変更なし |
| Supabase接続・ネイティブ実機 | 未実行。今回の範囲外 |

実施日 2026-11-28（JST）。調査対象 `913ae312cf350770831cc13e2310e561cf8e8b60`。本番会員の登録やメールの再送を伴わない検証。

| 分類 | 対象 | 結果・根拠 |
|---|---|---|
| 静的調査 | GitHub main | ルートに仕様9ファイル、単一HTMLと画像を確認。外部JS、ネットワーク処理、npm設定なし |
| 静的調査 | 仕様書の同一性 | FEATURES.mdとDATABASE.mdのblob SHA一致。SPEC.mdの実表題と参照上の役割の不一致 |
| 現行デモ | 公開版と同一のHTMLをローカル配信 | 成功。Chromeの幅390pxで6タブ、検索、会員詳細、いいね、模擬チャット、申込み、再読込後のプロフィール保存、管理デモを確認。ページ実行エラー0件 |
| 公開 | GitHub Pages | HTTP 200。レスポンスのGit blob SHAはmainのindex.htmlと一致（`5444a17b4d0b59abe4295a1cf4fbb80176866805`）。公開元を指定する管理設定の詳細は未確認 |
| 既往CI | PR #1 Webビルドとテスト | 既往成功。対象は旧基盤ブランチ。[Actions](https://github.com/sereness25-cyber/sereness-match/actions/runs/45989148426) |
| 既往CI | PR #2 SQL/Auth/Data API | 既往成功。相互いいね、第三者拒否、確認前送信拒否、ブロック。[Actions](https://github.com/sereness25-cyber/sereness-match/actions/runs/46134013332) |
| 既往CI | PR #4 ブラウザ＋ローカルSupabase | 既往成功。架空登録・ログイン・ログアウト、セッション更新、公開プロフィール切替。[Actions](https://github.com/sereness25-cyber/sereness-match/actions/runs/46135306249) |
| 本番メール | Gmail SMTP | 外部確認待ち。送信結果の確認が自動承認審査の利用上限で中断。配信成功とは判定しない |
| 本番権限・実機 | Supabase本番、iOS・Android実機 | 未実行。試験用RLSの結果は本番設定や最新仕様の検証を代替しない |

次の試験は (1) Phase 1の依存導入・lint・型チェック・自動テスト・Webビルド、(2) デモの主要画面とスマートフォン幅、(3) デモと本番の設定分離、(4) Phase 2で匿名・会員A/B・管理者・停止会員のRLSとStorage、(5) メール送達・期限切れ・正しいリダイレクト、(6) バックアップ復元と回帰。実データの投入はテストに使用しない。
