(() => {
'use strict';

const HOME_URL = '/';

const $ = (id) => document.getElementById(id);
const SPINNER = '<i class="ri-loader-4-line kd-spinner"></i>';

const getToken = () => localStorage.getItem('kd_session_token') || '';
const setToken = (t) => localStorage.setItem('kd_session_token', t);
const setProfile = (p) => { try { localStorage.setItem('kd_profile', JSON.stringify(p)); } catch (e) {} };

async function postJson(url, body) {
  const res = await fetch(url, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(body)
  });
  return res.json();
}

function initLoginPage() {
  const GOOGLE_CLIENT_ID = '704991012160-k1f0s7qojcojdeoshnrf6pdhpurse2a1.apps.googleusercontent.com';

  const loginEmail = $('login-email');
  const loginPassword = $('login-password');
  const newPasswordInput = $('new-password');
  const changePassExtra = $('change-pass-extra');
  const loginBtn = $('login-btn');
  const changePassBtn = $('change-pass-btn');
  const loginError = $('login-error');

  const LABEL = {
    login: '<i class="ri-arrow-right-line"></i> Đăng nhập',
    changePass: '<i class="ri-key-2-line"></i> Đổi Pass',
    confirm: '<i class="ri-check-line"></i> Xác nhận',
    back: '<i class="ri-arrow-left-line"></i> Quay lại'
  };

  let changePassMode = false;
  let loginErrorTimer = null;

  function showLoginError(msg) {
    loginError.innerHTML = '<i class="ri-error-warning-line"></i><span></span>';
    loginError.lastChild.textContent = msg;
    clearTimeout(loginErrorTimer);
    loginErrorTimer = setTimeout(() => { loginError.textContent = ''; }, 2500);
  }

  function showLoginLoading(msg) {
    clearTimeout(loginErrorTimer);
    loginError.innerHTML = SPINNER + ' ' + msg;
  }

  function onLoginSuccess(token, profile) {
    setToken(token);
    if (profile && profile.email) setProfile(profile);
    window.location.replace(HOME_URL);
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
    loginBtn.innerHTML = SPINNER + ' Đang đăng nhập...';

    try {
      const data = await postJson('/api/login', { email, password, mode: 'login' });
      if (data.ok) {
        onLoginSuccess(data.token, { email, avatar: data.avatar, name: data.name });
        return;
      }
      showLoginError(data.error === 'wrong_password' ? 'Sai mật khẩu' : 'Tài khoản không tồn tại');
    } catch (e) {
      showLoginError('Lỗi kết nối, hãy thử lại sau');
    }
    loginBtn.disabled = false;
    loginBtn.innerHTML = LABEL.login;
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
        showLoginError('Tài khoản không tồn tại.');
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

  const googleBtnEl = $('google-btn');
  const googleWrapEl = $('google-wrap');
  const googleOrEl = $('google-or');
  let googleReady = false;
  let googleRenderedWidth = 0;

  async function onGoogleCredential(resp) {
    if (!resp || !resp.credential) return;
    showLoginLoading('Đang đăng nhập...');
    try {
      const data = await postJson('/api/google-login', { credential: resp.credential });
      if (data.ok) {
        onLoginSuccess(data.token, { email: data.email, avatar: data.avatar, name: data.name, picture: data.picture });
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

  function renderGoogleBtn() {
    initGoogle();
    const hide = !googleReady;
    googleWrapEl.hidden = hide;
    googleOrEl.hidden = hide;
    if (hide) return;
    const cw = Math.round(googleWrapEl.clientWidth) || 240;
    const ch = googleWrapEl.clientHeight || 40;
    const w = Math.min(400, Math.max(200, cw));
    if (w !== googleRenderedWidth) {
      googleRenderedWidth = w;
      googleBtnEl.innerHTML = '';
      google.accounts.id.renderButton(googleBtnEl, {
        type: 'standard', theme: 'outline', size: 'large',
        text: 'signin_with', shape: 'pill', logo_alignment: 'left', width: w
      });
    }
    googleBtnEl.style.width = w + 'px';
    googleBtnEl.style.transform = 'scale(' + (cw / w) + ', ' + (ch / 40) + ')';
  }

  window.onGoogleLibraryLoad = renderGoogleBtn;
  googleWrapEl.hidden = true;
  googleOrEl.hidden = true;
  window.addEventListener('resize', () => { if (googleReady) renderGoogleBtn(); });

  loginBtn.addEventListener('click', () => { if (changePassMode) exitChangePassMode(); else doLogin(); });
  if (changePassBtn) changePassBtn.addEventListener('click', () => { if (changePassMode) doChangePassword(); else enterChangePassMode(); });

  [loginEmail, loginPassword].forEach((input) => {
    input.addEventListener('keydown', (e) => { if (e.key === 'Enter' && !changePassMode) doLogin(); });
  });

  if (window.google && google.accounts) renderGoogleBtn();
}

function initRegisterPage() {
  const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

  const regEmail = $('reg-email');
  const regContact = $('reg-contact');
  const regPhoto = $('reg-photo');
  const regPhotoName = $('reg-photo-name');
  const regFileBox = regPhoto.closest('.reg-file');
  const regAgree = $('reg-agree');
  const regSubmit = $('register-submit');
  const regHint = $('register-hint');
  const successPanel = $('success-panel');

  const REG_LABEL = '<i class="ri-user-add-line"></i> Đăng ký';
  const REG_BUSY_LABEL = SPINNER + ' Đang đăng ký...';
  const REG_PHOTO_TEXT = regPhotoName.textContent;
  const REG_MAX_SIDE = 1600;
  let regHintTimer = null;
  let regBusy = false;

  function showRegHint(msg, ms = 2500) {
    regHint.innerHTML = '<i class="ri-error-warning-line"></i><span></span>';
    regHint.lastChild.textContent = msg;
    clearTimeout(regHintTimer);
    regHintTimer = setTimeout(() => { regHint.textContent = ''; }, ms);
  }

  function resetRegisterForm() {
    regEmail.value = '';
    regContact.value = '';
    regPhoto.value = '';
    regPhotoName.textContent = REG_PHOTO_TEXT;
    regFileBox.classList.remove('has-file');
    regAgree.checked = false;
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

  const openSuccess = () => { successPanel.hidden = false; };
  const closeSuccess = () => { successPanel.hidden = true; };

  async function doRegister() {
    if (regBusy) return;
    const email = regEmail.value.trim().toLowerCase();
    const contact = regContact.value.trim();
    const photo = regPhoto.files[0];

    if (!emailRegex.test(email)) { showRegHint('Vui lòng nhập Gmail hợp lệ'); return; }
    if (!photo) { showRegHint('Vui lòng tải lên ảnh chuyển khoản'); return; }
    if (!photo.type.startsWith('image/')) { showRegHint('File phải là hình ảnh'); return; }
    if (!regAgree.checked) { showRegHint('Vui lòng đồng ý Điều khoản'); return; }

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
        openSuccess();
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
  [regEmail, regContact].forEach((el) => el.addEventListener('keydown', (e) => { if (e.key === 'Enter') doRegister(); }));

  $('success-close').addEventListener('click', closeSuccess);
  successPanel.addEventListener('click', (e) => { if (e.target === successPanel) closeSuccess(); });
  document.addEventListener('keydown', (e) => { if (e.key === 'Escape') closeSuccess(); });
}

const ORDER_MAX_TOTAL = 25 * 1024 * 1024;
const ORDER_FILE_RE = /\.(ttf|otf|ttc|woff2?|zip|rar|7z)$/i;
const ORDER_LABEL = '<i class="ri-send-plane-2-line"></i> Đặt hàng';
const ORDER_BUSY_LABEL = SPINNER + ' Đang đặt hàng...';

function initOrderPage() {
  const linkInput = $('order-link');
  const contactInput = $('order-contact');
  const noteInput = $('order-note');
  const uploadBtn = $('order-upload-btn');
  const fileInput = $('order-files');
  const fileList = $('order-file-list');
  const submitBtn = $('order-submit');
  const toast = $('order-toast');
  const successPanel = $('success-panel');

  const sel = $('order-time');
  const selBtn = $('order-time-btn');
  const selList = sel.querySelector('.kd-select-list');
  const selLabel = sel.querySelector('.kd-select-label');
  const selPrice = selBtn.querySelector('.kd-select-price');
  const opts = Array.from(selList.querySelectorAll('[role="option"]'));

  let files = [];
  let timeValue = 'normal';
  let busy = false;
  let toastTimer = null;

  function showHint(msg, ms = 2500) {
    toast.innerHTML = '<i class="ri-error-warning-line"></i><span></span>';
    toast.lastChild.textContent = msg;
    clearTimeout(toastTimer);
    toastTimer = setTimeout(() => { toast.textContent = ''; }, ms);
  }

  function renderFiles() {
    fileList.textContent = '';
    files.forEach((f, i) => {
      const li = document.createElement('li');
      const icon = document.createElement('i');
      icon.className = 'ri-file-3-line';
      const name = document.createElement('span');
      name.className = 'order-file-name';
      name.textContent = f.name;
      const rm = document.createElement('button');
      rm.type = 'button';
      rm.className = 'order-file-remove';
      rm.setAttribute('aria-label', 'Xóa file');
      rm.innerHTML = '<i class="ri-close-line"></i>';
      rm.addEventListener('click', () => { files.splice(i, 1); renderFiles(); });
      li.append(icon, name, rm);
      fileList.appendChild(li);
    });
  }

  function addFiles(list) {
    let rejected = false;
    Array.from(list).forEach((f) => {
      if (!ORDER_FILE_RE.test(f.name)) { rejected = true; return; }
      const dup = files.some((x) => x.name === f.name && x.size === f.size && x.lastModified === f.lastModified);
      if (!dup) files.push(f);
    });
    if (rejected) showHint('Chỉ nhận file font (ttf, otf, woff...) hoặc file nén');
    renderFiles();
  }

  function openSel() {
    selList.hidden = false;
    sel.classList.add('open');
    selBtn.setAttribute('aria-expanded', 'true');
    const cur = opts.find((o) => o.dataset.value === timeValue) || opts[0];
    cur.focus();
  }

  function closeSel(focusBtn) {
    selList.hidden = true;
    sel.classList.remove('open');
    selBtn.setAttribute('aria-expanded', 'false');
    if (focusBtn) selBtn.focus();
  }

  function chooseOpt(o) {
    timeValue = o.dataset.value;
    opts.forEach((x) => x.setAttribute('aria-selected', String(x === o)));
    selLabel.textContent = o.children[0].textContent;
    selPrice.textContent = o.children[1].textContent;
    closeSel(true);
  }

  selBtn.addEventListener('click', () => { if (selList.hidden) openSel(); else closeSel(); });
  selBtn.addEventListener('keydown', (e) => {
    if (e.key === 'ArrowDown' || e.key === 'ArrowUp') { e.preventDefault(); if (selList.hidden) openSel(); }
  });
  opts.forEach((o) => {
    o.addEventListener('click', () => chooseOpt(o));
    o.addEventListener('keydown', (e) => {
      const i = opts.indexOf(o);
      if (e.key === 'ArrowDown') { e.preventDefault(); opts[(i + 1) % opts.length].focus(); }
      else if (e.key === 'ArrowUp') { e.preventDefault(); opts[(i - 1 + opts.length) % opts.length].focus(); }
      else if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); chooseOpt(o); }
      else if (e.key === 'Escape') { e.stopPropagation(); closeSel(true); }
      else if (e.key === 'Tab') { closeSel(false); }
    });
  });
  document.addEventListener('click', (e) => { if (!sel.contains(e.target)) closeSel(false); });

  function resetOrderForm() {
    linkInput.value = '';
    contactInput.value = '';
    noteInput.value = '';
    noteInput.style.height = '';
    files = [];
    renderFiles();
    chooseOpt(opts[0]);
    closeSel(false);
  }

  const openSuccess = () => { successPanel.hidden = false; };
  const closeSuccess = () => { successPanel.hidden = true; };

  async function doOrder() {
    if (busy) return;
    const link = linkInput.value.trim();
    const contact = contactInput.value.trim();
    const note = noteInput.value.trim();

    if (!link && !files.length) { showHint('Vui lòng nhập link hoặc tải lên file'); return; }
    if (link && !link.split(/[\s,]+/).every((u) => /^https?:\/\/\S+\.\S+/i.test(u))) {
      showHint('Link font không hợp lệ');
      return;
    }
    if (!contact) { showHint('Vui lòng nhập thông tin liên hệ'); return; }
    const total = files.reduce((n, f) => n + f.size, 0);
    if (total > ORDER_MAX_TOTAL) { showHint('Tổng dung lượng file tối đa ' + Math.round(ORDER_MAX_TOTAL / 1048576) + 'MB'); return; }

    busy = true;
    submitBtn.disabled = true;
    submitBtn.innerHTML = ORDER_BUSY_LABEL;

    try {
      const fd = new FormData();
      fd.append('link', link);
      fd.append('time', timeValue);
      fd.append('contact', contact);
      fd.append('note', note);
      files.forEach((f) => fd.append('files', f, f.name));
      const token = getToken();
      if (token) fd.append('token', token);
      try {
        const profile = JSON.parse(localStorage.getItem('kd_profile') || 'null');
        if (profile && profile.email) fd.append('email', profile.email);
      } catch (_) {}

      const res = await fetch('/api/viethoa', { method: 'POST', body: fd });
      const data = await res.json().catch(() => ({}));
      if (data.ok) {
        resetOrderForm();
        openSuccess();
      } else {
        showHint('Gửi thất bại, hãy thử lại sau');
      }
    } catch (e) {
      showHint('Lỗi kết nối, hãy thử lại sau');
    } finally {
      busy = false;
      submitBtn.disabled = false;
      submitBtn.innerHTML = ORDER_LABEL;
    }
  }

  uploadBtn.addEventListener('click', () => fileInput.click());
  fileInput.addEventListener('change', () => { addFiles(fileInput.files); fileInput.value = ''; });
  submitBtn.addEventListener('click', doOrder);
  [linkInput, contactInput].forEach((el) => el.addEventListener('keydown', (e) => { if (e.key === 'Enter') doOrder(); }));

  $('success-close').addEventListener('click', closeSuccess);
  successPanel.addEventListener('click', (e) => { if (e.target === successPanel) closeSuccess(); });
  document.addEventListener('keydown', (e) => { if (e.key === 'Escape') closeSuccess(); });
}

const page = document.body.dataset.page;
if (page === 'order') {
  initOrderPage();
} else if (getToken()) {
  window.location.replace(HOME_URL);
} else if (page === 'login') {
  initLoginPage();
} else if (page === 'register') {
  initRegisterPage();
}
})();
