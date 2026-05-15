/* ============================================================
   Expense & Budget Visualizer — js/app.js
   Vanilla JS, no frameworks, no build tools.
   Sections: State | Storage | Validation | Transactions |
             Categories | Limits | Rendering | Theme | Init
   ============================================================ */

'use strict';

/* ============================================================
   BROWSER COMPATIBILITY CHECK (Baseline 2023 APIs)
   ============================================================ */
function checkCompatibility() {
  const required = [
    { name: 'localStorage',         test: () => window.localStorage },
    { name: 'JSON.parse',           test: () => JSON.parse },
    { name: 'JSON.stringify',       test: () => JSON.stringify },
    { name: 'Array.prototype.at',   test: () => [].at },
    { name: 'structuredClone',      test: () => structuredClone },
    { name: 'CSS.supports',         test: () => CSS && CSS.supports },
  ];

  const missing = [];
  for (const api of required) {
    try {
      if (!api.test()) missing.push(api.name);
    } catch (_) {
      missing.push(api.name);
    }
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
  limits:       {},   // { [category]: number }
  theme:        'light',
  sortOrder:    null, // 'amount-asc' | 'amount-desc' | 'category-asc' | null
};

const DEFAULT_CATEGORIES = ['Food', 'Transport', 'Fun'];
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
  _bannerTimer = setTimeout(() => dismissStorageBanner(), 5000);
}

function dismissStorageBanner() {
  const banner = document.getElementById('storage-error');
  banner.classList.add('hidden');
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
  } catch (_) {
    AppState.transactions = [];
    showStorageBanner('Read error: could not load transactions. Your data may not be saved.');
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
    showStorageBanner('Read error: could not load categories.');
  }

  // Limits
  try {
    const raw = localStorage.getItem(STORAGE_KEYS.limits);
    AppState.limits = raw ? JSON.parse(raw) : {};
    if (typeof AppState.limits !== 'object' || Array.isArray(AppState.limits)) AppState.limits = {};
  } catch (_) {
    AppState.limits = {};
    showStorageBanner('Read error: could not load spending limits.');
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
    showStorageBanner('Write error: could not save transactions. Storage may be full or unavailable.');
  }
}

function saveCategories() {
  try {
    localStorage.setItem(STORAGE_KEYS.categories, JSON.stringify(AppState.categories));
  } catch (_) {
    showStorageBanner('Write error: could not save categories.');
  }
}

function saveLimits() {
  try {
    localStorage.setItem(STORAGE_KEYS.limits, JSON.stringify(AppState.limits));
  } catch (_) {
    showStorageBanner('Write error: could not save spending limits.');
  }
}

function saveTheme() {
  try {
    localStorage.setItem(STORAGE_KEYS.theme, AppState.theme);
  } catch (_) {
    // Non-critical; silently ignore
  }
}

/* ============================================================
   VALIDATION
   ============================================================ */
function validateTransaction(name, amount, category) {
  const errors = [];
  if (!name || name.trim() === '') errors.push('Item name is required.');
  if (name && name.trim().length > 100) errors.push('Item name must be 100 characters or fewer.');
  const amt = parseFloat(amount);
  if (isNaN(amt) || amt <= 0) errors.push('Amount must be a positive number.');
  if (amt > 999999999.99) errors.push('Amount is too large.');
  if (!category || category.trim() === '') errors.push('Please select a category.');
  return errors.length > 0 ? errors.join(' ') : null;
}

function validateCategory(name, existingCategories) {
  if (!name || name.trim() === '') return 'Category name cannot be empty.';
  if (name.trim().length > 50) return 'Category name must be 50 characters or fewer.';
  const trimmed = name.trim().toLowerCase();
  if (existingCategories.some(c => c.toLowerCase() === trimmed)) {
    return 'This category already exists.';
  }
  return null;
}

/* ============================================================
   TRANSACTIONS
   ============================================================ */
function generateId() {
  try {
    return crypto.randomUUID();
  } catch (_) {
    return Date.now().toString(36) + Math.random().toString(36).slice(2);
  }
}

function addTransaction(name, amount, category) {
  if (AppState.transactions.length >= MAX_TRANSACTIONS) return;

  const transaction = {
    id:       generateId(),
    name:     name.trim(),
    amount:   parseFloat(parseFloat(amount).toFixed(2)),
    category: category.trim(),
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
    default:
      return copy;
  }
}

/* ============================================================
   CATEGORIES
   ============================================================ */
function addCategory(name) {
  const trimmed = name.trim();
  AppState.categories.push(trimmed);
  saveCategories();
  renderCategoryDropdown();
  renderLimitInputs();
}

function getCategoryTotals() {
  const totals = new Map();
  for (const t of AppState.transactions) {
    totals.set(t.category, (totals.get(t.category) || 0) + t.amount);
  }
  return totals;
}

/* ============================================================
   LIMITS
   ============================================================ */
function setSpendingLimit(category, value) {
  const num = parseFloat(value);
  if (!isNaN(num) && num > 0) {
    AppState.limits[category] = num;
  } else {
    delete AppState.limits[category];
  }
  saveLimits();
  renderTransactionList();
  renderPieChart();
}

function isOverLimit(category) {
  const limit = AppState.limits[category];
  if (limit === undefined || limit === null) return false;
  const totals = getCategoryTotals();
  return (totals.get(category) || 0) > limit;
}

/* ============================================================
   RENDERING — Balance
   ============================================================ */
function renderBalanceDisplay() {
  const total = AppState.transactions.reduce((sum, t) => sum + t.amount, 0);
  document.getElementById('balance-amount').textContent = formatCurrency(total);
}

/* ============================================================
   RENDERING — Category Dropdown
   ============================================================ */
function renderCategoryDropdown() {
  const select = document.getElementById('category-select');
  const current = select.value;
  select.innerHTML = '<option value="">-- Select Category --</option>';
  for (const cat of AppState.categories) {
    const opt = document.createElement('option');
    opt.value = cat;
    opt.textContent = cat;
    select.appendChild(opt);
  }
  if (current && AppState.categories.includes(current)) select.value = current;
}

/* ============================================================
   RENDERING — Transaction List
   ============================================================ */
function renderTransactionList() {
  const list = document.getElementById('transaction-list');
  const sorted = getSortedTransactions();
  list.innerHTML = '';

  if (sorted.length === 0) {
    const li = document.createElement('li');
    li.className = 'empty-msg';
    li.textContent = 'No transactions yet. Add one above!';
    list.appendChild(li);
    return;
  }

  for (const t of sorted) {
    const over = isOverLimit(t.category);
    const li = document.createElement('li');
    li.className = 'transaction-item' + (over ? ' over-limit' : '');
    li.dataset.id = t.id;

    const dateStr = new Date(t.date).toLocaleDateString(undefined, {
      month: 'short', day: 'numeric', year: 'numeric'
    });

    li.innerHTML = `
      <div class="transaction-info">
        <div class="transaction-name" title="${escapeHtml(t.name)}">${escapeHtml(t.name)}</div>
        <div class="transaction-meta">
          <span class="category-badge" style="background:${categoryColor(t.category)}">${escapeHtml(t.category)}</span>
          <span class="transaction-date">${dateStr}</span>
        </div>
      </div>
      <span class="transaction-amount">${formatCurrency(t.amount)}</span>
      <button class="delete-btn" data-id="${t.id}" aria-label="Delete ${escapeHtml(t.name)}">Delete</button>
    `;
    list.appendChild(li);
  }

  // Wire delete buttons
  list.querySelectorAll('.delete-btn').forEach(btn => {
    btn.addEventListener('click', () => deleteTransaction(btn.dataset.id));
  });

  // Cap message
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
   RENDERING — Pie Chart (Canvas 2D, no external library)
   ============================================================ */
function renderPieChart() {
  const canvas = document.getElementById('pie-chart');
  const fallback = document.getElementById('chart-fallback');
  const legend = document.getElementById('chart-legend');

  if (!canvas || !canvas.getContext) {
    canvas && canvas.classList.add('hidden');
    fallback && fallback.classList.remove('hidden');
    return;
  }

  const ctx = canvas.getContext('2d');
  const W = canvas.width;
  const H = canvas.height;
  const cx = W / 2;
  const cy = H / 2;
  const R = Math.min(W, H) / 2 - 10;

  ctx.clearRect(0, 0, W, H);
  legend.innerHTML = '';

  const totals = getCategoryTotals();

  if (totals.size === 0) {
    // Placeholder
    ctx.beginPath();
    ctx.arc(cx, cy, R, 0, Math.PI * 2);
    ctx.fillStyle = getComputedStyle(document.documentElement)
      .getPropertyValue('--border').trim() || '#e0e0ee';
    ctx.fill();
    ctx.fillStyle = getComputedStyle(document.documentElement)
      .getPropertyValue('--text-muted').trim() || '#888899';
    ctx.font = `bold 14px ${getComputedStyle(document.documentElement).getPropertyValue('--font') || 'sans-serif'}`;
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    ctx.fillText('No data', cx, cy);
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

    // Over-limit: dashed border on segment
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

    // Percentage label (only if slice is large enough)
    if (slice > 0.25) {
      const midAngle = startAngle + slice / 2;
      const lx = cx + (R * 0.65) * Math.cos(midAngle);
      const ly = cy + (R * 0.65) * Math.sin(midAngle);
      const pct = ((total / grandTotal) * 100).toFixed(1);
      ctx.fillStyle = '#fff';
      ctx.font = 'bold 11px sans-serif';
      ctx.textAlign = 'center';
      ctx.textBaseline = 'middle';
      ctx.fillText(`${pct}%`, lx, ly);
    }

    startAngle += slice;

    // Legend entry
    const item = document.createElement('div');
    item.className = 'legend-item';
    item.innerHTML = `
      <span class="legend-swatch" style="background:${color}"></span>
      <span>${escapeHtml(cat)} (${formatCurrency(total)})</span>
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
    container.innerHTML = '<p class="limit-empty">No categories yet.</p>';
    return;
  }

  for (const cat of AppState.categories) {
    const div = document.createElement('div');
    div.className = 'limit-item';

    const label = document.createElement('label');
    label.textContent = cat;
    label.htmlFor = `limit-${cat}`;

    const input = document.createElement('input');
    input.type = 'number';
    input.id = `limit-${cat}`;
    input.placeholder = 'No limit';
    input.min = '0.01';
    input.step = '0.01';
    input.value = AppState.limits[cat] !== undefined ? AppState.limits[cat] : '';
    input.setAttribute('aria-label', `Spending limit for ${cat}`);

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
  const summaryList  = document.getElementById('summary-list');
  const summaryEmpty = document.getElementById('summary-empty');
  const summaryTotal = document.getElementById('summary-total');
  const summaryAmt   = document.getElementById('summary-total-amount');

  summaryList.innerHTML = '';
  summaryEmpty.classList.add('hidden');
  summaryTotal.classList.add('hidden');

  const filtered = AppState.transactions.filter(t => {
    const d = new Date(t.date);
    return d.getMonth() + 1 === month && d.getFullYear() === year;
  });

  if (filtered.length === 0) {
    summaryEmpty.classList.remove('hidden');
    return;
  }

  let total = 0;
  for (const t of filtered) {
    total += t.amount;
    const li = document.createElement('li');
    li.className = 'summary-item';
    li.innerHTML = `
      <span>${escapeHtml(t.name)} <small style="color:var(--text-muted)">(${escapeHtml(t.category)})</small></span>
      <span>${formatCurrency(t.amount)}</span>
    `;
    summaryList.appendChild(li);
  }

  summaryAmt.textContent = formatCurrency(total);
  summaryTotal.classList.remove('hidden');
}

/* ============================================================
   RENDERING — All
   ============================================================ */
function renderAll() {
  renderBalanceDisplay();
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
  if (btn) btn.textContent = theme === 'dark' ? '☀️ Light Mode' : '🌙 Dark Mode';
  saveTheme();
  // Re-render chart so colours update
  renderPieChart();
}

function toggleTheme() {
  if (_themeDebounce) return; // debounce: ignore activations within 300ms
  _themeDebounce = setTimeout(() => { _themeDebounce = null; }, 300);
  applyTheme(AppState.theme === 'dark' ? 'light' : 'dark');
}

/* ============================================================
   HELPERS
   ============================================================ */
function formatCurrency(amount) {
  return '$' + Number(amount).toLocaleString('en-US', {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  });
}

function escapeHtml(str) {
  return String(str)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;');
}

// Deterministic HSL colour from a string
function categoryColor(str) {
  let hash = 0;
  for (let i = 0; i < str.length; i++) {
    hash = str.charCodeAt(i) + ((hash << 5) - hash);
  }
  const hue = Math.abs(hash) % 360;
  return `hsl(${hue}, 65%, 55%)`;
}

/* ============================================================
   INIT
   ============================================================ */
function init() {
  // 1. Compatibility check first
  if (!checkCompatibility()) return;

  // 2. Load persisted state
  loadFromStorage();

  // 3. Set default year in monthly summary
  document.getElementById('year-input').value = new Date().getFullYear();

  // 4. Apply stored theme
  applyTheme(AppState.theme);

  // 5. Render all UI
  renderCategoryDropdown();
  renderLimitInputs();
  renderAll();

  // 6. Wire: Input Form submit
  document.getElementById('input-form').addEventListener('submit', e => {
    e.preventDefault();
    const name     = document.getElementById('item-name').value;
    const amount   = document.getElementById('amount').value;
    const category = document.getElementById('category-select').value;
    const error    = validateTransaction(name, amount, category);
    const errEl    = document.getElementById('form-error');

    if (error) {
      errEl.textContent = error;
      return;
    }
    errEl.textContent = '';

    if (AppState.transactions.length >= MAX_TRANSACTIONS) return;

    addTransaction(name, amount, category);

    // Reset form
    document.getElementById('item-name').value = '';
    document.getElementById('amount').value = '';
    document.getElementById('category-select').value = '';
  });

  // 7. Wire: Category Manager submit
  document.getElementById('add-category-btn').addEventListener('click', () => {
    const input  = document.getElementById('new-category-input');
    const errEl  = document.getElementById('category-error');
    const error  = validateCategory(input.value, AppState.categories);

    if (error) {
      errEl.textContent = error;
      return;
    }
    errEl.textContent = '';
    addCategory(input.value);
    input.value = '';
  });

  // 8. Wire: Sort control
  document.getElementById('sort-select').addEventListener('change', e => {
    AppState.sortOrder = e.target.value || null;
    renderTransactionList();
  });

  // 9. Wire: Monthly Summary
  document.getElementById('apply-summary-btn').addEventListener('click', () => {
    const month = parseInt(document.getElementById('month-select').value, 10);
    const year  = parseInt(document.getElementById('year-input').value, 10);
    if (!isNaN(month) && !isNaN(year)) renderMonthlySummary(month, year);
  });

  // 10. Wire: Theme Toggle
  document.getElementById('theme-toggle').addEventListener('click', toggleTheme);

  // 11. Wire: Storage Banner dismiss
  document.getElementById('storage-error-close').addEventListener('click', dismissStorageBanner);
}

document.addEventListener('DOMContentLoaded', init);
