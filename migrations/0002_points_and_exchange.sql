-- ポイント・投げ銭・交換システム

-- ポイント取引履歴テーブル
CREATE TABLE IF NOT EXISTS point_transactions (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  from_user_id INTEGER, -- NULL の場合はシステムからの付与
  to_user_id INTEGER NOT NULL,
  amount INTEGER NOT NULL,
  transaction_type TEXT NOT NULL, -- tip(投げ銭), login(ログインボーナス), system(システム付与), exchange(交換)
  target_type TEXT, -- post, question, answer, announcement
  target_id INTEGER, -- 投げ銭対象のID
  message TEXT, -- 投げ銭メッセージ
  created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
  FOREIGN KEY (from_user_id) REFERENCES users(id) ON DELETE CASCADE,
  FOREIGN KEY (to_user_id) REFERENCES users(id) ON DELETE CASCADE
);

-- 交換所アイテムテーブル
CREATE TABLE IF NOT EXISTS exchange_items (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  name TEXT NOT NULL,
  description TEXT NOT NULL,
  category TEXT NOT NULL, -- goods(グッズ), event(イベント参加券), privilege(特典)
  image_url TEXT,
  required_points INTEGER NOT NULL,
  stock_quantity INTEGER DEFAULT -1, -- -1は無制限
  is_available BOOLEAN DEFAULT 1,
  created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
  updated_at DATETIME DEFAULT CURRENT_TIMESTAMP
);

-- 交換履歴テーブル
CREATE TABLE IF NOT EXISTS exchange_history (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  user_id INTEGER NOT NULL,
  item_id INTEGER NOT NULL,
  points_used INTEGER NOT NULL,
  status TEXT DEFAULT 'pending', -- pending(処理中), completed(完了), cancelled(キャンセル)
  shipping_info TEXT, -- 配送情報（JSON）
  notes TEXT,
  created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
  updated_at DATETIME DEFAULT CURRENT_TIMESTAMP,
  FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE,
  FOREIGN KEY (item_id) REFERENCES exchange_items(id)
);

-- インデックス作成
CREATE INDEX IF NOT EXISTS idx_point_transactions_from_user ON point_transactions(from_user_id);
CREATE INDEX IF NOT EXISTS idx_point_transactions_to_user ON point_transactions(to_user_id);
CREATE INDEX IF NOT EXISTS idx_point_transactions_type ON point_transactions(transaction_type);
CREATE INDEX IF NOT EXISTS idx_point_transactions_created_at ON point_transactions(created_at DESC);

CREATE INDEX IF NOT EXISTS idx_exchange_items_category ON exchange_items(category);
CREATE INDEX IF NOT EXISTS idx_exchange_items_points ON exchange_items(required_points);

CREATE INDEX IF NOT EXISTS idx_exchange_history_user ON exchange_history(user_id);
CREATE INDEX IF NOT EXISTS idx_exchange_history_item ON exchange_history(item_id);
CREATE INDEX IF NOT EXISTS idx_exchange_history_status ON exchange_history(status);
