# 引き継ぎ · Sereness Match

## Phase 1の引き継ぎ

レビュー用ブランチは `codex/phase-1-foundation`、基点は `913ae312cf350770831cc13e2310e561cf8e8b60`。[PR #6](https://github.com/sereness25-cyber/sereness-match/pull/6)でレビューする。Node 22系とnpm、Vite、TypeScript、ESLint、GitHub Actionsを整備し、デモとオンライン準備を分離した。mainおよび公開環境への反映は運営者の承認待ち。Windows作業用チェックアウトは過去の未追跡状態を持つコピーとは別に用意した。

次のチャットでは、最新のGit履歴とPhase 1 PRを確認し、[README.md](../README.md) のコマンドを使う。Phase 2の指示を受けたら開発用Supabaseを選び、架空データ、公開可能な接続値、本番からの分離を確認する。#2と#4の試験結果を参照しつつ、現行仕様の年齢確認、RLS、Storage、証拠保持を設計する。本番メールは送達未確認のままなので、再送前にAuth Logsと受信状態を照合する。

更新日 2026-11-28（JST）。現行の公開系はGitHub Pages上の単一HTML試作。仕様基準は main の `913ae312cf350770831cc13e2310e561cf8e8b60`（文書Ver.1.0）。未統合の開発版はVer.0.4系。

## Gitと前回までの作業

- [PR #1](https://github.com/sereness25-cyber/sereness-match/pull/1) は基盤。調査時に main への自動マージ不可表示。最新版の仕様書を保全して再統合する。
- [PR #2](https://github.com/sereness25-cyber/sereness-match/pull/2) は開発用SQL/RLSと統合テスト。
- [PR #3](https://github.com/sereness25-cyber/sereness-match/pull/3) は会員カード・成立画面・チャットからプロフィールへの導線。#1ベース。
- [PR #4](https://github.com/sereness25-cyber/sereness-match/pull/4) はローカルSupabaseの登録・ログイン・ログアウトとプロフィール。#2ベース。直近確認の先端は `de9937d0ed6ec1db8d7bd0198796022506367539`。
- ローカル作業領域には過去の未追跡ファイルがあった。調査ではリモートの各PRを正として区別し、既存差分をリセットしなかった。

## 外部サービスの状態

- 本番用Supabaseプロジェクトは東京に作成済み。プロジェクトをWebアプリへつなぐ設定と、本番マイグレーション適用はこの調査で確認・実行していない。
- Gmail SMTP設定は以前に保存を確認済み。指定先への招待送信を一度操作した後、結果を読むブラウザー操作が自動承認審査の利用上限で拒否された。送達・招待の作成状態は未確定。新たに送る前にAuthenticationのユーザー状態とAuth Logs、運営者の受信箱を照合する。
- データベースのパスワード・アプリパスワード・秘密鍵・送信先アドレスは引き継ぎ文書に保存しない。

## Phase 0で作成したファイル

`docs/DEVELOPMENT_STATUS.md`、`docs/TASKS.md`、`docs/DECISIONS.md`、`docs/HANDOVER.md`、`docs/TEST_REPORT.md`、`docs/RELEASE_CHECKLIST.md`。詳細な実装状態、保留点、テスト結果はそれぞれを参照。

## 再開手順

1. リモートの最新mainを基準にAGENTS.md、開発状況とタスク一覧、本ファイル、Git差分を照合する。
2. SPEC.md/FEATURES.mdの正本を運営者に確認しつつ、既存PRの基盤コードと最新版仕様を分けて取り込む。変更があるローカル作業コピーは上書きしない。
3. Phase 1のビルド・型チェック・デモ維持を検証する。次の優先作業はPhase 2の開発用Supabase接続。Gmail送達、正式な認証フロー、RLS差分を追跡する。
4. 本番DB・GitHub Pagesの設定変更や正式公開は、チェックリストと承認を揃えた段階で扱う。
