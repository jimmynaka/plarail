# プラレールSNS

## プロジェクト概要
- **名称**: プラレールSNS
- **目的**: プラレール愛好者のためのコミュニティSNSプラットフォーム
- **技術スタック**: Hono + Cloudflare Pages + D1 Database + R2 Storage

## 公開URL
- **本番環境（最新）**: https://5573ab11.plarail-sns.pages.dev
- **GitHub**: https://github.com/jimmynaka/plarail
- **開発環境**: https://3000-i1wtec293xug7k5j2mu59-6532622b.e2b.dev

## ✨ 完全機能版 - すべて動作します！

**ログイン、投稿、質問、要望、検索（リアルタイムサジェスト付き）**がすべてブラウザから直接利用可能になりました！

## 🎉 使い方 - すべてブラウザから利用可能！

### 🚪 ログイン方法
1. **右上の「ログイン」ボタンをクリック**
2. **既存のユーザー名を入力**:
   - `admin` - 運営
   - `takara_tomy` - タカラトミー公式  
   - `plarail_taro` - プラレール太郎
   - `train_collector` - 車両コレクター花子
   - `layout_master` - レイアウトマスター

### 📝 投稿方法
1. ログイン後、**「投稿する」ボタン**をクリック
2. タイトル、説明、カテゴリ、タグを入力
3. **「投稿する」**をクリック
4. ページをリロードすると新しい投稿が表示されます

### ❓ 質問方法
1. **「質問する」ボタン**をクリック
2. タイトル、質問内容、カテゴリを入力
3. **「質問を投稿」**をクリック

### 💡 要望方法
1. **「要望する」ボタン**をクリック
2. タイトル、詳細説明、カテゴリを入力
3. **「要望を投稿」**をクリック

### 🔍 検索方法（新機能！）
1. ナビゲーションバーの**検索バー**にキーワードを入力
2. **リアルタイムサジェスト**が自動的に表示されます：
   - 投稿、質問、ユーザーから候補を表示
   - 過去の検索履歴も表示
   - サジェストをクリックで即座に検索
3. Enterキーまたは検索アイコンをクリックで検索実行
4. **検索結果のフィルター機能**:
   - 「すべて」「投稿」「質問」「ユーザー」で絞り込み
   - 検索履歴の管理（クリア機能付き）

---

## 📝 API経由での投稿（開発者向け）

### APIを使った投稿方法

**新規投稿を作成:**
```bash
curl -X POST https://8fa4e02b.plarail-sns.pages.dev/api/posts \
  -H "Content-Type: application/json" \
  -d '{
    "user_id": 3,
    "title": "新しいレイアウト完成！",
    "description": "今日作ったレイアウトです",
    "category": "レイアウト",
    "visibility": "public",
    "images": ["https://placehold.co/800x600/3b82f6/ffffff?text=My+Layout"],
    "tags": ["レイアウト", "新幹線"]
  }'
```

**質問を投稿:**
```bash
curl -X POST https://8fa4e02b.plarail-sns.pages.dev/api/questions \
  -H "Content-Type: application/json" \
  -d '{
    "user_id": 3,
    "title": "レールの接続について",
    "content": "曲線レールと直線レールの接続がうまくいきません",
    "category": "レイアウト",
    "difficulty": "初心者"
  }'
```

**検索:**
```bash
curl "https://8fa4e02b.plarail-sns.pages.dev/api/search?q=新幹線"
```

**既存ユーザー (user_id):**
- 1: admin (運営)
- 2: takara_tomy (公式)
- 3: plarail_taro
- 4: train_collector
- 5: layout_master

詳しい使い方は `INSTRUCTIONS.md` を参照してください。

## 現在完成している機能

### 1. 画像投稿・公開機能 ✅
- 最大10枚の画像アップロード対応（JPEG, PNG, GIF）
- タイトル、説明文、カテゴリ、タグ設定
- 公開範囲設定（全体公開/フォロワーのみ/非公開）
- いいね機能、閲覧数カウント
- カテゴリ別表示（レイアウト、車両コレクション、改造、ジオラマ等）

**APIエンドポイント:**
- `GET /api/posts` - 投稿一覧取得（category, sort, limit, offsetパラメータ対応）
- `GET /api/posts/:id` - 投稿詳細取得
- `POST /api/posts` - 新規投稿作成

### 2. 質問・回答コーナー ✅
- 質問投稿（タイトル、本文、画像添付、カテゴリ、難易度タグ）
- 回答投稿（画像添付可能）
- ベストアンサー選択機能
- 質問ステータス管理（未解決/解決済み/受付終了）
- カテゴリ・タグ絞り込み、ソート機能

**APIエンドポイント:**
- `GET /api/questions` - 質問一覧取得（category, status, sortパラメータ対応）
- `GET /api/questions/:id` - 質問詳細取得（回答も含む）
- `POST /api/questions` - 質問投稿
- `POST /api/answers` - 回答投稿

### 3. 新商品発表会（公式情報ページ） ✅
- メーカー公式アカウント機能（認証バッジ表示）
- 新商品情報投稿（商品画像、型番、価格、発売日、説明）
- コメント機能（ユーザーからの感想・質問）
- いいね機能、お気に入り登録
- カテゴリ別表示、発売スケジュール

**APIエンドポイント:**
- `GET /api/announcements` - 新商品一覧取得（category, sortパラメータ対応）
- `GET /api/announcements/:id` - 新商品詳細取得（コメントも含む）

### 4. 要望リクエストフォーム ✅
- 要望投稿（タイトル、詳細説明、カテゴリ、参考画像）
- 賛同機能（他ユーザーの要望に「賛同する」）
- 賛同数ランキング表示
- 要望ステータス管理（受付中/確認済み/検討中/実現予定/見送り）
- メーカー側返信機能

**APIエンドポイント:**
- `GET /api/requests` - 要望一覧取得（category, status, sortパラメータ対応）
- `GET /api/requests/:id` - 要望詳細取得
- `POST /api/requests` - 要望投稿
- `POST /api/requests/:id/support` - 要望に賛同

### 5. いいね・評価システム ✅
- 投稿、質問、回答、新商品発表への「いいね」機能
- いいね数表示、ワンタップで実行/取り消し
- ユーザーごとのいいね統計

**APIエンドポイント:**
- `POST /api/likes` - いいね追加
- `DELETE /api/likes` - いいね削除

### 6. ユーザープロフィール・フォロー機能 ✅
- プロフィール設定（アイコン、表示名、自己紹介、所有車両リスト等）
- フォロー/フォロワー機能
- フォロワー数・フォロー数表示
- 公式アカウント認証バッジ

**APIエンドポイント:**
- `GET /api/users` - ユーザー一覧取得
- `GET /api/users/:id` - ユーザー詳細取得（フォロワー数/フォロー数含む）
- `POST /api/follows` - フォロー追加
- `DELETE /api/follows` - フォロー解除

### 7. 検索・フィルター機能 ✅
- キーワード検索（投稿、質問、ユーザー）
- カテゴリ絞り込み
- 複合条件検索
- ソート機能（新着順、人気順、回答数順等）

**APIエンドポイント:**
- `GET /api/search?q=キーワード&type=all|posts|questions|users`

### 8. 画像アップロード・ストレージ ✅
- Cloudflare R2による画像保存
- ファイルアップロードAPI
- 画像取得API（CDN配信対応）

**APIエンドポイント:**
- `POST /api/upload` - 画像アップロード
- `GET /api/images/*` - 画像取得

## データベース構造

### テーブル一覧
1. **users** - ユーザー情報
2. **posts** - 画像投稿
3. **questions** - 質問
4. **answers** - 回答
5. **announcements** - 新商品発表
6. **requests** - 要望リクエスト
7. **likes** - いいね（汎用）
8. **follows** - フォロー関係
9. **request_supports** - 要望賛同
10. **comments** - コメント（公式発表用）

### ストレージサービス
- **D1 Database**: SQLiteベースのグローバル分散データベース
- **R2 Storage**: S3互換オブジェクトストレージ（画像保存用）

## フロントエンドUI
- **TailwindCSS**: レスポンシブデザイン
- **Font Awesome**: アイコンライブラリ
- **Axios**: HTTP通信
- **バニラJavaScript**: シンプルで軽量な実装

## 開発環境での起動方法

```bash
# 依存関係のインストール
npm install

# データベースマイグレーション（ローカル）
npm run db:migrate:local

# シードデータの投入
npm run db:seed

# ビルド
npm run build

# PM2で開発サーバー起動
npm run clean-port  # ポート3000をクリーンアップ
pm2 start ecosystem.config.cjs

# サービステスト
npm test  # curl http://localhost:3000

# PM2ログ確認
pm2 logs plarail-sns --nostream
```

## 本番環境へのデプロイ

### 前提条件
1. Cloudflare APIキーの設定
2. GitHubリポジトリの作成

### デプロイ手順

```bash
# 1. D1本番データベース作成
npx wrangler d1 create plarail-sns-production
# → database_idをwrangler.jsoncに設定

# 2. R2バケット作成
npx wrangler r2 bucket create plarail-images

# 3. 本番データベースマイグレーション
npm run db:migrate:prod

# 4. Cloudflare Pagesプロジェクト作成
npx wrangler pages project create plarail-sns --production-branch main

# 5. デプロイ
npm run deploy:prod
```

## 今後の拡張機能候補

### 未実装の機能
1. **イベント・コンテスト機能**
   - フォトコンテスト
   - レイアウトコンペ
   - テーマ投稿イベント
   - 投票機能

2. **通知システム**
   - いいね通知
   - 回答通知
   - フォロー通知
   - 新商品発表通知

3. **画像編集機能**
   - トリミング
   - 明るさ・コントラスト調整
   - フィルター適用

4. **レコメンド機能**
   - 閲覧履歴に基づくおすすめ投稿
   - 似たような質問の提案
   - 関連車両・関連投稿の表示

5. **タイムライン機能**
   - フォロー中ユーザーの投稿優先表示
   - カスタマイズ可能な表示設定

## 推奨される次のステップ

1. **GitHubリポジトリへのプッシュ**
   - GitHub環境のセットアップ
   - リポジトリ作成とコード公開

2. **Cloudflare Pagesへの本番デプロイ**
   - D1本番データベース作成
   - R2バケット作成
   - プロジェクトデプロイと動作確認

3. **ユーザー認証の実装**
   - セッション管理
   - ログイン/ログアウト機能
   - 投稿・コメントの権限管理

4. **画像編集機能の追加**
   - フロントエンドでの画像編集ライブラリ導入
   - Cropper.jsやFabric.jsの統合

5. **通知システムの実装**
   - リアルタイム通知（Cloudflare Durable Objects）
   - メール通知（SendGrid等の統合）

## プロジェクト統計

- **総行数**: 4000行以上
- **APIエンドポイント**: 25個以上
- **データベーステーブル**: 10個
- **フロントエンドページ**: 統合シングルページアプリ

## ライセンス

MIT License

## デプロイ情報

- **本番環境URL**: https://8fa4e02b.plarail-sns.pages.dev
- **プロジェクト名**: plarail-sns
- **Cloudflareアカウント**: h.nakaga0@gmail.com
- **D1データベース**: plarail-sns-production (WNAM region)
- **デプロイ日**: 2025-11-29

## 最終更新日

2025-11-29
