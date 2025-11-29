-- プラレールSNS データベーススキーマ

-- ユーザーテーブル
CREATE TABLE IF NOT EXISTS users (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  username TEXT UNIQUE NOT NULL,
  email TEXT UNIQUE NOT NULL,
  display_name TEXT NOT NULL,
  avatar_url TEXT,
  bio TEXT,
  plarail_history TEXT, -- プラレール歴
  specialty_tags TEXT, -- 得意分野タグ（JSON配列）
  owned_trains TEXT, -- 所有車両リスト（JSON配列）
  social_links TEXT, -- SNSリンク（JSON）
  is_official BOOLEAN DEFAULT 0, -- 公式アカウントフラグ
  created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
  updated_at DATETIME DEFAULT CURRENT_TIMESTAMP
);

-- 画像投稿テーブル
CREATE TABLE IF NOT EXISTS posts (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  user_id INTEGER NOT NULL,
  title TEXT NOT NULL,
  description TEXT,
  category TEXT NOT NULL, -- レイアウト、車両コレクション、改造、ジオラマ等
  visibility TEXT DEFAULT 'public', -- public, followers, private
  images TEXT NOT NULL, -- 画像URL配列（JSON）
  tags TEXT, -- 使用車両・レールタグ（JSON配列）
  like_count INTEGER DEFAULT 0,
  view_count INTEGER DEFAULT 0,
  created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
  updated_at DATETIME DEFAULT CURRENT_TIMESTAMP,
  FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
);

-- 質問テーブル
CREATE TABLE IF NOT EXISTS questions (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  user_id INTEGER NOT NULL,
  title TEXT NOT NULL,
  content TEXT NOT NULL,
  category TEXT NOT NULL, -- 車両、レイアウト、購入相談、メンテナンス等
  difficulty TEXT, -- 初心者、中級者、上級者
  status TEXT DEFAULT 'open', -- open, solved, closed
  images TEXT, -- 画像URL配列（JSON）
  tags TEXT, -- タグ（JSON配列）
  answer_count INTEGER DEFAULT 0,
  view_count INTEGER DEFAULT 0,
  best_answer_id INTEGER,
  created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
  updated_at DATETIME DEFAULT CURRENT_TIMESTAMP,
  FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
);

-- 回答テーブル
CREATE TABLE IF NOT EXISTS answers (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  question_id INTEGER NOT NULL,
  user_id INTEGER NOT NULL,
  content TEXT NOT NULL,
  images TEXT, -- 画像URL配列（JSON）
  like_count INTEGER DEFAULT 0,
  is_best_answer BOOLEAN DEFAULT 0,
  created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
  updated_at DATETIME DEFAULT CURRENT_TIMESTAMP,
  FOREIGN KEY (question_id) REFERENCES questions(id) ON DELETE CASCADE,
  FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
);

-- 新商品発表テーブル
CREATE TABLE IF NOT EXISTS announcements (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  user_id INTEGER NOT NULL, -- メーカー公式アカウント
  title TEXT NOT NULL,
  product_name TEXT NOT NULL,
  product_code TEXT,
  price INTEGER,
  release_date DATE,
  description TEXT,
  images TEXT, -- 画像URL配列（JSON）
  video_url TEXT, -- プロモーション動画URL
  official_url TEXT, -- 公式サイトリンク
  category TEXT, -- 車両、レール、情景部品等
  like_count INTEGER DEFAULT 0,
  comment_count INTEGER DEFAULT 0,
  notify_on_release BOOLEAN DEFAULT 0,
  created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
  updated_at DATETIME DEFAULT CURRENT_TIMESTAMP,
  FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
);

-- 要望リクエストテーブル
CREATE TABLE IF NOT EXISTS requests (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  user_id INTEGER NOT NULL,
  title TEXT NOT NULL,
  description TEXT NOT NULL,
  category TEXT NOT NULL, -- 新車両、新レール・情景部品、既存商品改良、復刻要望等
  images TEXT, -- 参考画像URL配列（JSON）
  status TEXT DEFAULT 'pending', -- pending, confirmed, in_review, planned, rejected
  support_count INTEGER DEFAULT 0, -- 賛同数
  manufacturer_response TEXT, -- メーカーからの返信
  created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
  updated_at DATETIME DEFAULT CURRENT_TIMESTAMP,
  FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
);

-- いいねテーブル（汎用）
CREATE TABLE IF NOT EXISTS likes (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  user_id INTEGER NOT NULL,
  target_type TEXT NOT NULL, -- post, question, answer, announcement
  target_id INTEGER NOT NULL,
  created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
  FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE,
  UNIQUE(user_id, target_type, target_id)
);

-- フォローテーブル
CREATE TABLE IF NOT EXISTS follows (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  follower_id INTEGER NOT NULL, -- フォローする人
  following_id INTEGER NOT NULL, -- フォローされる人
  created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
  FOREIGN KEY (follower_id) REFERENCES users(id) ON DELETE CASCADE,
  FOREIGN KEY (following_id) REFERENCES users(id) ON DELETE CASCADE,
  UNIQUE(follower_id, following_id)
);

-- 要望賛同テーブル
CREATE TABLE IF NOT EXISTS request_supports (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  user_id INTEGER NOT NULL,
  request_id INTEGER NOT NULL,
  created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
  FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE,
  FOREIGN KEY (request_id) REFERENCES requests(id) ON DELETE CASCADE,
  UNIQUE(user_id, request_id)
);

-- コメントテーブル（公式発表へのコメント）
CREATE TABLE IF NOT EXISTS comments (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  user_id INTEGER NOT NULL,
  announcement_id INTEGER NOT NULL,
  content TEXT NOT NULL,
  created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
  FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE,
  FOREIGN KEY (announcement_id) REFERENCES announcements(id) ON DELETE CASCADE
);

-- インデックス作成
CREATE INDEX IF NOT EXISTS idx_posts_user_id ON posts(user_id);
CREATE INDEX IF NOT EXISTS idx_posts_category ON posts(category);
CREATE INDEX IF NOT EXISTS idx_posts_created_at ON posts(created_at DESC);

CREATE INDEX IF NOT EXISTS idx_questions_user_id ON questions(user_id);
CREATE INDEX IF NOT EXISTS idx_questions_category ON questions(category);
CREATE INDEX IF NOT EXISTS idx_questions_status ON questions(status);
CREATE INDEX IF NOT EXISTS idx_questions_created_at ON questions(created_at DESC);

CREATE INDEX IF NOT EXISTS idx_answers_question_id ON answers(question_id);
CREATE INDEX IF NOT EXISTS idx_answers_user_id ON answers(user_id);

CREATE INDEX IF NOT EXISTS idx_announcements_user_id ON announcements(user_id);
CREATE INDEX IF NOT EXISTS idx_announcements_category ON announcements(category);
CREATE INDEX IF NOT EXISTS idx_announcements_release_date ON announcements(release_date);

CREATE INDEX IF NOT EXISTS idx_requests_category ON requests(category);
CREATE INDEX IF NOT EXISTS idx_requests_status ON requests(status);
CREATE INDEX IF NOT EXISTS idx_requests_support_count ON requests(support_count DESC);

CREATE INDEX IF NOT EXISTS idx_likes_user_id ON likes(user_id);
CREATE INDEX IF NOT EXISTS idx_likes_target ON likes(target_type, target_id);

CREATE INDEX IF NOT EXISTS idx_follows_follower ON follows(follower_id);
CREATE INDEX IF NOT EXISTS idx_follows_following ON follows(following_id);

CREATE INDEX IF NOT EXISTS idx_request_supports_request ON request_supports(request_id);
CREATE INDEX IF NOT EXISTS idx_request_supports_user ON request_supports(user_id);

CREATE INDEX IF NOT EXISTS idx_comments_announcement ON comments(announcement_id);
