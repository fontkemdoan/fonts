(() => {
'use strict';

const $ = (id) => document.getElementById(id);

const getToken = () => localStorage.getItem('kd_session_token') || '';
const setToken = (t) => localStorage.setItem('kd_session_token', t);
const clearToken = () => localStorage.removeItem('kd_session_token');

const downloadUrl = (file) =>
  '/api/download?file=' + encodeURIComponent(file) + '&token=' + encodeURIComponent(getToken());

const freeUrl = (file) => 'freefonts/' + String(file).split('/').map(encodeURIComponent).join('/');
const fontSrc = (f) => (f.free ? freeUrl(f.file) : downloadUrl(f.file));
const fontKey = (f) => (f.free ? 'free:' : '') + f.file;

async function postJson(url, body) {
  const res = await fetch(url, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(body)
  });
  return res.json();
}

function foldText(str) {
  return String(str).toLowerCase()
    .replace(/đ/g, 'd')
    .normalize('NFD').replace(/[\u0300-\u036f]/g, '')
    .replace(/[^a-z0-9]+/g, '');
}

const prefersReducedMotion = () =>
  window.matchMedia('(prefers-reduced-motion: reduce)').matches;

function spinIcon(btn) {
  const icon = btn.querySelector('i');
  if (!icon) return;
  icon.classList.remove('spin-360');
  void icon.offsetWidth;
  icon.classList.add('spin-360');
}

function clickDownloadLink(href, name = '') {
  const a = document.createElement('a');
  a.href = href;
  a.download = name;
  document.body.appendChild(a);
  a.click();
  a.remove();
}

function saveBlob(blob, name) {
  const url = URL.createObjectURL(blob);
  clickDownloadLink(url, name);
  setTimeout(() => URL.revokeObjectURL(url), 10000);
}

const DL_ICON = 'ri-download-cloud-2-line';

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
const authLabel = $('auth-label');
const registerBtn = $('register-btn');
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

const isLoggedIn = () => !!getToken();

function resetPreviews(clearCache) {
  cancelFreeWait();
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
  registerBtn.hidden = on;
  if (on) closeRegister();
}

function showApp() {
  brand.classList.add('search-brand');
  brand.hidden = false;
  contentEl.hidden = false;
  loadFonts();
}

function closeAllPanels(keep) {
  if (keep !== 'login') closeLogin();
  if (keep !== 'register') closeRegister();
  if (keep !== 'notice') closeNotice();
  if (keep !== 'finder') closeFinder();
  if (keep !== 'menu') closeMenu();
}

let panelJustOpened = false;
function markPanelOpened() {
  panelJustOpened = true;
  setTimeout(() => { panelJustOpened = false; }, 0);
}

function openLogin() {
  markPanelOpened();
  closeAllPanels('login');
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
  closeAllPanels('notice');
  noticeMsg.textContent = msg || NOTICE_DEFAULT_MSG;
  noticePanel.hidden = false;
}

function closeNotice() {
  noticePanel.hidden = true;
}

async function verifyAndBoot() {
  bootLoading.hidden = true;
  showApp();

  const token = getToken();
  if (!token) { updateAuthUI(); return; }

  try {
    const data = await postJson('/api/verify-session', { token });
    if (!data.ok) clearToken();
  } catch (e) {

  }
  updateAuthUI();
}

function showLoginError(msg) {
  loginError.textContent = msg;
  clearTimeout(loginErrorTimer);
  loginErrorTimer = setTimeout(() => { loginError.textContent = ''; }, 3000);
}

function onLoginSuccess(token) {
  setToken(token);
  loginEmail.value = '';
  resetLoginIcon();
  updateAuthUI();
  resetPreviews(false);
  closeLogin();
}

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
      onLoginSuccess(data.token);
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
      onLoginSuccess(data.token);
    } else if (data.error === 'not_registered') {
      showLoginError('Tài khoản chưa được đăng ký');
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

window.onGoogleLibraryLoad = () => { initGoogle(); if (!loginPanel.hidden) renderGoogleBtn(); };

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

  $('notice-login-btn').addEventListener('click', openLogin);
  $('notice-register-btn').addEventListener('click', openRegister);

  initGoogle();
  verifyAndBoot();
}

const DEFAULT_PREVIEW_TEXT = 'Phông tiếng Việt';
const DEFAULT_PREVIEW_SIZE = 40;
const NEED_LOGIN_TEXT = 'Vui lòng đăng nhập để xem';
const NEED_LOGIN_SIZE = 20;

const loadedPreviewFonts = new Map();
const sucking = new WeakSet();
let fontSeq = 0;

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

const searchInput = $('search');
const searchWrap = searchInput.closest('.search-wrap');
const clearBtn = $('clear-btn');
const statusEl = $('status');
const demosEl = $('demos');
const demoCardTpl = $('demo-card-tpl');
const demosMoreBtn = $('demos-more');
const demoVariantTpl = $('demo-variant-tpl');

let allFonts = [];
let activeFilter = 'all';

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

const groupDir = (f) => (f.free ? '@free/' + String(f.file).split('/').slice(0, -1).join('/') : familyKey(f));

async function loadFonts() {
  if (allFonts.length) { updateView(); return; }
  try {
    const res = await fetch('manifest.json');
    allFonts = await res.json();
    allFonts.forEach((f) => { f._key = foldText(f.name); });
    buildDemos();
  } catch (err) {
    statusEl.textContent = 'Lỗi server - ' + err;
  }
}

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
  const pool = demoAll;
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

function runSearch() {
  const q = foldText(searchInput.value);
  searchWrap.classList.toggle('has-value', !!searchInput.value);

  demoList = q ? demoAll.filter((g) => g.keys.some((k) => k.includes(q))) : filteredGroups();

  const same = demoRendered && demoRendered.length === demoList.length && demoRendered.every((g, i) => g === demoList[i]);
  if (!same) renderDemos();

  statusEl.textContent = '';
  if (!demoList.length) {
    if (q) showNotFound();
    else if (activeFilter !== 'all') statusEl.innerHTML = '<b>CHƯA CÓ FONT TRONG MỤC NÀY</b>';
  }
  updateView();
}

const DEMO_PAGE_SIZE = 24;
let demoAll = [];
let demoList = [];
let demoRendered = null;
let demoShown = 0;
const demoGroups = new WeakMap();

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
  return (i < 0 ? 99 : i) * 2 + (italic ? 1 : 0);
}

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
    g.fonts.sort((a, b) => styleRank(a.style) - styleRank(b.style));
    g.price = g.free ? '' : priceLabel(g.fonts.map((f) => f.price).find((p) => priceLabel(p)));
    g.title = g.fonts.length > 1 ? (g.fonts[0].group || g.fonts[0].name) : g.fonts[0].name;
    g.keys = [foldText(g.title), ...g.fonts.map((f) => f._key)];
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
    badge.className = 'demo-free-badge';
    badge.textContent = 'Free';
    img.after(badge);
  }
  const nameEl = card.querySelector('.demo-name');
  nameEl.textContent = g.title;
  if (g.price) {
    const price = document.createElement('span');
    price.className = 'demo-price-badge';
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
  paintFreeWait();
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
  runSearch();
}

const demoOpeners = new WeakMap();
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

  let align = 'center';
  let savedText = DEFAULT_PREVIEW_TEXT;

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

    v.textEl.addEventListener('input', () => {
      if (!v.textEl.textContent) v.textEl.replaceChildren();
      savedText = v.textEl.textContent;
      variants.forEach((o) => { if (o !== v && !o.locked) o.textEl.textContent = savedText; });
    });

    v.textEl.addEventListener('paste', (e) => {
      e.preventDefault();
      const text = (e.clipboardData || window.clipboardData).getData('text');
      document.execCommand('insertText', false, text);
    });
  });

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
      if (!isLoggedIn() && !v.font.free) showLocked(v);
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

function updateView() {
  demosEl.hidden = !demosEl.children.length;
  demosMoreBtn.hidden = demosEl.hidden || demoShown >= demoList.length;
}

function downloadFont(font) {
  if (!font.free && !isLoggedIn()) { openNotice(); return; }
  clickDownloadLink(fontSrc(font));
}

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
    icon.className = DL_ICON;
    delete btn.dataset.busy;
  }
}

function startDownload(g, btn) {
  if (g.fonts.length === 1) { downloadFont(g.fonts[0]); return; }
  if (btn.dataset.busy) return;
  downloadZip(btn, g.fonts, g.title.replace(/[\\/:*?"<>|]+/g, '_'));
}

function onDemoDownload(g, btn) {
  if (g.free) { onFreeDownload(g, btn); return; }
  if (!isLoggedIn()) { openNotice(); return; }
  startDownload(g, btn);
}

const FREE_WAIT_SEC = 60;
const FREE_WAIT_MSG = `Vui lòng chờ hết ${FREE_WAIT_SEC}s để tải font khác.\n\nHoặc đăng ký tài khoản để tải không giới hạn.`;

let freeWait = null;
let freeTimer = 0;

function setCountdown(card, sec) {
  const btn = card.querySelector('.demo-download');
  if (btn.dataset.busy) return;
  const icon = btn.querySelector('i');
  if (sec === null) {
    if (!btn.dataset.counting) return;
    icon.className = DL_ICON;
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
  if (freeWait.last) freeWait.left -= now - freeWait.last;
  freeWait.last = visible ? now : 0;

  if (freeWait.left > 0 || !visible) { paintFreeWait(); return; }

  const key = stopFreeWait();
  const g = demoAll.find((x) => x.key === key);
  if (!g) return;
  const card = [...demosEl.children].find((c) => demoGroups.get(c) === g);
  let btn = card && card.querySelector('.demo-download');
  if (!btn) {
    btn = document.createElement('button');
    btn.innerHTML = '<i></i>';
  }
  startDownload(g, btn);
}

function onFreeDownload(g, btn) {
  if (isLoggedIn()) { startDownload(g, btn); return; }
  if (freeWait) { openNotice(FREE_WAIT_MSG); return; }

  freeWait = { left: FREE_WAIT_SEC * 1000, key: g.key, last: Date.now() };
  clearInterval(freeTimer);
  freeTimer = setInterval(tickFreeWait, 250);
  paintFreeWait();
}

const registerPanel = $('register-panel');
const regEmail = $('reg-email');
const regContact = $('reg-contact');
const regPhoto = $('reg-photo');
const regPhotoName = $('reg-photo-name');
const regFileBox = regPhoto.closest('.reg-file');
const regSubmit = $('register-submit');
const regHint = $('register-hint');
const REG_LABEL = '<i class="ri-user-add-line"></i> Đăng ký';
const REG_BUSY_LABEL = SPINNER + ' Đang xử lý...';
const REG_PHOTO_TEXT = regPhotoName.textContent;
const REG_MAX_SIDE = 1600;
let regHintTimer = null;
let regBusy = false;

function showRegHint(msg, ms = 4000) {
  regHint.textContent = msg;
  clearTimeout(regHintTimer);
  regHintTimer = setTimeout(() => { regHint.textContent = ''; }, ms);
}

function openRegister() {
  markPanelOpened();
  closeAllPanels('register');
  registerPanel.hidden = false;
}

function closeRegister() {
  registerPanel.hidden = true;
  regHint.textContent = '';
}

function resetRegisterForm() {
  regEmail.value = '';
  regContact.value = '';
  regPhoto.value = '';
  regPhotoName.textContent = REG_PHOTO_TEXT;
  regFileBox.classList.remove('has-file');
}

async function shrinkImage(file) {
  try {
    const bmp = await createImageBitmap(file);
    const scale = Math.min(1, REG_MAX_SIDE / Math.max(bmp.width, bmp.height));
    if (scale === 1 && file.size < 1.5 * 1024 * 1024) return file;
    const canvas = document.createElement('canvas');
    canvas.width = Math.round(bmp.width * scale);
    canvas.height = Math.round(bmp.height * scale);
    canvas.getContext('2d').drawImage(bmp, 0, 0, canvas.width, canvas.height);
    const blob = await new Promise((r) => canvas.toBlob(r, 'image/jpeg', 0.85));
    return blob || file;
  } catch (_) {
    return file;
  }
}

async function doRegister() {
  if (regBusy) return;
  const email = regEmail.value.trim().toLowerCase();
  const contact = regContact.value.trim();
  const photo = regPhoto.files[0];

  if (!emailRegex.test(email)) { showRegHint('Vui lòng nhập Gmail hợp lệ'); return; }
  if (!photo) { showRegHint('Vui lòng tải lên ảnh chuyển khoản'); return; }
  if (!photo.type.startsWith('image/')) { showRegHint('File phải là hình ảnh'); return; }

  regBusy = true;
  regSubmit.disabled = true;
  regSubmit.innerHTML = REG_BUSY_LABEL;

  try {
    const img = await shrinkImage(photo);
    const fd = new FormData();
    fd.append('email', email);
    fd.append('contact', contact);
    fd.append('photo', img, 'chuyen-khoan.jpg');

    const res = await fetch('/api/register', { method: 'POST', body: fd });
    const data = await res.json().catch(() => ({}));
    if (data.ok) {
      resetRegisterForm();
      showRegHint('Đăng ký thành công. Vui lòng đăng nhập sau ít phút.', 5000);
    } else {
      showRegHint('Đăng ký thất bại, hãy thử lại sau');
    }
  } catch (e) {
    showRegHint('Lỗi kết nối, hãy thử lại sau');
  } finally {
    regBusy = false;
    regSubmit.disabled = false;
    regSubmit.innerHTML = REG_LABEL;
  }
}

regPhoto.addEventListener('change', () => {
  const f = regPhoto.files[0];
  regPhotoName.textContent = f ? f.name : REG_PHOTO_TEXT;
  regFileBox.classList.toggle('has-file', !!f);
});
regSubmit.addEventListener('click', doRegister);

const menuBtn = $('menu-btn');
const menuIcon = menuBtn.querySelector('i');
const menuPanel = $('menu-panel');
const menuBackdrop = $('menu-backdrop');
const finderPanel = $('finder-panel');
const finderVideo = $('finder-video');

const isMenuOpen = () => menuPanel.classList.contains('open');

function openMenu() {
  closeAllPanels('menu');
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
  closeAllPanels('finder');
  finderPanel.hidden = false;
}

function closeFinder() {
  finderPanel.hidden = true;
  finderVideo.pause();
}

function setFilter(name) {
  if (!FILTERS[name]) return;
  activeFilter = name;
  document.querySelectorAll('[data-filter]').forEach((b) => {
    const on = b.dataset.filter === name;
    b.classList.toggle('active', on);
    if (on) b.setAttribute('aria-current', 'true'); else b.removeAttribute('aria-current');
  });
  searchInput.value = '';
  if (allFonts.length) runSearch();
  window.scrollTo({ top: 0, behavior: prefersReducedMotion() ? 'auto' : 'smooth' });
}

const desktopMQ = window.matchMedia('(min-width: 768px)');
const dockSearch = $('dock-search');

function placeSearch() {
  if (desktopMQ.matches) {
    if (searchWrap.parentElement !== dockSearch) dockSearch.appendChild(searchWrap);
  } else if (searchWrap.parentElement !== contentEl) {
    contentEl.insertBefore(searchWrap, contentEl.firstChild);
  }
  closeMenu();
}

function initMenu() {
  placeSearch();
  desktopMQ.addEventListener('change', placeSearch);

  menuBtn.addEventListener('click', () => { if (isMenuOpen()) closeMenu(); else openMenu(); });

  menuPanel.addEventListener('click', (e) => {
    const item = e.target.closest('.menu-item, .nav-btn');
    if (!item) return;
    if (item.dataset.action === 'finder') { openFinder(); return; }
    if (item.dataset.action === 'register') { openRegister(); return; }
    closeMenu();
  });

  $('bottom-nav').addEventListener('click', (e) => {
    const item = e.target.closest('[data-filter]');
    if (!item) return;
    setFilter(item.dataset.filter);
    closeMenu();
  });

  document.addEventListener('click', (e) => {
    if (isMenuOpen() && !e.target.closest('#menu-panel, #menu-btn')) closeMenu();
    if (panelJustOpened) return;
    const path = e.composedPath();
    [[loginPanel, '.login-card', closeLogin],
     [noticePanel, '.notice-card', closeNotice],
     [finderPanel, '.notice-card', closeFinder],
     [registerPanel, '.register-card', closeRegister]].forEach(([panel, cardSel, close]) => {
      if (panel.hidden) return;
      const card = panel.querySelector(cardSel);
      if (card && path.includes(card)) return;
      close();
    });
  });

  document.addEventListener('keydown', (e) => {
    if (e.key === 'Escape') closeAllPanels();
  });
}

function initFonts() {
  searchInput.addEventListener('input', runSearch);

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

  document.addEventListener('visibilitychange', tickFreeWait);

  demosMoreBtn.addEventListener('click', showMoreDemos);

  demosEl.addEventListener('click', (e) => {
    const btn = e.target.closest('.demo-download');
    if (btn) { onDemoDownload(demoGroups.get(btn.closest('.demo-card')), btn); return; }
    if (e.target.closest('.demo-panel')) return;
    const card = e.target.closest('.demo-card');
    if (card) toggleDemo(card);
  });
}

const popupClose = $('popup-close');
const popups = [loginPanel, noticePanel, finderPanel, registerPanel];
const syncPopupClose = () => { popupClose.hidden = popups.every((p) => p.hidden); };
const popupObserver = new MutationObserver(syncPopupClose);
popups.forEach((p) => popupObserver.observe(p, { attributes: true, attributeFilter: ['hidden'] }));
popupClose.addEventListener('click', () => closeAllPanels());
syncPopupClose();

function initDockTips() {
  const dock = document.querySelector('.dock');
  if (!dock) return;
  const collapsedMq = window.matchMedia('(min-width: 768px) and (max-width: 1279.98px)');
  const tip = document.createElement('div');
  tip.className = 'dock-tip';
  tip.setAttribute('role', 'tooltip');
  document.body.appendChild(tip);

  const SEL = '.menu-item, .nav-btn';
  let current = null;

  const labelOf = (el) => {
    const s = el.querySelector('.nav-label, span:not(.nav-zalo-text)');
    return ((s && s.textContent) || el.getAttribute('aria-label') || el.dataset.tip || '').trim();
  };

  const hide = () => {
    tip.classList.remove('show');
    if (current && current.dataset.tipTitle !== undefined) {
      current.setAttribute('title', current.dataset.tipTitle);
      delete current.dataset.tipTitle;
    }
    current = null;
  };

  const show = (el) => {
    if (!collapsedMq.matches) return;
    const text = labelOf(el);
    if (!text) return;
    if (current && current !== el) hide();
    current = el;
    if (el.hasAttribute('title')) {
      el.dataset.tipTitle = el.getAttribute('title');
      el.removeAttribute('title');
    }
    tip.textContent = text;
    const r = el.getBoundingClientRect();
    tip.style.left = Math.round(r.right + 14) + 'px';
    tip.style.top = Math.round(r.top + r.height / 2 - tip.offsetHeight / 2) + 'px';
    tip.classList.add('show');
  };

  dock.addEventListener('mouseover', (e) => {
    const el = e.target.closest(SEL);
    if (el && dock.contains(el)) show(el);
  });
  dock.addEventListener('mouseout', (e) => {
    const el = e.target.closest(SEL);
    if (el && !el.contains(e.relatedTarget)) hide();
  });
  dock.addEventListener('focusin', (e) => {
    const el = e.target.closest(SEL);
    if (el && el.matches(':focus-visible')) show(el);
  });
  dock.addEventListener('focusout', hide);
  dock.addEventListener('click', hide);
  dock.addEventListener('scroll', hide, { passive: true });
  window.addEventListener('resize', hide);
}

initFonts();
initMenu();
initAuth();
initDockTips();
})();
