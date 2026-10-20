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
  return session;
}
