import { json, contentsUrl, githubHeaders, normEmail, findUser, getPwver } from '../_lib.js';

export async function onRequestPost({ request, env }) {
  let body;
  try {
    body = await request.json();
  } catch (e) {
    return json({ ok: false, error: 'Invalid request' }, 400);
  }

  const email = normEmail(body.email);
  const password = body.password || '';
  const mode = body.mode === 'login' ? 'login' : 'preview';

  if (!email) {
    return json({ ok: false, error: 'Missing email' }, 400);
  }

  const res = await fetch(contentsUrl('emails.json'), {
    headers: githubHeaders(env, 'application/vnd.github.v3.raw')
  });
  if (!res.ok) return json({ ok: false, error: 'Cannot load email list' }, 500);

  let list;
  try {
    list = await res.json();
  } catch (e) {
    return json({ ok: false, error: 'Invalid email list format' }, 500);
  }

  const match = findUser(list, email);
  if (!match) {
    return json({ ok: false });
  }

  // Chế độ xem trước: chỉ trả avatar/tên, không cần mật khẩu
  if (mode === 'preview') {
    return json({ ok: true, avatar: match.avatar || null, name: match.name || null });
  }

  // Chế độ đăng nhập thật: bắt buộc kiểm tra mật khẩu
  if (!password) {
    return json({ ok: false, error: 'missing_password' });
  }

  if (String(match.password || '') !== password) {
    return json({ ok: false, error: 'wrong_password' });
  }

  // Đăng nhập thành công -> cấp session token gắn với phiên bản mật khẩu hiện tại
  const pwver = await getPwver(env, email);
  const token = crypto.randomUUID();
  await env.KD_SESSIONS.put('session:' + token, JSON.stringify({ email, pwver }));

  return json({ ok: true, avatar: match.avatar || null, name: match.name || null, token });
}
