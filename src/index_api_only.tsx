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

// ==================== Frontend Routes ====================
