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

// Font free nằm công khai trong thư mục freefonts/ của site (không cần token)
const freeUrl = (file) => 'freefonts/' + String(file).split('/').map(encodeURIComponent).join('/');
const fontSrc = (f) => (f.free ? freeUrl(f.file) : downloadUrl(f.file));
const fontKey = (f) => (f.free ? 'free:' : '') + f.file; // khóa riêng để font free không trùng font trả phí

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
const authLabel = $('auth-label'); // chữ cạnh icon (chỉ hiện ở desktop)
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
  cancelFreeWait(); // đăng nhập/đăng xuất thì bỏ đếm ngược font free
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
  authBtn.title = on ? 'Đăng xuất' : 'Đăng nhập';
  authLabel.textContent = on ? 'Đăng xuất' : 'Đăng nhập';
}

// ---- Chuyển màn hình ----
function showApp() {
  brand.classList.add('search-brand');
  brand.hidden = false;
  contentEl.hidden = false;
  loadFonts();
}

// Click vừa mở panel thì không được đóng panel ngay (xem handler 'bấm bất cứ đâu' ở initMenu)
let panelJustOpened = false;
function markPanelOpened() {
  panelJustOpened = true;
  setTimeout(() => { panelJustOpened = false; }, 0);
}

function openLogin() {
  markPanelOpened();
  closeNotice();
  closeMenu();
  closeFinder();
  loginPanel.hidden = false;
  renderGoogleBtn();
}

function closeLogin() {
  loginPanel.hidden = true;
  loginPassword.value = '';
  loginError.textContent = '';
  if (changePassMode) exitChangePassMode();
}

const noticeMsg = noticePanel.querySelector('.notice-msg');
const NOTICE_DEFAULT_MSG = noticeMsg.textContent;

function openNotice(msg) {
  markPanelOpened();
  closeLogin();
  closeMenu();
  closeFinder();
  noticeMsg.textContent = msg || NOTICE_DEFAULT_MSG;
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
  loginErrorTimer = setTimeout(() => { loginError.textContent = ''; }, 3000);
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

// ---- Đăng nhập bằng Google ----
const GOOGLE_CLIENT_ID = '704991012160-k1f0s7qojcojdeoshnrf6pdhpurse2a1.apps.googleusercontent.com';
const googleBtnEl = $('google-btn');
const googleOrEl = $('google-or');
let googleReady = false;

async function onGoogleCredential(resp) {
  if (!resp || !resp.credential) return;
  loginError.textContent = '';
  try {
    const data = await postJson('/api/google-login', { credential: resp.credential });
    if (data.ok) {
      setToken(data.token);
      loginEmail.value = '';
      resetLoginIcon();
      updateAuthUI();
      resetPreviews(false);
      closeLogin();
    } else if (data.error === 'not_registered') {
      showLoginError('Email chưa được đăng ký');
    } else {
      showLoginError('Đăng nhập Google thất bại');
    }
  } catch (e) {
    showLoginError('Lỗi kết nối, hãy thử lại sau');
  }
}

function initGoogle() {
  if (googleReady || !(window.google && google.accounts && google.accounts.id)) return;
  google.accounts.id.initialize({
    client_id: GOOGLE_CLIENT_ID,
    callback: onGoogleCredential,
    ux_mode: 'popup',
    auto_select: false
  });
  googleReady = true;
}

let googleRenderedWidth = 0;
function renderGoogleBtn() {
  initGoogle();
  const hide = !googleReady;
  googleBtnEl.hidden = hide;
  googleOrEl.hidden = hide;
  if (hide) return;
  const w = Math.min(400, Math.max(200, Math.round(googleBtnEl.parentElement.clientWidth - 60) || 240));
  if (w === googleRenderedWidth) return;
  googleRenderedWidth = w;
  googleBtnEl.innerHTML = '';
  google.accounts.id.renderButton(googleBtnEl, {
    type: 'standard', theme: 'outline', size: 'large',
    text: 'signin_with', shape: 'pill', logo_alignment: 'left', width: w
  });
}

// Thư viện Google tải async: khi xong thì khởi tạo (nếu panel đang mở thì vẽ nút luôn)
window.onGoogleLibraryLoad = () => { initGoogle(); if (!loginPanel.hidden) renderGoogleBtn(); };

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

  initGoogle();
  verifyAndBoot();
}

// ================= Xem trước font =================
const DEFAULT_PREVIEW_TEXT = 'Phông tiếng Việt';
const DEFAULT_PREVIEW_SIZE = 40;
const NEED_LOGIN_TEXT = 'Vui lòng đăng nhập để xem';
const NEED_LOGIN_SIZE = 22; // size riêng cho chữ "dành cho tk vip"

const loadedPreviewFonts = new Map(); // fontKey -> tên font-family đã đăng ký
const sucking = new WeakSet();        // khung chữ đang chạy hiệu ứng xóa
let fontSeq = 0;

// Tải font (cần token) và đăng ký vào document.fonts; trả về tên font-family. Có cache.
async function ensurePreviewFont(font) {
  if (loadedPreviewFonts.has(fontKey(font))) return loadedPreviewFonts.get(fontKey(font));

  const res = await fetch(fontSrc(font));
  if (!res.ok) throw new Error('fetch failed');

  const objectUrl = URL.createObjectURL(await res.blob());
  const familyName = 'kd-preview-' + fontSeq++;

  const fontFace = new FontFace(familyName, `url(${objectUrl})`);
  await fontFace.load();
  document.fonts.add(fontFace);

  loadedPreviewFonts.set(fontKey(font), familyName);
  return familyName;
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

// ================= Danh sách bộ font, card demo, tìm kiếm, tải bộ font =================
const searchInput = $('search');
const searchWrap = searchInput.closest('.search-wrap');
const clearBtn = $('clear-btn');
const statusEl = $('status');
const demosEl = $('demos');
const demoCardTpl = $('demo-card-tpl');
const demosMoreBtn = $('demos-more');
const demoVariantTpl = $('demo-variant-tpl');

let allFonts = [];
let activeFilter = 'all'; // bộ lọc đang chọn ở menu: all | free | wed | hand

// Tag của font trong manifest: chấp nhận "wed", "wed,hand", "wed hand" hoặc ["wed","hand"] (trường tag hoặc tags)
const tagsOf = (f) => {
  const t = f.tags ?? f.tag ?? [];
  return (Array.isArray(t) ? t : String(t).split(/[\s,]+/)).map((s) => String(s).toLowerCase()).filter(Boolean);
};
const hasTag = (g, tag) => g.fonts.some((f) => tagsOf(f).includes(tag));

const FILTERS = {
  all: () => true,
  free: (g) => g.free,
  wed: (g) => hasTag(g, 'wed'),
  hand: (g) => hasTag(g, 'hand')
};
const filteredGroups = () => demoAll.filter(FILTERS[activeFilter] || FILTERS.all);

const familyKey = (f) => String(f.file).split('/')[0];
// Thư mục "chứa" font: font free và font trả phí không bao giờ gom chung 1 card
const groupDir = (f) => (f.free ? '@free/' + String(f.file).split('/').slice(0, -1).join('/') : familyKey(f));

// ---- Tải danh sách font ----
async function loadFonts() {
  if (allFonts.length) { updateView(); return; } // đã tải rồi (đăng nhập lại)
  try {
    const res = await fetch('manifest.json');
    allFonts = await res.json();
    allFonts.forEach((f) => { f._key = foldText(f.name); });
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
  const pool = demoAll; // gợi ý trên toàn bộ font, không phụ thuộc mục đang chọn
  if (q.length < 3 || !pool.length) return [];
  const maxDist = Math.max(1, Math.round(q.length / 3));
  const seen = new Set();
  const scored = [];
  pool.flatMap((g) => g.fonts).forEach((f) => {
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
    '<b>KHÔNG TÌM THẤY FONT</b>';

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

// Tìm kiếm: lọc card demo theo tên bộ / tên từng font trong bộ
function runSearch() {
  const q = foldText(searchInput.value);
  searchWrap.classList.toggle('has-value', !!searchInput.value); // desktop nửa màn hình: chấm báo đang có chữ tìm
  // Có từ khóa: tìm trên TẤT CẢ font, bất kể đang ở mục nào. Ô tìm kiếm trống: hiện theo mục đang chọn.
  demoList = q ? demoAll.filter((g) => g.keys.some((k) => k.includes(q))) : filteredGroups();

  // Kết quả không đổi (vd gõ thêm chữ mà vẫn ra đúng các card cũ) thì giữ nguyên, khỏi dựng lại
  const same = demoRendered && demoRendered.length === demoList.length && demoRendered.every((g, i) => g === demoList[i]);
  if (!same) renderDemos();

  statusEl.textContent = '';
  if (!demoList.length) {
    if (q) showNotFound();
    else if (activeFilter !== 'all') statusEl.innerHTML = '<b>CHƯA CÓ FONT TRONG MỤC NÀY</b>';
  }
  updateView();
}

// ---- Card demo: font nào có ảnh trùng tên trong imgdemo/ (manifest có trường img) ----
// Các font cùng 1 bộ (cùng ảnh, ví dụ Regular + Bold) gom chung 1 card, mỗi font 1 dòng preview.
const DEMO_PAGE_SIZE = 24; // mỗi lần hiện 24 card, bấm "Xem tiếp font" để hiện thêm
let demoAll = [];          // toàn bộ card demo: [{ title, fonts: [font...] }]
let demoList = [];         // danh sách đang hiển thị (toàn bộ, hoặc kết quả tìm kiếm)
let demoRendered = null;   // danh sách đã dựng ra màn hình
let demoShown = 0;         // số card đã đưa ra màn hình
const demoGroups = new WeakMap(); // card -> group

// Thứ tự hiện trong card: Thin, Thin Italic, ExtraLight, ..., Regular, Italic, Medium, ..., Black, Black Italic
const WEIGHT_ORDER = [
  ['hairline', 'thin'],
  ['extralight', 'ultralight'],
  ['light'],
  ['', 'regular', 'normal', 'book'],
  ['medium'],
  ['semibold', 'demibold'],
  ['bold'],
  ['extrabold', 'ultrabold'],
  ['black', 'heavy']
];

function styleRank(style) {
  const s = String(style || '').toLowerCase().replace(/[\s_-]+/g, '');
  const italic = /italic|oblique/.test(s);
  const weight = s.replace(/italic|oblique/g, '');
  const i = WEIGHT_ORDER.findIndex((names) => names.includes(weight));
  return (i < 0 ? 99 : i) * 2 + (italic ? 1 : 0); // chưa nhận ra kiểu chữ -> xuống cuối, giữ thứ tự cũ
}

// Giá hiển thị trên nhãn: manifest ghi "price": 50000 -> "50.000đ"; ghi chuỗi ("50K", "Liên hệ") -> hiện nguyên chuỗi
const priceLabel = (p) => {
  if (p === undefined || p === null || p === '') return '';
  return typeof p === 'number' ? p.toLocaleString('vi-VN') + 'đ' : String(p).trim();
};

function buildDemoGroups() {
  const map = new Map();
  allFonts.filter((f) => f.img).forEach((f) => {
    const key = f.img + '|' + groupDir(f);
    if (!map.has(key)) map.set(key, { key, free: !!f.free, fonts: [] });
    map.get(key).fonts.push(f);
  });

  return [...map.values()].map((g) => {
    g.fonts.sort((a, b) => styleRank(a.style) - styleRank(b.style)); // xếp theo độ đậm: Thin ... Black
    g.price = g.free ? '' : priceLabel(g.fonts.map((f) => f.price).find((p) => priceLabel(p))); // 1 card = 1 giá (lấy của font đầu tiên có ghi giá)
    g.title = g.fonts.length > 1 ? (g.fonts[0].group || g.fonts[0].name) : g.fonts[0].name;
    g.keys = [foldText(g.title), ...g.fonts.map((f) => f._key)]; // chuỗi dùng để tìm kiếm
    return g;
  });
}

function createDemoCard(g) {
  const card = demoCardTpl.content.firstElementChild.cloneNode(true);
  const img = card.querySelector('.demo-img');
  img.alt = g.title;
  img.addEventListener('error', () => { card.remove(); updateView(); });
  img.src = encodeURI(g.fonts[0].img);
  if (g.free) {
    const badge = document.createElement('span');
    badge.className = 'demo-free-badge'; // nhãn đè lên góc trái ảnh, CSS riêng (.demo-free-badge)
    badge.textContent = 'Free';
    img.after(badge);
  }
  const nameEl = card.querySelector('.demo-name');
  nameEl.textContent = g.title;
  if (g.price) {
    const price = document.createElement('span');
    price.className = 'demo-price-badge'; // nhãn giá nằm ngay sau tên font, CSS riêng (.demo-price-badge)
    price.textContent = g.price;
    nameEl.after(price);
  }
  demoGroups.set(card, g);
  demoOpeners.set(card, bindDemoPanel(card, g));
  return card;
}

function showMoreDemos() {
  const next = demoList.slice(demoShown, demoShown + DEMO_PAGE_SIZE);
  next.forEach((g) => demosEl.appendChild(createDemoCard(g)));
  demoShown += next.length;
  paintFreeWait(); // card vừa dựng ra có thể đang đếm ngược font free
  updateView();
}

function renderDemos() {
  demosEl.innerHTML = '';
  demoRendered = demoList;
  demoShown = 0;
  showMoreDemos();
}

function buildDemos() {
  demoAll = buildDemoGroups();
  demoRendered = null;
  runSearch(); // dựng card theo ô tìm kiếm hiện tại (rỗng = tất cả)
}

// ---- Panel preview của card demo: gõ trực tiếp vào chữ preview, canh lề phải/trái/giữa ----
const demoOpeners = new WeakMap(); // card -> hàm mở panel (nạp font + hiển thị)
const EDITABLE_MODE = (() => {
  const el = document.createElement('div');
  el.contentEditable = 'plaintext-only';
  return el.contentEditable === 'plaintext-only' ? 'plaintext-only' : 'true';
})();

function bindDemoPanel(card, group) {
  const panel = card.querySelector('.demo-panel');
  const variantsEl = panel.querySelector('.demo-variants');
  const clearBtn = panel.querySelector('.demo-clear-btn');
  const loadingEl = panel.querySelector('.preview-loading');
  const slider = panel.querySelector('.preview-size-slider');
  const sizeValue = panel.querySelector('.preview-size-value');
  const alignBtns = panel.querySelectorAll('.demo-align-btn');
  const multi = group.fonts.length > 1;

  let align = 'center'; // mặc định canh giữa
  let savedText = DEFAULT_PREVIEW_TEXT;

  // Mỗi font của bộ = 1 dòng preview (bộ nhiều font thì có nhãn Regular/Bold...)
  const variants = group.fonts.map((font) => {
    const el = demoVariantTpl.content.firstElementChild.cloneNode(true);
    const label = el.querySelector('.demo-variant-label');
    if (multi) label.textContent = font.style || 'Regular'; else label.remove();
    variantsEl.appendChild(el);
    return {
      font,
      locked: false,
      wrap: el.querySelector('.demo-text-wrap'),
      textEl: el.querySelector('.demo-preview-text')
    };
  });

  const applySize = () => {
    const v = Number(slider.value);
    variants.forEach((x) => { x.textEl.style.fontSize = (x.locked ? NEED_LOGIN_SIZE : v) + 'px'; });
    sizeValue.textContent = v + 'px';
    slider.style.setProperty('--pct', (v - 1) / 99);
  };
  const applyAlign = () => {
    variants.forEach((x) => { x.textEl.style.textAlign = align; });
    alignBtns.forEach((b) => b.classList.toggle('active', b.dataset.align === align));
  };

  slider.value = DEFAULT_PREVIEW_SIZE;
  applySize();
  applyAlign();
  slider.addEventListener('input', applySize);
  alignBtns.forEach((b) => b.addEventListener('click', () => { align = b.dataset.align; applyAlign(); }));

  variants.forEach((v) => {
    // Gõ ở dòng nào thì các dòng còn lại đổi theo
    v.textEl.addEventListener('input', () => {
      if (!v.textEl.textContent) v.textEl.replaceChildren(); // để placeholder hiện lại
      savedText = v.textEl.textContent;
      variants.forEach((o) => { if (o !== v && !o.locked) o.textEl.textContent = savedText; });
    });
    // Dán chỉ lấy chữ thuần (không mang định dạng)
    v.textEl.addEventListener('paste', (e) => {
      e.preventDefault();
      const text = (e.clipboardData || window.clipboardData).getData('text');
      document.execCommand('insertText', false, text);
    });
  });

  // Xóa nhanh: chữ ở mọi dòng cùng bị "hút" vào thùng rác (dùng chung hiệu ứng với ô preview ở search)
  clearBtn.addEventListener('click', async () => {
    spinIcon(clearBtn);
    const active = variants.filter((v) => !v.locked);
    if (!active.length || active.some((v) => sucking.has(v.wrap))) return;
    const hadText = savedText.length > 0;
    savedText = '';
    if (hadText) {
      active.forEach((v) => v.textEl.setAttribute('contenteditable', 'false'));
      await Promise.all(active.map((v) => suckTextIntoTrash(v.wrap, v.textEl)));
    }
    active.forEach((v) => {
      v.textEl.textContent = '';
      v.textEl.setAttribute('contenteditable', EDITABLE_MODE);
    });
  });

  const showFont = (v, family) => {
    v.locked = false;
    v.textEl.style.fontSize = Number(slider.value) + 'px';
    v.textEl.style.fontFamily = `"${family}", sans-serif`;
    v.textEl.textContent = savedText;
    v.textEl.setAttribute('contenteditable', EDITABLE_MODE);
  };
  const showLocked = (v) => {
    v.locked = true;
    v.textEl.style.fontSize = NEED_LOGIN_SIZE + 'px';
    v.textEl.style.fontFamily = '';
    v.textEl.textContent = NEED_LOGIN_TEXT;
    v.textEl.setAttribute('contenteditable', 'false');
  };

  return async () => {
    const pending = [];
    variants.forEach((v) => {
      if (!isLoggedIn() && !v.font.free) showLocked(v); // font trả phí: phải đăng nhập mới xem
      else if (loadedPreviewFonts.has(fontKey(v.font))) showFont(v, loadedPreviewFonts.get(fontKey(v.font)));
      else pending.push(v);
    });

    if (pending.length) {
      loadingEl.hidden = false;
      clearBtn.hidden = true;
      pending.forEach((v) => {
        v.textEl.setAttribute('contenteditable', 'false');
        v.textEl.textContent = '';
      });
      await Promise.all(pending.map(async (v) => {
        try {
          showFont(v, await ensurePreviewFont(v.font));
        } catch (e) {
          showLocked(v);
        }
      }));
    }

    loadingEl.hidden = true;
    clearBtn.hidden = variants.every((v) => v.locked);
  };
}

function toggleDemo(card) {
  const wasOpen = card.classList.contains('open');
  demosEl.querySelectorAll('.demo-card.open').forEach((c) => c.classList.remove('open'));
  if (wasOpen) return;
  card.classList.add('open');
  demoOpeners.get(card)();
}

// Card demo luôn hiện (đã được lọc theo ô tìm kiếm)
function updateView() {
  demosEl.hidden = !demosEl.children.length;
  demosMoreBtn.hidden = demosEl.hidden || demoShown >= demoList.length; // hết font thì ẩn nút
}

// Tải 1 font; font trả phí cần đăng nhập, chưa đăng nhập -> hiện panel thông báo
function downloadFont(font) {
  if (!font.free && !isLoggedIn()) { openNotice(); return; }
  const a = document.createElement('a');
  a.href = fontSrc(font);
  a.download = '';
  document.body.appendChild(a);
  a.click();
  a.remove();
}

// Tải nhiều font thành 1 file zip (dùng cho card demo nhiều font)
async function downloadZip(btn, files, zipName) {
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
          const res = await fetch(fontSrc(f));
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
      saveBlob(await zip.generateAsync({ type: 'blob', compression: 'STORE' }), zipName + '.zip');
    }
  } catch (_) {
    alert('Tải không thành công');
  } finally {
    icon.textContent = '';
    icon.className = 'ri-download-cloud-2-line';
    delete btn.dataset.busy;
  }
}

// ---- Tải font ở card demo ----
function startDownload(g, btn) {
  if (g.fonts.length === 1) { downloadFont(g.fonts[0]); return; } // 1 font: tải thẳng
  if (btn.dataset.busy) return;
  downloadZip(btn, g.fonts, g.title.replace(/[\\/:*?"<>|]+/g, '_')); // nhiều font: gói zip
}

function onDemoDownload(g, btn) {
  if (g.free) { onFreeDownload(g, btn); return; }
  if (!isLoggedIn()) { openNotice(); return; }
  startDownload(g, btn);
}

// ---- Font free: chưa đăng nhập phải chờ 60s mới tải được, và chỉ chờ được 1 font tại một thời điểm ----
// Chỉ đếm khi đang ở trang: chuyển tab / thu nhỏ / ra khỏi app thì tạm dừng. Tải lại trang (F5) thì hủy hẳn.
const FREE_WAIT_SEC = 60;
const FREE_WAIT_MSG = `Vui lòng chờ hết ${FREE_WAIT_SEC}s để tải font khác.\n\nHoặc đăng ký tài khoản để tải không giới hạn.`;

let freeWait = null;   // { left: ms còn lại, key: khóa card đang chờ, last: lần cập nhật cuối (0 = đang tạm dừng) }
let freeTimer = 0;

// Hiện / bỏ số giây đếm ngược (vd "45s") ngay trong icon download của card
function setCountdown(card, sec) {
  const btn = card.querySelector('.demo-download');
  if (btn.dataset.busy) return;
  const icon = btn.querySelector('i');
  if (sec === null) {
    if (!btn.dataset.counting) return;
    icon.className = 'ri-download-cloud-2-line';
    icon.textContent = '';
    delete btn.dataset.counting;
  } else {
    icon.className = 'dl-count';
    icon.textContent = sec + 's';
    btn.dataset.counting = '1';
  }
}

function paintFreeWait() {
  if (!freeWait) return;
  const sec = Math.max(0, Math.ceil(freeWait.left / 1000));
  demosEl.querySelectorAll('.demo-card').forEach((card) => {
    if (demoGroups.get(card).key === freeWait.key) setCountdown(card, sec);
  });
}

function stopFreeWait() {
  clearInterval(freeTimer);
  freeTimer = 0;
  const key = freeWait && freeWait.key;
  freeWait = null;
  demosEl.querySelectorAll('.demo-card').forEach((card) => {
    if (demoGroups.get(card).key === key) setCountdown(card, null);
  });
  return key;
}

function cancelFreeWait() {
  if (freeWait) stopFreeWait();
}

function tickFreeWait() {
  if (!freeWait) return;

  const now = Date.now();
  const visible = document.visibilityState === 'visible';
  if (freeWait.last) freeWait.left -= now - freeWait.last; // chỉ cộng thời gian đã trôi khi đang ở trang
  freeWait.last = visible ? now : 0;                        // ẩn trang: tạm dừng

  if (freeWait.left > 0 || !visible) { paintFreeWait(); return; }

  // Hết giờ (và đang ở trang): tải font
  const key = stopFreeWait();
  const g = demoAll.find((x) => x.key === key);
  if (!g) return;
  const card = [...demosEl.children].find((c) => demoGroups.get(c) === g);
  let btn = card && card.querySelector('.demo-download');
  if (!btn) { // card không còn trên màn hình (vd đang tìm kiếm font khác): dùng nút tạm để chạy tải zip
    btn = document.createElement('button');
    btn.innerHTML = '<i></i>';
  }
  startDownload(g, btn);
}

function onFreeDownload(g, btn) {
  if (isLoggedIn()) { startDownload(g, btn); return; } // đã đăng nhập: tải ngay, không phải chờ
  if (freeWait) { openNotice(FREE_WAIT_MSG); return; }  // đang chờ 1 font free rồi

  freeWait = { left: FREE_WAIT_SEC * 1000, key: g.key, last: Date.now() };
  clearInterval(freeTimer);
  freeTimer = setInterval(tickFreeWait, 250);
  paintFreeWait();
}

// ================= Menu (bottom-nav) & popup KD Font Finder =================
const menuBtn = $('menu-btn');
const menuIcon = menuBtn.querySelector('i');
const menuPanel = $('menu-panel');
const menuBackdrop = $('menu-backdrop');
const finderPanel = $('finder-panel');
const finderVideo = $('finder-video');

const isMenuOpen = () => menuPanel.classList.contains('open');

function openMenu() {
  closeLogin();
  closeNotice();
  closeFinder();
  menuPanel.classList.add('open');
  menuBackdrop.classList.add('open');
  menuBtn.setAttribute('aria-expanded', 'true');
  menuIcon.className = 'ri-close-line';
}

function closeMenu() {
  if (!isMenuOpen()) return;
  menuPanel.classList.remove('open');
  menuBackdrop.classList.remove('open');
  menuBtn.setAttribute('aria-expanded', 'false');
  menuIcon.className = 'ri-menu-2-line';
}

function openFinder() {
  markPanelOpened();
  closeMenu();
  closeLogin();
  closeNotice();
  finderPanel.hidden = false;
}

function closeFinder() {
  finderPanel.hidden = true;
  finderVideo.pause(); // đóng popup thì dừng video
}

// Chọn mục lọc: Tất cả / Free / Cưới / Viết tay
function setFilter(name) {
  if (!FILTERS[name]) return;
  activeFilter = name;
  document.querySelectorAll('[data-filter]').forEach((b) => {
    const on = b.dataset.filter === name;
    b.classList.toggle('active', on);
    if (on) b.setAttribute('aria-current', 'true'); else b.removeAttribute('aria-current');
  });
  searchInput.value = ''; // chọn mục thì xóa chữ đang tìm, để hiện đúng danh sách của mục
  if (allFonts.length) runSearch(); // chưa tải xong manifest thì buildDemos() sẽ tự lọc theo mục đang chọn
  window.scrollTo({ top: 0, behavior: prefersReducedMotion() ? 'auto' : 'smooth' });
}

// Desktop (>= 768px): ô tìm kiếm nằm trong sidebar; mobile: nằm đầu danh sách như cũ
const desktopMQ = window.matchMedia('(min-width: 768px)');
const dockSearch = $('dock-search');

function placeSearch() {
  if (desktopMQ.matches) {
    if (searchWrap.parentElement !== dockSearch) dockSearch.appendChild(searchWrap);
  } else if (searchWrap.parentElement !== contentEl) {
    contentEl.insertBefore(searchWrap, contentEl.firstChild);
  }
  closeMenu(); // đổi layout thì đóng menu popup của mobile
}

function initMenu() {
  placeSearch();
  desktopMQ.addEventListener('change', placeSearch);

  menuBtn.addEventListener('click', () => { if (isMenuOpen()) closeMenu(); else openMenu(); });

  // Menu popup (góc trên trái): Messenger, Facebook, Zalo, Đăng nhập, KD Font Finder, 10K font khác
  menuPanel.addEventListener('click', (e) => {
    const item = e.target.closest('.menu-item, .nav-btn');
    if (!item) return;
    if (item.dataset.action === 'finder') { openFinder(); return; }
    closeMenu();
  });

  // Thanh dưới (mobile): Trang chủ, Font free, Font cưới, Font viết tay
  $('bottom-nav').addEventListener('click', (e) => {
    const item = e.target.closest('[data-filter]');
    if (!item) return;
    setFilter(item.dataset.filter);
    closeMenu();
  });

  // Bấm ra ngoài menu thì đóng
  document.addEventListener('click', (e) => {
    if (isMenuOpen() && !e.target.closest('#menu-panel, #menu-btn')) closeMenu();
  });

  finderPanel.addEventListener('click', (e) => { if (e.target === finderPanel) closeFinder(); });

  // Panel đăng nhập / thông báo / KD Font Finder đang mở: bấm bất cứ vùng nào
  // ngoài thẻ (kể cả thanh dưới, nút menu, sidebar) đều đóng panel.
  // Bấm trong thẻ thì giữ nguyên để còn nhập liệu, xem video, bấm nút.
  document.addEventListener('click', (e) => {
    if (panelJustOpened) return;
    const path = e.composedPath();
    [[loginPanel, '.login-card', closeLogin],
     [noticePanel, '.notice-card', closeNotice],
     [finderPanel, '.notice-card', closeFinder]].forEach(([panel, cardSel, close]) => {
      if (panel.hidden) return;
      const card = panel.querySelector(cardSel);
      if (card && path.includes(card)) return;
      close();
    });
  });

  document.addEventListener('keydown', (e) => {
    if (e.key !== 'Escape') return;
    closeMenu();
    closeFinder();
  });
}

// ---- Sự kiện ----
function initFonts() {
  searchInput.addEventListener('input', runSearch);
  searchInput.addEventListener('focus', updateView);
  searchInput.addEventListener('blur', () => setTimeout(updateView, 0));

  clearBtn.addEventListener('click', () => {
    spinIcon(clearBtn);
    searchInput.value = '';
    runSearch();
  });

  statusEl.addEventListener('click', (e) => {
    const chip = e.target.closest('.dym-chip');
    if (!chip) return;
    searchInput.value = chip.dataset.name;
    runSearch();
  });

  document.addEventListener('visibilitychange', tickFreeWait); // ẩn/hiện trang: dừng/đếm tiếp ngay

  demosMoreBtn.addEventListener('click', showMoreDemos);

  demosEl.addEventListener('click', (e) => {
    const btn = e.target.closest('.demo-download');
    if (btn) { onDemoDownload(demoGroups.get(btn.closest('.demo-card')), btn); return; }
    if (e.target.closest('.demo-panel')) return; // bấm trong panel: không đóng
    const card = e.target.closest('.demo-card');
    if (card) toggleDemo(card);
  });
}

// ================= Khởi động =================
initFonts();
initMenu();
initAuth(); // xác thực xong sẽ tự gọi loadFonts()
})();
