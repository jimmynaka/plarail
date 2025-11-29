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
                <div class="flex justify-between h-16">
                    <div class="flex items-center">
                        <i class="fas fa-train text-3xl text-purple-600 mr-3"></i>
                        <span class="text-2xl font-bold text-gray-800">プラレールSNS</span>
                    </div>
                    <div class="flex items-center space-x-6">
                        <a href="#posts" class="text-gray-600 hover:text-purple-600 transition"><i class="fas fa-images mr-1"></i>投稿</a>
                        <a href="#questions" class="text-gray-600 hover:text-purple-600 transition"><i class="fas fa-question-circle mr-1"></i>質問</a>
                        <a href="#announcements" class="text-gray-600 hover:text-purple-600 transition"><i class="fas fa-bullhorn mr-1"></i>新商品</a>
                        <a href="#requests" class="text-gray-600 hover:text-purple-600 transition"><i class="fas fa-lightbulb mr-1"></i>要望</a>
                        <button class="bg-purple-600 text-white px-4 py-2 rounded-lg hover:bg-purple-700 transition">
                            <i class="fas fa-user mr-1"></i>ログイン
                        </button>
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
                    <button class="bg-white text-purple-600 px-8 py-3 rounded-lg font-semibold hover:bg-gray-100 transition">
                        <i class="fas fa-camera mr-2"></i>投稿する
                    </button>
                    <button class="bg-transparent border-2 border-white text-white px-8 py-3 rounded-lg font-semibold hover:bg-white hover:text-purple-600 transition">
                        <i class="fas fa-search mr-2"></i>探索する
                    </button>
                </div>
            </div>
        </div>

        <!-- 主要機能セクション -->
        <div class="max-w-7xl mx-auto px-4 py-16">
            <h2 class="text-3xl font-bold text-center mb-12 text-gray-800">主要機能</h2>
            <div class="grid md:grid-cols-2 lg:grid-cols-4 gap-6">
                <!-- 画像投稿 -->
                <div class="bg-white rounded-lg shadow-md p-6 card-hover">
                    <div class="text-blue-500 text-4xl mb-4"><i class="fas fa-images"></i></div>
                    <h3 class="text-xl font-semibold mb-2">画像投稿</h3>
                    <p class="text-gray-600">レイアウトやコレクションを共有しよう</p>
                    <button class="mt-4 text-blue-600 hover:underline" onclick="loadPosts()">投稿を見る →</button>
                </div>
                
                <!-- 質問・回答 -->
                <div class="bg-white rounded-lg shadow-md p-6 card-hover">
                    <div class="text-green-500 text-4xl mb-4"><i class="fas fa-question-circle"></i></div>
                    <h3 class="text-xl font-semibold mb-2">質問・回答</h3>
                    <p class="text-gray-600">困ったことを相談して解決しよう</p>
                    <button class="mt-4 text-green-600 hover:underline" onclick="loadQuestions()">質問を見る →</button>
                </div>
                
                <!-- 新商品発表 -->
                <div class="bg-white rounded-lg shadow-md p-6 card-hover">
                    <div class="text-purple-500 text-4xl mb-4"><i class="fas fa-bullhorn"></i></div>
                    <h3 class="text-xl font-semibold mb-2">新商品発表</h3>
                    <p class="text-gray-600">最新のプラレール情報をチェック</p>
                    <button class="mt-4 text-purple-600 hover:underline" onclick="loadAnnouncements()">発表を見る →</button>
                </div>
                
                <!-- 要望リクエスト -->
                <div class="bg-white rounded-lg shadow-md p-6 card-hover">
                    <div class="text-orange-500 text-4xl mb-4"><i class="fas fa-lightbulb"></i></div>
                    <h3 class="text-xl font-semibold mb-2">要望リクエスト</h3>
                    <p class="text-gray-600">欲しい商品をメーカーに届けよう</p>
                    <button class="mt-4 text-orange-600 hover:underline" onclick="loadRequests()">要望を見る →</button>
                </div>
            </div>
        </div>

        <!-- コンテンツエリア -->
        <div id="content-area" class="max-w-7xl mx-auto px-4 pb-16">
            <div id="posts" class="mb-16">
                <h2 class="text-3xl font-bold mb-6 text-gray-800"><i class="fas fa-images mr-2"></i>最新の投稿</h2>
                <div id="posts-container" class="grid md:grid-cols-2 lg:grid-cols-3 gap-6">
                    <!-- 投稿カードがここに表示されます -->
                </div>
            </div>

            <div id="questions" class="mb-16">
                <h2 class="text-3xl font-bold mb-6 text-gray-800"><i class="fas fa-question-circle mr-2"></i>最新の質問</h2>
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
                <h2 class="text-3xl font-bold mb-6 text-gray-800"><i class="fas fa-lightbulb mr-2"></i>人気の要望</h2>
                <div id="requests-container" class="space-y-4">
                    <!-- 要望カードがここに表示されます -->
                </div>
            </div>
        </div>

        <!-- フッター -->
        <footer class="bg-gray-800 text-white py-8">
            <div class="max-w-7xl mx-auto px-4 text-center">
                <p class="text-gray-400">© 2025 プラレールSNS - コミュニティプラットフォーム</p>
                <div class="mt-4 space-x-4">
                    <a href="#" class="text-gray-400 hover:text-white transition"><i class="fab fa-twitter"></i></a>
                    <a href="#" class="text-gray-400 hover:text-white transition"><i class="fab fa-facebook"></i></a>
                    <a href="#" class="text-gray-400 hover:text-white transition"><i class="fab fa-instagram"></i></a>
                </div>
            </div>
        </footer>

        <script src="https://cdn.jsdelivr.net/npm/axios@1.6.0/dist/axios.min.js"></script>
        <script>
          // データ読み込み関数
          async function loadPosts() {
            try {
              const { data } = await axios.get('/api/posts?limit=6');
              const container = document.getElementById('posts-container');
              container.innerHTML = data.posts.map(post => {
                const images = JSON.parse(post.images || '[]');
                return \`
                  <div class="bg-white rounded-lg shadow-md overflow-hidden card-hover">
                    <img src="\${images[0] || 'https://placehold.co/400x300/e5e7eb/64748b?text=No+Image'}" class="w-full h-48 object-cover" alt="\${post.title}">
                    <div class="p-4">
                      <div class="flex items-center mb-2">
                        <img src="\${post.avatar_url || 'https://placehold.co/32x32/6366f1/ffffff?text=' + post.display_name[0]}" class="w-8 h-8 rounded-full mr-2" alt="\${post.display_name}">
                        <div>
                          <p class="text-sm font-semibold">\${post.display_name}</p>
                          <p class="text-xs text-gray-500">\${new Date(post.created_at).toLocaleDateString('ja-JP')}</p>
                        </div>
                      </div>
                      <h3 class="font-semibold text-lg mb-2">\${post.title}</h3>
                      <p class="text-gray-600 text-sm mb-3 line-clamp-2">\${post.description || ''}</p>
                      <div class="flex items-center justify-between text-sm text-gray-500">
                        <span><i class="fas fa-heart text-red-500 mr-1"></i>\${post.like_count}</span>
                        <span><i class="fas fa-eye mr-1"></i>\${post.view_count}</span>
                        <span class="bg-blue-100 text-blue-600 px-2 py-1 rounded">\${post.category}</span>
                      </div>
                    </div>
                  </div>
                \`;
              }).join('');
            } catch (error) {
              console.error('投稿の読み込みエラー:', error);
            }
          }

          async function loadQuestions() {
            try {
              const { data } = await axios.get('/api/questions?limit=5');
              const container = document.getElementById('questions-container');
              container.innerHTML = data.questions.map(q => \`
                <div class="bg-white rounded-lg shadow-md p-6 card-hover">
                  <div class="flex items-start justify-between">
                    <div class="flex-1">
                      <div class="flex items-center mb-2">
                        <span class="bg-green-100 text-green-700 text-xs px-2 py-1 rounded mr-2">\${q.category}</span>
                        <span class="bg-gray-100 text-gray-600 text-xs px-2 py-1 rounded">\${q.difficulty || '初心者'}</span>
                        <span class="ml-2 \${q.status === 'solved' ? 'bg-blue-100 text-blue-700' : 'bg-yellow-100 text-yellow-700'} text-xs px-2 py-1 rounded">
                          \${q.status === 'solved' ? '✓ 解決済み' : '未解決'}
                        </span>
                      </div>
                      <h3 class="font-semibold text-lg mb-2">\${q.title}</h3>
                      <p class="text-gray-600 text-sm mb-3 line-clamp-2">\${q.content}</p>
                      <div class="flex items-center text-sm text-gray-500">
                        <img src="\${q.avatar_url || 'https://placehold.co/24x24/6366f1/ffffff?text=' + q.display_name[0]}" class="w-6 h-6 rounded-full mr-2" alt="\${q.display_name}">
                        <span class="mr-4">\${q.display_name}</span>
                        <span class="mr-4"><i class="fas fa-comment mr-1"></i>\${q.answer_count}件の回答</span>
                        <span><i class="fas fa-eye mr-1"></i>\${q.view_count}閲覧</span>
                      </div>
                    </div>
                  </div>
                </div>
              \`).join('');
            } catch (error) {
              console.error('質問の読み込みエラー:', error);
            }
          }

          async function loadAnnouncements() {
            try {
              const { data } = await axios.get('/api/announcements?limit=4');
              const container = document.getElementById('announcements-container');
              container.innerHTML = data.announcements.map(a => {
                const images = JSON.parse(a.images || '[]');
                return \`
                  <div class="bg-white rounded-lg shadow-md overflow-hidden card-hover">
                    <div class="bg-gradient-to-r from-purple-500 to-pink-500 text-white px-4 py-2 flex items-center">
                      <i class="fas fa-badge-check mr-2"></i>
                      <span class="font-semibold">\${a.display_name}</span>
                    </div>
                    <img src="\${images[0] || 'https://placehold.co/600x400/e5e7eb/64748b?text=No+Image'}" class="w-full h-48 object-cover" alt="\${a.product_name}">
                    <div class="p-4">
                      <div class="flex justify-between items-start mb-2">
                        <h3 class="font-semibold text-lg">\${a.product_name}</h3>
                        <span class="text-purple-600 font-bold">¥\${(a.price || 0).toLocaleString()}</span>
                      </div>
                      <p class="text-gray-600 text-sm mb-3 line-clamp-2">\${a.description || ''}</p>
                      <div class="flex items-center justify-between text-sm">
                        <span class="text-gray-500"><i class="fas fa-calendar mr-1"></i>\${a.release_date ? new Date(a.release_date).toLocaleDateString('ja-JP') : '未定'}</span>
                        <span class="text-gray-500"><i class="fas fa-heart text-red-500 mr-1"></i>\${a.like_count}</span>
                      </div>
                    </div>
                  </div>
                \`;
              }).join('');
            } catch (error) {
              console.error('新商品の読み込みエラー:', error);
            }
          }

          async function loadRequests() {
            try {
              const { data } = await axios.get('/api/requests?limit=5');
              const container = document.getElementById('requests-container');
              container.innerHTML = data.requests.map(r => \`
                <div class="bg-white rounded-lg shadow-md p-6 card-hover">
                  <div class="flex items-start justify-between">
                    <div class="flex-1">
                      <div class="flex items-center mb-2">
                        <span class="bg-orange-100 text-orange-700 text-xs px-2 py-1 rounded mr-2">\${r.category}</span>
                        <span class="bg-gray-100 text-gray-600 text-xs px-2 py-1 rounded">\${r.status === 'pending' ? '受付中' : r.status === 'confirmed' ? '確認済み' : r.status === 'in_review' ? '検討中' : r.status}</span>
                      </div>
                      <h3 class="font-semibold text-lg mb-2">\${r.title}</h3>
                      <p class="text-gray-600 text-sm mb-3 line-clamp-2">\${r.description}</p>
                      <div class="flex items-center justify-between text-sm">
                        <div class="flex items-center text-gray-500">
                          <img src="\${r.avatar_url || 'https://placehold.co/24x24/6366f1/ffffff?text=' + r.display_name[0]}" class="w-6 h-6 rounded-full mr-2" alt="\${r.display_name}">
                          <span>\${r.display_name}</span>
                        </div>
                        <div class="flex items-center">
                          <button class="bg-orange-100 text-orange-700 px-3 py-1 rounded hover:bg-orange-200 transition">
                            <i class="fas fa-thumbs-up mr-1"></i>賛同 \${r.support_count}
                          </button>
                        </div>
                      </div>
                    </div>
                  </div>
                </div>
              \`).join('');
            } catch (error) {
              console.error('要望の読み込みエラー:', error);
            }
          }

          // ページ読み込み時にデータをロード
          window.addEventListener('DOMContentLoaded', () => {
            loadPosts();
            loadQuestions();
            loadAnnouncements();
            loadRequests();
          });
        </script>
    </body>
    </html>
  `)
})

export default app
