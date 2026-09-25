export async function onRequestPost(context) {
  const { request, env } = context;

  let body;
  try {
    body = await request.json();
  } catch (e) {
    return json({ ok: false, error: 'Invalid request' }, 400);
  }

  const email = (body.email || '').trim().toLowerCase();
  const deviceId = (body.deviceId || '').trim();
  const mode = body.mode === 'login' ? 'login' : 'preview';

  if (!email) {
    return json({ ok: false, error: 'Missing email' }, 400);
  }

  const owner = 'fontkemdoan';
  const repo = 'fontsdata';
  const path = 'emails.json';

  // ---- CHẾ ĐỘ PREVIEW: chỉ đọc để hiện avatar/tên, không khóa máy ----
  if (mode === 'preview') {
    const res = await fetch(`https://api.github.com/repos/${owner}/${repo}/contents/${path}`, {
      headers: {
        'Authorization': `Bearer ${env.GITHUB_TOKEN}`,
        'Accept': 'application/vnd.github.v3.raw',
        'User-Agent': 'font-search-app'
      }
    });
    if (!res.ok) return json({ ok: false, error: 'Cannot load email list' }, 500);

    let list;
    try { list = await res.json(); } catch (e) { return json({ ok: false }, 500); }

    const match = list.find(item => String(item.email || '').trim().toLowerCase() === email);
    if (!match) return json({ ok: false });

    return json({ ok: true, avatar: match.avatar || null, name: match.name || null });
  }

  // ---- CHẾ ĐỘ LOGIN THẬT: kiểm tra + khóa thiết bị ----
  if (!deviceId) {
    return json({ ok: false, error: 'Missing device id' }, 400);
  }

  const getRes = await fetch(`https://api.github.com/repos/${owner}/${repo}/contents/${path}`, {
    headers: {
      'Authorization': `Bearer ${env.GITHUB_TOKEN}`,
      'Accept': 'application/vnd.github.v3+json',
      'User-Agent': 'font-search-app'
    }
  });

  if (!getRes.ok) return json({ ok: false, error: 'Cannot load email list' }, 500);

  const fileData = await getRes.json();
  const sha = fileData.sha;

  let decoded;
  try {
    decoded = decodeURIComponent(escape(atob(fileData.content.replace(/\n/g, ''))));
  } catch (e) {
    return json({ ok: false, error: 'Cannot decode file' }, 500);
  }

  let list;
  try {
    list = JSON.parse(decoded);
  } catch (e) {
    return json({ ok: false, error: 'Invalid list format' }, 500);
  }

  const index = list.findIndex(item => String(item.email || '').trim().toLowerCase() === email);
  if (index === -1) {
    return json({ ok: false });
  }

  const match = list[index];

  // Máy khác đã dùng email này rồi -> từ chối
  if (match.deviceId && match.deviceId !== deviceId) {
    return json({ ok: false, error: 'device_mismatch' });
  }

  // Chưa từng đăng nhập -> khóa email này với đúng máy hiện tại
  if (!match.deviceId) {
    match.deviceId = deviceId;
    list[index] = match;

    const encoded = btoa(unescape(encodeURIComponent(JSON.stringify(list, null, 2))));

    const putRes = await fetch(`https://api.github.com/repos/${owner}/${repo}/contents/${path}`, {
      method: 'PUT',
      headers: {
        'Authorization': `Bearer ${env.GITHUB_TOKEN}`,
        'User-Agent': 'font-search-app',
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({
        message: `Lock device for ${email}`,
        content: encoded,
        sha: sha
      })
    });

    if (!putRes.ok) {
      return json({ ok: false, error: 'Cannot save device lock' }, 500);
    }
  }

  return json({ ok: true, avatar: match.avatar || null, name: match.name || null });
}

function json(obj, status = 200) {
  return new Response(JSON.stringify(obj), {
    status,
    headers: { 'Content-Type': 'application/json' }
  });
}
