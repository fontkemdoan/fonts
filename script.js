let allFonts = [];
const searchInput = document.getElementById('search');
const clearBtn = document.getElementById('clear-btn');
const statusEl = document.getElementById('status');
const loginPanel = document.getElementById('login-panel');
const brandHeader = document.getElementById('brand-header');
const contentEl = document.getElementById('content');
const loginEmail = document.getElementById('login-email');
const loginPassword = document.getElementById('login-password');
const loginBtn = document.getElementById('login-btn');
const loginError = document.getElementById('login-error');
const changePassBtn = document.getElementById('change-pass-btn');
const changePassExtra = document.getElementById('change-pass-extra');
const newPasswordInput = document.getElementById('new-password');
const logoutBtn = document.getElementById('logout-btn');
const familiesEl = document.getElementById('families');

function showApp() {
  loginPanel.style.display = 'none';
  brandHeader.style.display = 'none';
  contentEl.style.display = '';
  loadManifest();
}

function showLogin() {
  contentEl.style.display = 'none';
  familiesEl.classList.add('hidden');
  brandHeader.style.display = 'flex';
  loginPanel.style.display = 'flex';
}

function loadManifest() {
  fetch('manifest.json')
    .then(res => res.json())
    .then(data => {
      allFonts = data;
      buildFamilies();
    })
    .catch(err => {
      statusEl.textContent = 'Lỗi sever - ' + err;
    });
}

function verifyAndBoot() {
  const token = localStorage.getItem('kd_session_token');
  const bootLoading = document.getElementById('boot-loading');

  if (!token) {
    bootLoading.style.display = 'none';
    showLogin();
    return;
  }

  fetch('/api/verify-session', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ token })
  })
    .then(res => res.json())
    .then(data => {
      bootLoading.style.display = 'none';
      if (data.ok) {
        showApp();
      } else {
        localStorage.removeItem('kd_logged_in');
        localStorage.removeItem('kd_session_token');
        showLogin();
      }
    })
    .catch(() => {

      bootLoading.style.display = 'none';
      showApp();
    });
}

verifyAndBoot();

let loginErrorTimer = null;
function showLoginError(msg) {
  loginError.textContent = msg;
  clearTimeout(loginErrorTimer);
  loginErrorTimer = setTimeout(() => {
    loginError.textContent = '';
  }, 2000);
}

function doLogin() {
  const email = loginEmail.value.trim().toLowerCase();
  const password = loginPassword.value;
  loginError.textContent = '';

  if (!email || !password) {
    showLoginError('Vui lòng nhập email và mật khẩu');
    return;
  }

  loginBtn.disabled = true;
  loginBtn.innerHTML = '<i class="ri-loader-4-line kd-spinner"></i>';

  fetch('/api/login', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ email, password, mode: 'login' })
  })
    .then(res => res.json())
    .then(data => {
      if (data.ok) {
        localStorage.setItem('kd_logged_in', '1');
        localStorage.setItem('kd_session_token', data.token);
        showApp();
      } else if (data.error === 'wrong_password') {
        showLoginError('Sai mật khẩu');
      } else {
        showLoginError('Tài khoản không tồn tại');
      }
    })
    .catch(() => {
      showLoginError('Lỗi kết nối, hãy thử lại sau');
    })
    .finally(() => {
      loginBtn.disabled = false;
      loginBtn.innerHTML = '<i class="ri-arrow-right-line"></i> Đăng nhập';
    });
}

loginBtn.addEventListener('click', () => {
  if (changePassMode) {
    exitChangePassMode();
  } else {
    doLogin();
  }
});
loginEmail.addEventListener('keydown', (e) => {
  if (e.key === 'Enter' && !changePassMode) doLogin();
});
loginPassword.addEventListener('keydown', (e) => {
  if (e.key === 'Enter' && !changePassMode) doLogin();
});

let changePassMode = false;

function enterChangePassMode() {
  changePassMode = true;
  changePassExtra.style.display = 'block';
  changePassBtn.innerHTML = '<i class="ri-check-line"></i> Xác nhận';
  loginBtn.innerHTML = '<i class="ri-arrow-left-line"></i> Quay lại';
}

function exitChangePassMode() {
  changePassMode = false;
  changePassExtra.style.display = 'none';
  newPasswordInput.value = '';
  changePassBtn.innerHTML = '<i class="ri-key-2-line"></i> Đổi Pass';
  loginBtn.innerHTML = '<i class="ri-arrow-right-line"></i> Đăng nhập';
}

changePassBtn.addEventListener('click', () => {
  if (!changePassMode) {
    enterChangePassMode();
    return;
  }

  const email = loginEmail.value.trim().toLowerCase();
  const oldPassword = loginPassword.value;
  const newPassword = newPasswordInput.value;

  if (!email || !oldPassword || !newPassword) {
    showLoginError('Vui lòng nhập đầy đủ thông tin');
    return;
  }

  changePassBtn.disabled = true;
  loginBtn.disabled = true;
  changePassBtn.innerHTML = '<i class="ri-loader-4-line kd-spinner"></i>';

  fetch('/api/change-password', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ email, oldPassword, newPassword })
  })
    .then(res => res.json())
    .then(data => {
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
    })
    .catch(() => showLoginError('Lỗi kết nối, hãy thử lại sau'))
    .finally(() => {
      changePassBtn.disabled = false;
      loginBtn.disabled = false;
      if (changePassMode) changePassBtn.innerHTML = '<i class="ri-check-line"></i> Xác nhận';
    });
});

const loginIcon = document.getElementById('login-icon');
const loginTitle = document.querySelector('.login-title');
const DEFAULT_TITLE = 'Thành Viên';
const DEFAULT_ICON = '<i class="ri-user-line"></i>';
const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
let previewTimer = null;

function resetLoginIcon() {
  loginIcon.innerHTML = DEFAULT_ICON;
  loginTitle.textContent = DEFAULT_TITLE;
}

function previewAvatar(email) {
  fetch('/api/login', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ email, mode: 'preview' })
  })
    .then(res => res.json())
    .then(data => {
      if (data.ok) {
        if (data.avatar) {
          loginIcon.innerHTML = `<img src="avatars/${data.avatar}" alt="avatar">`;
        } else {
          loginIcon.innerHTML = DEFAULT_ICON;
        }
        loginTitle.textContent = data.name || DEFAULT_TITLE;
      } else {
        resetLoginIcon();
      }
    })
    .catch(() => resetLoginIcon());
}

loginEmail.addEventListener('input', () => {
  clearTimeout(previewTimer);
  const val = loginEmail.value.trim().toLowerCase();
  if (!emailRegex.test(val)) {
    resetLoginIcon();
    return;
  }
  previewTimer = setTimeout(() => previewAvatar(val), 400);
});

const loadedPreviewFonts = new Map();
const DEFAULT_PREVIEW_TEXT = 'Phông chữ Tiếng Việt';
const DEFAULT_PREVIEW_SIZE = 30;

function render(list) {
  const container = document.getElementById('results');
  container.innerHTML = '';

  if (list.length === 0) {
    const sugg = suggestFonts(searchInput.value);
    const suggHtml = sugg.length
      ? '<div class="did-you-mean">Có phải bạn muốn tìm font ' +
        sugg.map(n => '<button type="button" class="dym-chip" data-name="' + escapeAttr(n) + '">' + escapeHtml(n) + '</button>').join('') +
        '</div>'
      : '';
    statusEl.innerHTML = '<b>KHÔNG TÌM THẤY FONT</b><br><br><i>Gợi ý: Chỉ cần nhập tên font<br>Ví dụ Kemdoan Regular → Kemdoan</i>' + suggHtml;
    return;
  }

  statusEl.textContent = '';
  list.forEach(font => {
    const token = localStorage.getItem('kd_session_token') || '';

    const card = document.createElement('div');
    card.className = 'font-card';

    const item = document.createElement('div');
    item.className = 'font-item';
    item.innerHTML = `
      <span class="font-name">${font.name}</span>
      <a class="download-btn" href="/api/download?file=${encodeURIComponent(font.file)}&token=${encodeURIComponent(token)}" download aria-label="Tải font"><i class="ri-download-cloud-2-line"></i></a>
    `;

    const panel = document.createElement('div');
    panel.className = 'preview-panel';
    panel.innerHTML = `
      <div class="preview-input-wrap">
        <input type="text" class="preview-input" placeholder="Nhập chữ để xem..." value="${DEFAULT_PREVIEW_TEXT}" autocomplete="off" autocorrect="off" autocapitalize="off" spellcheck="false">
        <button class="preview-clear-btn show" aria-label="Xóa"><i class="ri-close-line"></i></button>
      </div>
      <div class="preview-size-row">
        <input type="range" class="preview-size-slider" min="1" max="100" step="1" value="30" aria-label="Cỡ chữ">
        <span class="preview-size-value">30px</span>
      </div>
      <div class="preview-loading" style="display:none;"><i class="ri-loader-4-line kd-spinner"></i> Đang tải font...</div>
      <div class="preview-text"></div>
    `;

    card.appendChild(item);
    card.appendChild(panel);
    container.appendChild(card);

    item.addEventListener('click', (e) => {
      if (e.target.closest('.download-btn')) return;
      togglePreview(font, panel);
    });
  });
}

async function togglePreview(font, panel) {

  const itemEl = panel.previousElementSibling;

  document.querySelectorAll('.preview-panel.open').forEach(p => {
    if (p !== panel) {
      p.classList.remove('open');
      if (p.previousElementSibling) p.previousElementSibling.classList.remove('expanded');
    }
  });

  if (panel.classList.contains('open')) {
    panel.classList.remove('open');
    itemEl.classList.remove('expanded');
    return;
  }

  panel.classList.add('open');
  itemEl.classList.add('expanded');

  const inputEl = panel.querySelector('.preview-input');
  const loadingEl = panel.querySelector('.preview-loading');
  const previewTextEl = panel.querySelector('.preview-text');
  const previewClearBtn = panel.querySelector('.preview-clear-btn');
  const sizeSlider = panel.querySelector('.preview-size-slider');
  const sizeValue = panel.querySelector('.preview-size-value');

  const applySize = () => {
    const v = Number(sizeSlider.value);
    previewTextEl.style.fontSize = v + 'px';
    sizeValue.textContent = v + 'px';
    sizeSlider.style.setProperty('--pct', (v - 1) / 99);
  };
  sizeSlider.oninput = applySize;
  sizeSlider.value = DEFAULT_PREVIEW_SIZE; 
  applySize();

  const applyText = () => {
    previewTextEl.textContent = inputEl.value;
  };

  let suckBusy = false;

  const suckTextIntoTrash = (done) => {
    const text = previewTextEl.textContent;
    const reduce = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
    if (!text.trim() || reduce || !previewTextEl.animate) { done(); return; }

    suckBusy = true;

    previewTextEl.textContent = '';
    const chars = [];
    Array.from(text.normalize('NFC')).forEach(ch => {
      if (/\s/.test(ch)) {
        previewTextEl.appendChild(document.createTextNode(ch));
      } else {
        const sp = document.createElement('span');
        sp.className = 'preview-char';
        sp.textContent = ch;
        previewTextEl.appendChild(sp);
        chars.push(sp);
      }
    });

    const baseH = previewTextEl.offsetHeight;
    previewTextEl.style.paddingBottom = '46px';

    const trash = document.createElement('div');
    trash.className = 'preview-trash';
    trash.innerHTML = '<i class="ri-delete-bin-line"></i>';
    trash.style.left = (previewTextEl.offsetLeft + previewTextEl.offsetWidth / 2) + 'px';
    trash.style.top = (previewTextEl.offsetTop + baseH + 6) + 'px';
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
          previewTextEl.style.paddingBottom = '';
          suckBusy = false;
          done();
        };
      };
      if (last) last.onfinish = finish; else finish();
    };
  };

  previewClearBtn.onclick = () => {
    spinIcon(previewClearBtn);
    if (suckBusy) return;
    const hadText = inputEl.value.length > 0;
    slideTextLeft(inputEl);
    inputEl.value = '';

    const showEmpty = () => {
      if (inputEl.value.length > 0) return; 
      applyText();
    };

    if (hadText) suckTextIntoTrash(showEmpty); else showEmpty();
  };

  if (loadedPreviewFonts.has(font.file)) {
    previewTextEl.style.fontFamily = `"${loadedPreviewFonts.get(font.file)}", sans-serif`;
    applyText();
    inputEl.oninput = applyText;
    return;
  }

  loadingEl.style.display = 'flex';
  previewTextEl.textContent = '';

  try {
    const token = localStorage.getItem('kd_session_token') || '';
    const res = await fetch(`/api/download?file=${encodeURIComponent(font.file)}&token=${encodeURIComponent(token)}`);
    if (!res.ok) throw new Error('fetch failed');

    const blob = await res.blob();
    const objectUrl = URL.createObjectURL(blob);
    const familyName = 'kd-preview-' + loadedPreviewFonts.size;

    const fontFace = new FontFace(familyName, `url(${objectUrl})`);
    await fontFace.load();
    document.fonts.add(fontFace);

    loadedPreviewFonts.set(font.file, familyName);

    loadingEl.style.display = 'none';
    previewTextEl.style.fontFamily = `"${familyName}", sans-serif`;
    applyText();
    inputEl.oninput = applyText;
  } catch (e) {
    loadingEl.style.display = 'none';
    previewTextEl.style.fontFamily = '';
    previewTextEl.textContent = 'File zip';
  }
}

function slideTextLeft(input, duration = 200) {
  const text = input.value;
  const reduce = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
  if (!text || reduce || !input.animate) return;

  const cs = getComputedStyle(input);
  const padL = parseFloat(cs.paddingLeft) || 0;
  const padR = parseFloat(cs.paddingRight) || 0;
  const bl = parseFloat(cs.borderLeftWidth) || 0;
  const bt = parseFloat(cs.borderTopWidth) || 0;

  const clip = document.createElement('div');
  Object.assign(clip.style, {
    position: 'absolute',
    left: (input.offsetLeft + bl + padL) + 'px',
    top: (input.offsetTop + bt) + 'px',
    width: (input.clientWidth - padL - padR) + 'px',
    height: input.clientHeight + 'px',
    boxSizing: 'border-box',
    overflow: 'hidden',
    pointerEvents: 'none',
    display: 'flex',
    alignItems: 'center',
    fontSize: cs.fontSize,
    fontFamily: cs.fontFamily,
    fontWeight: cs.fontWeight,
    letterSpacing: cs.letterSpacing,
    color: cs.color
  });
  const span = document.createElement('span');
  span.textContent = text;
  span.style.whiteSpace = 'pre';
  span.style.flexShrink = '0';
  clip.appendChild(span);
  input.parentNode.appendChild(clip);
  input.classList.add('clearing');

  const dist = span.offsetWidth + 10;
  const cleanup = () => {
    clip.remove();
    input.classList.remove('clearing');
    input.removeEventListener('input', cleanup);
  };
  input.addEventListener('input', cleanup);

  const anim = span.animate(
    [
      { transform: 'translateX(0)', opacity: 1 },
      { transform: 'translateX(' + (-dist * 0.6) + 'px)', opacity: 1, offset: 0.6 },
      { transform: 'translateX(' + (-dist) + 'px)', opacity: 0 }
    ],
    { duration, easing: 'cubic-bezier(.45,0,.55,1)', fill: 'forwards' }
  );
  anim.onfinish = cleanup;
}

function spinIcon(btn) {
  const icon = btn.querySelector('i');
  if (!icon) return;
  icon.classList.remove('spin-360');
  void icon.offsetWidth;
  icon.classList.add('spin-360');
}

function normalize(str) {
  return str.toLowerCase().replace(/[\s\-_]+/g, '');
}

function familyKey(f) {
  return String(f.file).split('/')[0];
}

function buildFamilies() {
  const map = new Map();
  allFonts.forEach(f => {
    const k = familyKey(f);
    if (!map.has(k)) map.set(k, { name: k, count: 0, link: f.group_file || f.family_file || '' });
    map.get(k).count++;
  });
  familiesEl.innerHTML = '';
  [...map.values()].sort((a, b) => a.name.localeCompare(b.name)).forEach(g => {
    const card = document.createElement('div');
    card.className = 'family-card';
    card.innerHTML = `
      <div class="family-name">${g.name}</div>
      <div class="family-foot">
        <span>${g.count} Font</span>
        <a class="family-download" href="#" data-folder="${g.name}" aria-label="Tải bộ font"><i class="ri-download-cloud-2-line"></i></a>
      </div>`;
    familiesEl.appendChild(card);
  });
  updateFamilies();
}

function updateFamilies() {
  const hide = document.activeElement === searchInput || searchInput.value.trim() !== '';
  familiesEl.classList.toggle('hidden', hide || !familiesEl.children.length);
}
searchInput.addEventListener('focus', updateFamilies);
searchInput.addEventListener('blur', () => setTimeout(updateFamilies, 0));

familiesEl.addEventListener('click', async (e) => {
  const btn = e.target.closest('.family-download');
  if (!btn) return;
  e.preventDefault();
  if (btn.dataset.busy) return;
  const folder = btn.dataset.folder;
  const files = allFonts.filter(f => familyKey(f) === folder);
  const token = localStorage.getItem('kd_session_token') || '';
  const icon = btn.querySelector('i');
  btn.dataset.busy = '1';
  icon.className = '';
  icon.style.cssText = 'font-size:13px;font-style:normal';
  icon.textContent = '0';

  const zip = new JSZip();
  let ok = 0, i = 0;
  const worker = async () => {
    while (i < files.length) {
      const f = files[i++];
      try {
        const res = await fetch('/api/download?file=' + encodeURIComponent(f.file) + '&token=' + encodeURIComponent(token));
        if (!res.ok) continue;
        zip.file(f.file.split('/').pop(), await res.blob());
        ok++;
        icon.textContent = ok;
      } catch (_) {}
    }
  };
  await Promise.all(Array.from({ length: 6 }, worker));

  if (ok === 0) {
    alert('Tải không thành công');
  } else {
    const blob = await zip.generateAsync({ type: 'blob', compression: 'STORE' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = folder + '.zip';
    document.body.appendChild(a);
    a.click();
    a.remove();
    setTimeout(() => URL.revokeObjectURL(url), 10000);
  }
  icon.textContent = '';
  icon.style.cssText = '';
  icon.className = 'ri-download-cloud-2-line';
  delete btn.dataset.busy;
});

function escapeHtml(t) {
  return String(t).replace(/[&<>"']/g, c => ({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
}
function escapeAttr(t) { return escapeHtml(t); }

function foldText(str) {
  return String(str).toLowerCase()
    .replace(/đ/g, 'd')
    .normalize('NFD').replace(/[\u0300-\u036f]/g, '')
    .replace(/[^a-z0-9]+/g, '');
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
      const d = editDistance(q, name.substr(i, len));
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
  allFonts.forEach(f => {
    const name = f.name;
    if (seen.has(name)) return;
    seen.add(name);
    const d = fuzzyScore(q, foldText(name));
    if (d <= maxDist) scored.push({ name, d, len: name.length });
  });
  scored.sort((a, b) => a.d - b.d || a.len - b.len || a.name.localeCompare(b.name));
  return scored.slice(0, max).map(x => x.name);
}

statusEl.addEventListener('click', e => {
  const chip = e.target.closest('.dym-chip');
  if (!chip) return;
  searchInput.value = chip.dataset.name;
  runSearch();
  updateFamilies();
});

function runSearch() {
  const raw = searchInput.value.trim();
  if (!raw) {
    document.getElementById('results').innerHTML = '';
    statusEl.textContent = '';
    return;
  }
  const q = normalize(raw);
  render(allFonts.filter(f => normalize(f.name).includes(q)).slice(0, 50));
}

searchInput.addEventListener('input', () => { runSearch(); updateFamilies(); });

clearBtn.addEventListener('click', () => {
  spinIcon(clearBtn);
  slideTextLeft(searchInput);
  searchInput.value = '';
  document.getElementById('results').innerHTML = '';
  statusEl.textContent = '';
  updateFamilies();
});

logoutBtn.addEventListener('click', () => {
  localStorage.removeItem('kd_logged_in');
  localStorage.removeItem('kd_session_token');
  showLogin();
});

(function () {
  const root = document.documentElement;
  const btn = document.getElementById('theme-toggle');
  const icon = btn.querySelector('i');
  const sync = () => {
    icon.className = root.getAttribute('data-theme') === 'dark' ? 'ri-moon-line' : 'ri-sun-line';
  };
  sync();
  btn.addEventListener('click', () => {
    const dark = root.getAttribute('data-theme') !== 'dark';
    const theme = dark ? 'dark' : 'light';
    root.setAttribute('data-theme', theme);
    try { localStorage.setItem('kd_theme', theme); } catch (e) {}
    sync();
  });
})();
