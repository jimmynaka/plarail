-- テストユーザーデータ
INSERT OR IGNORE INTO users (id, username, email, display_name, bio, is_official, points, plarail_history, specialty_tags, owned_trains) VALUES 
  (1, 'admin', 'admin@plarail-sns.com', 'プラレールSNS運営', '公式アカウントです', 1, 100, NULL, NULL, NULL),
  (2, 'takara_tomy', 'official@takaratomy.co.jp', 'タカラトミー公式', 'プラレール公式アカウント', 1, 100, NULL, NULL, NULL),
  (3, 'plarail_taro', 'taro@example.com', 'プラレール太郎', 'プラレール歴30年のベテランです。レイアウト作りが得意です。', 0, 100, '30年', '["レイアウト設計", "改造"]', '["新幹線N700S", "ドクターイエロー", "E5系はやぶさ"]'),
  (4, 'train_collector', 'collector@example.com', '車両コレクター花子', 'プラレールを500両以上コレクションしています！', 0, 100, '15年', '["車両収集", "塗装"]', '["E6系こまち", "E7系かがやき", "923形ドクターイエロー"]'),
  (5, 'layout_master', 'layout@example.com', 'レイアウトマスター', '複雑なレイアウト作りが趣味です。', 0, 100, '10年', '["レイアウト設計", "電飾"]', '["N700系新幹線", "E233系", "EF66電気機関車"]');

-- テスト投稿データ
INSERT OR IGNORE INTO posts (user_id, title, description, category, visibility, images, tags, like_count) VALUES 
  (3, '巨大レイアウト完成！', '3ヶ月かけて作った8畳の大レイアウトがついに完成しました。立体交差や駅も複数配置しています。', 'レイアウト', 'public', '["https://placehold.co/800x600/3b82f6/ffffff?text=Layout1", "https://placehold.co/800x600/3b82f6/ffffff?text=Layout2"]', '["レイアウト", "立体交差", "複線"]', 45),
  (4, '今月の新車両コレクション', '今月購入した新幹線車両たちです。E5系とE6系の連結がお気に入り！', '車両コレクション', 'public', '["https://placehold.co/800x600/10b981/ffffff?text=Collection"]', '["E5系", "E6系", "新幹線"]', 32),
  (5, 'LED電飾改造に挑戦', '車両にLEDライトを組み込んでみました。夜間走行がリアルになります。', '改造', 'public', '["https://placehold.co/800x600/f59e0b/ffffff?text=LED+Mod"]', '["改造", "LED", "電飾"]', 67);

-- テスト質問データ
INSERT OR IGNORE INTO questions (user_id, title, content, category, difficulty, status, answer_count) VALUES 
  (3, 'レールの接続がうまくいきません', '複線レイアウトを作っているのですが、曲線レールと直線レールの接続部分がずれてしまいます。何か良い方法はありますか？', 'レイアウト', '初心者', 'open', 2),
  (4, 'ドクターイエローの入手方法', 'ドクターイエローの特別仕様車が欲しいのですが、どこで購入できますか？限定品でしょうか？', '購入相談', '初心者', 'open', 1),
  (5, '古い車両のモーター交換', '10年前の車両のモーターが弱くなってきました。モーター交換は可能でしょうか？', 'メンテナンス', '中級者', 'solved', 3);

-- テスト回答データ
INSERT OR IGNORE INTO answers (question_id, user_id, content, is_best_answer, like_count) VALUES 
  (1, 5, 'レイアウトプランナーアプリを使って事前に設計すると失敗が減りますよ。また、接続部に薄いプラ板を挟むと調整できます。', 0, 5),
  (1, 4, '私も同じ問題に悩みましたが、公式の「曲線レイアウトガイド」を参考にすると解決しました。タカラトミーの公式サイトにPDFがあります。', 0, 3),
  (2, 3, 'トイザらスやヨドバシカメラなどの大型店舗で取り扱いがあります。ネット通販も便利ですよ。', 0, 2),
  (3, 4, 'タカラトミーの修理サービスでモーター交換できます。費用は1,000円程度です。', 1, 8),
  (3, 5, '自分で交換する場合は、同じ型番のモーターを用意する必要があります。ネジ止めなので工具があれば可能です。', 0, 4);

UPDATE questions SET best_answer_id = 4 WHERE id = 3;

-- 新商品発表データ
INSERT OR IGNORE INTO announcements (user_id, title, product_name, product_code, price, release_date, description, images, category, like_count) VALUES 
  (2, '新幹線E8系「つばさ」発売決定！', 'プラレール E8系新幹線つばさ', 'S-23', 2800, '2025-03-15', '2024年にデビューしたE8系新幹線がプラレールに登場！リアルな車体デザインと3両編成で臨場感たっぷり。', '["https://placehold.co/800x600/dc2626/ffffff?text=E8+Tsubasa"]', '車両', 89),
  (2, '新レール「大曲線レール」登場', '大曲線レール（4本セット）', 'R-50', 1200, '2025-02-01', 'より大きなカーブが作れる大曲線レールが新登場。広いレイアウト作りに最適です。', '["https://placehold.co/800x600/2563eb/ffffff?text=Curve+Rail"]', 'レール', 45),
  (2, '情景部品「プラレールタワー駅」', 'プラレールタワー駅セット', 'J-30', 5800, '2025-04-10', '3階建ての大型駅セット。エレベーター可動ギミック付き。', '["https://placehold.co/800x600/059669/ffffff?text=Tower+Station"]', '情景部品', 123);

-- 要望リクエストデータ
INSERT OR IGNORE INTO requests (user_id, title, description, category, status, support_count) VALUES 
  (3, 'E235系横須賀線の発売希望', 'E235系横須賀線カラーのプラレールを発売してほしいです。山手線や総武線はありますが、横須賀線カラーもぜひ！', '新車両', 'pending', 234),
  (4, 'トンネルセットの復刻希望', '1990年代に発売されていた「大トンネルセット」の復刻版を希望します。当時のデザインのままで。', '復刻要望', 'confirmed', 567),
  (5, 'レールの耐久性向上', 'レールの接続部分がすぐに緩くなってしまうので、より耐久性の高い素材への改良を希望します。', '既存商品改良', 'in_review', 890),
  (3, '透明レールの商品化', '透明なレールがあると、立体交差が美しく見えると思います。クリアパーツの採用を希望します。', '新レール・情景部品', 'pending', 445);

-- いいねデータ
INSERT OR IGNORE INTO likes (user_id, target_type, target_id) VALUES 
  (3, 'post', 1),
  (4, 'post', 1),
  (5, 'post', 1),
  (3, 'post', 2),
  (5, 'post', 2),
  (4, 'announcement', 1),
  (3, 'announcement', 1),
  (5, 'announcement', 1);

-- フォローデータ
INSERT OR IGNORE INTO follows (follower_id, following_id) VALUES 
  (3, 2),
  (4, 2),
  (5, 2),
  (3, 4),
  (3, 5),
  (4, 3),
  (4, 5),
  (5, 3),
  (5, 4);

-- 要望賛同データ
INSERT OR IGNORE INTO request_supports (user_id, request_id) VALUES 
  (3, 2),
  (4, 1),
  (4, 2),
  (5, 1),
  (5, 2),
  (5, 3);

-- コメントデータ
INSERT OR IGNORE INTO comments (user_id, announcement_id, content) VALUES 
  (3, 1, '待ってました！絶対買います！'),
  (4, 1, 'E8系かっこいいですね。発売日が楽しみです。'),
  (5, 1, '3両編成なのが嬉しいです。連結して走らせたい。'),
  (3, 3, 'タワー駅すごい！エレベーターギミックが気になります。');
