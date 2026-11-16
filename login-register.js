/* ==========================================================
   JS dùng chung cho dang-nhap.html và dang-ky.html
   Trang nào chạy phần đó: thẻ <body data-page="login"> hoặc "register"
   ========================================================== */
(() => {
'use strict';

/* ===== Phần dùng chung ===== */

/* Đổi đường dẫn này nếu trang chủ của bạn khác */
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


/* ==========================================================
   TRANG ĐĂNG NHẬP (dang-nhap.html)
   ========================================================== */
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
    loginError.textContent = msg;
    clearTimeout(loginErrorTimer);
    loginErrorTimer = setTimeout(() => { loginError.textContent = ''; }, 3000);
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
      showLoginError('Vui lòng nhập email và mật khẩu.');
      return;
    }

    loginBtn.disabled = true;
    loginBtn.innerHTML = SPINNER;

    try {
      const data = await postJson('/api/login', { email, password, mode: 'login' });
      if (data.ok) {
        onLoginSuccess(data.token, { email, avatar: data.avatar, name: data.name });
        return;
      }
      showLoginError(data.error === 'wrong_password' ? 'Sai mật khẩu' : 'Tài khoản không tồn tại.');
    } catch (e) {
      showLoginError('Lỗi kết nối, hãy thử lại sau.');
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
      showLoginError('Vui lòng nhập đầy đủ thông tin.');
      return;
    }

    changePassBtn.disabled = true;
    loginBtn.disabled = true;
    changePassBtn.innerHTML = SPINNER;

    try {
      const data = await postJson('/api/change-password', { email, oldPassword, newPassword });
      if (data.ok) {
        showLoginError('Đổi mật khẩu thành công.');
        exitChangePassMode();
      } else if (data.error === 'wrong_password') {
        showLoginError('Mật khẩu hiện tại không đúng.');
      } else if (data.error === 'not_found') {
        showLoginError('Tài khoản không tồn tại.');
      } else {
        showLoginError('Có lỗi xảy ra, hãy thử lại sau.');
      }
    } catch (e) {
      showLoginError('Lỗi kết nối, hãy thử lại sau.');
    } finally {
      changePassBtn.disabled = false;
      loginBtn.disabled = false;
      if (changePassMode) changePassBtn.innerHTML = LABEL.confirm;
    }
  }

  /* ---------- Google ---------- */
  const googleBtnEl = $('google-btn');
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

  window.onGoogleLibraryLoad = renderGoogleBtn;
  googleBtnEl.hidden = true;
  googleOrEl.hidden = true;
  window.addEventListener('resize', () => { if (googleReady) renderGoogleBtn(); });

  /* ---------- Sự kiện ---------- */
  loginBtn.addEventListener('click', () => { if (changePassMode) exitChangePassMode(); else doLogin(); });
  if (changePassBtn) changePassBtn.addEventListener('click', () => { if (changePassMode) doChangePassword(); else enterChangePassMode(); });

  [loginEmail, loginPassword].forEach((input) => {
    input.addEventListener('keydown', (e) => { if (e.key === 'Enter' && !changePassMode) doLogin(); });
  });

  if (window.google && google.accounts) renderGoogleBtn();
}


/* ==========================================================
   TRANG ĐĂNG KÝ (dang-ky.html)
   ========================================================== */
function initRegisterPage() {
  const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

  const regEmail = $('reg-email');
  const regContact = $('reg-contact');
  const regPhoto = $('reg-photo');
  const regPhotoName = $('reg-photo-name');
  const regFileBox = regPhoto.closest('.reg-file');
  const regSubmit = $('register-submit');
  const regHint = $('register-hint');
  const successPanel = $('success-panel');

  const REG_LABEL = '<i class="ri-user-add-line"></i> Đăng ký';
  const REG_BUSY_LABEL = SPINNER + ' Đang đăng ký...';
  const REG_PHOTO_TEXT = regPhotoName.textContent;
  const REG_MAX_SIDE = 1600;
  let regHintTimer = null;
  let regBusy = false;

  function showRegHint(msg, ms = 4000) {
    regHint.textContent = msg;
    clearTimeout(regHintTimer);
    regHintTimer = setTimeout(() => { regHint.textContent = ''; }, ms);
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

  const openSuccess = () => { successPanel.hidden = false; };
  const closeSuccess = () => { successPanel.hidden = true; };

  async function doRegister() {
    if (regBusy) return;
    const email = regEmail.value.trim().toLowerCase();
    const contact = regContact.value.trim();
    const photo = regPhoto.files[0];

    if (!emailRegex.test(email)) { showRegHint('Vui lòng nhập Gmail hợp lệ.'); return; }
    if (!photo) { showRegHint('Vui lòng tải lên ảnh chuyển khoản.'); return; }
    if (!photo.type.startsWith('image/')) { showRegHint('File phải là hình ảnh.'); return; }

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
        showRegHint('Đăng ký thất bại, hãy thử lại sau.');
      }
    } catch (e) {
      showRegHint('Lỗi kết nối, hãy thử lại sau.');
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

  /* popup thành công: đóng bằng nút X, bấm ra ngoài hoặc Esc */
  $('success-close').addEventListener('click', closeSuccess);
  successPanel.addEventListener('click', (e) => { if (e.target === successPanel) closeSuccess(); });
  document.addEventListener('keydown', (e) => { if (e.key === 'Escape') closeSuccess(); });
}


/* ===== Khởi chạy theo trang ===== */

/* đã đăng nhập thì về trang chủ */
if (getToken()) {
  window.location.replace(HOME_URL);
} else {
  const page = document.body.dataset.page;
  if (page === 'login') initLoginPage();
  else if (page === 'register') initRegisterPage();
}
})();
