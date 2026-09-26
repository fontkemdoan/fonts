export async function onRequestPost(context) {
  const { request, env } = context;

  let body;
  try {
    body = await request.json();
  } catch (e) {
    return json({ ok: false, error: 'Invalid request' }, 400);
  }

  const email = (body.email || '').trim().toLowerCase();
  const password = body.password || '';
  const mode = body.mode === 'login' ? 'login' : 'preview';

  if (!email) {
    return json({ ok: false, error: 'Missing email' }, 400);
  }

  const owner = 'fontkemdoan';
  const repo = 'fontsdata';
  const path = 'emails.json';

  const res = await fetch(`https://api.github.com/repos/${owner}/${repo}/contents/${path}`, {
    headers: {
      'Authorization': `Bearer ${env.GITHUB_TOKEN}`,
      'Accept': 'application/vnd.github.v3.raw',
      'User-Agent': 'font-search-app'
    }
  });
  if (!res.ok) return json({ ok: false, error: 'Cannot load email list' }, 500);

  let list;
  try {
    list = await res.json();
  } catch (e) {
    return json({ ok: false, error: 'Invalid email list format' }, 500);
  }

  const match = list.find(item => String(item.email || '').trim().toLowerCase() === email);
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

  return json({ ok: true, avatar: match.avatar || null, name: match.name || null });
}

function json(obj, status = 200) {
  return new Response(JSON.stringify(obj), {
    status,
    headers: { 'Content-Type': 'application/json' }
  });
}
