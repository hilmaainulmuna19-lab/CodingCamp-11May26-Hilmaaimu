/* ============================================================
   Expense & Budget Visualizer — js/app.js
   Vanilla JS · No frameworks · No build tools
   Sections: Compat | State | Storage | Validation |
             Transactions | Categories | Limits |
             Rendering | Theme | Helpers | Init
   ============================================================ */

'use strict';

/* ============================================================
   BROWSER COMPATIBILITY CHECK (Baseline 2023 APIs)
   ============================================================ */
function checkCompatibility() {
  const required = [
    { name: 'localStorage',       test: () => window.localStorage },
    { name: 'JSON.parse',         test: () => JSON.parse },
    { name: 'JSON.stringify',     test: () => JSON.stringify },
    { name: 'Array.prototype.at', test: () => [].at },
    { name: 'structuredClone',    test: () => structuredClone },
    { name: 'CSS.supports',       test: () => CSS && CSS.supports },
  ];

  const missing = [];
  for (const api of required) {
    try { if (!api.test()) missing.push(api.name); }
    catch (_) { missing.push(api.name); }
  }

  if (missing.length > 0) {
    const warn = document.getElementById('compat-warning');
    const list = document.getElementById('compat-missing-list');
    missing.forEach(name => {
      const li = document.createElement('li');
      li.textContent = name;
      list.appendChild(li);
    });
    warn.classList.remove('hidden');
    document.getElementById('app').classList.add('hidden');
    return false;
  }
  return true;
}

/* ============================================================
   STATE
   ============================================================ */
const AppState = {
  transactions: [],   // Transaction[]
  categories:   [],   // string[]
  limits:       {},   // { [category]: number }  — expense limits only
  theme:        'light',
  sortOrder:    null, // 'amount-asc'|'amount-desc'|'category-asc'|'type-income'|'type-expense'|null
};

/*
  Transaction shape:
  {
    id:       string,
    name:     string,
    amount:   number,   // always positive
    type:     'income' | 'expense',
    category: string,   // only meaningful for expenses
    date:     string,   // ISO 8601
  }
*/

const DEFAULT_CATEGORIES = ['Makanan', 'Transportasi', 'Hiburan'];
const STORAGE_KEYS = {
  transactions: 'ebv_transactions',
  categories:   'ebv_categories',
  limits:       'ebv_limits',
  theme:        'ebv_theme',
};
const MAX_TRANSACTIONS = 500;

/* ============================================================
   STORAGE — Warning Banner
   ============================================================ */
let _bannerTimer = null;

function showStorageBanner(message) {
  const banner = document.getElementById('storage-error');
  const msg    = document.getElementById('storage-error-msg');
  msg.textContent = message;
  banner.classList.remove('hidden');
  if (_bannerTimer) clearTimeout(_bannerTimer);
  _bannerTimer = setTimeout(dismissStorageBanner, 5000);
}

function dismissStorageBanner() {
  document.getElementById('storage-error').classList.add('hidden');
  if (_bannerTimer) { clearTimeout(_bannerTimer); _bannerTimer = null; }
}

/* ============================================================
   STORAGE — Read / Write
   ============================================================ */
function loadFromStorage() {
  // Transactions
  try {
    const raw = localStorage.getItem(STORAGE_KEYS.transactions);
    AppState.transactions = raw ? JSON.parse(raw) : [];
    if (!Array.isArray(AppState.transactions)) AppState.transactions = [];
    // Back-compat: old entries without 'type' default to expense
    AppState.transactions.forEach(t => { if (!t.type) t.type = 'expense'; });
  } catch (_) {
    AppState.transactions = [];
    showStorageBanner('Gagal memuat transaksi. Data mungkin tidak tersimpan.');
  }

  // Categories
  try {
    const raw = localStorage.getItem(STORAGE_KEYS.categories);
    AppState.categories = raw ? JSON.parse(raw) : [...DEFAULT_CATEGORIES];
    if (!Array.isArray(AppState.categories) || AppState.categories.length === 0) {
      AppState.categories = [...DEFAULT_CATEGORIES];
    }
  } catch (_) {
    AppState.categories = [...DEFAULT_CATEGORIES];
    showStorageBanner('Gagal memuat kategori.');
  }

  // Limits
  try {
    const raw = localStorage.getItem(STORAGE_KEYS.limits);
    AppState.limits = raw ? JSON.parse(raw) : {};
    if (typeof AppState.limits !== 'object' || Array.isArray(AppState.limits)) AppState.limits = {};
  } catch (_) {
    AppState.limits = {};
    showStorageBanner('Gagal memuat batas pengeluaran.');
  }

  // Theme
  try {
    const raw = localStorage.getItem(STORAGE_KEYS.theme);
    AppState.theme = (raw === 'dark' || raw === 'light') ? raw : 'light';
  } catch (_) {
    AppState.theme = 'light';
  }
}

function saveTransactions() {
  try {
    localStorage.setItem(STORAGE_KEYS.transactions, JSON.stringify(AppState.transactions));
  } catch (_) {
    showStorageBanner('Gagal menyimpan transaksi. Penyimpanan mungkin penuh.');
  }
}

function saveCategories() {
  try {
    localStorage.setItem(STORAGE_KEYS.categories, JSON.stringify(AppState.categories));
  } catch (_) {
    showStorageBanner('Gagal menyimpan kategori.');
  }
}

function saveLimits() {
  try {
    localStorage.setItem(STORAGE_KEYS.limits, JSON.stringify(AppState.limits));
  } catch (_) {
    showStorageBanner('Gagal menyimpan batas pengeluaran.');
  }
}

function saveTheme() {
  try { localStorage.setItem(STORAGE_KEYS.theme, AppState.theme); } catch (_) {}
}

/* ============================================================
   VALIDATION
   ============================================================ */
function validateTransaction(name, amount, type, category) {
  const errors = [];
  if (!name || name.trim() === '')
    errors.push('Nama / keterangan wajib diisi.');
  if (name && name.trim().length > 100)
    errors.push('Nama maksimal 100 karakter.');
  const amt = parseFloat(amount);
  if (isNaN(amt) || amt <= 0)
    errors.push('Jumlah harus berupa angka positif.');
  if (amt > 999999999999)
    errors.push('Jumlah terlalu besar.');
  if (type === 'expense' && (!category || category.trim() === ''))
    errors.push('Pilih kategori untuk pengeluaran.');
  return errors.length > 0 ? errors.join(' ') : null;
}

function validateCategory(name, existingCategories) {
  if (!name || name.trim() === '') return 'Nama kategori tidak boleh kosong.';
  if (name.trim().length > 50) return 'Nama kategori maksimal 50 karakter.';
  const trimmed = name.trim().toLowerCase();
  if (existingCategories.some(c => c.toLowerCase() === trimmed))
    return 'Kategori ini sudah ada.';
  return null;
}

/* ============================================================
   TRANSACTIONS
   ============================================================ */
function generateId() {
  try { return crypto.randomUUID(); }
  catch (_) { return Date.now().toString(36) + Math.random().toString(36).slice(2); }
}

function addTransaction(name, amount, type, category) {
  if (AppState.transactions.length >= MAX_TRANSACTIONS) return;

  const transaction = {
    id:       generateId(),
    name:     name.trim(),
    amount:   Math.round(parseFloat(amount)), // IDR — whole numbers
    type:     type,                           // 'income' | 'expense'
    category: type === 'expense' ? category.trim() : 'Pemasukan',
    date:     new Date().toISOString(),
  };

  AppState.transactions.push(transaction);
  saveTransactions();
  renderAll();
}

function deleteTransaction(id) {
  AppState.transactions = AppState.transactions.filter(t => t.id !== id);
  saveTransactions();
  renderAll();
}

function getSortedTransactions() {
  const copy = structuredClone(AppState.transactions);
  switch (AppState.sortOrder) {
    case 'amount-asc':
      return copy.sort((a, b) => a.amount - b.amount || a.name.localeCompare(b.name));
    case 'amount-desc':
      return copy.sort((a, b) => b.amount - a.amount || a.name.localeCompare(b.name));
    case 'category-asc':
      return copy.sort((a, b) => a.category.localeCompare(b.category) || a.name.localeCompare(b.name));
    case 'type-income':
      return copy.sort((a, b) => {
        if (a.type === b.type) return 0;
        return a.type === 'income' ? -1 : 1;
      });
    case 'type-expense':
      return copy.sort((a, b) => {
        if (a.type === b.type) return 0;
        return a.type === 'expense' ? -1 : 1;
      });
    default:
      return copy;
  }
}

/* ============================================================
   SUMMARY CALCULATIONS
   ============================================================ */
function calcSummary() {
  let income = 0, expense = 0;
  for (const t of AppState.transactions) {
    if (t.type === 'income') income += t.amount;
    else expense += t.amount;
  }
  return { income, expense, balance: income - expense };
}

/* ============================================================
   CATEGORIES
   ============================================================ */
function addCategory(name) {
  AppState.categories.push(name.trim());
  saveCategories();
  renderCategoryDropdown();
  renderLimitInputs();
}

function getExpenseCategoryTotals() {
  const totals = new Map();
  for (const t of AppState.transactions) {
    if (t.type !== 'expense') continue;
    totals.set(t.category, (totals.get(t.category) || 0) + t.amount);
  }
  return totals;
}

/* ============================================================
   LIMITS
   ============================================================ */
function setSpendingLimit(category, value) {
  const num = parseFloat(value);
  if (!isNaN(num) && num > 0) AppState.limits[category] = num;
  else delete AppState.limits[category];
  saveLimits();
  renderTransactionList();
  renderPieChart();
}

function isOverLimit(category) {
  const limit = AppState.limits[category];
  if (limit === undefined || limit === null) return false;
  const totals = getExpenseCategoryTotals();
  return (totals.get(category) || 0) > limit;
}

/* ============================================================
   RENDERING — Summary Cards (Income / Expense / Balance)
   ============================================================ */
function renderSummaryCards() {
  const { income, expense, balance } = calcSummary();

  document.getElementById('total-income').textContent  = formatIDR(income);
  document.getElementById('total-expense').textContent = formatIDR(expense);

  const balEl = document.getElementById('balance-amount');
  balEl.textContent = formatIDR(balance);
  balEl.className = 'summary-value ' + (balance >= 0 ? 'positive' : 'negative');
}

/* ============================================================
   RENDERING — Category Dropdown
   ============================================================ */
function renderCategoryDropdown() {
  const select  = document.getElementById('category-select');
  const current = select.value;
  select.innerHTML = '<option value="">-- Pilih Kategori --</option>';
  for (const cat of AppState.categories) {
    const opt = document.createElement('option');
    opt.value = cat;
    opt.textContent = cat;
    select.appendChild(opt);
  }
  if (current && AppState.categories.includes(current)) select.value = current;
}

/* ============================================================
   RENDERING — Show/hide category field based on type
   ============================================================ */
function updateCategoryVisibility() {
  const type = document.getElementById('type-select').value;
  const group = document.getElementById('category-group');
  if (type === 'income') group.classList.add('hidden');
  else group.classList.remove('hidden');
}

/* ============================================================
   RENDERING — Transaction List
   ============================================================ */
function renderTransactionList() {
  const list   = document.getElementById('transaction-list');
  const sorted = getSortedTransactions();
  list.innerHTML = '';

  if (sorted.length === 0) {
    const li = document.createElement('li');
    li.className = 'empty-msg';
    li.textContent = 'Belum ada transaksi. Tambahkan di atas!';
    list.appendChild(li);
    updateCapUI();
    return;
  }

  for (const t of sorted) {
    const isIncome = t.type === 'income';
    const over     = !isIncome && isOverLimit(t.category);

    const li = document.createElement('li');
    li.className = [
      'transaction-item',
      isIncome ? 'is-income' : 'is-expense',
      over ? 'over-limit' : '',
    ].filter(Boolean).join(' ');
    li.dataset.id = t.id;

    const dateStr = new Date(t.date).toLocaleDateString('id-ID', {
      day: 'numeric', month: 'short', year: 'numeric',
    });

    const sign = isIncome ? '+' : '−';

    li.innerHTML = `
      <div class="transaction-info">
        <div class="transaction-name" title="${escapeHtml(t.name)}">${escapeHtml(t.name)}</div>
        <div class="transaction-meta">
          <span class="type-badge ${t.type}">${isIncome ? 'Pemasukan' : 'Pengeluaran'}</span>
          ${!isIncome ? `<span class="category-badge" style="background:${categoryColor(t.category)}">${escapeHtml(t.category)}</span>` : ''}
          <span class="transaction-date">${dateStr}</span>
        </div>
      </div>
      <span class="transaction-amount ${t.type}">${sign} ${formatIDR(t.amount)}</span>
      <button class="delete-btn" data-id="${t.id}" aria-label="Hapus ${escapeHtml(t.name)}">Hapus</button>
    `;
    list.appendChild(li);
  }

  list.querySelectorAll('.delete-btn').forEach(btn => {
    btn.addEventListener('click', () => deleteTransaction(btn.dataset.id));
  });

  updateCapUI();
}

function updateCapUI() {
  const capMsg = document.getElementById('cap-msg');
  const addBtn = document.getElementById('add-btn');
  if (AppState.transactions.length >= MAX_TRANSACTIONS) {
    capMsg.classList.remove('hidden');
    addBtn.disabled = true;
  } else {
    capMsg.classList.add('hidden');
    addBtn.disabled = false;
  }
}

/* ============================================================
   RENDERING — Pie Chart (expense categories only)
   ============================================================ */
function renderPieChart() {
  const canvas   = document.getElementById('pie-chart');
  const fallback = document.getElementById('chart-fallback');
  const legend   = document.getElementById('chart-legend');

  if (!canvas || !canvas.getContext) {
    canvas && canvas.classList.add('hidden');
    fallback && fallback.classList.remove('hidden');
    return;
  }

  const ctx = canvas.getContext('2d');
  const W = canvas.width, H = canvas.height;
  const cx = W / 2, cy = H / 2;
  const R = Math.min(W, H) / 2 - 10;

  ctx.clearRect(0, 0, W, H);
  legend.innerHTML = '';

  const totals = getExpenseCategoryTotals();

  if (totals.size === 0) {
    ctx.beginPath();
    ctx.arc(cx, cy, R, 0, Math.PI * 2);
    ctx.fillStyle = getComputedStyle(document.documentElement).getPropertyValue('--border').trim() || '#e0e0ee';
    ctx.fill();
    ctx.fillStyle = getComputedStyle(document.documentElement).getPropertyValue('--text-muted').trim() || '#888899';
    ctx.font = 'bold 13px sans-serif';
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    ctx.fillText('Belum ada data', cx, cy);
    return;
  }

  const grandTotal = [...totals.values()].reduce((s, v) => s + v, 0);
  let startAngle = -Math.PI / 2;

  for (const [cat, total] of totals) {
    const slice = (total / grandTotal) * Math.PI * 2;
    const color = categoryColor(cat);
    const over  = isOverLimit(cat);

    ctx.beginPath();
    ctx.moveTo(cx, cy);
    ctx.arc(cx, cy, R, startAngle, startAngle + slice);
    ctx.closePath();
    ctx.fillStyle = color;
    ctx.fill();

    if (over) {
      ctx.save();
      ctx.setLineDash([6, 3]);
      ctx.strokeStyle = '#e74c3c';
      ctx.lineWidth = 3;
      ctx.beginPath();
      ctx.moveTo(cx, cy);
      ctx.arc(cx, cy, R, startAngle, startAngle + slice);
      ctx.closePath();
      ctx.stroke();
      ctx.restore();
    }

    if (slice > 0.25) {
      const mid = startAngle + slice / 2;
      const lx = cx + R * 0.65 * Math.cos(mid);
      const ly = cy + R * 0.65 * Math.sin(mid);
      ctx.fillStyle = '#fff';
      ctx.font = 'bold 11px sans-serif';
      ctx.textAlign = 'center';
      ctx.textBaseline = 'middle';
      ctx.fillText(((total / grandTotal) * 100).toFixed(1) + '%', lx, ly);
    }

    startAngle += slice;

    const item = document.createElement('div');
    item.className = 'legend-item';
    item.innerHTML = `
      <span class="legend-swatch" style="background:${color}"></span>
      <span>${escapeHtml(cat)} (${formatIDR(total)})</span>
    `;
    legend.appendChild(item);
  }
}

/* ============================================================
   RENDERING — Spending Limit Inputs
   ============================================================ */
function renderLimitInputs() {
  const container = document.getElementById('limit-manager');
  container.innerHTML = '';

  if (AppState.categories.length === 0) {
    container.innerHTML = '<p class="limit-empty">Belum ada kategori.</p>';
    return;
  }

  for (const cat of AppState.categories) {
    const div = document.createElement('div');
    div.className = 'limit-item';

    const label = document.createElement('label');
    label.textContent = cat;
    label.htmlFor = `limit-${CSS.escape(cat)}`;

    const input = document.createElement('input');
    input.type = 'number';
    input.id = `limit-${CSS.escape(cat)}`;
    input.placeholder = 'Tanpa batas';
    input.min = '1';
    input.step = '1000';
    input.value = AppState.limits[cat] !== undefined ? AppState.limits[cat] : '';
    input.setAttribute('aria-label', `Batas pengeluaran untuk ${cat}`);
    input.addEventListener('change', () => setSpendingLimit(cat, input.value));

    div.appendChild(label);
    div.appendChild(input);
    container.appendChild(div);
  }
}

/* ============================================================
   RENDERING — Monthly Summary
   ============================================================ */
function renderMonthlySummary(month, year) {
  const summaryList    = document.getElementById('summary-list');
  const summaryEmpty   = document.getElementById('summary-empty');
  const summaryTotals  = document.getElementById('summary-totals');
  const incomeAmountEl = document.getElementById('summary-income-amount');
  const expenseAmountEl= document.getElementById('summary-expense-amount');
  const balanceAmountEl= document.getElementById('summary-balance-amount');

  summaryList.innerHTML = '';
  summaryEmpty.classList.add('hidden');
  summaryTotals.classList.add('hidden');

  const filtered = AppState.transactions.filter(t => {
    const d = new Date(t.date);
    return d.getMonth() + 1 === month && d.getFullYear() === year;
  });

  if (filtered.length === 0) {
    summaryEmpty.classList.remove('hidden');
    return;
  }

  let totalIncome = 0, totalExpense = 0;

  for (const t of filtered) {
    if (t.type === 'income') totalIncome += t.amount;
    else totalExpense += t.amount;

    const li = document.createElement('li');
    li.className = 'summary-item';
    const sign = t.type === 'income' ? '+' : '−';
    li.innerHTML = `
      <span>
        ${escapeHtml(t.name)}
        <small style="color:var(--text-muted)">(${escapeHtml(t.category)})</small>
      </span>
      <span class="item-amount ${t.type}">${sign} ${formatIDR(t.amount)}</span>
    `;
    summaryList.appendChild(li);
  }

  const balance = totalIncome - totalExpense;
  incomeAmountEl.textContent  = formatIDR(totalIncome);
  expenseAmountEl.textContent = formatIDR(totalExpense);
  balanceAmountEl.textContent = formatIDR(Math.abs(balance));
  balanceAmountEl.className   = balance >= 0 ? 'positive' : 'negative';
  summaryTotals.classList.remove('hidden');
}

/* ============================================================
   RENDERING — All
   ============================================================ */
function renderAll() {
  renderSummaryCards();
  renderTransactionList();
  renderPieChart();
}

/* ============================================================
   THEME
   ============================================================ */
let _themeDebounce = null;

function applyTheme(theme) {
  AppState.theme = theme;
  document.documentElement.setAttribute('data-theme', theme);
  const btn = document.getElementById('theme-toggle');
  if (btn) btn.textContent = theme === 'dark' ? '☀️ Mode Terang' : '🌙 Mode Gelap';
  saveTheme();
  renderPieChart();
}

function toggleTheme() {
  if (_themeDebounce) return;
  _themeDebounce = setTimeout(() => { _themeDebounce = null; }, 300);
  applyTheme(AppState.theme === 'dark' ? 'light' : 'dark');
}

/* ============================================================
   HELPERS
   ============================================================ */
function formatIDR(amount) {
  // Format: Rp 1.000.000  (Indonesian thousand separator = dot)
  const rounded = Math.round(Number(amount));
  return 'Rp ' + rounded.toLocaleString('id-ID');
}

function escapeHtml(str) {
  return String(str)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;');
}

function categoryColor(str) {
  let hash = 0;
  for (let i = 0; i < str.length; i++) {
    hash = str.charCodeAt(i) + ((hash << 5) - hash);
  }
  return `hsl(${Math.abs(hash) % 360}, 65%, 55%)`;
}

/* ============================================================
   INIT
   ============================================================ */
function init() {
  if (!checkCompatibility()) return;

  loadFromStorage();

  // Default year for monthly summary
  document.getElementById('year-input').value = new Date().getFullYear();

  applyTheme(AppState.theme);

  renderCategoryDropdown();
  renderLimitInputs();
  updateCategoryVisibility();
  renderAll();

  // — Input Form submit —
  document.getElementById('input-form').addEventListener('submit', e => {
    e.preventDefault();
    const name     = document.getElementById('item-name').value;
    const amount   = document.getElementById('amount').value;
    const type     = document.getElementById('type-select').value;
    const category = type === 'expense'
      ? document.getElementById('category-select').value
      : 'Pemasukan';

    const errEl = document.getElementById('form-error');
    const error = validateTransaction(name, amount, type, category);
    if (error) { errEl.textContent = error; return; }
    errEl.textContent = '';

    if (AppState.transactions.length >= MAX_TRANSACTIONS) return;

    addTransaction(name, amount, type, category);

    // Reset form
    document.getElementById('item-name').value = '';
    document.getElementById('amount').value = '';
    document.getElementById('category-select').value = '';
  });

  // — Type select: show/hide category —
  document.getElementById('type-select').addEventListener('change', updateCategoryVisibility);

  // — Category Manager —
  document.getElementById('add-category-btn').addEventListener('click', () => {
    const input = document.getElementById('new-category-input');
    const errEl = document.getElementById('category-error');
    const error = validateCategory(input.value, AppState.categories);
    if (error) { errEl.textContent = error; return; }
    errEl.textContent = '';
    addCategory(input.value);
    input.value = '';
  });

  // — Sort control —
  document.getElementById('sort-select').addEventListener('change', e => {
    AppState.sortOrder = e.target.value || null;
    renderTransactionList();
  });

  // — Monthly Summary —
  document.getElementById('apply-summary-btn').addEventListener('click', () => {
    const month = parseInt(document.getElementById('month-select').value, 10);
    const year  = parseInt(document.getElementById('year-input').value, 10);
    if (!isNaN(month) && !isNaN(year)) renderMonthlySummary(month, year);
  });

  // — Theme Toggle —
  document.getElementById('theme-toggle').addEventListener('click', toggleTheme);

  // — Storage Banner dismiss —
  document.getElementById('storage-error-close').addEventListener('click', dismissStorageBanner);
}

document.addEventListener('DOMContentLoaded', init);
