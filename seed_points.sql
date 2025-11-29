-- 交換所アイテムのシードデータ

-- グッズカテゴリ
INSERT INTO exchange_items (name, description, category, image_url, required_points, stock_quantity, is_available) VALUES
('プラレールオリジナルTシャツ', '限定デザインのプラレールSNSオリジナルTシャツ（サイズ: S/M/L/XL）', 'goods', 'https://placehold.co/400x400/3b82f6/ffffff?text=T-Shirt', 500, 50, 1),
('プラレールステッカーセット', '人気車両10種類のステッカーセット', 'goods', 'https://placehold.co/400x400/10b981/ffffff?text=Stickers', 100, 200, 1),
('オリジナルトートバッグ', 'A4サイズ対応のキャンバス地トートバッグ', 'goods', 'https://placehold.co/400x400/6366f1/ffffff?text=Tote+Bag', 300, 100, 1),
('プラレールマグカップ', '陶器製オリジナルデザインマグカップ（350ml）', 'goods', 'https://placehold.co/400x400/f59e0b/ffffff?text=Mug+Cup', 250, 80, 1),
('レイアウトガイドブック', 'プロが教える本格レイアウト制作ガイド（PDF版）', 'goods', 'https://placehold.co/400x400/8b5cf6/ffffff?text=Guidebook', 150, -1, 1),
('プラレールキーホルダー', '金属製ミニチュア新幹線キーホルダー', 'goods', 'https://placehold.co/400x400/ec4899/ffffff?text=Keychain', 120, 150, 1),
('オリジナル巾着袋', '小物収納に便利な巾着袋（サイズ: M）', 'goods', 'https://placehold.co/400x400/14b8a6/ffffff?text=Pouch', 80, 300, 1),
('限定ピンバッジセット', 'コレクター必見！限定デザインピンバッジ5個セット', 'goods', 'https://placehold.co/400x400/f97316/ffffff?text=Pin+Badge', 200, 60, 1),

-- イベント参加券
('プラレール撮影会参加券', '月1回開催の撮影会に参加できる権利', 'event', 'https://placehold.co/400x400/3b82f6/ffffff?text=Photo+Event', 300, 30, 1),
('レイアウトコンテスト参加券', '年4回開催のレイアウトコンテストへの参加権', 'event', 'https://placehold.co/400x400/10b981/ffffff?text=Contest', 200, 50, 1),
('オンライン交流会参加券', 'プラレール愛好者とのオンライン交流会', 'event', 'https://placehold.co/400x400/6366f1/ffffff?text=Online+Meet', 100, -1, 1),
('工場見学ツアー参加券', 'タカラトミー工場見学ツアー（抽選）', 'event', 'https://placehold.co/400x400/f59e0b/ffffff?text=Factory+Tour', 800, 20, 1),
('プラレール博入場券', 'プラレール博の優先入場券（2枚セット）', 'event', 'https://placehold.co/400x400/8b5cf6/ffffff?text=Expo+Ticket', 400, 40, 1),

-- 特典
('プロフィールバッジ「ゴールド」', 'プロフィールに表示されるゴールドバッジ（30日間）', 'privilege', 'https://placehold.co/400x400/fbbf24/ffffff?text=Gold+Badge', 150, -1, 1),
('プロフィールバッジ「プラチナ」', 'プロフィールに表示されるプラチナバッジ（30日間）', 'privilege', 'https://placehold.co/400x400/e5e7eb/ffffff?text=Platinum', 300, -1, 1),
('投稿ハイライト機能', '投稿がトップページに7日間固定表示される', 'privilege', 'https://placehold.co/400x400/3b82f6/ffffff?text=Highlight', 200, -1, 1),
('プレミアムアイコンフレーム', 'プロフィールアイコンに特別フレーム（永久）', 'privilege', 'https://placehold.co/400x400/ec4899/ffffff?text=Frame', 500, -1, 1),
('広告非表示機能', 'サイト内の広告を30日間非表示（※将来実装）', 'privilege', 'https://placehold.co/400x400/6366f1/ffffff?text=Ad-Free', 250, -1, 1),
('レア車両情報早期通知', '新商品情報を一般公開の24時間前に通知', 'privilege', 'https://placehold.co/400x400/f59e0b/ffffff?text=Early+Access', 180, -1, 1);

-- 全ユーザーに初期ポイント100を付与（マイグレーションで既に付与済み）
-- ログインボーナス10ポイントは手動で付与する必要あり
