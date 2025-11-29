// グローバル状態管理
let currentUser = null;

// ページロード時の初期化
window.addEventListener('DOMContentLoaded', () => {
  // ローカルストレージからユーザー情報を読み込む
  const savedUser = localStorage.getItem('currentUser');
  if (savedUser) {
    currentUser = JSON.parse(savedUser);
    updateLoginUI();
  }
  
  // データロード
  loadPosts();
  loadQuestions();
  loadAnnouncements();
  loadRequests();
  
  // イベントリスナー設定
  setupEventListeners();
});

// ログインUI更新
function updateLoginUI() {
  const loginBtn = document.getElementById('login-btn');
  const userMenu = document.getElementById('user-menu');
  
  if (currentUser) {
    loginBtn.style.display = 'none';
    userMenu.style.display = 'flex';
    document.getElementById('user-display-name').textContent = currentUser.display_name;
  } else {
    loginBtn.style.display = 'block';
    userMenu.style.display = 'none';
  }
}

// イベントリスナー設定
function setupEventListeners() {
  // ログインボタン
  document.getElementById('login-btn')?.addEventListener('click', showLoginModal);
  
  // ログアウトボタン
  document.getElementById('logout-btn')?.addEventListener('click', logout);
  
  // 投稿ボタン
  document.getElementById('new-post-btn')?.addEventListener('click', showPostModal);
  document.getElementById('new-question-btn')?.addEventListener('click', showQuestionModal);
  document.getElementById('new-request-btn')?.addEventListener('click', showRequestModal);
  
  // 検索フォーム
  document.getElementById('search-form')?.addEventListener('submit', handleSearch);
}

// ログインモーダル表示
function showLoginModal() {
  const modal = document.getElementById('login-modal');
  modal.classList.remove('hidden');
}

// ログインモーダル閉じる
function closeLoginModal() {
  const modal = document.getElementById('login-modal');
  modal.classList.add('hidden');
}

// ログイン処理
async function handleLogin(event) {
  event.preventDefault();
  const username = document.getElementById('login-username').value;
  
  try {
    const { data } = await axios.get('/api/users');
    const user = data.users.find(u => u.username === username);
    
    if (user) {
      currentUser = user;
      localStorage.setItem('currentUser', JSON.stringify(user));
      updateLoginUI();
      closeLoginModal();
      showNotification('ログインしました！', 'success');
    } else {
      showNotification('ユーザーが見つかりません', 'error');
    }
  } catch (error) {
    console.error('ログインエラー:', error);
    showNotification('ログインに失敗しました', 'error');
  }
}

// ログアウト
function logout() {
  currentUser = null;
  localStorage.removeItem('currentUser');
  updateLoginUI();
  showNotification('ログアウトしました', 'success');
}

// 通知表示
function showNotification(message, type = 'info') {
  const notification = document.createElement('div');
  notification.className = `fixed top-4 right-4 px-6 py-3 rounded-lg shadow-lg text-white z-50 ${
    type === 'success' ? 'bg-green-500' : type === 'error' ? 'bg-red-500' : 'bg-blue-500'
  }`;
  notification.textContent = message;
  document.body.appendChild(notification);
  
  setTimeout(() => {
    notification.remove();
  }, 3000);
}

// 投稿モーダル表示
function showPostModal() {
  if (!currentUser) {
    showNotification('ログインしてください', 'error');
    showLoginModal();
    return;
  }
  document.getElementById('post-modal').classList.remove('hidden');
}

// 投稿モーダル閉じる
function closePostModal() {
  document.getElementById('post-modal').classList.add('hidden');
  document.getElementById('post-form').reset();
}

// 投稿送信
async function submitPost(event) {
  event.preventDefault();
  
  if (!currentUser) {
    showNotification('ログインしてください', 'error');
    return;
  }
  
  const title = document.getElementById('post-title').value;
  const description = document.getElementById('post-description').value;
  const category = document.getElementById('post-category').value;
  const tags = document.getElementById('post-tags').value.split(',').map(t => t.trim()).filter(t => t);
  
  try {
    await axios.post('/api/posts', {
      user_id: currentUser.id,
      title,
      description,
      category,
      visibility: 'public',
      images: ['https://placehold.co/800x600/3b82f6/ffffff?text=' + encodeURIComponent(title)],
      tags
    });
    
    showNotification('投稿しました！', 'success');
    closePostModal();
    loadPosts(); // リロード
  } catch (error) {
    console.error('投稿エラー:', error);
    showNotification('投稿に失敗しました', 'error');
  }
}

// 質問モーダル表示
function showQuestionModal() {
  if (!currentUser) {
    showNotification('ログインしてください', 'error');
    showLoginModal();
    return;
  }
  document.getElementById('question-modal').classList.remove('hidden');
}

// 質問モーダル閉じる
function closeQuestionModal() {
  document.getElementById('question-modal').classList.add('hidden');
  document.getElementById('question-form').reset();
}

// 質問送信
async function submitQuestion(event) {
  event.preventDefault();
  
  if (!currentUser) {
    showNotification('ログインしてください', 'error');
    return;
  }
  
  const title = document.getElementById('question-title').value;
  const content = document.getElementById('question-content').value;
  const category = document.getElementById('question-category').value;
  const difficulty = document.getElementById('question-difficulty').value;
  
  try {
    await axios.post('/api/questions', {
      user_id: currentUser.id,
      title,
      content,
      category,
      difficulty
    });
    
    showNotification('質問を投稿しました！', 'success');
    closeQuestionModal();
    loadQuestions(); // リロード
  } catch (error) {
    console.error('質問投稿エラー:', error);
    showNotification('質問の投稿に失敗しました', 'error');
  }
}

// 要望モーダル表示
function showRequestModal() {
  if (!currentUser) {
    showNotification('ログインしてください', 'error');
    showLoginModal();
    return;
  }
  document.getElementById('request-modal').classList.remove('hidden');
}

// 要望モーダル閉じる
function closeRequestModal() {
  document.getElementById('request-modal').classList.add('hidden');
  document.getElementById('request-form').reset();
}

// 要望送信
async function submitRequest(event) {
  event.preventDefault();
  
  if (!currentUser) {
    showNotification('ログインしてください', 'error');
    return;
  }
  
  const title = document.getElementById('request-title').value;
  const description = document.getElementById('request-description').value;
  const category = document.getElementById('request-category').value;
  
  try {
    await axios.post('/api/requests', {
      user_id: currentUser.id,
      title,
      description,
      category
    });
    
    showNotification('要望を投稿しました！', 'success');
    closeRequestModal();
    loadRequests(); // リロード
  } catch (error) {
    console.error('要望投稿エラー:', error);
    showNotification('要望の投稿に失敗しました', 'error');
  }
}

// 検索処理
async function handleSearch(event) {
  event.preventDefault();
  const query = document.getElementById('search-input').value;
  
  if (!query) {
    showNotification('検索キーワードを入力してください', 'error');
    return;
  }
  
  try {
    const { data } = await axios.get(`/api/search?q=${encodeURIComponent(query)}`);
    displaySearchResults(data);
  } catch (error) {
    console.error('検索エラー:', error);
    showNotification('検索に失敗しました', 'error');
  }
}

// 検索結果表示
function displaySearchResults(results) {
  const resultsDiv = document.getElementById('search-results');
  resultsDiv.innerHTML = '<h2 class="text-3xl font-bold mb-6 text-gray-800"><i class="fas fa-search mr-2"></i>検索結果</h2>';
  
  let hasResults = false;
  
  if (results.posts && results.posts.length > 0) {
    hasResults = true;
    resultsDiv.innerHTML += '<h3 class="text-2xl font-semibold mb-4">投稿 (' + results.posts.length + '件)</h3>';
    resultsDiv.innerHTML += '<div class="grid md:grid-cols-2 lg:grid-cols-3 gap-6 mb-8">';
    results.posts.forEach(post => {
      const images = JSON.parse(post.images || '[]');
      resultsDiv.innerHTML += `
        <div class="bg-white rounded-lg shadow-md overflow-hidden">
          <img src="${images[0] || 'https://placehold.co/400x300'}" class="w-full h-48 object-cover" alt="${post.title}">
          <div class="p-4">
            <h4 class="font-semibold text-lg mb-2">${post.title}</h4>
            <p class="text-gray-600 text-sm">${post.description || ''}</p>
          </div>
        </div>
      `;
    });
    resultsDiv.innerHTML += '</div>';
  }
  
  if (results.questions && results.questions.length > 0) {
    hasResults = true;
    resultsDiv.innerHTML += '<h3 class="text-2xl font-semibold mb-4">質問 (' + results.questions.length + '件)</h3>';
    resultsDiv.innerHTML += '<div class="space-y-4 mb-8">';
    results.questions.forEach(q => {
      resultsDiv.innerHTML += `
        <div class="bg-white rounded-lg shadow-md p-6">
          <h4 class="font-semibold text-lg mb-2">${q.title}</h4>
          <p class="text-gray-600 text-sm">${q.content.substring(0, 150)}...</p>
        </div>
      `;
    });
    resultsDiv.innerHTML += '</div>';
  }
  
  if (!hasResults) {
    resultsDiv.innerHTML += '<p class="text-gray-500 text-center py-8">検索結果が見つかりませんでした</p>';
  }
  
  resultsDiv.scrollIntoView({ behavior: 'smooth' });
}

// データ読み込み関数
async function loadPosts() {
  try {
    const { data } = await axios.get('/api/posts?limit=6');
    const container = document.getElementById('posts-container');
    container.innerHTML = data.posts.map(post => {
      const images = JSON.parse(post.images || '[]');
      return `
        <div class="bg-white rounded-lg shadow-md overflow-hidden card-hover">
          <img src="${images[0] || 'https://placehold.co/400x300/e5e7eb/64748b?text=No+Image'}" class="w-full h-48 object-cover" alt="${post.title}">
          <div class="p-4">
            <div class="flex items-center mb-2">
              <img src="${post.avatar_url || 'https://placehold.co/32x32/6366f1/ffffff?text=' + post.display_name[0]}" class="w-8 h-8 rounded-full mr-2" alt="${post.display_name}">
              <div>
                <p class="text-sm font-semibold">${post.display_name}</p>
                <p class="text-xs text-gray-500">${new Date(post.created_at).toLocaleDateString('ja-JP')}</p>
              </div>
            </div>
            <h3 class="font-semibold text-lg mb-2">${post.title}</h3>
            <p class="text-gray-600 text-sm mb-3 line-clamp-2">${post.description || ''}</p>
            <div class="flex items-center justify-between text-sm text-gray-500">
              <span><i class="fas fa-heart text-red-500 mr-1"></i>${post.like_count}</span>
              <span><i class="fas fa-eye mr-1"></i>${post.view_count}</span>
              <span class="bg-blue-100 text-blue-600 px-2 py-1 rounded">${post.category}</span>
            </div>
          </div>
        </div>
      `;
    }).join('');
  } catch (error) {
    console.error('投稿の読み込みエラー:', error);
  }
}

async function loadQuestions() {
  try {
    const { data } = await axios.get('/api/questions?limit=5');
    const container = document.getElementById('questions-container');
    container.innerHTML = data.questions.map(q => `
      <div class="bg-white rounded-lg shadow-md p-6 card-hover">
        <div class="flex items-start justify-between">
          <div class="flex-1">
            <div class="flex items-center mb-2">
              <span class="bg-green-100 text-green-700 text-xs px-2 py-1 rounded mr-2">${q.category}</span>
              <span class="bg-gray-100 text-gray-600 text-xs px-2 py-1 rounded">${q.difficulty || '初心者'}</span>
              <span class="ml-2 ${q.status === 'solved' ? 'bg-blue-100 text-blue-700' : 'bg-yellow-100 text-yellow-700'} text-xs px-2 py-1 rounded">
                ${q.status === 'solved' ? '✓ 解決済み' : '未解決'}
              </span>
            </div>
            <h3 class="font-semibold text-lg mb-2">${q.title}</h3>
            <p class="text-gray-600 text-sm mb-3 line-clamp-2">${q.content}</p>
            <div class="flex items-center text-sm text-gray-500">
              <img src="${q.avatar_url || 'https://placehold.co/24x24/6366f1/ffffff?text=' + q.display_name[0]}" class="w-6 h-6 rounded-full mr-2" alt="${q.display_name}">
              <span class="mr-4">${q.display_name}</span>
              <span class="mr-4"><i class="fas fa-comment mr-1"></i>${q.answer_count}件の回答</span>
              <span><i class="fas fa-eye mr-1"></i>${q.view_count}閲覧</span>
            </div>
          </div>
        </div>
      </div>
    `).join('');
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
      return `
        <div class="bg-white rounded-lg shadow-md overflow-hidden card-hover">
          <div class="bg-gradient-to-r from-purple-500 to-pink-500 text-white px-4 py-2 flex items-center">
            <i class="fas fa-badge-check mr-2"></i>
            <span class="font-semibold">${a.display_name}</span>
          </div>
          <img src="${images[0] || 'https://placehold.co/600x400/e5e7eb/64748b?text=No+Image'}" class="w-full h-48 object-cover" alt="${a.product_name}">
          <div class="p-4">
            <div class="flex justify-between items-start mb-2">
              <h3 class="font-semibold text-lg">${a.product_name}</h3>
              <span class="text-purple-600 font-bold">¥${(a.price || 0).toLocaleString()}</span>
            </div>
            <p class="text-gray-600 text-sm mb-3 line-clamp-2">${a.description || ''}</p>
            <div class="flex items-center justify-between text-sm">
              <span class="text-gray-500"><i class="fas fa-calendar mr-1"></i>${a.release_date ? new Date(a.release_date).toLocaleDateString('ja-JP') : '未定'}</span>
              <span class="text-gray-500"><i class="fas fa-heart text-red-500 mr-1"></i>${a.like_count}</span>
            </div>
          </div>
        </div>
      `;
    }).join('');
  } catch (error) {
    console.error('新商品の読み込みエラー:', error);
  }
}

async function loadRequests() {
  try {
    const { data } = await axios.get('/api/requests?limit=5');
    const container = document.getElementById('requests-container');
    container.innerHTML = data.requests.map(r => `
      <div class="bg-white rounded-lg shadow-md p-6 card-hover">
        <div class="flex items-start justify-between">
          <div class="flex-1">
            <div class="flex items-center mb-2">
              <span class="bg-orange-100 text-orange-700 text-xs px-2 py-1 rounded mr-2">${r.category}</span>
              <span class="bg-gray-100 text-gray-600 text-xs px-2 py-1 rounded">${r.status === 'pending' ? '受付中' : r.status === 'confirmed' ? '確認済み' : r.status === 'in_review' ? '検討中' : r.status}</span>
            </div>
            <h3 class="font-semibold text-lg mb-2">${r.title}</h3>
            <p class="text-gray-600 text-sm mb-3 line-clamp-2">${r.description}</p>
            <div class="flex items-center justify-between text-sm">
              <div class="flex items-center text-gray-500">
                <img src="${r.avatar_url || 'https://placehold.co/24x24/6366f1/ffffff?text=' + r.display_name[0]}" class="w-6 h-6 rounded-full mr-2" alt="${r.display_name}">
                <span>${r.display_name}</span>
              </div>
              <div class="flex items-center">
                <button class="bg-orange-100 text-orange-700 px-3 py-1 rounded hover:bg-orange-200 transition">
                  <i class="fas fa-thumbs-up mr-1"></i>賛同 ${r.support_count}
                </button>
              </div>
            </div>
          </div>
        </div>
      </div>
    `).join('');
  } catch (error) {
    console.error('要望の読み込みエラー:', error);
  }
}
