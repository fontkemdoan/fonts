(() => {
'use strict';

const $ = (id) => document.getElementById(id);

// ================= Tiện ích =================
// ---- Session token ----
const getToken = () => localStorage.getItem('kd_session_token') || '';
const setToken = (t) => localStorage.setItem('kd_session_token', t);
const clearToken = () => localStorage.removeItem('kd_session_token');

const downloadUrl = (file) =>
  '/api/download?file=' + encodeURIComponent(file) + '&token=' + encodeURIComponent(getToken());

async function postJson(url, body) {
  const res = await fetch(url, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(body)
  });
  return res.json();
}

// ---- Chuẩn hóa chuỗi để tìm kiếm: bỏ dấu, bỏ ký tự đặc biệt, chữ thường ----
function foldText(str) {
  return String(str).toLowerCase()
    .replace(/đ/g, 'd')
    .normalize('NFD').replace(/[\u0300-\u036f]/g, '')
    .replace(/[^a-z0-9]+/g, '');
}

// ---- Hiệu ứng ----
const prefersReducedMotion = () =>
  window.matchMedia('(prefers-reduced-motion: reduce)').matches;

function spinIcon(btn) {
  const icon = btn.querySelector('i');
  if (!icon) return;
  icon.classList.remove('spin-360');
  void icon.offsetWidth;
  icon.classList.add('spin-360');
}

// ---- Lưu blob thành file tải về ----
function saveBlob(blob, name) {
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = name;
  document.body.appendChild(a);
  a.click();
  a.remove();
  setTimeout(() => URL.revokeObjectURL(url), 10000);
}

// ---- JSZip chỉ tải khi cần (lúc bấm tải cả bộ font) ----
const JSZIP_SRC = 'https://cdnjs.cloudflare.com/ajax/libs/jszip/3.10.1/jszip.min.js';
let jszipPromise = null;

function loadJSZip() {
  if (window.JSZip) return Promise.resolve(window.JSZip);
  if (!jszipPromise) {
    jszipPromise = new Promise((resolve, reject) => {
      const s = document.createElement('script');
      s.src = JSZIP_SRC;
      s.onload = () => resolve(window.JSZip);
      s.onerror = () => { jszipPromise = null; reject(new Error('Cannot load JSZip')); };
      document.head.appendChild(s);
    });
  }
  return jszipPromise;
}

// ================= Giao diện sáng/tối =================
function initTheme() {
  const root = document.documentElement;
  const btn = document.getElementById('theme-toggle');
  const icon = btn.querySelector('i');

  const sync = () => {
    icon.className = root.getAttribute('data-theme') === 'dark' ? 'ri-moon-line' : 'ri-sun-line';
  };
  sync();

  btn.addEventListener('click', () => {
    const theme = root.getAttribute('data-theme') === 'dark' ? 'light' : 'dark';
    root.setAttribute('data-theme', theme);
    try { localStorage.setItem('kd_theme', theme); } catch (e) {}
    sync();
  });
}

// ================= Đăng nhập / đổi mật khẩu =================
const loginPanel = $('login-panel');
const brand = $('brand');
const contentEl = $('content');
const bootLoading = $('boot-loading');
const loginEmail = $('login-email');
const loginPassword = $('login-password');
const newPasswordInput = $('new-password');
const changePassExtra = $('change-pass-extra');
const loginBtn = $('login-btn');
const changePassBtn = $('change-pass-btn');
const authBtn = $('auth-btn');
const authIcon = authBtn.querySelector('i');
const noticePanel = $('notice-panel');
const loginError = $('login-error');
const loginIcon = $('login-icon');
const loginTitle = document.querySelector('.login-title');

const SPINNER = '<i class="ri-loader-4-line kd-spinner"></i>';
const LABEL = {
  login: '<i class="ri-arrow-right-line"></i> Đăng nhập',
  back: '<i class="ri-arrow-left-line"></i> Quay lại',
  changePass: '<i class="ri-key-2-line"></i> Đổi Pass',
  confirm: '<i class="ri-check-line"></i> Xác nhận'
};
const DEFAULT_TITLE = 'Thành Viên';
const DEFAULT_ICON = '<i class="ri-user-line"></i>';
const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

let changePassMode = false;
let loginErrorTimer = null;
let previewTimer = null;

// ---- Trạng thái đăng nhập ----
const isLoggedIn = () => !!getToken();

// Đổi trạng thái đăng nhập -> đóng mọi preview đang mở để mở lại theo trạng thái mới
function resetPreviews(clearCache) {
  document.querySelectorAll('.preview-panel.open').forEach(closePanel);
  document.querySelectorAll('.demo-card.open').forEach((c) => c.classList.remove('open'));
  if (clearCache) {
    loadedPreviewFonts.forEach((family) => {
      document.fonts.forEach((f) => { if (f.family === family) document.fonts.delete(f); });
    });
    loadedPreviewFonts.clear();
  }
}

function updateAuthUI() {
  const on = isLoggedIn();
  authIcon.className = on ? 'ri-logout-box-line' : 'ri-user-line';
  authBtn.setAttribute('aria-label', on ? 'Đăng xuất' : 'Đăng nhập');
}

// ---- Chuyển màn hình ----
function showApp() {
  brand.classList.add('search-brand');
  brand.hidden = false;
  contentEl.hidden = false;
  loadFonts();
}

function openLogin() {
  closeNotice();
  loginPanel.hidden = false;
}

function closeLogin() {
  loginPanel.hidden = true;
  loginPassword.value = '';
  loginError.textContent = '';
  if (changePassMode) exitChangePassMode();
}

function openNotice() {
  closeLogin();
  noticePanel.hidden = false;
}

function closeNotice() {
  noticePanel.hidden = true;
}

// Vào trang luôn xem được; chỉ kiểm tra token để biết đã đăng nhập hay chưa
async function verifyAndBoot() {
  bootLoading.hidden = true;
  showApp();

  const token = getToken();
  if (!token) { updateAuthUI(); return; }

  try {
    const data = await postJson('/api/verify-session', { token });
    if (!data.ok) clearToken();
  } catch (e) {
    // Không kết nối được server -> giữ nguyên token
  }
  updateAuthUI();
}

// ---- Thông báo lỗi ----
function showLoginError(msg) {
  loginError.textContent = msg;
  clearTimeout(loginErrorTimer);
  loginErrorTimer = setTimeout(() => { loginError.textContent = ''; }, 2000);
}

// ---- Đăng nhập ----
async function doLogin() {
  const email = loginEmail.value.trim().toLowerCase();
  const password = loginPassword.value;
  loginError.textContent = '';

  if (!email || !password) {
    showLoginError('Vui lòng nhập email và mật khẩu');
    return;
  }

  loginBtn.disabled = true;
  loginBtn.innerHTML = SPINNER;

  try {
    const data = await postJson('/api/login', { email, password, mode: 'login' });
    if (data.ok) {
      setToken(data.token);
      loginEmail.value = '';
      resetLoginIcon();
      updateAuthUI();
      resetPreviews(false);
      closeLogin();
    } else if (data.error === 'wrong_password') {
      showLoginError('Sai mật khẩu');
    } else {
      showLoginError('Tài khoản không tồn tại');
    }
  } catch (e) {
    showLoginError('Lỗi kết nối, hãy thử lại sau');
  } finally {
    loginBtn.disabled = false;
    loginBtn.innerHTML = LABEL.login;
  }
}

// ---- Đổi mật khẩu ----
function enterChangePassMode() {
  changePassMode = true;
  changePassExtra.hidden = false;
  changePassBtn.innerHTML = LABEL.confirm;
  loginBtn.innerHTML = LABEL.back;
}

function exitChangePassMode() {
  changePassMode = false;
  changePassExtra.hidden = true;
  newPasswordInput.value = '';
  changePassBtn.innerHTML = LABEL.changePass;
  loginBtn.innerHTML = LABEL.login;
}

async function doChangePassword() {
  const email = loginEmail.value.trim().toLowerCase();
  const oldPassword = loginPassword.value;
  const newPassword = newPasswordInput.value;

  if (!email || !oldPassword || !newPassword) {
    showLoginError('Vui lòng nhập đầy đủ thông tin');
    return;
  }

  changePassBtn.disabled = true;
  loginBtn.disabled = true;
  changePassBtn.innerHTML = SPINNER;

  try {
    const data = await postJson('/api/change-password', { email, oldPassword, newPassword });
    if (data.ok) {
      showLoginError('Đổi mật khẩu thành công');
      exitChangePassMode();
    } else if (data.error === 'wrong_password') {
      showLoginError('Mật khẩu hiện tại không đúng');
    } else if (data.error === 'not_found') {
      showLoginError('Tài khoản không tồn tại');
    } else {
      showLoginError('Có lỗi xảy ra, hãy thử lại sau');
    }
  } catch (e) {
    showLoginError('Lỗi kết nối, hãy thử lại sau');
  } finally {
    changePassBtn.disabled = false;
    loginBtn.disabled = false;
    if (changePassMode) changePassBtn.innerHTML = LABEL.confirm;
  }
}

// ---- Xem trước avatar theo email ----
function resetLoginIcon() {
  loginIcon.innerHTML = DEFAULT_ICON;
  loginTitle.textContent = DEFAULT_TITLE;
}

async function previewAvatar(email) {
  try {
    const data = await postJson('/api/login', { email, mode: 'preview' });
    if (!data.ok) {
      resetLoginIcon();
      return;
    }
    if (data.avatar) {
      const img = document.createElement('img');
      img.src = 'avatars/' + data.avatar;
      img.alt = 'avatar';
      loginIcon.replaceChildren(img);
    } else {
      loginIcon.innerHTML = DEFAULT_ICON;
    }
    loginTitle.textContent = data.name || DEFAULT_TITLE;
  } catch (e) {
    resetLoginIcon();
  }
}

// ---- Khởi tạo ----
function initAuth() {
  loginBtn.addEventListener('click', () => {
    if (changePassMode) exitChangePassMode(); else doLogin();
  });

  changePassBtn.addEventListener('click', () => {
    if (changePassMode) doChangePassword(); else enterChangePassMode();
  });

  [loginEmail, loginPassword].forEach((input) => {
    input.addEventListener('keydown', (e) => {
      if (e.key === 'Enter' && !changePassMode) doLogin();
    });
  });

  loginEmail.addEventListener('input', () => {
    clearTimeout(previewTimer);
    const val = loginEmail.value.trim().toLowerCase();
    if (!emailRegex.test(val)) {
      resetLoginIcon();
      return;
    }
    previewTimer = setTimeout(() => previewAvatar(val), 400);
  });

  authBtn.addEventListener('click', () => {
    if (isLoggedIn()) {
      clearToken();
      updateAuthUI();
      resetPreviews(true);
      closeLogin();
      closeNotice();
    } else if (loginPanel.hidden) {
      openLogin();
    } else {
      closeLogin();
    }
  });

  // Bấm ra ngoài thẻ / nhấn Esc để đóng panel
  loginPanel.addEventListener('click', (e) => { if (e.target === loginPanel) closeLogin(); });
  noticePanel.addEventListener('click', (e) => { if (e.target === noticePanel) closeNotice(); });
  $('notice-login-btn').addEventListener('click', openLogin);
  document.addEventListener('keydown', (e) => {
    if (e.key !== 'Escape') return;
    closeLogin();
    closeNotice();
  });

  verifyAndBoot();
}

// ================= Xem trước font =================
const DEFAULT_PREVIEW_TEXT = 'Phông Chữ Tiếng Việt...';
const DEFAULT_PREVIEW_SIZE = 40;
const NEED_LOGIN_TEXT = 'Đăng nhập để xem preview';

const loadedPreviewFonts = new Map(); // font.file -> tên font-family đã đăng ký
const sucking = new WeakSet();        // panel đang chạy hiệu ứng xóa chữ
let fontSeq = 0;

// Tải font (cần token) và đăng ký vào document.fonts; trả về tên font-family. Có cache.
async function ensurePreviewFont(font) {
  if (loadedPreviewFonts.has(font.file)) return loadedPreviewFonts.get(font.file);

  const res = await fetch(downloadUrl(font.file));
  if (!res.ok) throw new Error('fetch failed');

  const objectUrl = URL.createObjectURL(await res.blob());
  const familyName = 'kd-preview-' + fontSeq++;

  const fontFace = new FontFace(familyName, `url(${objectUrl})`);
  await fontFace.load();
  document.fonts.add(fontFace);

  loadedPreviewFonts.set(font.file, familyName);
  return familyName;
}

// Gắn sự kiện mở/đóng preview cho 1 thẻ font
function bindPreview(card, font) {
  const panel = card.querySelector('.preview-panel');
  panel.querySelector('.preview-input').value = DEFAULT_PREVIEW_TEXT;

  card.querySelector('.font-item').addEventListener('click', (e) => {
    if (e.target.closest('.download-btn')) return;
    togglePreview(font, panel);
  });
}

function closePanel(panel) {
  panel.classList.remove('open');
  if (panel.previousElementSibling) panel.previousElementSibling.classList.remove('expanded');
}

// Chữ bị "hút" vào thùng rác; trả về Promise khi xong
function suckTextIntoTrash(panel, textEl) {
  return new Promise((done) => {
    const text = textEl.textContent;
    if (!text.trim() || prefersReducedMotion() || !textEl.animate) { done(); return; }

    sucking.add(panel);

    textEl.textContent = '';
    const chars = [];
    Array.from(text.normalize('NFC')).forEach((ch) => {
      if (/\s/.test(ch)) {
        textEl.appendChild(document.createTextNode(ch));
      } else {
        const sp = document.createElement('span');
        sp.className = 'preview-char';
        sp.textContent = ch;
        textEl.appendChild(sp);
        chars.push(sp);
      }
    });

    const baseH = textEl.offsetHeight;
    textEl.style.paddingBottom = '46px';

    const trash = document.createElement('div');
    trash.className = 'preview-trash';
    trash.innerHTML = '<i class="ri-delete-bin-line"></i>';
    trash.style.left = (textEl.offsetLeft + textEl.offsetWidth / 2) + 'px';
    trash.style.top = (textEl.offsetTop + baseH + 6) + 'px';
    panel.appendChild(trash);

    const trashIn = trash.animate(
      [{ opacity: 0, transform: 'scale(0)' }, { opacity: 1, transform: 'scale(1)' }],
      { duration: 167, easing: 'cubic-bezier(.34,1.56,.64,1)', fill: 'forwards' }
    );

    trashIn.onfinish = () => {
      const tr = trash.getBoundingClientRect();
      const tx = tr.left + tr.width / 2;
      const ty = tr.top + tr.height / 2;
      const perChar = Math.min(27, 300 / Math.max(chars.length, 1));
      let last = null;

      chars.forEach((sp, i) => {
        const r = sp.getBoundingClientRect();
        const dx = tx - (r.left + r.width / 2);
        const dy = ty - (r.top + r.height / 2);
        const rot = (Math.random() * 2 - 1) * 240;
        last = sp.animate(
          [
            { transform: 'translate(0,0) scale(1) rotate(0deg)', opacity: 1 },
            { transform: `translate(${dx}px,${dy}px) scale(0.05) rotate(${rot}deg)`, opacity: 0 }
          ],
          { duration: 330, delay: i * perChar, easing: 'cubic-bezier(.55,0,.85,.4)', fill: 'forwards' }
        );
      });

      trash.animate(
        [
          { transform: 'scale(1) rotate(0deg)' },
          { transform: 'scale(1.18) rotate(-8deg)', offset: 0.25 },
          { transform: 'scale(1.18) rotate(8deg)', offset: 0.5 },
          { transform: 'scale(1.18) rotate(-8deg)', offset: 0.75 },
          { transform: 'scale(1) rotate(0deg)' }
        ],
        { duration: 330 + chars.length * perChar, iterations: 1 }
      );

      const finish = () => {
        trash.animate(
          [{ opacity: 1, transform: 'scale(1)' }, { opacity: 0, transform: 'scale(0)' }],
          { duration: 133, easing: 'ease-in', fill: 'forwards' }
        ).onfinish = () => {
          trash.remove();
          textEl.style.paddingBottom = '';
          sucking.delete(panel);
          done();
        };
      };
      if (last) last.onfinish = finish; else finish();
    };
  });
}

async function togglePreview(font, panel) {
  const itemEl = panel.previousElementSibling;

  document.querySelectorAll('.preview-panel.open').forEach((p) => {
    if (p !== panel) closePanel(p);
  });

  if (panel.classList.contains('open')) {
    closePanel(panel);
    return;
  }

  panel.classList.add('open');
  itemEl.classList.add('expanded');

  const q = (sel) => panel.querySelector(sel);
  const inputEl = q('.preview-input');
  const loadingEl = q('.preview-loading');
  const previewTextEl = q('.preview-text');
  const previewClearBtn = q('.preview-clear-btn');
  const sizeSlider = q('.preview-size-slider');
  const sizeValue = q('.preview-size-value');

  const applySize = () => {
    const v = Number(sizeSlider.value);
    previewTextEl.style.fontSize = v + 'px';
    sizeValue.textContent = v + 'px';
    sizeSlider.style.setProperty('--pct', (v - 1) / 99);
  };
  sizeSlider.oninput = applySize;
  sizeSlider.value = DEFAULT_PREVIEW_SIZE;
  applySize();

  let locked = false; // true = chưa đăng nhập / không tải được font -> chỉ hiện thông báo
  const applyText = () => {
    previewTextEl.textContent = locked ? NEED_LOGIN_TEXT : inputEl.value;
  };

  previewClearBtn.onclick = async () => {
    spinIcon(previewClearBtn);
    if (sucking.has(panel)) return;
    const hadText = !locked && inputEl.value.length > 0;
    inputEl.value = '';
    if (hadText) await suckTextIntoTrash(panel, previewTextEl);
    if (inputEl.value.length > 0) return; // người dùng đã gõ lại trong lúc chạy hiệu ứng
    applyText();
  };

  const showFont = (family) => {
    loadingEl.hidden = true;
    previewTextEl.style.fontFamily = `"${family}", sans-serif`;
    applyText();
    inputEl.oninput = applyText;
  };

  // Chưa đăng nhập -> không xem được
  if (!isLoggedIn()) {
    locked = true;
    inputEl.oninput = applyText;
    previewTextEl.style.fontFamily = '';
    applyText();
    return;
  }

  if (loadedPreviewFonts.has(font.file)) {
    showFont(loadedPreviewFonts.get(font.file));
    return;
  }

  loadingEl.hidden = false;
  previewTextEl.textContent = '';

  try {
    showFont(await ensurePreviewFont(font));
  } catch (e) {
    locked = true;
    loadingEl.hidden = true;
    inputEl.oninput = applyText;
    previewTextEl.style.fontFamily = '';
    applyText();
  }
}

// ================= Danh sách font, tìm kiếm, tải bộ font =================
const searchInput = $('search');
const clearBtn = $('clear-btn');
const statusEl = $('status');
const resultsEl = $('results');
const familiesEl = $('families');
const fontCardTpl = $('font-card-tpl');
const familyCardTpl = $('family-card-tpl');
const demosEl = $('demos');
const demoCardTpl = $('demo-card-tpl');

const MAX_RESULTS = 50;
let allFonts = [];

const familyKey = (f) => String(f.file).split('/')[0];

// ---- Tải danh sách font ----
async function loadFonts() {
  if (allFonts.length) { updateFamilies(); return; } // đã tải rồi (đăng nhập lại)
  try {
    const res = await fetch('manifest.json');
    allFonts = await res.json();
    allFonts.forEach((f) => { f._key = foldText(f.name); });
    buildFamilies();
    buildDemos();
  } catch (err) {
    statusEl.textContent = 'Lỗi server - ' + err;
  }
}

// ---- Gợi ý khi gõ sai tên (fuzzy) ----
function editDistance(a, b) {
  const m = a.length, n = b.length;
  if (!m) return n;
  if (!n) return m;
  let prev = new Array(n + 1), cur = new Array(n + 1);
  for (let j = 0; j <= n; j++) prev[j] = j;
  for (let i = 1; i <= m; i++) {
    cur[0] = i;
    for (let j = 1; j <= n; j++) {
      const cost = a[i - 1] === b[j - 1] ? 0 : 1;
      cur[j] = Math.min(prev[j] + 1, cur[j - 1] + 1, prev[j - 1] + cost);
    }
    [prev, cur] = [cur, prev];
  }
  return prev[n];
}

function fuzzyScore(q, name) {
  let best = editDistance(q, name);
  const L = q.length;
  for (const len of [L - 1, L, L + 1]) {
    if (len < 2 || len > name.length) continue;
    for (let i = 0; i + len <= name.length; i++) {
      const d = editDistance(q, name.slice(i, i + len));
      if (d < best) best = d;
      if (best === 0) return 0;
    }
  }
  return best;
}

function suggestFonts(raw, max = 2) {
  const q = foldText(raw);
  if (q.length < 3 || !allFonts.length) return [];
  const maxDist = Math.max(1, Math.round(q.length / 3));
  const seen = new Set();
  const scored = [];
  allFonts.forEach((f) => {
    if (seen.has(f.name)) return;
    seen.add(f.name);
    const d = fuzzyScore(q, f._key);
    if (d <= maxDist) scored.push({ name: f.name, d, len: f.name.length });
  });
  scored.sort((a, b) => a.d - b.d || a.len - b.len || a.name.localeCompare(b.name));
  return scored.slice(0, max).map((x) => x.name);
}

// ---- Hiển thị kết quả ----
function showNotFound() {
  statusEl.innerHTML =
    '<b>KHÔNG TÌM THẤY FONT</b><br><br><i>Gợi ý: Chỉ cần nhập tên font<br>Ví dụ Kemdoan Regular → Kemdoan</i>';

  const sugg = suggestFonts(searchInput.value);
  if (!sugg.length) return;

  const box = document.createElement('div');
  box.className = 'did-you-mean';
  box.append('Có phải bạn muốn tìm font ');
  sugg.forEach((name) => {
    const chip = document.createElement('button');
    chip.type = 'button';
    chip.className = 'dym-chip';
    chip.dataset.name = name;
    chip.textContent = name;
    box.appendChild(chip);
  });
  statusEl.appendChild(box);
}

function render(list) {
  resultsEl.innerHTML = '';

  if (list.length === 0) {
    showNotFound();
    return;
  }

  statusEl.textContent = '';
  const frag = document.createDocumentFragment();
  list.forEach((font) => {
    const card = fontCardTpl.content.firstElementChild.cloneNode(true);
    card.querySelector('.font-name').textContent = font.name;
    card.querySelector('.download-btn').dataset.file = font.file;
    bindPreview(card, font);
    frag.appendChild(card);
  });
  resultsEl.appendChild(frag);
}

function runSearch() {
  const q = foldText(searchInput.value);
  if (!q) {
    resultsEl.innerHTML = '';
    statusEl.textContent = '';
    return;
  }
  render(allFonts.filter((f) => f._key.includes(q)).slice(0, MAX_RESULTS));
}

// ---- Danh sách bộ font (hiện khi chưa tìm kiếm) ----
function buildFamilies() {
  const counts = new Map();
  allFonts.forEach((f) => {
    const k = familyKey(f);
    counts.set(k, (counts.get(k) || 0) + 1);
  });

  familiesEl.innerHTML = '';
  [...counts].sort(([a], [b]) => a.localeCompare(b)).forEach(([name, count]) => {
    const card = familyCardTpl.content.firstElementChild.cloneNode(true);
    card.querySelector('.family-name').textContent = name;
    card.querySelector('.family-count').textContent = count + ' Font';
    card.querySelector('.family-download').dataset.folder = name;
    familiesEl.appendChild(card);
  });
  updateFamilies();
}

// ---- Card demo: font nào có ảnh trùng tên trong imgdemo/ (manifest có trường img) ----
function buildDemos() {
  demosEl.innerHTML = '';
  allFonts.filter((f) => f.img).forEach((f) => {
    const card = demoCardTpl.content.firstElementChild.cloneNode(true);
    const img = card.querySelector('.demo-img');
    img.alt = f.name;
    img.addEventListener('error', () => { card.remove(); updateFamilies(); });
    img.src = encodeURI(f.img);
    card.querySelector('.demo-name').textContent = f.name;
    card.querySelector('.demo-download').dataset.file = f.file;
    demoOpeners.set(card, bindDemoPanel(card, f));
    demosEl.appendChild(card);
  });
  updateFamilies();
}

// ---- Panel preview của card demo: gõ trực tiếp vào chữ preview, canh lề phải/trái/giữa ----
const demoOpeners = new WeakMap(); // card -> hàm mở panel (nạp font + hiển thị)
const EDITABLE_MODE = (() => {
  const el = document.createElement('div');
  el.contentEditable = 'plaintext-only';
  return el.contentEditable === 'plaintext-only' ? 'plaintext-only' : 'true';
})();

function bindDemoPanel(card, font) {
  const panel = card.querySelector('.demo-panel');
  const wrap = panel.querySelector('.demo-text-wrap');
  const textEl = panel.querySelector('.demo-preview-text');
  const clearBtn = panel.querySelector('.demo-clear-btn');
  const loadingEl = panel.querySelector('.preview-loading');
  const slider = panel.querySelector('.preview-size-slider');
  const sizeValue = panel.querySelector('.preview-size-value');
  const alignBtns = panel.querySelectorAll('.demo-align-btn');

  let align = 'center'; // mặc định canh giữa
  let savedText = DEFAULT_PREVIEW_TEXT;
  let locked = false;

  const applySize = () => {
    const v = Number(slider.value);
    textEl.style.fontSize = v + 'px';
    sizeValue.textContent = v + 'px';
    slider.style.setProperty('--pct', (v - 1) / 99);
  };
  const applyAlign = () => {
    textEl.style.textAlign = align;
    alignBtns.forEach((b) => b.classList.toggle('active', b.dataset.align === align));
  };

  slider.value = DEFAULT_PREVIEW_SIZE;
  applySize();
  applyAlign();
  slider.addEventListener('input', applySize);
  alignBtns.forEach((b) => b.addEventListener('click', () => { align = b.dataset.align; applyAlign(); }));

  textEl.addEventListener('input', () => {
    if (!textEl.textContent) textEl.replaceChildren(); // để placeholder hiện lại
    savedText = textEl.textContent;
  });
  // Dán chỉ lấy chữ thuần (không mang định dạng)
  textEl.addEventListener('paste', (e) => {
    e.preventDefault();
    const text = (e.clipboardData || window.clipboardData).getData('text');
    document.execCommand('insertText', false, text);
  });

  // Xóa nhanh: chữ bị "hút" vào thùng rác (dùng chung hiệu ứng với ô preview ở search)
  clearBtn.addEventListener('click', async () => {
    spinIcon(clearBtn);
    if (locked || sucking.has(wrap)) return;
    const hadText = textEl.textContent.length > 0;
    savedText = '';
    if (hadText) {
      textEl.setAttribute('contenteditable', 'false');
      await suckTextIntoTrash(wrap, textEl);
    }
    textEl.textContent = '';
    textEl.setAttribute('contenteditable', EDITABLE_MODE);
  });

  const showFont = (family) => {
    locked = false;
    loadingEl.hidden = true;
    clearBtn.hidden = false;
    textEl.style.fontFamily = `"${family}", sans-serif`;
    textEl.textContent = savedText;
    textEl.setAttribute('contenteditable', EDITABLE_MODE);
  };
  const showLocked = () => {
    locked = true;
    loadingEl.hidden = true;
    clearBtn.hidden = true;
    textEl.style.fontFamily = '';
    textEl.textContent = NEED_LOGIN_TEXT;
    textEl.setAttribute('contenteditable', 'false');
  };

  return async () => {
    if (!isLoggedIn()) { showLocked(); return; }
    if (loadedPreviewFonts.has(font.file)) { showFont(loadedPreviewFonts.get(font.file)); return; }

    loadingEl.hidden = false;
    clearBtn.hidden = true;
    textEl.setAttribute('contenteditable', 'false');
    textEl.textContent = '';
    try {
      showFont(await ensurePreviewFont(font));
    } catch (e) {
      showLocked();
    }
  };
}

function toggleDemo(card) {
  const wasOpen = card.classList.contains('open');
  demosEl.querySelectorAll('.demo-card.open').forEach((c) => c.classList.remove('open'));
  if (wasOpen) return;
  card.classList.add('open');
  demoOpeners.get(card)();
}

function updateFamilies() {
  const hide = document.activeElement === searchInput || searchInput.value.trim() !== '';
  familiesEl.hidden = hide || !familiesEl.children.length;
  demosEl.hidden = hide || !demosEl.children.length;
}

// Tải 1 font (cần token); chưa đăng nhập -> hiện panel thông báo
function downloadFont(file) {
  if (!isLoggedIn()) { openNotice(); return; }
  const a = document.createElement('a');
  a.href = downloadUrl(file);
  a.download = '';
  document.body.appendChild(a);
  a.click();
  a.remove();
}

// Tải cả bộ font thành 1 file zip
async function downloadFamily(btn) {
  if (!isLoggedIn()) { openNotice(); return; }

  const folder = btn.dataset.folder;
  const files = allFonts.filter((f) => familyKey(f) === folder);
  const icon = btn.querySelector('i');

  btn.dataset.busy = '1';
  icon.className = 'dl-count';
  icon.textContent = '0';

  try {
    const JSZip = await loadJSZip();
    const zip = new JSZip();
    let ok = 0, i = 0;

    const worker = async () => {
      while (i < files.length) {
        const f = files[i++];
        try {
          const res = await fetch(downloadUrl(f.file));
          if (!res.ok) continue;
          zip.file(f.file.split('/').pop(), await res.blob());
          icon.textContent = ++ok;
        } catch (_) {}
      }
    };
    await Promise.all(Array.from({ length: 6 }, worker));

    if (ok === 0) {
      alert('Tải không thành công');
    } else {
      saveBlob(await zip.generateAsync({ type: 'blob', compression: 'STORE' }), folder + '.zip');
    }
  } catch (_) {
    alert('Tải không thành công');
  } finally {
    icon.textContent = '';
    icon.className = 'ri-download-cloud-2-line';
    delete btn.dataset.busy;
  }
}

// ---- Sự kiện ----
function initFonts() {
  searchInput.addEventListener('input', () => { runSearch(); updateFamilies(); });
  searchInput.addEventListener('focus', updateFamilies);
  searchInput.addEventListener('blur', () => setTimeout(updateFamilies, 0));

  clearBtn.addEventListener('click', () => {
    spinIcon(clearBtn);
    searchInput.value = '';
    runSearch();
    updateFamilies();
  });

  statusEl.addEventListener('click', (e) => {
    const chip = e.target.closest('.dym-chip');
    if (!chip) return;
    searchInput.value = chip.dataset.name;
    runSearch();
    updateFamilies();
  });

  // Tải 1 font: chưa đăng nhập -> hiện panel thông báo
  resultsEl.addEventListener('click', (e) => {
    const btn = e.target.closest('.download-btn');
    if (!btn) return;
    e.preventDefault();
    downloadFont(btn.dataset.file);
  });

  demosEl.addEventListener('click', (e) => {
    const btn = e.target.closest('.demo-download');
    if (btn) { downloadFont(btn.dataset.file); return; }
    if (e.target.closest('.demo-panel')) return; // bấm trong panel: không đóng
    const card = e.target.closest('.demo-card');
    if (card) toggleDemo(card);
  });

  familiesEl.addEventListener('click', (e) => {
    const btn = e.target.closest('.family-download');
    if (!btn) return;
    e.preventDefault();
    if (!btn.dataset.busy) downloadFamily(btn);
  });
}

// ================= Khởi động =================
initTheme();
initFonts();
initAuth(); // xác thực xong sẽ tự gọi loadFonts()

})();
