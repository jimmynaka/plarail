import { Hono } from 'hono'
import { cors } from 'hono/cors'
import { serveStatic } from 'hono/cloudflare-workers'
import type { Bindings } from './types'

const app = new Hono<{ Bindings: Bindings }>()

// CORS設定
app.use('/api/*', cors())

// 静的ファイル配信
app.use('/static/*', serveStatic({ root: './' }))

// ==================== API Routes ====================

// ===== ユーザーAPI =====
// ユーザー一覧取得
app.get('/api/users', async (c) => {
  const { DB } = c.env
  const { results } = await DB.prepare('SELECT id, username, display_name, avatar_url, bio, is_official FROM users ORDER BY created_at DESC LIMIT 50').all()
  return c.json({ users: results })
})

// ユーザー詳細取得
app.get('/api/users/:id', async (c) => {
  const { DB } = c.env
  const id = c.req.param('id')
  const user = await DB.prepare('SELECT * FROM users WHERE id = ?').bind(id).first()
  if (!user) return c.json({ error: 'User not found' }, 404)
  
  // フォロワー数・フォロー数取得
  const followers = await DB.prepare('SELECT COUNT(*) as count FROM follows WHERE following_id = ?').bind(id).first()
  const following = await DB.prepare('SELECT COUNT(*) as count FROM follows WHERE follower_id = ?').bind(id).first()
  
  return c.json({ 
    user,
    follower_count: followers?.count || 0,
    following_count: following?.count || 0
  })
})

// ===== 投稿API =====
// 投稿一覧取得
app.get('/api/posts', async (c) => {
  const { DB } = c.env
  const category = c.req.query('category')
  const sort = c.req.query('sort') || 'latest'
  const limit = parseInt(c.req.query('limit') || '20')
  const offset = parseInt(c.req.query('offset') || '0')
  
  let query = `
    SELECT p.*, u.username, u.display_name, u.avatar_url, u.is_official
    FROM posts p
    LEFT JOIN users u ON p.user_id = u.id
    WHERE p.visibility = 'public'
  `
  const params: any[] = []
  
  if (category) {
    query += ' AND p.category = ?'
    params.push(category)
  }
  
  if (sort === 'popular') {
    query += ' ORDER BY p.like_count DESC, p.created_at DESC'
  } else {
    query += ' ORDER BY p.created_at DESC'
  }
  
  query += ' LIMIT ? OFFSET ?'
  params.push(limit, offset)
  
  const { results } = await DB.prepare(query).bind(...params).all()
  return c.json({ posts: results })
})

// 投稿詳細取得
app.get('/api/posts/:id', async (c) => {
  const { DB } = c.env
  const id = c.req.param('id')
  
  const post = await DB.prepare(`
    SELECT p.*, u.username, u.display_name, u.avatar_url, u.is_official
    FROM posts p
    LEFT JOIN users u ON p.user_id = u.id
    WHERE p.id = ?
  `).bind(id).first()
  
  if (!post) return c.json({ error: 'Post not found' }, 404)
  
  // 閲覧数カウント
  await DB.prepare('UPDATE posts SET view_count = view_count + 1 WHERE id = ?').bind(id).run()
  
  return c.json({ post })
})

// 投稿作成
app.post('/api/posts', async (c) => {
  const { DB } = c.env
  const body = await c.req.json()
  const { user_id, title, description, category, visibility, images, tags } = body
  
  if (!user_id || !title || !category || !images) {
    return c.json({ error: 'Missing required fields' }, 400)
  }
  
  const result = await DB.prepare(`
    INSERT INTO posts (user_id, title, description, category, visibility, images, tags)
    VALUES (?, ?, ?, ?, ?, ?, ?)
  `).bind(user_id, title, description || '', category, visibility || 'public', JSON.stringify(images), JSON.stringify(tags || [])).run()
  
  return c.json({ success: true, id: result.meta.last_row_id })
})

// ===== 質問API =====
// 質問一覧取得
app.get('/api/questions', async (c) => {
  const { DB } = c.env
  const category = c.req.query('category')
  const status = c.req.query('status')
  const sort = c.req.query('sort') || 'latest'
  const limit = parseInt(c.req.query('limit') || '20')
  const offset = parseInt(c.req.query('offset') || '0')
  
  let query = `
    SELECT q.*, u.username, u.display_name, u.avatar_url
    FROM questions q
    LEFT JOIN users u ON q.user_id = u.id
    WHERE 1=1
  `
  const params: any[] = []
  
  if (category) {
    query += ' AND q.category = ?'
    params.push(category)
  }
  
  if (status) {
    query += ' AND q.status = ?'
    params.push(status)
  }
  
  if (sort === 'popular') {
    query += ' ORDER BY q.answer_count DESC, q.created_at DESC'
  } else if (sort === 'unanswered') {
    query += ' AND q.answer_count = 0 ORDER BY q.created_at DESC'
  } else {
    query += ' ORDER BY q.created_at DESC'
  }
  
  query += ' LIMIT ? OFFSET ?'
  params.push(limit, offset)
  
  const { results } = await DB.prepare(query).bind(...params).all()
  return c.json({ questions: results })
})

// 質問詳細取得
app.get('/api/questions/:id', async (c) => {
  const { DB } = c.env
  const id = c.req.param('id')
  
  const question = await DB.prepare(`
    SELECT q.*, u.username, u.display_name, u.avatar_url
    FROM questions q
    LEFT JOIN users u ON q.user_id = u.id
    WHERE q.id = ?
  `).bind(id).first()
  
  if (!question) return c.json({ error: 'Question not found' }, 404)
  
  // 回答取得
  const { results: answers } = await DB.prepare(`
    SELECT a.*, u.username, u.display_name, u.avatar_url
    FROM answers a
    LEFT JOIN users u ON a.user_id = u.id
    WHERE a.question_id = ?
    ORDER BY a.is_best_answer DESC, a.like_count DESC, a.created_at ASC
  `).bind(id).all()
  
  // 閲覧数カウント
  await DB.prepare('UPDATE questions SET view_count = view_count + 1 WHERE id = ?').bind(id).run()
  
  return c.json({ question, answers })
})

// 質問投稿
app.post('/api/questions', async (c) => {
  const { DB } = c.env
  const body = await c.req.json()
  const { user_id, title, content, category, difficulty, images, tags } = body
  
  if (!user_id || !title || !content || !category) {
    return c.json({ error: 'Missing required fields' }, 400)
  }
  
  const result = await DB.prepare(`
    INSERT INTO questions (user_id, title, content, category, difficulty, images, tags)
    VALUES (?, ?, ?, ?, ?, ?, ?)
  `).bind(user_id, title, content, category, difficulty || '', JSON.stringify(images || []), JSON.stringify(tags || [])).run()
  
  return c.json({ success: true, id: result.meta.last_row_id })
})

// 回答投稿
app.post('/api/answers', async (c) => {
  const { DB } = c.env
  const body = await c.req.json()
  const { question_id, user_id, content, images } = body
  
  if (!question_id || !user_id || !content) {
    return c.json({ error: 'Missing required fields' }, 400)
  }
  
  const result = await DB.prepare(`
    INSERT INTO answers (question_id, user_id, content, images)
    VALUES (?, ?, ?, ?)
  `).bind(question_id, user_id, content, JSON.stringify(images || [])).run()
  
  // 質問の回答数を更新
  await DB.prepare('UPDATE questions SET answer_count = answer_count + 1 WHERE id = ?').bind(question_id).run()
  
  return c.json({ success: true, id: result.meta.last_row_id })
})

// ===== 新商品発表API =====
// 新商品一覧取得
app.get('/api/announcements', async (c) => {
  const { DB } = c.env
  const category = c.req.query('category')
  const sort = c.req.query('sort') || 'latest'
  const limit = parseInt(c.req.query('limit') || '20')
  const offset = parseInt(c.req.query('offset') || '0')
  
  let query = `
    SELECT a.*, u.username, u.display_name, u.avatar_url, u.is_official
    FROM announcements a
    LEFT JOIN users u ON a.user_id = u.id
    WHERE 1=1
  `
  const params: any[] = []
  
  if (category) {
    query += ' AND a.category = ?'
    params.push(category)
  }
  
  if (sort === 'popular') {
    query += ' ORDER BY a.like_count DESC, a.created_at DESC'
  } else if (sort === 'upcoming') {
    query += ' AND a.release_date >= date("now") ORDER BY a.release_date ASC'
  } else {
    query += ' ORDER BY a.created_at DESC'
  }
  
  query += ' LIMIT ? OFFSET ?'
  params.push(limit, offset)
  
  const { results } = await DB.prepare(query).bind(...params).all()
  return c.json({ announcements: results })
})

// 新商品詳細取得
app.get('/api/announcements/:id', async (c) => {
  const { DB } = c.env
  const id = c.req.param('id')
  
  const announcement = await DB.prepare(`
    SELECT a.*, u.username, u.display_name, u.avatar_url, u.is_official
    FROM announcements a
    LEFT JOIN users u ON a.user_id = u.id
    WHERE a.id = ?
  `).bind(id).first()
  
  if (!announcement) return c.json({ error: 'Announcement not found' }, 404)
  
  // コメント取得
  const { results: comments } = await DB.prepare(`
    SELECT c.*, u.username, u.display_name, u.avatar_url
    FROM comments c
    LEFT JOIN users u ON c.user_id = u.id
    WHERE c.announcement_id = ?
    ORDER BY c.created_at DESC
  `).bind(id).all()
  
  return c.json({ announcement, comments })
})

// ===== 要望リクエストAPI =====
// 要望一覧取得
app.get('/api/requests', async (c) => {
  const { DB } = c.env
  const category = c.req.query('category')
  const status = c.req.query('status')
  const sort = c.req.query('sort') || 'popular'
  const limit = parseInt(c.req.query('limit') || '20')
  const offset = parseInt(c.req.query('offset') || '0')
  
  let query = `
    SELECT r.*, u.username, u.display_name, u.avatar_url
    FROM requests r
    LEFT JOIN users u ON r.user_id = u.id
    WHERE 1=1
  `
  const params: any[] = []
  
  if (category) {
    query += ' AND r.category = ?'
    params.push(category)
  }
  
  if (status) {
    query += ' AND r.status = ?'
    params.push(status)
  }
  
  if (sort === 'popular') {
    query += ' ORDER BY r.support_count DESC, r.created_at DESC'
  } else {
    query += ' ORDER BY r.created_at DESC'
  }
  
  query += ' LIMIT ? OFFSET ?'
  params.push(limit, offset)
  
  const { results } = await DB.prepare(query).bind(...params).all()
  return c.json({ requests: results })
})

// 要望詳細取得
app.get('/api/requests/:id', async (c) => {
  const { DB } = c.env
  const id = c.req.param('id')
  
  const request = await DB.prepare(`
    SELECT r.*, u.username, u.display_name, u.avatar_url
    FROM requests r
    LEFT JOIN users u ON r.user_id = u.id
    WHERE r.id = ?
  `).bind(id).first()
  
  if (!request) return c.json({ error: 'Request not found' }, 404)
  
  return c.json({ request })
})

// 要望投稿
app.post('/api/requests', async (c) => {
  const { DB } = c.env
  const body = await c.req.json()
  const { user_id, title, description, category, images } = body
  
  if (!user_id || !title || !description || !category) {
    return c.json({ error: 'Missing required fields' }, 400)
  }
  
  const result = await DB.prepare(`
    INSERT INTO requests (user_id, title, description, category, images)
    VALUES (?, ?, ?, ?, ?)
  `).bind(user_id, title, description, category, JSON.stringify(images || [])).run()
  
  return c.json({ success: true, id: result.meta.last_row_id })
})

// 要望賛同
app.post('/api/requests/:id/support', async (c) => {
  const { DB } = c.env
  const id = c.req.param('id')
  const { user_id } = await c.req.json()
  
  if (!user_id) return c.json({ error: 'Missing user_id' }, 400)
  
  // 重複チェック
  const existing = await DB.prepare('SELECT id FROM request_supports WHERE user_id = ? AND request_id = ?').bind(user_id, id).first()
  if (existing) return c.json({ error: 'Already supported' }, 400)
  
  await DB.prepare('INSERT INTO request_supports (user_id, request_id) VALUES (?, ?)').bind(user_id, id).run()
  await DB.prepare('UPDATE requests SET support_count = support_count + 1 WHERE id = ?').bind(id).run()
  
  return c.json({ success: true })
})

// ===== いいねAPI =====
// いいね追加
app.post('/api/likes', async (c) => {
  const { DB } = c.env
  const { user_id, target_type, target_id } = await c.req.json()
  
  if (!user_id || !target_type || !target_id) {
    return c.json({ error: 'Missing required fields' }, 400)
  }
  
  // 重複チェック
  const existing = await DB.prepare('SELECT id FROM likes WHERE user_id = ? AND target_type = ? AND target_id = ?').bind(user_id, target_type, target_id).first()
  if (existing) return c.json({ error: 'Already liked' }, 400)
  
  await DB.prepare('INSERT INTO likes (user_id, target_type, target_id) VALUES (?, ?, ?)').bind(user_id, target_type, target_id).run()
  
  // いいね数カウント更新
  if (target_type === 'post') {
    await DB.prepare('UPDATE posts SET like_count = like_count + 1 WHERE id = ?').bind(target_id).run()
  } else if (target_type === 'announcement') {
    await DB.prepare('UPDATE announcements SET like_count = like_count + 1 WHERE id = ?').bind(target_id).run()
  } else if (target_type === 'answer') {
    await DB.prepare('UPDATE answers SET like_count = like_count + 1 WHERE id = ?').bind(target_id).run()
  }
  
  return c.json({ success: true })
})

// いいね削除
app.delete('/api/likes', async (c) => {
  const { DB } = c.env
  const { user_id, target_type, target_id } = await c.req.json()
  
  if (!user_id || !target_type || !target_id) {
    return c.json({ error: 'Missing required fields' }, 400)
  }
  
  await DB.prepare('DELETE FROM likes WHERE user_id = ? AND target_type = ? AND target_id = ?').bind(user_id, target_type, target_id).run()
  
  // いいね数カウント更新
  if (target_type === 'post') {
    await DB.prepare('UPDATE posts SET like_count = like_count - 1 WHERE id = ?').bind(target_id).run()
  } else if (target_type === 'announcement') {
    await DB.prepare('UPDATE announcements SET like_count = like_count - 1 WHERE id = ?').bind(target_id).run()
  } else if (target_type === 'answer') {
    await DB.prepare('UPDATE answers SET like_count = like_count - 1 WHERE id = ?').bind(target_id).run()
  }
  
  return c.json({ success: true })
})

// ===== フォローAPI =====
// フォロー追加
app.post('/api/follows', async (c) => {
  const { DB } = c.env
  const { follower_id, following_id } = await c.req.json()
  
  if (!follower_id || !following_id) {
    return c.json({ error: 'Missing required fields' }, 400)
  }
  
  // 重複チェック
  const existing = await DB.prepare('SELECT id FROM follows WHERE follower_id = ? AND following_id = ?').bind(follower_id, following_id).first()
  if (existing) return c.json({ error: 'Already following' }, 400)
  
  await DB.prepare('INSERT INTO follows (follower_id, following_id) VALUES (?, ?)').bind(follower_id, following_id).run()
  
  return c.json({ success: true })
})

// フォロー解除
app.delete('/api/follows', async (c) => {
  const { DB } = c.env
  const { follower_id, following_id } = await c.req.json()
  
  if (!follower_id || !following_id) {
    return c.json({ error: 'Missing required fields' }, 400)
  }
  
  await DB.prepare('DELETE FROM follows WHERE follower_id = ? AND following_id = ?').bind(follower_id, following_id).run()
  
  return c.json({ success: true })
})

// ===== 画像アップロードAPI =====
app.post('/api/upload', async (c) => {
  const { R2 } = c.env
  const formData = await c.req.formData()
  const file = formData.get('file') as File
  
  if (!file) return c.json({ error: 'No file provided' }, 400)
  
  // ファイル名生成
  const timestamp = Date.now()
  const randomStr = Math.random().toString(36).substring(7)
  const ext = file.name.split('.').pop()
  const key = `uploads/${timestamp}-${randomStr}.${ext}`
  
  // R2にアップロード
  await R2.put(key, await file.arrayBuffer(), {
    httpMetadata: {
      contentType: file.type
    }
  })
  
  // 公開URLを返す（実際の環境ではR2のカスタムドメインを使用）
  return c.json({ 
    success: true, 
    url: `/api/images/${key}`,
    key 
  })
})

// R2から画像取得
app.get('/api/images/*', async (c) => {
  const { R2 } = c.env
  const key = c.req.path.replace('/api/images/', '')
  
  const object = await R2.get(key)
  if (!object) return c.notFound()
  
  return new Response(object.body, {
    headers: {
      'Content-Type': object.httpMetadata?.contentType || 'application/octet-stream',
      'Cache-Control': 'public, max-age=31536000'
    }
  })
})

// ===== 検索API =====
app.get('/api/search', async (c) => {
  const { DB } = c.env
  const q = c.req.query('q')
  const type = c.req.query('type') || 'all'
  const limit = parseInt(c.req.query('limit') || '20')
  
  if (!q) return c.json({ error: 'Missing search query' }, 400)
  
  const results: any = {}
  const searchTerm = `%${q}%`
  
  if (type === 'all' || type === 'posts') {
    const { results: posts } = await DB.prepare(`
      SELECT p.*, u.username, u.display_name, u.avatar_url
      FROM posts p
      LEFT JOIN users u ON p.user_id = u.id
      WHERE p.title LIKE ? OR p.description LIKE ?
      ORDER BY p.created_at DESC LIMIT ?
    `).bind(searchTerm, searchTerm, limit).all()
    results.posts = posts
  }
  
  if (type === 'all' || type === 'questions') {
    const { results: questions } = await DB.prepare(`
      SELECT q.*, u.username, u.display_name, u.avatar_url
      FROM questions q
      LEFT JOIN users u ON q.user_id = u.id
      WHERE q.title LIKE ? OR q.content LIKE ?
      ORDER BY q.created_at DESC LIMIT ?
    `).bind(searchTerm, searchTerm, limit).all()
    results.questions = questions
  }
  
  if (type === 'all' || type === 'users') {
    const { results: users } = await DB.prepare(`
      SELECT id, username, display_name, avatar_url, bio, is_official
      FROM users
      WHERE username LIKE ? OR display_name LIKE ?
      LIMIT ?
    `).bind(searchTerm, searchTerm, limit).all()
    results.users = users
  }
  
  return c.json(results)
})

// ===== ポイント・投げ銭システムAPI =====

// ユーザーのポイント残高取得
app.get('/api/users/:id/points', async (c) => {
  const { DB } = c.env
  const userId = c.req.param('id')
  
  const user = await DB.prepare('SELECT points FROM users WHERE id = ?').bind(userId).first()
  if (!user) return c.json({ error: 'User not found' }, 404)
  
  return c.json({ points: user.points || 0 })
})

// ログインボーナス付与
app.post('/api/users/:id/daily-bonus', async (c) => {
  const { DB } = c.env
  const userId = c.req.param('id')
  const bonusAmount = 10
  
  // 今日すでに受け取っているかチェック
  const today = new Date().toISOString().split('T')[0]
  const { results } = await DB.prepare(`
    SELECT * FROM point_transactions 
    WHERE to_user_id = ? AND transaction_type = 'login' 
    AND DATE(created_at) = ?
  `).bind(userId, today).all()
  
  if (results && results.length > 0) {
    return c.json({ error: 'Already received today' }, 400)
  }
  
  // ポイント付与
  await DB.prepare('UPDATE users SET points = points + ? WHERE id = ?')
    .bind(bonusAmount, userId).run()
  
  await DB.prepare(`
    INSERT INTO point_transactions (to_user_id, amount, transaction_type)
    VALUES (?, ?, 'login')
  `).bind(userId, bonusAmount).run()
  
  const user = await DB.prepare('SELECT points FROM users WHERE id = ?').bind(userId).first()
  
  return c.json({ success: true, points: user.points, bonus: bonusAmount })
})

// 投げ銭送信
app.post('/api/tips', async (c) => {
  const { DB } = c.env
  const body = await c.req.json()
  const { from_user_id, to_user_id, amount, target_type, target_id, message } = body
  
  if (!from_user_id || !to_user_id || !amount) {
    return c.json({ error: 'Missing required fields' }, 400)
  }
  
  if (amount < 10 || amount > 1000) {
    return c.json({ error: 'Amount must be between 10 and 1000' }, 400)
  }
  
  // 自分に送ることはできない
  if (from_user_id === to_user_id) {
    return c.json({ error: 'Cannot send to yourself' }, 400)
  }
  
  // 送信者の残高チェック
  const sender = await DB.prepare('SELECT points FROM users WHERE id = ?').bind(from_user_id).first()
  if (!sender || sender.points < amount) {
    return c.json({ error: 'Insufficient points' }, 400)
  }
  
  // トランザクション実行
  await DB.prepare('UPDATE users SET points = points - ? WHERE id = ?')
    .bind(amount, from_user_id).run()
  await DB.prepare('UPDATE users SET points = points + ? WHERE id = ?')
    .bind(amount, to_user_id).run()
  
  await DB.prepare(`
    INSERT INTO point_transactions 
    (from_user_id, to_user_id, amount, transaction_type, target_type, target_id, message)
    VALUES (?, ?, ?, 'tip', ?, ?, ?)
  `).bind(from_user_id, to_user_id, amount, target_type, target_id, message).run()
  
  return c.json({ success: true })
})

// ポイント取引履歴取得
app.get('/api/users/:id/transactions', async (c) => {
  const { DB } = c.env
  const userId = c.req.param('id')
  const limit = parseInt(c.req.query('limit') || '50')
  
  const { results } = await DB.prepare(`
    SELECT pt.*, 
           fu.username as from_username, fu.display_name as from_display_name,
           tu.username as to_username, tu.display_name as to_display_name
    FROM point_transactions pt
    LEFT JOIN users fu ON pt.from_user_id = fu.id
    LEFT JOIN users tu ON pt.to_user_id = tu.id
    WHERE pt.from_user_id = ? OR pt.to_user_id = ?
    ORDER BY pt.created_at DESC
    LIMIT ?
  `).bind(userId, userId, limit).all()
  
  return c.json({ transactions: results || [] })
})

// ===== 交換所API =====

// 交換可能アイテム一覧取得
app.get('/api/exchange/items', async (c) => {
  const { DB } = c.env
  const category = c.req.query('category')
  
  let query = 'SELECT * FROM exchange_items WHERE is_available = 1'
  const params: any[] = []
  
  if (category) {
    query += ' AND category = ?'
    params.push(category)
  }
  
  query += ' ORDER BY required_points ASC'
  
  const { results } = await DB.prepare(query).bind(...params).all()
  return c.json({ items: results || [] })
})

// アイテム詳細取得
app.get('/api/exchange/items/:id', async (c) => {
  const { DB } = c.env
  const itemId = c.req.param('id')
  
  const item = await DB.prepare('SELECT * FROM exchange_items WHERE id = ?').bind(itemId).first()
  if (!item) return c.json({ error: 'Item not found' }, 404)
  
  return c.json(item)
})

// アイテム交換
app.post('/api/exchange', async (c) => {
  const { DB } = c.env
  const body = await c.req.json()
  const { user_id, item_id, shipping_info } = body
  
  if (!user_id || !item_id) {
    return c.json({ error: 'Missing required fields' }, 400)
  }
  
  // アイテム取得
  const item = await DB.prepare('SELECT * FROM exchange_items WHERE id = ?').bind(item_id).first()
  if (!item) return c.json({ error: 'Item not found' }, 404)
  if (!item.is_available) return c.json({ error: 'Item not available' }, 400)
  
  // 在庫チェック
  if (item.stock_quantity >= 0 && item.stock_quantity <= 0) {
    return c.json({ error: 'Out of stock' }, 400)
  }
  
  // ユーザーの残高チェック
  const user = await DB.prepare('SELECT points FROM users WHERE id = ?').bind(user_id).first()
  if (!user || user.points < item.required_points) {
    return c.json({ error: 'Insufficient points' }, 400)
  }
  
  // トランザクション実行
  await DB.prepare('UPDATE users SET points = points - ? WHERE id = ?')
    .bind(item.required_points, user_id).run()
  
  // 在庫減少（無制限の場合は減らさない）
  if (item.stock_quantity >= 0) {
    await DB.prepare('UPDATE exchange_items SET stock_quantity = stock_quantity - 1 WHERE id = ?')
      .bind(item_id).run()
  }
  
  // 交換履歴記録
  const result = await DB.prepare(`
    INSERT INTO exchange_history (user_id, item_id, points_used, shipping_info, status)
    VALUES (?, ?, ?, ?, 'pending')
  `).bind(user_id, item_id, item.required_points, shipping_info || null).run()
  
  // ポイント取引履歴
  await DB.prepare(`
    INSERT INTO point_transactions (to_user_id, amount, transaction_type)
    VALUES (?, ?, 'exchange')
  `).bind(user_id, -item.required_points).run()
  
  return c.json({ 
    success: true, 
    exchange_id: result.meta.last_row_id,
    remaining_points: user.points - item.required_points
  })
})

// 交換履歴取得
app.get('/api/users/:id/exchanges', async (c) => {
  const { DB } = c.env
  const userId = c.req.param('id')
  const limit = parseInt(c.req.query('limit') || '50')
  
  const { results } = await DB.prepare(`
    SELECT eh.*, ei.name, ei.description, ei.image_url, ei.category
    FROM exchange_history eh
    LEFT JOIN exchange_items ei ON eh.item_id = ei.id
    WHERE eh.user_id = ?
    ORDER BY eh.created_at DESC
    LIMIT ?
  `).bind(userId, limit).all()
  
  return c.json({ exchanges: results || [] })
})

// ==================== Frontend Routes ====================

// ホームページ
// ホームページ
app.get('/', (c) => {
  return c.html(`
    <!DOCTYPE html>
    <html lang="ja">
    <head>
        <meta charset="UTF-8">
        <meta name="viewport" content="width=device-width, initial-scale=1.0">
        <title>プラレールSNS - コミュニティプラットフォーム</title>
        <script src="https://cdn.tailwindcss.com"></script>
        <link href="https://cdn.jsdelivr.net/npm/@fortawesome/fontawesome-free@6.4.0/css/all.min.css" rel="stylesheet">
        <style>
          .hero-gradient {
            background: linear-gradient(135deg, #667eea 0%, #764ba2 100%);
          }
          .card-hover:hover {
            transform: translateY(-4px);
            box-shadow: 0 10px 25px rgba(0,0,0,0.1);
            transition: all 0.3s ease;
          }
        </style>
    </head>
    <body class="bg-gray-50">
        <!-- ナビゲーションバー -->
        <nav class="bg-white shadow-sm sticky top-0 z-50">
            <div class="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
                <div class="flex justify-between h-16 items-center">
                    <div class="flex items-center cursor-pointer" onclick="scrollToTop()">
                        <i class="fas fa-train text-3xl text-purple-600 mr-3"></i>
                        <span class="text-2xl font-bold text-gray-800">プラレールSNS</span>
                    </div>
                    
                    <!-- 検索バー -->
                    <div class="flex-1 max-w-xl mx-8">
                        <form id="search-form" class="relative">
                            <input type="text" id="search-input" placeholder="投稿、質問、ユーザーを検索..." 
                                   class="w-full px-4 py-2 pr-10 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-purple-600">
                            <button type="submit" class="absolute right-2 top-2 text-gray-400 hover:text-purple-600">
                                <i class="fas fa-search"></i>
                            </button>
                        </form>
                    </div>
                    
                    <div class="flex items-center space-x-4">
                        <button onclick="scrollToSection('posts')" class="text-gray-600 hover:text-purple-600 transition">
                            <i class="fas fa-images mr-1"></i>投稿
                        </button>
                        <button onclick="scrollToSection('questions')" class="text-gray-600 hover:text-purple-600 transition">
                            <i class="fas fa-question-circle mr-1"></i>質問
                        </button>
                        <button onclick="showExchangeModal()" class="text-gray-600 hover:text-purple-600 transition">
                            <i class="fas fa-gift mr-1"></i>交換所
                        </button>
                        
                        <!-- ログイン前 -->
                        <button id="login-btn" onclick="showLoginModal()" class="bg-purple-600 text-white px-4 py-2 rounded-lg hover:bg-purple-700 transition">
                            <i class="fas fa-user mr-1"></i>ログイン
                        </button>
                        
                        <!-- ログイン後 -->
                        <div id="user-menu" style="display:none;" class="flex items-center space-x-4">
                            <div onclick="showPointsModal()" class="cursor-pointer bg-gradient-to-r from-yellow-400 to-orange-500 text-white px-4 py-2 rounded-lg font-bold hover:scale-105 transition">
                                <i class="fas fa-coins mr-1"></i><span id="user-points">0</span>P
                            </div>
                            <span id="user-display-name" class="text-gray-700 font-semibold"></span>
                            <button onclick="logout()" class="text-gray-600 hover:text-red-600 transition">
                                <i class="fas fa-sign-out-alt"></i> ログアウト
                            </button>
                        </div>
                    </div>
                </div>
            </div>
        </nav>

        <!-- ヒーローセクション -->
        <div class="hero-gradient text-white py-20">
            <div class="max-w-7xl mx-auto px-4 text-center">
                <h1 class="text-5xl font-bold mb-4">プラレール愛好者のためのSNS</h1>
                <p class="text-xl mb-8">作品を共有し、知識を交換し、コミュニティを楽しもう</p>
                <div class="flex justify-center space-x-4">
                    <button onclick="showPostModal()" class="bg-white text-purple-600 px-8 py-3 rounded-lg font-semibold hover:bg-gray-100 transition">
                        <i class="fas fa-camera mr-2"></i>投稿する
                    </button>
                    <button onclick="showExploreModal()" class="bg-transparent border-2 border-white text-white px-8 py-3 rounded-lg font-semibold hover:bg-white hover:text-purple-600 transition">
                        <i class="fas fa-compass mr-2"></i>探索する
                    </button>
                </div>
            </div>
        </div>

        <!-- 主要機能セクション -->
        <div class="max-w-7xl mx-auto px-4 py-16">
            <h2 class="text-3xl font-bold text-center mb-12 text-gray-800">主要機能</h2>
            <div class="grid md:grid-cols-2 lg:grid-cols-4 gap-6">
                <!-- 画像投稿 -->
                <div class="bg-white rounded-lg shadow-md p-6 card-hover cursor-pointer" onclick="showPostModal()">
                    <div class="text-blue-500 text-4xl mb-4"><i class="fas fa-images"></i></div>
                    <h3 class="text-xl font-semibold mb-2">画像投稿</h3>
                    <p class="text-gray-600">レイアウトやコレクションを共有しよう</p>
                    <button class="mt-4 text-blue-600 hover:underline">投稿する →</button>
                </div>
                
                <!-- 質問・回答 -->
                <div class="bg-white rounded-lg shadow-md p-6 card-hover cursor-pointer" onclick="showQuestionModal()">
                    <div class="text-green-500 text-4xl mb-4"><i class="fas fa-question-circle"></i></div>
                    <h3 class="text-xl font-semibold mb-2">質問・回答</h3>
                    <p class="text-gray-600">困ったことを相談して解決しよう</p>
                    <button class="mt-4 text-green-600 hover:underline">質問する →</button>
                </div>
                
                <!-- 新商品発表 -->
                <div class="bg-white rounded-lg shadow-md p-6 card-hover">
                    <div class="text-purple-500 text-4xl mb-4"><i class="fas fa-bullhorn"></i></div>
                    <h3 class="text-xl font-semibold mb-2">新商品発表</h3>
                    <p class="text-gray-600">最新のプラレール情報をチェック</p>
                    <a href="#announcements" class="mt-4 text-purple-600 hover:underline inline-block">発表を見る →</a>
                </div>
                
                <!-- 要望リクエスト -->
                <div class="bg-white rounded-lg shadow-md p-6 card-hover cursor-pointer" onclick="showRequestModal()">
                    <div class="text-orange-500 text-4xl mb-4"><i class="fas fa-lightbulb"></i></div>
                    <h3 class="text-xl font-semibold mb-2">要望リクエスト</h3>
                    <p class="text-gray-600">欲しい商品をメーカーに届けよう</p>
                    <button class="mt-4 text-orange-600 hover:underline">要望する →</button>
                </div>
            </div>
        </div>

        <!-- 検索結果エリア -->
        <div id="search-results" class="max-w-7xl mx-auto px-4 pb-8" style="display:none;"></div>

        <!-- コンテンツエリア -->
        <div id="content-area" class="max-w-7xl mx-auto px-4 pb-16">
            <div id="posts" class="mb-16">
                <div class="flex justify-between items-center mb-6">
                    <h2 class="text-3xl font-bold text-gray-800"><i class="fas fa-images mr-2"></i>最新の投稿</h2>
                    <button onclick="showPostModal()" class="bg-purple-600 text-white px-4 py-2 rounded-lg hover:bg-purple-700 transition">
                        <i class="fas fa-plus mr-1"></i>新規投稿
                    </button>
                </div>
                <div id="posts-container" class="grid md:grid-cols-2 lg:grid-cols-3 gap-6">
                    <!-- 投稿カードがここに表示されます -->
                </div>
            </div>

            <div id="questions" class="mb-16">
                <div class="flex justify-between items-center mb-6">
                    <h2 class="text-3xl font-bold text-gray-800"><i class="fas fa-question-circle mr-2"></i>最新の質問</h2>
                    <button onclick="showQuestionModal()" class="bg-green-600 text-white px-4 py-2 rounded-lg hover:bg-green-700 transition">
                        <i class="fas fa-plus mr-1"></i>質問する
                    </button>
                </div>
                <div id="questions-container" class="space-y-4">
                    <!-- 質問カードがここに表示されます -->
                </div>
            </div>

            <div id="announcements" class="mb-16">
                <h2 class="text-3xl font-bold mb-6 text-gray-800"><i class="fas fa-bullhorn mr-2"></i>新商品発表</h2>
                <div id="announcements-container" class="grid md:grid-cols-2 gap-6">
                    <!-- 新商品カードがここに表示されます -->
                </div>
            </div>

            <div id="requests">
                <div class="flex justify-between items-center mb-6">
                    <h2 class="text-3xl font-bold text-gray-800"><i class="fas fa-lightbulb mr-2"></i>人気の要望</h2>
                    <button onclick="showRequestModal()" class="bg-orange-600 text-white px-4 py-2 rounded-lg hover:bg-orange-700 transition">
                        <i class="fas fa-plus mr-1"></i>要望する
                    </button>
                </div>
                <div id="requests-container" class="space-y-4">
                    <!-- 要望カードがここに表示されます -->
                </div>
            </div>
        </div>

        <!-- ログインモーダル -->
        <div id="login-modal" class="hidden modal fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
            <div class="bg-white rounded-lg p-8 max-w-md w-full mx-4">
                <div class="flex justify-between items-center mb-6">
                    <h2 class="text-2xl font-bold">ログイン</h2>
                    <button onclick="closeLoginModal()" class="text-gray-500 hover:text-gray-700">
                        <i class="fas fa-times text-2xl"></i>
                    </button>
                </div>
                <form onsubmit="handleLogin(event)">
                    <div class="mb-4">
                        <label class="block text-gray-700 mb-2">ユーザー名</label>
                        <input type="text" id="login-username" required
                               class="w-full px-4 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-purple-600"
                               placeholder="例: plarail_taro">
                        <p class="text-sm text-gray-500 mt-2">既存のユーザー名: admin, takara_tomy, plarail_taro, train_collector, layout_master</p>
                    </div>
                    <button type="submit" class="w-full bg-purple-600 text-white py-2 rounded-lg hover:bg-purple-700 transition">
                        ログイン
                    </button>
                </form>
            </div>
        </div>

        <!-- 投稿モーダル -->
        <div id="post-modal" class="hidden modal fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
            <div class="bg-white rounded-lg p-8 max-w-2xl w-full mx-4 max-h-[90vh] overflow-y-auto">
                <div class="flex justify-between items-center mb-6">
                    <h2 class="text-2xl font-bold">新規投稿</h2>
                    <button onclick="closePostModal()" class="text-gray-500 hover:text-gray-700">
                        <i class="fas fa-times text-2xl"></i>
                    </button>
                </div>
                <form id="post-form" onsubmit="submitPost(event)">
                    <div class="mb-4">
                        <label class="block text-gray-700 mb-2">タイトル *</label>
                        <input type="text" id="post-title" required
                               class="w-full px-4 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-purple-600">
                    </div>
                    <div class="mb-4">
                        <label class="block text-gray-700 mb-2">説明</label>
                        <textarea id="post-description" rows="4"
                                  class="w-full px-4 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-purple-600"></textarea>
                    </div>
                    <div class="mb-4">
                        <label class="block text-gray-700 mb-2">カテゴリ *</label>
                        <select id="post-category" required
                                class="w-full px-4 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-purple-600">
                            <option value="レイアウト">レイアウト</option>
                            <option value="車両コレクション">車両コレクション</option>
                            <option value="改造">改造</option>
                            <option value="ジオラマ">ジオラマ</option>
                        </select>
                    </div>
                    <div class="mb-4">
                        <label class="block text-gray-700 mb-2">タグ（カンマ区切り）</label>
                        <input type="text" id="post-tags" placeholder="例: 新幹線, E5系, レイアウト"
                               class="w-full px-4 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-purple-600">
                    </div>
                    <button type="submit" class="w-full bg-purple-600 text-white py-2 rounded-lg hover:bg-purple-700 transition">
                        投稿する
                    </button>
                </form>
            </div>
        </div>

        <!-- 質問モーダル -->
        <div id="question-modal" class="hidden modal fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
            <div class="bg-white rounded-lg p-8 max-w-2xl w-full mx-4 max-h-[90vh] overflow-y-auto">
                <div class="flex justify-between items-center mb-6">
                    <h2 class="text-2xl font-bold">質問する</h2>
                    <button onclick="closeQuestionModal()" class="text-gray-500 hover:text-gray-700">
                        <i class="fas fa-times text-2xl"></i>
                    </button>
                </div>
                <form id="question-form" onsubmit="submitQuestion(event)">
                    <div class="mb-4">
                        <label class="block text-gray-700 mb-2">タイトル *</label>
                        <input type="text" id="question-title" required
                               class="w-full px-4 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-green-600">
                    </div>
                    <div class="mb-4">
                        <label class="block text-gray-700 mb-2">質問内容 *</label>
                        <textarea id="question-content" rows="6" required
                                  class="w-full px-4 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-green-600"></textarea>
                    </div>
                    <div class="mb-4">
                        <label class="block text-gray-700 mb-2">カテゴリ *</label>
                        <select id="question-category" required
                                class="w-full px-4 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-green-600">
                            <option value="車両">車両</option>
                            <option value="レイアウト">レイアウト</option>
                            <option value="購入相談">購入相談</option>
                            <option value="メンテナンス">メンテナンス</option>
                        </select>
                    </div>
                    <div class="mb-4">
                        <label class="block text-gray-700 mb-2">難易度</label>
                        <select id="question-difficulty"
                                class="w-full px-4 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-green-600">
                            <option value="初心者">初心者</option>
                            <option value="中級者">中級者</option>
                            <option value="上級者">上級者</option>
                        </select>
                    </div>
                    <button type="submit" class="w-full bg-green-600 text-white py-2 rounded-lg hover:bg-green-700 transition">
                        質問を投稿
                    </button>
                </form>
            </div>
        </div>

        <!-- 要望モーダル -->
        <div id="request-modal" class="hidden modal fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
            <div class="bg-white rounded-lg p-8 max-w-2xl w-full mx-4 max-h-[90vh] overflow-y-auto">
                <div class="flex justify-between items-center mb-6">
                    <h2 class="text-2xl font-bold">要望を投稿</h2>
                    <button onclick="closeRequestModal()" class="text-gray-500 hover:text-gray-700">
                        <i class="fas fa-times text-2xl"></i>
                    </button>
                </div>
                <form id="request-form" onsubmit="submitRequest(event)">
                    <div class="mb-4">
                        <label class="block text-gray-700 mb-2">タイトル *</label>
                        <input type="text" id="request-title" required
                               class="w-full px-4 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-orange-600">
                    </div>
                    <div class="mb-4">
                        <label class="block text-gray-700 mb-2">詳細説明 *</label>
                        <textarea id="request-description" rows="6" required
                                  class="w-full px-4 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-orange-600"></textarea>
                    </div>
                    <div class="mb-4">
                        <label class="block text-gray-700 mb-2">カテゴリ *</label>
                        <select id="request-category" required
                                class="w-full px-4 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-orange-600">
                            <option value="新車両">新車両</option>
                            <option value="新レール・情景部品">新レール・情景部品</option>
                            <option value="既存商品改良">既存商品改良</option>
                            <option value="復刻要望">復刻要望</option>
                        </select>
                    </div>
                    <button type="submit" class="w-full bg-orange-600 text-white py-2 rounded-lg hover:bg-orange-700 transition">
                        要望を投稿
                    </button>
                </form>
            </div>
        </div>

        <!-- 探索モーダル -->
        <div id="explore-modal" class="hidden modal fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
            <div class="bg-white rounded-lg p-8 max-w-6xl w-full mx-4 max-h-[90vh] overflow-y-auto">
                <div class="flex justify-between items-center mb-6">
                    <h2 class="text-3xl font-bold text-gray-800">
                        <i class="fas fa-compass text-purple-600 mr-2"></i>探索する
                    </h2>
                    <button onclick="closeExploreModal()" class="text-gray-500 hover:text-gray-700">
                        <i class="fas fa-times text-2xl"></i>
                    </button>
                </div>

                <!-- タブメニュー -->
                <div class="flex border-b mb-6 overflow-x-auto">
                    <button onclick="switchExploreTab('popular')" id="tab-popular" class="px-6 py-3 text-purple-600 border-b-2 border-purple-600 font-semibold whitespace-nowrap">
                        <i class="fas fa-fire mr-1"></i>人気の投稿
                    </button>
                    <button onclick="switchExploreTab('trending')" id="tab-trending" class="px-6 py-3 text-gray-600 hover:text-purple-600 whitespace-nowrap">
                        <i class="fas fa-hashtag mr-1"></i>トレンドタグ
                    </button>
                    <button onclick="switchExploreTab('users')" id="tab-users" class="px-6 py-3 text-gray-600 hover:text-purple-600 whitespace-nowrap">
                        <i class="fas fa-users mr-1"></i>おすすめユーザー
                    </button>
                    <button onclick="switchExploreTab('latest')" id="tab-latest" class="px-6 py-3 text-gray-600 hover:text-purple-600 whitespace-nowrap">
                        <i class="fas fa-clock mr-1"></i>最新の投稿
                    </button>
                </div>

                <!-- タブコンテンツ -->
                <div id="explore-content">
                    <!-- 動的に読み込まれます -->
                </div>
            </div>
        </div>

        <!-- 交換所モーダル -->
        <div id="exchange-modal" class="hidden modal fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
            <div class="bg-white rounded-lg p-8 max-w-6xl w-full mx-4 max-h-[90vh] overflow-y-auto">
                <div class="flex justify-between items-center mb-6">
                    <h2 class="text-3xl font-bold text-gray-800">
                        <i class="fas fa-gift text-purple-600 mr-2"></i>ポイント交換所
                    </h2>
                    <button onclick="closeExchangeModal()" class="text-gray-500 hover:text-gray-700">
                        <i class="fas fa-times text-2xl"></i>
                    </button>
                </div>

                <!-- カテゴリーフィルター -->
                <div class="flex gap-2 mb-6 overflow-x-auto">
                    <button onclick="filterExchangeItems('all')" id="exchange-filter-all" class="px-4 py-2 rounded-lg bg-purple-600 text-white whitespace-nowrap">
                        すべて
                    </button>
                    <button onclick="filterExchangeItems('goods')" id="exchange-filter-goods" class="px-4 py-2 rounded-lg bg-gray-200 text-gray-700 whitespace-nowrap">
                        グッズ
                    </button>
                    <button onclick="filterExchangeItems('event')" id="exchange-filter-event" class="px-4 py-2 rounded-lg bg-gray-200 text-gray-700 whitespace-nowrap">
                        イベント
                    </button>
                    <button onclick="filterExchangeItems('privilege')" id="exchange-filter-privilege" class="px-4 py-2 rounded-lg bg-gray-200 text-gray-700 whitespace-nowrap">
                        特典
                    </button>
                </div>

                <div id="exchange-items-container" class="grid md:grid-cols-2 lg:grid-cols-3 gap-6">
                    <!-- 動的に読み込まれます -->
                </div>
            </div>
        </div>

        <!-- ポイント管理モーダル -->
        <div id="points-modal" class="hidden modal fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
            <div class="bg-white rounded-lg p-8 max-w-4xl w-full mx-4 max-h-[90vh] overflow-y-auto">
                <div class="flex justify-between items-center mb-6">
                    <h2 class="text-3xl font-bold text-gray-800">
                        <i class="fas fa-coins text-yellow-500 mr-2"></i>マイポイント
                    </h2>
                    <button onclick="closePointsModal()" class="text-gray-500 hover:text-gray-700">
                        <i class="fas fa-times text-2xl"></i>
                    </button>
                </div>

                <!-- ポイント残高 -->
                <div class="bg-gradient-to-r from-yellow-400 to-orange-500 text-white p-6 rounded-lg mb-6">
                    <p class="text-lg mb-2">現在のポイント</p>
                    <p class="text-5xl font-bold"><span id="points-balance">0</span> P</p>
                </div>

                <!-- ログインボーナスボタン -->
                <button onclick="claimDailyBonus()" id="daily-bonus-btn" class="w-full bg-green-600 text-white py-3 rounded-lg hover:bg-green-700 transition mb-6">
                    <i class="fas fa-gift mr-2"></i>ログインボーナスを受け取る (10P)
                </button>

                <!-- タブ -->
                <div class="flex border-b mb-6">
                    <button onclick="switchPointsTab('transactions')" id="points-tab-transactions" class="px-6 py-3 text-purple-600 border-b-2 border-purple-600 font-semibold">
                        取引履歴
                    </button>
                    <button onclick="switchPointsTab('exchanges')" id="points-tab-exchanges" class="px-6 py-3 text-gray-600 hover:text-purple-600">
                        交換履歴
                    </button>
                </div>

                <div id="points-content">
                    <!-- 動的に読み込まれます -->
                </div>
            </div>
        </div>

        <!-- 投げ銭モーダル -->
        <div id="tip-modal" class="hidden modal fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
            <div class="bg-white rounded-lg p-8 max-w-md w-full mx-4">
                <div class="flex justify-between items-center mb-6">
                    <h2 class="text-2xl font-bold">投げ銭を送る</h2>
                    <button onclick="closeTipModal()" class="text-gray-500 hover:text-gray-700">
                        <i class="fas fa-times text-2xl"></i>
                    </button>
                </div>
                <form id="tip-form" onsubmit="submitTip(event)">
                    <div class="mb-4">
                        <p class="text-gray-700 mb-2">送り先: <span id="tip-target-name" class="font-bold"></span></p>
                    </div>
                    <div class="mb-4">
                        <label class="block text-gray-700 mb-2">ポイント数 *</label>
                        <input type="number" id="tip-amount" min="10" max="1000" required
                               class="w-full px-4 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-purple-600">
                        <p class="text-sm text-gray-500 mt-1">10〜1000ポイント</p>
                    </div>
                    <div class="mb-4">
                        <label class="block text-gray-700 mb-2">メッセージ（任意）</label>
                        <textarea id="tip-message" rows="3"
                                  class="w-full px-4 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-purple-600"></textarea>
                    </div>
                    <button type="submit" class="w-full bg-yellow-500 text-white py-2 rounded-lg hover:bg-yellow-600 transition">
                        <i class="fas fa-paper-plane mr-2"></i>送信する
                    </button>
                </form>
            </div>
        </div>

        <!-- フッター -->
        <footer class="bg-gray-800 text-white py-8">
            <div class="max-w-7xl mx-auto px-4 text-center">
                <p class="text-gray-400">© 2025 プラレールSNS - コミュニティプラットフォーム</p>
                <div class="mt-4 space-x-4">
                    <a href="https://github.com/jimmynaka/plarail" target="_blank" class="text-gray-400 hover:text-white transition">
                        <i class="fab fa-github text-2xl"></i>
                    </a>
                </div>
            </div>
        </footer>

        <script src="https://cdn.jsdelivr.net/npm/axios@1.6.0/dist/axios.min.js"></script>
        <script src="/static/app.js"></script>
    </body>
    </html>
  `)
})

export default app
