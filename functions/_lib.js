// Dùng chung cho các API trong functions/api/.
// File này không export onRequest* nên Cloudflare Pages không coi là route.

const OWNER = 'fontkemdoan';
const REPO = 'fontsdata';

// OAuth Client ID (công khai, không phải secret). Có thể ghi đè bằng env.GOOGLE_CLIENT_ID.
export const GOOGLE_CLIENT_ID = '704991012160-k1f0s7qojcojdeoshnrf6pdhpurse2a1.apps.googleusercontent.com';

export function json(obj, status = 200) {
  return new Response(JSON.stringify(obj), {
    status,
    headers: { 'Content-Type': 'application/json' }
  });
}

// path đã được encode sẵn từng đoạn (nếu cần)
export function contentsUrl(path) {
  return `https://api.github.com/repos/${OWNER}/${REPO}/contents/${path}`;
}

export function githubHeaders(env, accept) {
  return {
    'Authorization': `Bearer ${env.GITHUB_TOKEN}`,
    'Accept': accept,
    'User-Agent': 'font-search-app'
  };
}

export function normEmail(v) {
  return String(v || '').trim().toLowerCase();
}

export function findUser(list, email) {
  return list.find(item => normEmail(item.email) === email);
}

// Phiên bản mật khẩu hiện tại của email (mặc định '1')
export async function getPwver(env, email) {
  return (await env.KD_SESSIONS.get('pwver:' + email)) || '1';
}

// Tạo session mới cho email. Mỗi email chỉ giữ 1 session: session cũ (máy khác) bị xóa.
export async function createSession(env, email) {
  const pwver = await getPwver(env, email);
  const token = crypto.randomUUID();

  const oldToken = await env.KD_SESSIONS.get('user:' + email);
  if (oldToken) await env.KD_SESSIONS.delete('session:' + oldToken);

  await env.KD_SESSIONS.put('session:' + token, JSON.stringify({ email, pwver }));
  await env.KD_SESSIONS.put('user:' + email, token);
  return token;
}

// Trả về session nếu token hợp lệ, ngược lại trả null.
// Token cũ (mật khẩu đã đổi) sẽ bị xóa.
export async function validateSession(env, token) {
  if (!token) return null;

  const raw = await env.KD_SESSIONS.get('session:' + token);
  if (!raw) return null;

  let session;
  try {
    session = JSON.parse(raw);
  } catch (e) {
    return null;
  }
  if (!session) return null;

  if (String(session.pwver) !== String(await getPwver(env, session.email))) {
    await env.KD_SESSIONS.delete('session:' + token);
    return null;
  }

  // Chỉ session mới nhất của email là hợp lệ (đăng nhập máy khác -> máy này bị đá)
  if ((await env.KD_SESSIONS.get('user:' + session.email)) !== token) {
    await env.KD_SESSIONS.delete('session:' + token);
    return null;
  }

  // Email đã bị xóa khỏi emails.json -> vô hiệu session (hiệu lực trong tối đa ~60s do có cache)
  const list = await getEmailList(env);
  if (list && !findUser(list, session.email)) {
    await env.KD_SESSIONS.delete('session:' + token);
    return null;
  }
  return session;
}

// Danh sách email, cache trong KV 60s để không gọi GitHub ở mỗi lần tải font.
// Trả null nếu không đọc được (lúc đó giữ nguyên session, tránh đá hết user khi GitHub lỗi).
export async function getEmailList(env) {
  try {
    const cached = await env.KD_SESSIONS.get('cache:emails');
    if (cached) return JSON.parse(cached);

    const res = await fetch(contentsUrl('emails.json'), {
      headers: githubHeaders(env, 'application/vnd.github.v3.raw')
    });
    if (!res.ok) return null;

    const text = await res.text();
    const list = JSON.parse(text);
    if (!Array.isArray(list)) return null;

    await env.KD_SESSIONS.put('cache:emails', text, { expirationTtl: 60 });
    return list;
  } catch (e) {
    return null;
  }
}
