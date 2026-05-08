// グローバル変数
let allIssues = [];
let filteredIssues = [];

// DOM要素
const issuesContainer = document.getElementById('issuesContainer');
const loadingEl = document.getElementById('loading');
const errorMessageEl = document.getElementById('errorMessage');
const errorTextEl = document.getElementById('errorText');
const emptyStateEl = document.getElementById('emptyState');
const searchInput = document.getElementById('searchInput');
const filterBtn = document.getElementById('filterBtn');
const filterPanel = document.getElementById('filterPanel');
const totalCountEl = document.getElementById('totalCount');
const openCountEl = document.getElementById('openCount');
const overdueCountEl = document.getElementById('overdueCount');

// 初期化
document.addEventListener('DOMContentLoaded', () => {
  initEventListeners();
  loadIssues();
});

// イベントリスナーの設定
function initEventListeners() {
  // 検索
  searchInput.addEventListener('input', debounce(handleSearch, 300));

  // フィルターボタン
  filterBtn.addEventListener('click', () => {
    filterPanel.classList.toggle('active');
  });

  // フィルターチェックボックス
  const filterCheckboxes = filterPanel.querySelectorAll('input[type="checkbox"]');
  filterCheckboxes.forEach(cb => {
    cb.addEventListener('change', handleFilter);
  });
}

// 課題データを取得
async function loadIssues() {
  try {
    showLoading();
    hideError();

    // Firestoreからオープン状態の課題を取得
    const snapshot = await db.collection(COLLECTIONS.ISSUES).get();

    allIssues = snapshot.docs.map(doc => ({
      id: doc.id,
      ...doc.data()
    }));

    // オープン状態のみフィルター
    allIssues = allIssues.filter(issue => {
      const status = issue.ステータス || '';
      return status !== 'クローズ' && status !== '中止';
    });

    filteredIssues = [...allIssues];

    hideLoading();
    updateStats();
    renderIssues();

  } catch (error) {
    console.error('❌ 課題取得エラー:', error);
    hideLoading();
    showError('課題データの取得に失敗しました。Firebase設定を確認してください。');
  }
}

// 課題を表示
function renderIssues() {
  issuesContainer.innerHTML = '';

  if (filteredIssues.length === 0) {
    emptyStateEl.style.display = 'block';
    return;
  }

  emptyStateEl.style.display = 'none';

  filteredIssues.forEach(issue => {
    const card = createIssueCard(issue);
    issuesContainer.appendChild(card);
  });
}

// 課題カードを作成
function createIssueCard(issue) {
  const card = document.createElement('div');
  card.className = `issue-card priority-${getPriorityClass(issue.重要度)}`;

  const statusClass = getStatusClass(issue.ステータス);
  const priorityClass = getPriorityClass(issue.重要度);
  const isOverdue = checkOverdue(issue.期日);

  card.innerHTML = `
    <div class="issue-header">
      <span class="issue-number">${issue.課題No || 'N/A'}</span>
    </div>
    <h3 class="issue-title">${escapeHtml(issue.課題タイトル || '無題')}</h3>
    <p class="issue-description">${escapeHtml(issue.課題内容 || '説明なし')}</p>
    <div class="issue-meta">
      ${issue.担当者 ? `
        <div class="meta-item">
          <svg viewBox="0 0 20 20" fill="currentColor">
            <path d="M10 9a3 3 0 100-6 3 3 0 000 6zm-7 9a7 7 0 1114 0H3z"/>
          </svg>
          <span>${escapeHtml(issue.担当者)}</span>
        </div>
      ` : ''}
      ${issue.期日 ? `
        <div class="meta-item ${isOverdue ? 'text-danger' : ''}">
          <svg viewBox="0 0 20 20" fill="currentColor">
            <path d="M6 2a1 1 0 00-1 1v1H4a2 2 0 00-2 2v10a2 2 0 002 2h12a2 2 0 002-2V6a2 2 0 00-2-2h-1V3a1 1 0 10-2 0v1H7V3a1 1 0 00-1-1zm0 5a1 1 0 000 2h8a1 1 0 100-2H6z"/>
          </svg>
          <span>${formatDate(issue.期日)}</span>
        </div>
      ` : ''}
    </div>
    <div class="issue-footer">
      <span class="status-badge ${statusClass}">${escapeHtml(issue.ステータス || 'オープン')}</span>
      <span class="priority-badge ${priorityClass}">${escapeHtml(issue.重要度 || '中')}</span>
    </div>
  `;

  // クリックイベント
  card.addEventListener('click', () => {
    showIssueDetail(issue);
  });

  return card;
}

// 課題詳細を表示（モーダルやページ遷移）
function showIssueDetail(issue) {
  // デモ版では alert で表示
  const details = `
課題番号: ${issue.課題No || 'N/A'}
タイトル: ${issue.課題タイトル || '無題'}
内容: ${issue.課題内容 || '説明なし'}
担当者: ${issue.担当者 || '未割当'}
期日: ${issue.期日 || '未設定'}
ステータス: ${issue.ステータス || 'オープン'}
重要度: ${issue.重要度 || '中'}
  `.trim();

  alert(details);
}

// 検索処理
function handleSearch(e) {
  const query = e.target.value.toLowerCase().trim();

  if (!query) {
    filteredIssues = [...allIssues];
  } else {
    filteredIssues = allIssues.filter(issue => {
      const title = (issue.課題タイトル || '').toLowerCase();
      const content = (issue.課題内容 || '').toLowerCase();
      const issueNo = (issue.課題No || '').toLowerCase();
      const assignee = (issue.担当者 || '').toLowerCase();

      return title.includes(query) ||
             content.includes(query) ||
             issueNo.includes(query) ||
             assignee.includes(query);
    });
  }

  handleFilter();
}

// フィルター処理
function handleFilter() {
  const statusFilters = Array.from(
    filterPanel.querySelectorAll('.filter-group:first-child input[type="checkbox"]:checked')
  ).map(cb => cb.value);

  const priorityFilters = Array.from(
    filterPanel.querySelectorAll('.filter-group:last-child input[type="checkbox"]:checked')
  ).map(cb => cb.value);

  let result = [...filteredIssues];

  // ステータスフィルター
  if (!statusFilters.includes('全て')) {
    result = result.filter(issue =>
      statusFilters.includes(issue.ステータス || 'オープン')
    );
  }

  // 重要度フィルター
  result = result.filter(issue =>
    priorityFilters.includes(issue.重要度 || '中')
  );

  filteredIssues = result;
  updateStats();
  renderIssues();
}

// 統計を更新
function updateStats() {
  totalCountEl.textContent = filteredIssues.length;

  const openCount = filteredIssues.filter(issue =>
    (issue.ステータス || 'オープン') === 'オープン'
  ).length;
  openCountEl.textContent = openCount;

  const overdueCount = filteredIssues.filter(issue =>
    checkOverdue(issue.期日)
  ).length;
  overdueCountEl.textContent = overdueCount;
}

// ユーティリティ関数
function getPriorityClass(priority) {
  const map = {
    '高': 'high',
    '中': 'medium',
    '低': 'low'
  };
  return map[priority] || 'medium';
}

function getStatusClass(status) {
  const map = {
    'オープン': 'open',
    '作業中': 'in-progress',
    '確認待ち': 'review',
    'クローズ': 'closed'
  };
  return map[status] || 'open';
}

function checkOverdue(dueDate) {
  if (!dueDate) return false;
  const due = new Date(dueDate);
  const today = new Date();
  today.setHours(0, 0, 0, 0);
  return due < today;
}

function formatDate(dateStr) {
  if (!dateStr) return '';
  const date = new Date(dateStr);
  return `${date.getMonth() + 1}/${date.getDate()}`;
}

function escapeHtml(str) {
  if (!str) return '';
  const div = document.createElement('div');
  div.textContent = str;
  return div.innerHTML;
}

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

function showLoading() {
  loadingEl.style.display = 'block';
  issuesContainer.style.display = 'none';
  emptyStateEl.style.display = 'none';
}

function hideLoading() {
  loadingEl.style.display = 'none';
  issuesContainer.style.display = 'flex';
}

function showError(message) {
  errorTextEl.textContent = message;
  errorMessageEl.style.display = 'flex';
}

function hideError() {
  errorMessageEl.style.display = 'none';
}
