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
  
  // リアルタイム検索サジェスト
  const searchInput = document.getElementById('search-input');
  if (searchInput) {
    searchInput.addEventListener('input', debounce(handleSearchSuggest, 300));
    searchInput.addEventListener('focus', showSearchSuggestions);
    searchInput.addEventListener('blur', () => {
      // 少し遅延させてクリックイベントを有効にする
      setTimeout(() => hideSuggestions(), 200);
    });
  }
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

// Debounce関数（検索サジェストの頻度を制限）
function debounce(func, wait) {
  let timeout;
  return function executedFunction(...args) {
    const later = () => {
      clearTimeout(timeout);
      func(...args);
    };
    clearTimeout(timeout);
    timeout = setTimeout(later, wait);
  };
}

// 検索サジェスト表示
function showSearchSuggestions() {
  const input = document.getElementById('search-input');
  const query = input.value.trim();
  
  if (!query) {
    // 検索履歴を表示
    const history = getSearchHistory();
    if (history.length > 0) {
      displaySuggestions(history.map(term => ({ text: term, type: 'history' })));
    }
  }
}

// サジェスト非表示
function hideSuggestions() {
  const container = document.getElementById('search-suggestions');
  if (container) {
    container.style.display = 'none';
  }
}

// リアルタイム検索サジェスト
async function handleSearchSuggest(event) {
  const query = event.target.value.trim();
  
  if (query.length < 2) {
    hideSuggestions();
    return;
  }
  
  try {
    const { data } = await axios.get(`/api/search?q=${encodeURIComponent(query)}`);
    const suggestions = [];
    
    // 投稿から候補を追加
    if (data.posts) {
      data.posts.slice(0, 3).forEach(post => {
        suggestions.push({
          text: post.title,
          type: 'post',
          icon: 'fa-image'
        });
      });
    }
    
    // 質問から候補を追加
    if (data.questions) {
      data.questions.slice(0, 3).forEach(q => {
        suggestions.push({
          text: q.title,
          type: 'question',
          icon: 'fa-question-circle'
        });
      });
    }
    
    // ユーザーから候補を追加
    if (data.users) {
      data.users.slice(0, 2).forEach(user => {
        suggestions.push({
          text: user.display_name,
          subtext: '@' + user.username,
          type: 'user',
          icon: 'fa-user'
        });
      });
    }
    
    if (suggestions.length > 0) {
      displaySuggestions(suggestions);
    } else {
      hideSuggestions();
    }
  } catch (error) {
    console.error('サジェスト取得エラー:', error);
  }
}

// サジェスト表示
function displaySuggestions(suggestions) {
  let container = document.getElementById('search-suggestions');
  
  if (!container) {
    // コンテナがなければ作成
    container = document.createElement('div');
    container.id = 'search-suggestions';
    container.className = 'absolute top-full left-0 right-0 bg-white border border-gray-200 rounded-lg shadow-lg mt-1 z-50 max-h-96 overflow-y-auto';
    
    const searchForm = document.getElementById('search-form');
    searchForm.style.position = 'relative';
    searchForm.appendChild(container);
  }
  
  container.innerHTML = suggestions.map(s => {
    if (s.type === 'history') {
      return `
        <div class="px-4 py-2 hover:bg-gray-50 cursor-pointer flex items-center justify-between" 
             onclick="document.getElementById('search-input').value='${s.text}'; document.getElementById('search-form').dispatchEvent(new Event('submit', {cancelable: true, bubbles: true}));">
          <div class="flex items-center">
            <i class="fas fa-history text-gray-400 mr-3"></i>
            <span class="text-gray-700">${s.text}</span>
          </div>
          <i class="fas fa-arrow-up-left text-gray-300"></i>
        </div>
      `;
    } else {
      const iconColor = s.type === 'post' ? 'text-blue-500' : s.type === 'question' ? 'text-green-500' : 'text-purple-500';
      return `
        <div class="px-4 py-2 hover:bg-gray-50 cursor-pointer flex items-center" 
             onclick="document.getElementById('search-input').value='${s.text}'; document.getElementById('search-form').dispatchEvent(new Event('submit', {cancelable: true, bubbles: true}));">
          <i class="fas ${s.icon} ${iconColor} mr-3"></i>
          <div class="flex-1">
            <div class="text-gray-700">${s.text}</div>
            ${s.subtext ? '<div class="text-xs text-gray-500">' + s.subtext + '</div>' : ''}
          </div>
        </div>
      `;
    }
  }).join('');
  
  container.style.display = 'block';
}

// 検索処理
async function handleSearch(event) {
  event.preventDefault();
  const query = document.getElementById('search-input').value.trim();
  
  if (!query) {
    showNotification('検索キーワードを入力してください', 'error');
    return;
  }
  
  // サジェストを非表示
  hideSuggestions();
  
  // 検索履歴に追加
  addToSearchHistory(query);
  
  try {
    const { data } = await axios.get(`/api/search?q=${encodeURIComponent(query)}`);
    displaySearchResults(data, query);
    
    // コンテンツエリアを隠して検索結果を表示
    document.getElementById('content-area').style.display = 'none';
    document.getElementById('search-results').style.display = 'block';
  } catch (error) {
    console.error('検索エラー:', error);
    showNotification('検索に失敗しました', 'error');
  }
}

// 検索履歴に追加
function addToSearchHistory(query) {
  let history = JSON.parse(localStorage.getItem('searchHistory') || '[]');
  
  // 重複を削除
  history = history.filter(item => item !== query);
  
  // 先頭に追加
  history.unshift(query);
  
  // 最大10件まで保存
  if (history.length > 10) {
    history = history.slice(0, 10);
  }
  
  localStorage.setItem('searchHistory', JSON.stringify(history));
}

// 検索履歴を取得
function getSearchHistory() {
  return JSON.parse(localStorage.getItem('searchHistory') || '[]');
}

// 検索をクリア
function clearSearch() {
  document.getElementById('search-input').value = '';
  document.getElementById('search-results').style.display = 'none';
  document.getElementById('content-area').style.display = 'block';
}

// 検索結果表示
function displaySearchResults(results, query) {
  const resultsDiv = document.getElementById('search-results');
  
  // ヘッダー部分
  resultsDiv.innerHTML = `
    <div class="flex justify-between items-center mb-6">
      <h2 class="text-3xl font-bold text-gray-800">
        <i class="fas fa-search mr-2"></i>検索結果: "${query}"
      </h2>
      <button onclick="clearSearch()" class="text-gray-600 hover:text-purple-600 transition">
        <i class="fas fa-times mr-1"></i>閉じる
      </button>
    </div>
  `;
  
  // フィルターボタン
  resultsDiv.innerHTML += `
    <div class="flex gap-2 mb-6">
      <button onclick="filterSearchResults('all')" id="filter-all" class="px-4 py-2 rounded-lg bg-purple-600 text-white hover:bg-purple-700 transition">
        すべて
      </button>
      <button onclick="filterSearchResults('posts')" id="filter-posts" class="px-4 py-2 rounded-lg bg-gray-200 text-gray-700 hover:bg-gray-300 transition">
        投稿 ${results.posts ? '(' + results.posts.length + ')' : '(0)'}
      </button>
      <button onclick="filterSearchResults('questions')" id="filter-questions" class="px-4 py-2 rounded-lg bg-gray-200 text-gray-700 hover:bg-gray-300 transition">
        質問 ${results.questions ? '(' + results.questions.length + ')' : '(0)'}
      </button>
      <button onclick="filterSearchResults('users')" id="filter-users" class="px-4 py-2 rounded-lg bg-gray-200 text-gray-700 hover:bg-gray-300 transition">
        ユーザー ${results.users ? '(' + results.users.length + ')' : '(0)'}
      </button>
    </div>
  `;
  
  let hasResults = false;
  
  // 投稿結果
  if (results.posts && results.posts.length > 0) {
    hasResults = true;
    resultsDiv.innerHTML += `
      <div id="search-posts" class="mb-8">
        <h3 class="text-2xl font-semibold mb-4">
          <i class="fas fa-images mr-2 text-blue-500"></i>投稿 (${results.posts.length}件)
        </h3>
        <div class="grid md:grid-cols-2 lg:grid-cols-3 gap-6">
          ${results.posts.map(post => {
            const images = JSON.parse(post.images || '[]');
            return `
              <div class="bg-white rounded-lg shadow-md overflow-hidden card-hover">
                <img src="${images[0] || 'https://placehold.co/400x300/e5e7eb/64748b?text=No+Image'}" class="w-full h-48 object-cover" alt="${post.title}">
                <div class="p-4">
                  <div class="flex items-center mb-2">
                    <img src="${post.avatar_url || 'https://placehold.co/32x32/6366f1/ffffff?text=' + (post.display_name ? post.display_name[0] : 'U')}" class="w-8 h-8 rounded-full mr-2" alt="${post.display_name}">
                    <div>
                      <p class="text-sm font-semibold">${post.display_name}</p>
                      <p class="text-xs text-gray-500">${new Date(post.created_at).toLocaleDateString('ja-JP')}</p>
                    </div>
                  </div>
                  <h4 class="font-semibold text-lg mb-2">${post.title}</h4>
                  <p class="text-gray-600 text-sm line-clamp-2">${post.description || ''}</p>
                  <div class="flex items-center justify-between text-sm text-gray-500 mt-3">
                    <span><i class="fas fa-heart text-red-500 mr-1"></i>${post.like_count}</span>
                    <span class="bg-blue-100 text-blue-600 px-2 py-1 rounded">${post.category}</span>
                  </div>
                </div>
              </div>
            `;
          }).join('')}
        </div>
      </div>
    `;
  }
  
  // 質問結果
  if (results.questions && results.questions.length > 0) {
    hasResults = true;
    resultsDiv.innerHTML += `
      <div id="search-questions" class="mb-8">
        <h3 class="text-2xl font-semibold mb-4">
          <i class="fas fa-question-circle mr-2 text-green-500"></i>質問 (${results.questions.length}件)
        </h3>
        <div class="space-y-4">
          ${results.questions.map(q => `
            <div class="bg-white rounded-lg shadow-md p-6 card-hover">
              <div class="flex items-center mb-2">
                <span class="bg-green-100 text-green-700 text-xs px-2 py-1 rounded mr-2">${q.category}</span>
                <span class="${q.status === 'solved' ? 'bg-blue-100 text-blue-700' : 'bg-yellow-100 text-yellow-700'} text-xs px-2 py-1 rounded">
                  ${q.status === 'solved' ? '✓ 解決済み' : '未解決'}
                </span>
              </div>
              <h4 class="font-semibold text-lg mb-2">${q.title}</h4>
              <p class="text-gray-600 text-sm line-clamp-2 mb-3">${q.content}</p>
              <div class="flex items-center text-sm text-gray-500">
                <img src="${q.avatar_url || 'https://placehold.co/24x24/6366f1/ffffff?text=' + (q.display_name ? q.display_name[0] : 'U')}" class="w-6 h-6 rounded-full mr-2" alt="${q.display_name}">
                <span class="mr-4">${q.display_name}</span>
                <span class="mr-4"><i class="fas fa-comment mr-1"></i>${q.answer_count}件の回答</span>
                <span><i class="fas fa-eye mr-1"></i>${q.view_count}閲覧</span>
              </div>
            </div>
          `).join('')}
        </div>
      </div>
    `;
  }
  
  // ユーザー結果
  if (results.users && results.users.length > 0) {
    hasResults = true;
    resultsDiv.innerHTML += `
      <div id="search-users" class="mb-8">
        <h3 class="text-2xl font-semibold mb-4">
          <i class="fas fa-users mr-2 text-purple-500"></i>ユーザー (${results.users.length}件)
        </h3>
        <div class="grid md:grid-cols-2 lg:grid-cols-3 gap-4">
          ${results.users.map(user => `
            <div class="bg-white rounded-lg shadow-md p-4 card-hover">
              <div class="flex items-center">
                <img src="${user.avatar_url || 'https://placehold.co/48x48/6366f1/ffffff?text=' + (user.display_name ? user.display_name[0] : 'U')}" class="w-12 h-12 rounded-full mr-3" alt="${user.display_name}">
                <div class="flex-1">
                  <div class="flex items-center">
                    <p class="font-semibold">${user.display_name}</p>
                    ${user.is_official ? '<i class="fas fa-check-circle text-blue-500 ml-1" title="公式アカウント"></i>' : ''}
                  </div>
                  <p class="text-sm text-gray-500">@${user.username}</p>
                  ${user.bio ? '<p class="text-xs text-gray-600 mt-1 line-clamp-2">' + user.bio + '</p>' : ''}
                </div>
              </div>
            </div>
          `).join('')}
        </div>
      </div>
    `;
  }
  
  if (!hasResults) {
    resultsDiv.innerHTML += `
      <div class="text-center py-12">
        <i class="fas fa-search text-6xl text-gray-300 mb-4"></i>
        <p class="text-gray-500 text-lg">「${query}」の検索結果が見つかりませんでした</p>
        <p class="text-gray-400 text-sm mt-2">別のキーワードで検索してみてください</p>
      </div>
    `;
  }
  
  // 検索履歴表示
  const history = getSearchHistory();
  if (history.length > 0) {
    resultsDiv.innerHTML += `
      <div class="mt-8 border-t pt-6">
        <h3 class="text-lg font-semibold mb-3 text-gray-700">
          <i class="fas fa-history mr-2"></i>最近の検索
        </h3>
        <div class="flex flex-wrap gap-2">
          ${history.map(term => `
            <button onclick="document.getElementById('search-input').value='${term}'; document.getElementById('search-form').dispatchEvent(new Event('submit'));" 
                    class="px-3 py-1 bg-gray-100 text-gray-700 rounded-full hover:bg-purple-100 hover:text-purple-700 transition text-sm">
              ${term}
            </button>
          `).join('')}
          <button onclick="clearSearchHistory()" class="px-3 py-1 text-red-600 hover:bg-red-50 rounded-full transition text-sm">
            <i class="fas fa-trash-alt mr-1"></i>履歴をクリア
          </button>
        </div>
      </div>
    `;
  }
  
  resultsDiv.scrollIntoView({ behavior: 'smooth' });
}

// 検索フィルター
function filterSearchResults(type) {
  // ボタンのスタイル更新
  ['all', 'posts', 'questions', 'users'].forEach(t => {
    const btn = document.getElementById('filter-' + t);
    if (btn) {
      if (t === type) {
        btn.className = 'px-4 py-2 rounded-lg bg-purple-600 text-white hover:bg-purple-700 transition';
      } else {
        btn.className = 'px-4 py-2 rounded-lg bg-gray-200 text-gray-700 hover:bg-gray-300 transition';
      }
    }
  });
  
  // コンテンツの表示/非表示
  const sections = ['search-posts', 'search-questions', 'search-users'];
  sections.forEach(section => {
    const element = document.getElementById(section);
    if (element) {
      if (type === 'all' || section === 'search-' + type) {
        element.style.display = 'block';
      } else {
        element.style.display = 'none';
      }
    }
  });
}

// 検索履歴をクリア
function clearSearchHistory() {
  localStorage.removeItem('searchHistory');
  showNotification('検索履歴をクリアしました', 'success');
  
  // 検索結果を再表示（履歴部分を削除）
  const historySection = document.querySelector('#search-results .border-t');
  if (historySection) {
    historySection.remove();
  }
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
