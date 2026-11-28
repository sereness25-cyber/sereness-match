# Sereness Match データベース設計書

バージョン：1.0  
作成日：2026年11月28日

参照仕様書：
- SPEC.md
- FEATURES.md

---

# 1. データベース基本構成

## 1.1 採用技術

| 項目 | 技術 |
|---|---|
| バックエンド | Supabase |
| データベース | PostgreSQL |
| ユーザー認証 | Supabase Auth |
| ファイル保存 | Supabase Storage |
| リアルタイム通信 | Supabase Realtime |
| アクセス制御 | Row Level Security（RLS） |
| サーバー処理 | PostgreSQL Functions・Edge Functions |

## 1.2 基本設計方針

- 会員ごとに一意のUUIDを使用する。
- 認証情報と公開プロフィールを分離する。
- 個人情報と公開情報を分離する。
- データベース側でアクセス権限を制御する。
- ポイントやいいねの消費はサーバー側で処理する。
- 決済情報をクライアント側から直接変更させない。
- 管理者権限を一般会員と分離する。
- デモデータと本番データを分離する。
- 将来的な機能追加に対応できる構造とする。

---

# 2. 共通データ型

| データ型 | 用途 |
|---|---|
| uuid | 各種ID |
| text | 文字列 |
| integer | 件数・ポイント |
| bigint | 大規模集計 |
| boolean | 有効・無効 |
| date | 生年月日・日付 |
| timestamptz | 日時 |
| numeric | 数値・評価値 |
| jsonb | 可変設定・補助情報 |
| text[] | 複数選択情報 |

金額は原則として日本円の整数で管理する。

日時はUTCで保存し、日本時間で表示する。

いいね回復、ログインボーナスなどの日付判定は日本時間を使用する。

---

# 3. 共通カラム

必要に応じて以下のカラムを設ける。

| カラム | 型 | 内容 |
|---|---|---|
| id | uuid | 主キー |
| created_at | timestamptz | 作成日時 |
| updated_at | timestamptz | 更新日時 |
| deleted_at | timestamptz | 論理削除日時 |

IDは原則としてサーバー側で生成する。

論理削除は必要なテーブルのみに採用し、個人情報を無期限に保持する仕組みにはしない。

---

# 4. テーブル一覧

## 4.1 アカウント関連

- auth.users
- accounts
- account_private
- profiles
- profile_photos
- profile_preferences
- profile_hobbies
- hobbies
- verification_requests
- verification_documents
- user_settings
- user_devices

## 4.2 マッチング関連

- likes
- daily_like_balances
- extra_like_balances
- skips
- matches
- favorites
- footprints
- blocks

## 4.3 メッセージ関連

- conversations
- conversation_members
- messages
- message_reactions
- message_reads
- stickers
- date_invitations
- date_candidates
- date_change_requests

## 4.4 課金・ポイント関連

- plans
- plan_features
- subscriptions
- entitlements
- payment_products
- payments
- payment_events
- refunds
- point_wallets
- point_transactions
- point_products
- point_grants
- feature_unlocks
- login_stamps
- login_bonus_rewards
- login_bonus_claims

## 4.5 セレネス関連

- stores
- store_hours
- store_photos
- store_menu_items
- store_reservations
- store_reservation_slots
- date_plans
- events
- event_reservations
- event_participants
- event_match_requests
- consultation_slots
- consultations
- consultation_records
- introductions
- introduction_responses

## 4.6 診断・コンテンツ関連

- diagnosis_versions
- diagnosis_types
- diagnosis_questions
- diagnosis_choices
- diagnosis_results
- diagnosis_answers
- articles
- article_categories
- message_templates
- profile_templates
- announcements
- campaigns

## 4.7 運営・管理関連

- notifications
- notification_settings
- reports
- report_evidence
- penalties
- appeals
- prohibited_words
- moderation_flags
- inquiries
- inquiry_messages
- admins
- admin_roles
- admin_permissions
- admin_role_permissions
- admin_audit_logs
- system_settings
- feature_flags
- daily_statistics
- deletion_requests
- background_jobs

---

# 5. アカウント管理

## 5.1 auth.users

Supabase Authが管理する標準認証テーブル。

用途：

- メールアドレス認証
- パスワード認証
- セッション管理
- パスワード再設定

独自テーブルにパスワードを保存してはならない。認証方式は [AUTH.md](AUTH.md) を参照する。アプリの会員IDは auth.users.id に紐付け、外部事業者の識別子を公開IDに使用しない。accounts.email_verified_at はメール確認情報であり、5方式に共通する確認時刻として転用しない。

---

## 5.2 accounts

会員の基本管理情報。

| カラム | 型 | 内容 |
|---|---|---|
| id | uuid | auth.users.idと連携 |
| status | text | アカウント状態 |
| registration_completed | boolean | 初回登録完了 |
| email_verified_at | timestamptz | メール認証日時 |
| age_verified_at | timestamptz | 年齢確認日時 |
| identity_verified_at | timestamptz | 本人確認日時 |
| last_login_at | timestamptz | 最終ログイン |
| last_active_at | timestamptz | 最終利用日時 |
| terms_version | text | 同意した規約 |
| terms_accepted_at | timestamptz | 規約同意日時 |
| privacy_version | text | 同意したポリシー |
| privacy_accepted_at | timestamptz | 同意日時 |
| created_at | timestamptz | 登録日時 |
| updated_at | timestamptz | 更新日時 |
| withdrawn_at | timestamptz | 退会日時 |

### status

- pending
- active
- suspended
- banned
- withdrawing
- withdrawn

認証状態、利用停止状態は一般会員が直接変更できないようにする。

---

## 5.3 account_private

非公開の会員情報。

| カラム | 型 | 内容 |
|---|---|---|
| user_id | uuid | 会員ID・主キー |
| birth_date | date | 生年月日 |
| legal_name | text | 本名・必要な場合のみ |
| phone_number | text | 電話番号・必要な場合のみ |
| verification_reference | text | 認証管理用参照情報 |
| created_at | timestamptz | 作成日時 |
| updated_at | timestamptz | 更新日時 |

本名・電話番号は初期登録必須項目にしない。

必要性が確認された場合のみ取得する。

一般会員への公開は禁止する。

---

# 6. プロフィール

## 6.1 profiles

会員プロフィール情報。

| カラム | 型 | 内容 |
|---|---|---|
| user_id | uuid | 会員ID・主キー |
| nickname | text | ニックネーム |
| gender | text | 性別 |
| prefecture | text | 居住都道府県 |
| city | text | 居住市町村 |
| hometown | text | 出身地 |
| height | integer | 身長 |
| body_type | text | 体型 |
| occupation | text | 職業 |
| education | text | 学歴 |
| income_range | text | 年収区分 |
| days_off | text[] | 休日 |
| drinking | text | 飲酒 |
| smoking | text | 喫煙 |
| living_with | text | 同居人 |
| has_car | boolean | 車の有無 |
| relationship_purpose | text | 利用目的 |
| marital_history | text | 婚姻歴 |
| has_children | text | 子どもの有無 |
| marriage_intention | text | 結婚への意識 |
| wants_children | text | 子どもの希望 |
| household_values | text | 家事・育児への考え |
| meeting_preference | text | 会うまでの希望期間 |
| date_payment_style | text | デート費用への考え |
| personality | text[] | 性格 |
| lifestyle | text | 過ごし方 |
| ideal_date | text | 理想のデート |
| bio | text | 自己紹介 |
| short_message | text | ひとこと |
| visibility | text | 公開状態 |
| field_visibility | jsonb | 項目別公開設定 |
| completion_rate | integer | 完成度 |
| diagnosis_public | boolean | 診断結果公開 |
| created_at | timestamptz | 作成日時 |
| updated_at | timestamptz | 更新日時 |

年齢は生年月日からサーバー側で算出する。

生年月日そのものは公開しない。

プロフィール完成度はサーバー側で計算する。

非公開項目は検索結果やAPIレスポンスからも除外する。

---

## 6.2 profile_photos

| カラム | 型 | 内容 |
|---|---|---|
| id | uuid | 写真ID |
| user_id | uuid | 会員ID |
| storage_path | text | 保存先 |
| photo_type | text | main・sub |
| sort_order | integer | 表示順 |
| moderation_status | text | 審査状態 |
| created_at | timestamptz | 登録日時 |
| updated_at | timestamptz | 更新日時 |

初期制限案：

- メイン写真：1枚
- サブ写真：最大5枚

審査状態：

- pending
- approved
- rejected

公開条件を満たさない画像は他会員へ配信しない。

---

## 6.3 profile_preferences

希望するお相手の条件。

| カラム | 型 | 内容 |
|---|---|---|
| user_id | uuid | 会員ID・主キー |
| preferred_genders | text[] | 希望する性別 |
| min_age | integer | 希望最低年齢 |
| max_age | integer | 希望最高年齢 |
| preferred_prefectures | text[] | 希望都道府県 |
| preferred_cities | text[] | 希望市町村 |
| preferred_purposes | text[] | 希望利用目的 |
| updated_at | timestamptz | 更新日時 |

希望条件は原則として本人のみ閲覧可能とする。

---

## 6.4 hobbies

趣味マスターデータ。

| カラム | 型 | 内容 |
|---|---|---|
| id | uuid | 趣味ID |
| name | text | 趣味名 |
| category | text | カテゴリー |
| sort_order | integer | 表示順 |
| is_active | boolean | 利用可否 |

カテゴリー例：

- カフェ
- グルメ
- 旅行
- ゲーム
- アニメ
- 映画
- 音楽
- スポーツ
- アウトドア
- 読書
- ペット

## 6.5 profile_hobbies

| カラム | 型 | 内容 |
|---|---|---|
| user_id | uuid | 会員ID |
| hobby_id | uuid | 趣味ID |
| created_at | timestamptz | 登録日時 |

user_idとhobby_idの組み合わせを一意とする。

---

# 7. 年齢確認・本人確認

## 7.1 verification_requests

| カラム | 型 | 内容 |
|---|---|---|
| id | uuid | 申請ID |
| user_id | uuid | 会員ID |
| verification_type | text | age・identity |
| status | text | 審査状態 |
| document_type | text | 証明書種類 |
| submitted_at | timestamptz | 提出日時 |
| reviewed_at | timestamptz | 審査日時 |
| reviewed_by | uuid | 審査管理者 |
| rejection_reason | text | 再提出・否認理由 |
| created_at | timestamptz | 作成日時 |

審査状態：

- pending
- approved
- rejected
- resubmit_required

同じ種類の有効な審査中申請が重複しないようにする。

## 7.2 verification_documents

| カラム | 型 | 内容 |
|---|---|---|
| id | uuid | 証明書ID |
| request_id | uuid | 申請ID |
| storage_path | text | 非公開保存先 |
| mime_type | text | ファイル形式 |
| uploaded_at | timestamptz | 提出日時 |
| expires_at | timestamptz | 保存期限 |
| deleted_at | timestamptz | 削除日時 |

証明書は必要最小限の期間のみ保持する。

具体的な取得方法と保存期間は法令確認後に確定する。

---

# 8. 会員設定

## 8.1 user_settings

| カラム | 型 | 内容 |
|---|---|---|
| user_id | uuid | 会員ID・主キー |
| private_mode | boolean | 非公開モード |
| show_last_active | boolean | 最終利用表示 |
| introduction_opt_in | boolean | 紹介希望 |
| updated_at | timestamptz | 更新日時 |

非公開モードの利用権限と具体的な公開範囲はサーバー側で管理する。

## 8.2 user_devices

| カラム | 型 | 内容 |
|---|---|---|
| id | uuid | 端末ID |
| user_id | uuid | 会員ID |
| platform | text | ios・android・web |
| push_token | text | 通知トークン |
| is_active | boolean | 有効状態 |
| last_used_at | timestamptz | 最終利用日時 |

通知トークンは一般会員へ公開しない。

---

# 9. いいねシステム

## 9.1 likes

| カラム | 型 | 内容 |
|---|---|---|
| id | uuid | いいねID |
| sender_id | uuid | 送信会員 |
| receiver_id | uuid | 受信会員 |
| like_type | text | normal・message |
| message | text | 添付メッセージ |
| cost | integer | 消費数 |
| status | text | 状態 |
| viewed_at | timestamptz | 確認日時 |
| responded_at | timestamptz | 回答日時 |
| created_at | timestamptz | 送信日時 |

状態：

- pending
- accepted
- skipped
- cancelled

同一方向の重複送信を防止する。

自分自身への送信は禁止する。

## 9.2 daily_like_balances

| カラム | 型 | 内容 |
|---|---|---|
| user_id | uuid | 会員ID |
| target_date | date | 対象日 |
| granted_count | integer | 当日付与数 |
| used_count | integer | 使用数 |
| updated_at | timestamptz | 更新日時 |

user_idとtarget_dateの組み合わせを一意とする。

残数は付与数から使用数を引いて算出する。

## 9.3 extra_like_balances

| カラム | 型 | 内容 |
|---|---|---|
| id | uuid | 追加付与ID |
| user_id | uuid | 会員ID |
| granted_count | integer | 追加付与数 |
| used_count | integer | 使用数 |
| source | text | 付与理由 |
| point_transaction_id | uuid | ポイント取引ID |
| expires_at | timestamptz | 有効期限 |
| created_at | timestamptz | 付与日時 |

追加いいねの有効期限と消費優先順位は未確定とする。

## 9.4 skips

| カラム | 型 | 内容 |
|---|---|---|
| user_id | uuid | 操作会員 |
| target_user_id | uuid | 対象会員 |
| created_at | timestamptz | スキップ日時 |
| expires_at | timestamptz | 再表示可能日時 |

スキップの保持期間は設定値で管理する。

---

# 10. マッチング

## 10.1 matches

| カラム | 型 | 内容 |
|---|---|---|
| id | uuid | マッチングID |
| user_a_id | uuid | 会員A |
| user_b_id | uuid | 会員B |
| match_type | text | normal・introduction・event |
| source_id | uuid | 成立元データID |
| status | text | 状態 |
| matched_at | timestamptz | 成立日時 |
| ended_at | timestamptz | 終了日時 |
| ended_by | uuid | 解除した会員 |

状態：

- active
- unmatched
- blocked
- closed

会員IDの組み合わせを正規化し、同一ペアの有効なマッチングが重複しないようにする。

---

# 11. お気に入り・足あと・ブロック

## 11.1 favorites

| カラム | 型 | 内容 |
|---|---|---|
| user_id | uuid | 登録会員 |
| target_user_id | uuid | 対象会員 |
| created_at | timestamptz | 登録日時 |

本人のみ閲覧可能とする。

## 11.2 footprints

| カラム | 型 | 内容 |
|---|---|---|
| viewer_id | uuid | 閲覧会員 |
| target_user_id | uuid | 閲覧された会員 |
| last_viewed_at | timestamptz | 最新閲覧日時 |
| view_count | integer | 閲覧回数 |

viewer_idとtarget_user_idの組み合わせを一意とする。

閲覧制限はサーバー側で適用する。

## 11.3 blocks

| カラム | 型 | 内容 |
|---|---|---|
| blocker_id | uuid | ブロックした会員 |
| blocked_id | uuid | ブロックされた会員 |
| created_at | timestamptz | 登録日時 |

ブロック関係は双方の検索、閲覧、交流機能に反映する。

ブロックされた側にはブロック情報を直接公開しない。

---

# 12. メッセージシステム

## 12.1 conversations

| カラム | 型 | 内容 |
|---|---|---|
| id | uuid | 会話ID |
| match_id | uuid | マッチングID |
| status | text | active・closed |
| last_message_at | timestamptz | 最新送信日時 |
| created_at | timestamptz | 作成日時 |

## 12.2 conversation_members

| カラム | 型 | 内容 |
|---|---|---|
| conversation_id | uuid | 会話ID |
| user_id | uuid | 会員ID |
| last_read_at | timestamptz | 最終既読日時 |
| joined_at | timestamptz | 参加日時 |

## 12.3 messages

| カラム | 型 | 内容 |
|---|---|---|
| id | uuid | メッセージID |
| conversation_id | uuid | 会話ID |
| sender_id | uuid | 送信会員 |
| message_type | text | メッセージ種類 |
| body | text | 本文 |
| storage_path | text | 画像保存先 |
| sticker_id | uuid | スタンプID |
| date_invitation_id | uuid | デート申請ID |
| client_request_id | uuid | 重複送信防止ID |
| created_at | timestamptz | 送信日時 |
| unsent_at | timestamptz | 取り消し日時 |

message_type：

- text
- image
- sticker
- date_invitation
- system

送信取り消し済みの本文は通常の取得処理から除外する。

通報対応に必要な証拠は別途アクセス制限された領域で管理する。

## 12.4 message_reactions

| カラム | 型 | 内容 |
|---|---|---|
| message_id | uuid | メッセージID |
| user_id | uuid | 会員ID |
| reaction_type | text | リアクション |
| created_at | timestamptz | 登録日時 |

## 12.5 message_reads

| カラム | 型 | 内容 |
|---|---|---|
| message_id | uuid | メッセージID |
| user_id | uuid | 閲覧会員 |
| read_at | timestamptz | 既読日時 |

既読情報の取得は会員プランに応じて制御する。

## 12.6 stickers

| カラム | 型 | 内容 |
|---|---|---|
| id | uuid | スタンプID |
| name | text | 名称 |
| category | text | カテゴリー |
| storage_path | text | 画像保存先 |
| sort_order | integer | 表示順 |
| is_active | boolean | 利用可否 |

---

# 13. デート支援

## 13.1 date_invitations

| カラム | 型 | 内容 |
|---|---|---|
| id | uuid | デート申請ID |
| match_id | uuid | マッチングID |
| sender_id | uuid | 申請会員 |
| receiver_id | uuid | 相手会員 |
| date_type | text | デート種類 |
| location_name | text | 希望場所 |
| message | text | メッセージ |
| status | text | 申請状態 |
| confirmed_candidate_id | uuid | 確定候補ID |
| created_at | timestamptz | 申請日時 |
| responded_at | timestamptz | 回答日時 |

## 13.2 date_candidates

| カラム | 型 | 内容 |
|---|---|---|
| id | uuid | 候補ID |
| invitation_id | uuid | 申請ID |
| starts_at | timestamptz | 候補日時 |
| ends_at | timestamptz | 終了予定日時 |

## 13.3 date_change_requests

| カラム | 型 | 内容 |
|---|---|---|
| id | uuid | 変更申請ID |
| invitation_id | uuid | デート申請ID |
| requested_by | uuid | 変更希望会員 |
| proposed_at | timestamptz | 希望日時 |
| proposed_location | text | 希望場所 |
| status | text | 変更状態 |
| created_at | timestamptz | 申請日時 |
| responded_at | timestamptz | 回答日時 |

双方の承認が成立するまで確定済みデート予定を変更しない。

---

# 14. 会員プラン

## 14.1 plans

| カラム | 型 | 内容 |
|---|---|---|
| id | uuid | プランID |
| code | text | FREE・PREMIUM・SUPPORT |
| name | text | プラン名 |
| monthly_price | integer | 月額料金 |
| description | text | 説明 |
| is_active | boolean | 販売状態 |

初期料金：

| プラン | 月額 |
|---|---:|
| FREE | 0円 |
| PREMIUM | 980円 |
| SUPPORT | 3,300円 |

女性のプレミアム相当権限は別途利用権限として付与する。

## 14.2 plan_features

| カラム | 型 | 内容 |
|---|---|---|
| plan_id | uuid | プランID |
| feature_code | text | 機能コード |
| is_enabled | boolean | 利用可否 |
| limit_value | integer | 利用上限 |
| settings | jsonb | 補助設定 |

機能コード例：

- daily_likes
- advanced_search
- unlimited_footprints
- read_receipts
- priority_display
- private_mode
- event_discount
- marriage_support

## 14.3 subscriptions

| カラム | 型 | 内容 |
|---|---|---|
| id | uuid | 契約ID |
| user_id | uuid | 会員ID |
| plan_id | uuid | プランID |
| provider | text | 決済事業者 |
| provider_subscription_id | text | 外部契約ID |
| status | text | 契約状態 |
| starts_at | timestamptz | 開始日時 |
| current_period_end | timestamptz | 現在の契約終了日時 |
| auto_renew | boolean | 自動更新 |
| cancelled_at | timestamptz | 解約日時 |
| updated_at | timestamptz | 更新日時 |

## 14.4 entitlements

実際に利用できる機能を管理する。

| カラム | 型 | 内容 |
|---|---|---|
| id | uuid | 権限ID |
| user_id | uuid | 会員ID |
| feature_code | text | 機能コード |
| source | text | 付与元 |
| source_id | uuid | 関連ID |
| starts_at | timestamptz | 開始日時 |
| expires_at | timestamptz | 終了日時 |
| revoked_at | timestamptz | 取消日時 |

付与元：

- base_plan
- subscription
- gender_policy
- points
- campaign
- admin

契約状態と利用権限を分離することで、女性無料特典や期間限定機能にも対応する。

---

# 15. 決済管理

## 15.1 payment_products

| カラム | 型 | 内容 |
|---|---|---|
| id | uuid | 商品ID |
| product_type | text | subscription・points・event |
| provider | text | 決済事業者 |
| external_product_id | text | 外部商品ID |
| internal_reference_id | uuid | 内部商品ID |
| price | integer | 基準価格 |
| currency | text | 通貨 |
| is_active | boolean | 販売状態 |

## 15.2 payments

| カラム | 型 | 内容 |
|---|---|---|
| id | uuid | 決済ID |
| user_id | uuid | 会員ID |
| product_id | uuid | 商品ID |
| provider | text | 決済事業者 |
| external_transaction_id | text | 外部取引ID |
| amount | integer | 決済金額 |
| currency | text | 通貨 |
| status | text | 決済状態 |
| paid_at | timestamptz | 決済日時 |
| created_at | timestamptz | 作成日時 |

外部取引IDの重複登録を防止する。

## 15.3 payment_events

| カラム | 型 | 内容 |
|---|---|---|
| id | uuid | イベントID |
| provider | text | 決済事業者 |
| external_event_id | text | 外部イベントID |
| event_type | text | イベント種類 |
| processing_status | text | 処理状態 |
| received_at | timestamptz | 受信日時 |
| processed_at | timestamptz | 処理日時 |

決済通知の署名を検証し、同じイベントを二重処理しない。

## 15.4 refunds

| カラム | 型 | 内容 |
|---|---|---|
| id | uuid | 返金ID |
| payment_id | uuid | 決済ID |
| external_refund_id | text | 外部返金ID |
| amount | integer | 返金額 |
| reason | text | 返金理由 |
| status | text | 処理状態 |
| created_at | timestamptz | 作成日時 |
| refunded_at | timestamptz | 返金日時 |

カード番号、セキュリティコードは保存しない。

---

# 16. ポイントシステム

## 16.1 point_wallets

| カラム | 型 | 内容 |
|---|---|---|
| user_id | uuid | 会員ID・主キー |
| free_balance | integer | 無料残高 |
| paid_balance | integer | 購入残高 |
| updated_at | timestamptz | 更新日時 |

残高が負数にならないように制約を設ける。

## 16.2 point_transactions

| カラム | 型 | 内容 |
|---|---|---|
| id | uuid | 取引ID |
| user_id | uuid | 会員ID |
| transaction_type | text | 獲得・消費・調整 |
| point_type | text | free・paid |
| amount | integer | 増減ポイント |
| balance_after | integer | 処理後残高 |
| reason_code | text | 処理理由 |
| reference_id | uuid | 関連データID |
| idempotency_key | text | 重複処理防止キー |
| created_at | timestamptz | 処理日時 |

取引履歴の直接編集は禁止する。

修正が必要な場合は調整取引を追加する。

## 16.3 point_products

| カラム | 型 | 内容 |
|---|---|---|
| id | uuid | 商品ID |
| points | integer | ポイント数 |
| price | integer | 基準価格 |
| sort_order | integer | 表示順 |
| is_active | boolean | 販売状態 |

初期販売価格案：

| ポイント | 価格 |
|---|---:|
| 10pt | 120円 |
| 30pt | 360円 |
| 50pt | 550円 |
| 100pt | 980円 |
| 300pt | 2,800円 |
| 500pt | 4,500円 |

## 16.4 point_grants

| カラム | 型 | 内容 |
|---|---|---|
| id | uuid | 付与単位ID |
| user_id | uuid | 会員ID |
| point_type | text | free・paid |
| original_amount | integer | 付与数 |
| remaining_amount | integer | 未使用数 |
| transaction_id | uuid | 付与取引ID |
| granted_at | timestamptz | 付与日時 |
| expires_at | timestamptz | 有効期限 |

ポイントの有効期限を設定する場合に備え、付与単位で残高を管理する。

## 16.5 feature_unlocks

| カラム | 型 | 内容 |
|---|---|---|
| id | uuid | 解放ID |
| user_id | uuid | 会員ID |
| feature_code | text | 解放機能 |
| target_id | uuid | 対象データID |
| point_transaction_id | uuid | 消費取引ID |
| starts_at | timestamptz | 開始日時 |
| expires_at | timestamptz | 終了日時 |
| status | text | 利用状態 |

対象機能：

- 追加いいね
- 優先表示
- 足あと閲覧制限解除
- 詳細検索
- 既読確認

実際の機能権限はentitlementsなどと連携して管理する。

---

# 17. ログインボーナス

## 17.1 login_stamps

| カラム | 型 | 内容 |
|---|---|---|
| user_id | uuid | 会員ID |
| login_date | date | ログイン日 |
| reward_points | integer | 獲得ポイント |
| created_at | timestamptz | 獲得日時 |

user_idとlogin_dateの組み合わせを一意とする。

## 17.2 login_bonus_rewards

| カラム | 型 | 内容 |
|---|---|---|
| id | uuid | 報酬ID |
| reward_type | text | daily・milestone・perfect |
| required_days | integer | 必要日数 |
| reward_points | integer | 報酬ポイント |
| is_active | boolean | 有効状態 |

## 17.3 login_bonus_claims

| カラム | 型 | 内容 |
|---|---|---|
| id | uuid | 獲得ID |
| user_id | uuid | 会員ID |
| reward_id | uuid | 報酬ID |
| target_month | date | 対象月 |
| point_transaction_id | uuid | ポイント取引ID |
| claimed_at | timestamptz | 獲得日時 |

月間達成報酬の重複獲得を禁止する。

毎月のスタンプは新しい月のデータとして管理し、過去の履歴を上書きしない。

---

# 18. 店舗連携

## 18.1 stores

| カラム | 型 | 内容 |
|---|---|---|
| id | uuid | 店舗ID |
| name | text | 店舗名 |
| description | text | 店舗紹介 |
| address | text | 所在地 |
| access_information | text | アクセス |
| phone_number | text | 店舗電話番号 |
| reservation_enabled | boolean | 予約可否 |
| is_active | boolean | 公開状態 |

初期登録店舗：

Café & Bar Sereness

## 18.2 store_hours

| カラム | 型 | 内容 |
|---|---|---|
| id | uuid | 営業時間ID |
| store_id | uuid | 店舗ID |
| day_of_week | integer | 曜日 |
| opening_time | time | 開店時刻 |
| closing_time | time | 閉店時刻 |
| closes_next_day | boolean | 翌日閉店 |
| is_closed | boolean | 定休日 |

日付をまたぐ夜間営業に対応する。

## 18.3 store_photos

| カラム | 型 | 内容 |
|---|---|---|
| id | uuid | 写真ID |
| store_id | uuid | 店舗ID |
| storage_path | text | 画像保存先 |
| caption | text | 説明 |
| sort_order | integer | 表示順 |

## 18.4 store_menu_items

| カラム | 型 | 内容 |
|---|---|---|
| id | uuid | メニューID |
| store_id | uuid | 店舗ID |
| category | text | カテゴリー |
| name | text | 商品名 |
| description | text | 商品説明 |
| price | integer | 料金 |
| image_path | text | 商品画像 |
| is_available | boolean | 提供状態 |

## 18.5 store_reservation_slots

| カラム | 型 | 内容 |
|---|---|---|
| id | uuid | 予約枠ID |
| store_id | uuid | 店舗ID |
| starts_at | timestamptz | 開始日時 |
| ends_at | timestamptz | 終了日時 |
| capacity | integer | 受付可能人数 |
| is_available | boolean | 受付状態 |

臨時休業や特別営業時間にも対応する。

## 18.6 store_reservations

| カラム | 型 | 内容 |
|---|---|---|
| id | uuid | 予約ID |
| store_id | uuid | 店舗ID |
| user_id | uuid | 予約会員 |
| slot_id | uuid | 予約枠ID |
| date_invitation_id | uuid | 関連デートID |
| date_plan_id | uuid | 希望プランID |
| reservation_at | timestamptz | 希望日時 |
| guest_count | integer | 利用人数 |
| purpose | text | 利用目的 |
| notes | text | 備考 |
| status | text | 予約状態 |
| created_at | timestamptz | 申請日時 |
| confirmed_at | timestamptz | 確定日時 |

## 18.7 date_plans

| カラム | 型 | 内容 |
|---|---|---|
| id | uuid | プランID |
| store_id | uuid | 店舗ID |
| name | text | プラン名 |
| description | text | 内容 |
| price | integer | 料金 |
| image_path | text | 画像 |
| is_active | boolean | 提供状態 |

---

# 19. イベントシステム

## 19.1 events

| カラム | 型 | 内容 |
|---|---|---|
| id | uuid | イベントID |
| title | text | イベント名 |
| description | text | 内容 |
| category | text | ジャンル |
| image_path | text | イベント画像 |
| prefecture | text | 開催都道府県 |
| city | text | 開催市町村 |
| venue | text | 開催場所 |
| starts_at | timestamptz | 開始日時 |
| ends_at | timestamptz | 終了日時 |
| min_age | integer | 最低年齢 |
| max_age | integer | 最高年齢 |
| capacity | integer | 定員 |
| price | integer | 基本参加費 |
| premium_price | integer | 優待価格 |
| application_deadline | timestamptz | 募集締切 |
| matching_enabled | boolean | マッチング可否 |
| cancellation_policy | text | キャンセル規定 |
| status | text | 開催状態 |

## 19.2 event_reservations

| カラム | 型 | 内容 |
|---|---|---|
| id | uuid | 予約ID |
| event_id | uuid | イベントID |
| user_id | uuid | 会員ID |
| payment_id | uuid | 決済ID |
| charged_price | integer | 実際の参加費 |
| status | text | 予約状態 |
| hold_expires_at | timestamptz | 仮予約期限 |
| created_at | timestamptz | 予約日時 |
| cancelled_at | timestamptz | 取消日時 |

決済中の仮予約を含めて定員超過を防止する。

## 19.3 event_participants

| カラム | 型 | 内容 |
|---|---|---|
| event_id | uuid | イベントID |
| user_id | uuid | 参加会員 |
| attendance_status | text | 参加状態 |
| matching_opt_in | boolean | マッチング同意 |
| checked_in_at | timestamptz | 受付日時 |

## 19.4 event_match_requests

| カラム | 型 | 内容 |
|---|---|---|
| id | uuid | 申請ID |
| event_id | uuid | イベントID |
| sender_id | uuid | 申請会員 |
| receiver_id | uuid | 相手会員 |
| status | text | 申請状態 |
| created_at | timestamptz | 申請日時 |
| responded_at | timestamptz | 回答日時 |

イベント参加資格と双方の同意を確認する。

---

# 20. 婚活サポート

## 20.1 consultation_slots

| カラム | 型 | 内容 |
|---|---|---|
| id | uuid | 相談枠ID |
| starts_at | timestamptz | 開始日時 |
| ends_at | timestamptz | 終了日時 |
| consultation_method | text | 対面・オンライン |
| is_available | boolean | 予約可否 |

## 20.2 consultations

| カラム | 型 | 内容 |
|---|---|---|
| id | uuid | 相談予約ID |
| user_id | uuid | 会員ID |
| slot_id | uuid | 相談枠ID |
| category | text | 相談カテゴリー |
| consultation_method | text | 相談方法 |
| request_content | text | 相談内容 |
| status | text | 予約状態 |
| assigned_admin_id | uuid | 担当管理者 |
| created_at | timestamptz | 申請日時 |
| completed_at | timestamptz | 完了日時 |

予約相談型を採用する。

月間利用上限は設定値として管理する。

## 20.3 consultation_records

| カラム | 型 | 内容 |
|---|---|---|
| id | uuid | 相談記録ID |
| consultation_id | uuid | 相談予約ID |
| admin_id | uuid | 担当管理者 |
| summary | text | 相談概要 |
| advice | text | 対応内容 |
| next_action | text | 今後の方針 |
| created_at | timestamptz | 記録日時 |
| updated_at | timestamptz | 更新日時 |

相談記録は担当者および権限を持つ管理者のみ閲覧可能とする。

## 20.4 introductions

| カラム | 型 | 内容 |
|---|---|---|
| id | uuid | 紹介ID |
| user_a_id | uuid | 紹介会員A |
| user_b_id | uuid | 紹介会員B |
| admin_id | uuid | 紹介担当者 |
| introduction_message | text | 紹介文 |
| status | text | 紹介状態 |
| expires_at | timestamptz | 回答期限 |
| created_at | timestamptz | 紹介日時 |

## 20.5 introduction_responses

| カラム | 型 | 内容 |
|---|---|---|
| introduction_id | uuid | 紹介ID |
| user_id | uuid | 回答会員 |
| response | text | accepted・declined |
| responded_at | timestamptz | 回答日時 |

双方の承認によってマッチングを成立させる。

---

# 21. 恋愛タイプ診断

## 21.1 diagnosis_versions

| カラム | 型 | 内容 |
|---|---|---|
| id | uuid | 診断バージョンID |
| version | integer | バージョン番号 |
| scoring_settings | jsonb | 判定ルール |
| is_active | boolean | 現行版 |
| published_at | timestamptz | 公開日時 |

## 21.2 diagnosis_types

| カラム | 型 | 内容 |
|---|---|---|
| id | uuid | タイプID |
| version_id | uuid | 診断バージョン |
| code | text | タイプコード |
| name | text | タイプ名 |
| description | text | 説明 |
| personality | text | 性格傾向 |
| relationship_style | text | 恋愛傾向 |
| strengths | text | 長所 |
| cautions | text | 注意点 |
| advice | text | アドバイス |
| image_path | text | イラスト |

## 21.3 diagnosis_questions

| カラム | 型 | 内容 |
|---|---|---|
| id | uuid | 質問ID |
| version_id | uuid | 診断バージョン |
| question_text | text | 質問内容 |
| sort_order | integer | 表示順 |

## 21.4 diagnosis_choices

| カラム | 型 | 内容 |
|---|---|---|
| id | uuid | 選択肢ID |
| question_id | uuid | 質問ID |
| choice_text | text | 選択肢 |
| score_data | jsonb | 評価値 |
| sort_order | integer | 表示順 |

## 21.5 diagnosis_results

| カラム | 型 | 内容 |
|---|---|---|
| id | uuid | 診断結果ID |
| user_id | uuid | 会員ID |
| version_id | uuid | 診断バージョン |
| diagnosis_type_id | uuid | 判定タイプ |
| score_data | jsonb | 集計結果 |
| is_latest | boolean | 最新結果 |
| completed_at | timestamptz | 診断日時 |

## 21.6 diagnosis_answers

| カラム | 型 | 内容 |
|---|---|---|
| result_id | uuid | 診断結果ID |
| question_id | uuid | 質問ID |
| choice_id | uuid | 選択肢ID |

診断回答は非公開とする。

本人が公開を許可した場合のみ最新のタイプ名などをプロフィールへ表示する。

20問・4択・8タイプは初期案とし、固定値にしない。

---

# 22. コンテンツ管理

## 22.1 articles

| カラム | 型 | 内容 |
|---|---|---|
| id | uuid | 記事ID |
| category_id | uuid | カテゴリーID |
| title | text | タイトル |
| body | text | 本文 |
| image_path | text | 画像 |
| status | text | 公開状態 |
| published_at | timestamptz | 公開日時 |

## 22.2 article_categories

| カラム | 型 | 内容 |
|---|---|---|
| id | uuid | カテゴリーID |
| name | text | 名称 |
| sort_order | integer | 表示順 |
| is_active | boolean | 利用状態 |

## 22.3 message_templates

| カラム | 型 | 内容 |
|---|---|---|
| id | uuid | 例文ID |
| category | text | カテゴリー |
| title | text | タイトル |
| body | text | 例文 |
| is_active | boolean | 公開状態 |

## 22.4 profile_templates

| カラム | 型 | 内容 |
|---|---|---|
| id | uuid | テンプレートID |
| category | text | カテゴリー |
| template_text | text | テンプレート本文 |
| variables | jsonb | 差し込み項目 |
| is_active | boolean | 利用状態 |

## 22.5 announcements

| カラム | 型 | 内容 |
|---|---|---|
| id | uuid | お知らせID |
| title | text | タイトル |
| body | text | 本文 |
| importance | text | 重要度 |
| starts_at | timestamptz | 公開開始 |
| ends_at | timestamptz | 公開終了 |
| is_published | boolean | 公開状態 |

## 22.6 campaigns

| カラム | 型 | 内容 |
|---|---|---|
| id | uuid | キャンペーンID |
| title | text | 名称 |
| description | text | 内容 |
| reward_settings | jsonb | 特典設定 |
| starts_at | timestamptz | 開始日時 |
| ends_at | timestamptz | 終了日時 |
| is_active | boolean | 有効状態 |

---

# 23. 通知

## 23.1 notifications

| カラム | 型 | 内容 |
|---|---|---|
| id | uuid | 通知ID |
| user_id | uuid | 通知対象 |
| notification_type | text | 通知種類 |
| title | text | タイトル |
| body | text | 内容 |
| reference_id | uuid | 関連データID |
| is_read | boolean | 既読状態 |
| created_at | timestamptz | 作成日時 |
| read_at | timestamptz | 既読日時 |

基本通知種類：

- like_received
- message_like_received
- match_created
- message_received

運営通知種類：

- age_verification_result
- identity_verification_result
- payment_result
- security_notice

## 23.2 notification_settings

| カラム | 型 | 内容 |
|---|---|---|
| user_id | uuid | 会員ID・主キー |
| like_enabled | boolean | いいね通知 |
| match_enabled | boolean | マッチング通知 |
| message_enabled | boolean | メッセージ通知 |
| show_message_preview | boolean | 本文プレビュー |
| updated_at | timestamptz | 更新日時 |

---

# 24. 通報・安全対策

## 24.1 reports

| カラム | 型 | 内容 |
|---|---|---|
| id | uuid | 通報ID |
| reporter_id | uuid | 通報会員 |
| reported_user_id | uuid | 対象会員 |
| target_type | text | 通報対象種類 |
| target_id | uuid | 対象データID |
| reason | text | 通報理由 |
| description | text | 詳細 |
| status | text | 対応状態 |
| assigned_admin_id | uuid | 担当管理者 |
| created_at | timestamptz | 通報日時 |
| resolved_at | timestamptz | 対応日時 |

## 24.2 report_evidence

| カラム | 型 | 内容 |
|---|---|---|
| id | uuid | 証拠ID |
| report_id | uuid | 通報ID |
| evidence_type | text | 証拠種類 |
| storage_path | text | 非公開保存先 |
| created_at | timestamptz | 保存日時 |
| expires_at | timestamptz | 保存期限 |

## 24.3 penalties

| カラム | 型 | 内容 |
|---|---|---|
| id | uuid | 処分ID |
| user_id | uuid | 対象会員 |
| report_id | uuid | 関連通報 |
| penalty_type | text | 処分種類 |
| reason | text | 処分理由 |
| admin_id | uuid | 担当管理者 |
| starts_at | timestamptz | 開始日時 |
| ends_at | timestamptz | 終了日時 |
| revoked_at | timestamptz | 取消日時 |

処分種類：

- warning
- feature_restriction
- suspension
- permanent_ban

## 24.4 appeals

| カラム | 型 | 内容 |
|---|---|---|
| id | uuid | 申立ID |
| penalty_id | uuid | 対象処分 |
| user_id | uuid | 申立会員 |
| reason | text | 申立理由 |
| status | text | 対応状態 |
| resolution | text | 対応結果 |
| created_at | timestamptz | 申立日時 |
| resolved_at | timestamptz | 対応日時 |

## 24.5 prohibited_words

| カラム | 型 | 内容 |
|---|---|---|
| id | uuid | 禁止ワードID |
| word | text | 対象文字列 |
| category | text | カテゴリー |
| severity | integer | 重要度 |
| action_type | text | 検知時の処理 |
| is_active | boolean | 有効状態 |

## 24.6 moderation_flags

| カラム | 型 | 内容 |
|---|---|---|
| id | uuid | 検知ID |
| user_id | uuid | 対象会員 |
| target_type | text | 対象種類 |
| target_id | uuid | 対象ID |
| rule_code | text | 検知ルール |
| severity | integer | 重要度 |
| status | text | 確認状態 |
| created_at | timestamptz | 検知日時 |

自動検知結果は管理者審査の参考情報として扱う。

---

# 25. お問い合わせ

## 25.1 inquiries

| カラム | 型 | 内容 |
|---|---|---|
| id | uuid | 問い合わせID |
| user_id | uuid | 会員ID |
| category | text | カテゴリー |
| subject | text | 件名 |
| status | text | 対応状態 |
| assigned_admin_id | uuid | 担当管理者 |
| created_at | timestamptz | 受付日時 |
| closed_at | timestamptz | 完了日時 |

## 25.2 inquiry_messages

| カラム | 型 | 内容 |
|---|---|---|
| id | uuid | 回答ID |
| inquiry_id | uuid | 問い合わせID |
| sender_type | text | user・admin |
| sender_id | uuid | 送信者ID |
| body | text | 内容 |
| attachment_path | text | 添付ファイル |
| created_at | timestamptz | 送信日時 |

---

# 26. 管理者システム

## 26.1 admins

| カラム | 型 | 内容 |
|---|---|---|
| id | uuid | 管理者ID |
| auth_user_id | uuid | 認証ID |
| display_name | text | 管理者名 |
| role_id | uuid | 権限グループ |
| is_active | boolean | 利用状態 |
| last_login_at | timestamptz | 最終ログイン |

## 26.2 admin_roles

| カラム | 型 | 内容 |
|---|---|---|
| id | uuid | 権限グループID |
| code | text | 権限コード |
| name | text | 名称 |

権限グループ案：

- super_admin
- member_manager
- verification_manager
- support_manager
- event_manager
- content_manager
- accounting_manager

初期運営では少人数でも利用できる構造とする。

## 26.3 admin_permissions

| カラム | 型 | 内容 |
|---|---|---|
| id | uuid | 権限ID |
| code | text | 操作権限コード |
| description | text | 権限説明 |

## 26.4 admin_role_permissions

| カラム | 型 | 内容 |
|---|---|---|
| role_id | uuid | 権限グループ |
| permission_id | uuid | 操作権限 |

## 26.5 admin_audit_logs

| カラム | 型 | 内容 |
|---|---|---|
| id | uuid | 操作履歴ID |
| admin_id | uuid | 操作管理者 |
| action | text | 操作内容 |
| target_type | text | 対象種類 |
| target_id | uuid | 対象ID |
| reason | text | 操作理由 |
| change_summary | jsonb | 変更概要 |
| created_at | timestamptz | 操作日時 |

以下の操作は必ず記録する。

- 証明書閲覧
- 認証承認
- 認証否認
- 会員停止
- 強制退会
- ポイント調整
- 決済関連操作
- 設定変更
- 管理者権限変更

秘密情報や証明書画像そのものを操作ログへ保存しない。

---

# 27. システム設定

## 27.1 system_settings

| カラム | 型 | 内容 |
|---|---|---|
| key | text | 設定キー・主キー |
| value | jsonb | 設定値 |
| description | text | 設定説明 |
| updated_by | uuid | 更新管理者 |
| updated_at | timestamptz | 更新日時 |

設定キー例：

- daily_like_free_male
- daily_like_premium
- normal_like_cost
- message_like_cost
- message_like_max_length
- message_max_length
- message_unsend_hours
- profile_photo_limit
- free_footprint_limit
- signup_bonus
- profile_completion_bonus
- age_verification_bonus
- identity_verification_bonus
- daily_login_bonus
- consultation_monthly_limit
- consultation_duration
- introduction_monthly_limit
- recommendation_weights
- maintenance_mode

## 27.2 feature_flags

| カラム | 型 | 内容 |
|---|---|---|
| feature_code | text | 機能コード・主キー |
| is_enabled | boolean | 有効状態 |
| settings | jsonb | 補助設定 |
| updated_at | timestamptz | 更新日時 |

対象機能例：

- payments
- points
- events
- store_reservations
- marriage_support
- diagnosis
- push_notifications
- image_messages

未完成機能は本番環境で無効にできるようにする。

---

# 28. 集計・退会・バックグラウンド処理

## 28.1 daily_statistics

| カラム | 型 | 内容 |
|---|---|---|
| target_date | date | 集計日 |
| metric_code | text | 指標コード |
| dimensions | jsonb | 集計区分 |
| metric_value | numeric | 集計値 |
| updated_at | timestamptz | 更新日時 |

集計指標：

- 総会員数
- 新規登録数
- アクティブ会員数
- 男女比
- 年齢層
- 地域別会員数
- マッチング成立数
- 有料会員数
- 売上
- 退会数

少人数の集計から個人を特定できないように配慮する。

## 28.2 deletion_requests

| カラム | 型 | 内容 |
|---|---|---|
| id | uuid | 削除申請ID |
| user_id | uuid | 対象会員 |
| status | text | 処理状態 |
| requested_at | timestamptz | 申請日時 |
| completed_at | timestamptz | 完了日時 |

## 28.3 background_jobs

| カラム | 型 | 内容 |
|---|---|---|
| id | uuid | 処理ID |
| job_type | text | 処理種類 |
| reference_id | uuid | 関連データID |
| status | text | 処理状態 |
| attempts | integer | 試行回数 |
| scheduled_at | timestamptz | 実行予定日時 |
| completed_at | timestamptz | 完了日時 |

対象処理：

- 通知送信
- 期限切れ権限処理
- 証明書削除
- 退会データ削除
- 集計処理
- 決済照合

---

# 29. Supabase Storage設計

## 29.1 バケット一覧

| バケット名 | 公開設定 | 用途 |
|---|---|---|
| profile-photos | 非公開 | プロフィール写真 |
| verification-documents | 非公開 | 年齢・本人確認書類 |
| message-images | 非公開 | メッセージ画像 |
| report-evidence | 非公開 | 通報証拠 |
| inquiry-attachments | 非公開 | 問い合わせ添付 |
| store-images | 公開可 | 店舗写真 |
| event-images | 公開可 | イベント画像 |
| article-images | 公開可 | コラム画像 |
| diagnosis-images | 公開可 | 診断イラスト |
| stickers | 公開可 | スタンプ |

## 29.2 保存パス例

profile-photos/{user_id}/{photo_id}

verification-documents/{user_id}/{request_id}/{document_id}

message-images/{conversation_id}/{message_id}

report-evidence/{report_id}/{evidence_id}

## 29.3 アクセス制御

- プロフィール写真は閲覧権限を確認して配信する。
- 証明書は権限を持つ管理者のみ閲覧可能とする。
- メッセージ画像は対象会話の閲覧権限を持つ会員のみ閲覧可能とする。
- 通報証拠は権限を持つ管理者のみ閲覧可能とする。
- 必要に応じて短時間有効な署名付きURLを使用する。
- ブロック後も既発行URLが有効な時間を最小限にする。
- ファイル形式と容量を検証する。
- 不要な画像メタデータを削除する。

---

# 30. RLSアクセス制御

一般会員がアクセス可能なすべてのテーブルに適切なRLSを設定する。

RLSだけでカラム単位の公開制限を実現しようとせず、非公開テーブル、限定ビュー、RPCを併用する。

## 30.1 アクセス権限表

| データ | 本人 | 他会員 | 管理者 |
|---|---|---|---|
| アカウント | 制限付き閲覧 | 不可 | 権限による |
| 非公開情報 | 制限付き閲覧 | 不可 | 権限による |
| プロフィール | 閲覧・編集 | 公開項目のみ | 権限による |
| 認証書類 | 申請操作 | 不可 | 審査権限のみ |
| いいね | 関連分のみ | 関連分のみ | 必要時のみ |
| マッチング | 関連分のみ | 関連分のみ | 必要時のみ |
| メッセージ | 関連会話のみ | 関連会話のみ | 通報対応等に限定 |
| お気に入り | 本人のみ | 不可 | 原則不可 |
| 足あと | 権限範囲内 | 不可 | 必要時のみ |
| ブロック | 自分の登録分 | 不可 | 必要時のみ |
| ポイント | 自分の残高・履歴 | 不可 | 権限による |
| 決済 | 自分の履歴 | 不可 | 会計権限のみ |
| 診断回答 | 本人のみ | 不可 | 原則不可 |
| 診断結果 | 本人のみ | 公開許可分 | 必要時のみ |
| 相談記録 | 原則非公開 | 不可 | 担当権限のみ |
| 通報 | 自分の受付情報 | 不可 | 対応権限のみ |
| 管理者操作履歴 | 不可 | 不可 | 監査権限のみ |

管理者であっても無条件に全データへアクセスできる設計にはしない。

---

# 31. サーバー側処理

以下の処理はRPCまたはEdge Functionsを使用して実装する。

## 31.1 会員関連

- complete_registration
- update_profile
- get_public_profile
- search_members
- get_recommended_members
- submit_verification
- review_verification
- withdraw_account

## 31.2 マッチング関連

- get_daily_like_balance
- send_like
- send_message_like
- accept_like
- create_match
- unmatch
- record_footprint
- get_footprints
- add_favorite
- remove_favorite
- block_user
- unblock_user

## 31.3 メッセージ関連

- send_message
- unsend_message
- add_message_reaction
- mark_message_read
- get_read_receipt
- create_date_invitation
- respond_date_invitation
- request_date_change
- respond_date_change

## 31.4 ポイント関連

- grant_points
- spend_points
- purchase_extra_likes
- unlock_feature
- claim_login_bonus
- adjust_points

## 31.5 決済関連

- create_checkout
- verify_purchase
- process_payment_webhook
- update_subscription
- restore_purchase
- process_refund

## 31.6 予約関連

- create_store_reservation
- confirm_store_reservation
- reserve_event
- confirm_event_payment
- cancel_event_reservation
- create_consultation
- create_introduction
- respond_introduction
- create_event_match_request
- respond_event_match_request

## 31.7 診断関連

- submit_diagnosis
- calculate_diagnosis_result
- update_diagnosis_visibility

## 31.8 安全対策関連

- submit_report
- apply_penalty
- revoke_penalty
- submit_appeal
- process_account_deletion

各処理は認証、権限、入力値、利用状態をサーバー側で検証する。

会員IDはクライアントから渡された値を無条件に信用せず、認証済みユーザーIDを使用する。

---

# 32. トランザクション管理

以下の処理は原則として同一データベーストランザクション内で実行する。

## 32.1 いいね送信

- 残数確認
- 重複確認
- いいね登録
- 残数消費
- 通知データ登録

## 32.2 マッチング成立

- 承認条件確認
- いいね状態更新
- マッチング登録
- 会話ルーム作成
- 通知データ登録

## 32.3 ポイント消費

- 残高確認
- ポイント減算
- 取引履歴登録
- 対象機能の解放

## 32.4 ログインボーナス

- 当日獲得確認
- スタンプ登録
- ポイント付与
- 達成報酬判定
- 報酬履歴登録

## 32.5 イベント予約

- 定員確認
- 予約枠確保
- 予約状態更新

外部決済は単一のデータベーストランザクションに含められないため、仮予約、決済確認、再試行、返金処理を組み合わせて整合性を確保する。

---

# 33. インデックス・一意制約

## 33.1 インデックス対象

- profiles.prefecture
- profiles.city
- profiles.gender
- profiles.relationship_purpose
- profiles.marital_history
- accounts.last_active_at
- likes.receiver_id
- likes.sender_id
- matches.user_a_id
- matches.user_b_id
- messages.conversation_id
- messages.created_at
- footprints.target_user_id
- notifications.user_id
- subscriptions.user_id
- point_transactions.user_id
- events.starts_at
- event_reservations.event_id
- reports.status
- consultations.user_id

複合インデックスは実際の検索条件と実行計画を確認して追加する。

## 33.2 一意制約

- 同一趣味の重複登録
- 同一お気に入りの重複登録
- 同一ブロックの重複登録
- 同一方向のいいね重複
- 同一ペアの有効マッチング重複
- 同一日のログインボーナス重複
- 同一月の達成報酬重複
- 同一決済イベント重複
- 同一ポイント取引重複
- 同一イベントの有効予約重複

## 33.3 CHECK制約

- ポイント残高が0以上
- いいね使用数が0以上
- いいね使用数が付与数以下
- 金額が0以上
- 予約人数が1以上
- 最低年齢が最高年齢以下
- 自分自身へのいいね禁止
- 自分自身へのブロック禁止

---

# 34. データ削除方針

退会時は以下の順序で処理する。

1. アカウントを利用不可にする。
2. プロフィールを非公開にする。
3. 新規交流を停止する。
4. セッションを無効化する。
5. 有料契約の状態を確認する。
6. 削除対象データを特定する。
7. 写真・証明書などを削除する。
8. 個人情報を削除または適切に匿名化する。
9. 法令上必要な情報を分離して保存する。
10. 削除処理の完了を記録する。

外部キーの削除ルールはテーブルごとに設定する。

決済記録や安全対策上必要な記録まで無条件に連鎖削除しない。

保存期間は法令とプライバシーポリシーに基づいて確定する。

---

# 35. バックアップ・復旧

- データベースの定期バックアップ
- ストレージのバックアップ方針
- マイグレーション履歴管理
- 復旧手順の文書化
- 誤削除対策
- 本番環境と開発環境の分離
- 定期的な復旧テスト

利用可能なバックアップ機能はSupabaseの契約プランに応じて確認する。

---

# 36. Supabaseプロジェクト構成

推奨ディレクトリ構成：

    sereness-match/
    ├── src/
    ├── public/
    ├── supabase/
    │   ├── config.toml
    │   ├── migrations/
    │   ├── functions/
    │   ├── tests/
    │   └── seed.sql
    ├── .env.example
    ├── .gitignore
    ├── SPEC.md
    ├── FEATURES.md
    ├── DATABASE.md
    ├── UI_DESIGN.md
    ├── ADMIN.md
    ├── SECURITY.md
    ├── PAYMENT.md
    ├── DEVELOPMENT.md
    └── AGENTS.md

既存プロジェクトの構造を確認してから導入する。

---

# 37. マイグレーション作成順序

1. アカウント基本テーブル
2. 管理者権限テーブル
3. システム設定
4. プロフィール
5. 認証審査
6. 会員プラン
7. いいね
8. マッチング
9. ブロック
10. お気に入り・足あと
11. メッセージ
12. デート支援
13. 決済管理
14. ポイント
15. ログインボーナス
16. 店舗
17. イベント
18. 婚活サポート
19. 恋愛タイプ診断
20. コンテンツ
21. 通知
22. 通報・安全対策
23. お問い合わせ
24. 集計・削除処理
25. RLS・Storageポリシー
26. RPC・Edge Functions
27. テストデータ
28. 統合テスト

RLSは各テーブルの作成段階から有効化し、最後まで無防備な状態で放置しない。

---

# 38. 環境変数

フロントエンド用：

    VITE_SUPABASE_URL=
    VITE_SUPABASE_PUBLISHABLE_KEY=

サーバー専用：

    SUPABASE_SERVICE_ROLE_KEY=
    STRIPE_SECRET_KEY=
    STRIPE_WEBHOOK_SECRET=

その他の決済・通知関連キーは採用サービス確定後に追加する。

秘密鍵を以下へ保存してはならない。

- フロントエンドコード
- 公開GitHubリポジトリ
- GitHub Pagesの公開ファイル
- アプリ配布ファイル
- ログ
- 仕様書

.env.exampleには実際の秘密鍵を記載しない。

---

# 39. データベーステスト

## 39.1 アクセス制御テスト

- 他会員の非公開情報を取得できない。
- 他会員の証明書を取得できない。
- 他会員のポイントを変更できない。
- 他会員の決済情報を変更できない。
- 無関係な会話を閲覧できない。
- 管理者権限を自己付与できない。
- 年齢確認状態を自己変更できない。
- 非公開プロフィールを検索できない。

## 39.2 マッチングテスト

- 年齢確認前にいいねできない。
- ブロック相手にいいねできない。
- 残数不足時に送信できない。
- 同じいいねを二重消費しない。
- 同じマッチングが重複成立しない。
- マッチング前にメッセージできない。

## 39.3 ポイントテスト

- 残高不足時に消費できない。
- 同時消費で残高が負数にならない。
- ログインボーナスを二重取得できない。
- 決済通知の再送で二重付与されない。
- ポイント消費と機能解放が一致する。

## 39.4 予約テスト

- イベント定員を超過しない。
- 同じイベントへ重複予約できない。
- 決済失敗時に確定扱いにならない。
- 仮予約期限切れで予約枠が解放される。
- 相談枠が重複予約されない。

## 39.5 退会テスト

- 退会会員が検索結果に表示されない。
- 退会会員がメッセージを送信できない。
- セッションが無効化される。
- 削除対象の画像が削除される。
- 保存対象の法定記録が誤削除されない。

---

# 40. 未確定事項

以下は正式決定まで変更可能な設計とする。

- プロフィール選択肢
- 非公開モードの詳細
- 追加いいねの有効期限
- ポイント有効期限
- ポイント消費優先順位
- メッセージ保存期間
- 認証書類保存期間
- 退会後のデータ保存期間
- イベント割引率
- イベントキャンセル規定
- 婚活相談時間
- 月間相談回数
- お相手紹介人数
- 恋愛診断の判定方法
- おすすめ会員の計算式
- 決済事業者の正式選定
- 通知サービスの正式選定
- 管理者権限の最終構成

未確定事項を勝手に正式仕様へ変更してはならない。

---

# 41. Codexへの開発指示

1. SPEC.md、FEATURES.md、DATABASE.mdを読み込むこと。
2. 既存コードとデータ構造を分析すること。
3. 既存データベースの有無を確認すること。
4. 実装済みテーブルと未実装テーブルを整理すること。
5. テーブル間の外部キー関係を定義すること。
6. マイグレーションSQLを段階的に作成すること。
7. RLSを各テーブルに適切に設定すること。
8. 非公開情報を公開APIから分離すること。
9. サーバー側の権限検証を実装すること。
10. トランザクション処理を実装すること。
11. 重複処理防止を実装すること。
12. テストデータと本番データを分離すること。
13. 実在する利用者の個人情報をテストに使用しないこと。
14. 秘密鍵をGitHubへ登録しないこと。
15. 本番データベースへの破壊的変更を無断で実行しないこと。
16. ローカルまたは開発環境でテストすること。
17. テーブル定義、RLS、RPCのテスト結果を報告すること。
18. 仕様書間の矛盾や不足を発見した場合は報告すること。
19. 未確定事項は設定値または未実装として管理すること。
20. 許可なく本番環境へデプロイしないこと。

本仕様書は論理設計および物理設計の初期案である。

実際のSQL作成時には外部キー、NOT NULL、DEFAULT、UNIQUE、CHECK、削除ルール、RLSポリシーを明確に定義すること。

全テーブルを一括で本番環境へ作成するのではなく、依存関係を整理して段階的に構築すること。

以上。