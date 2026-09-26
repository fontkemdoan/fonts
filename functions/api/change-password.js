export async function onRequestPost(context) {
  const { request, env } = context;

  let body;
  try {
    body = await request.json();
  } catch (e) {
    return json({ ok: false, error: 'Invalid request' }, 400);
  }

  const email = (body.email || '').trim().toLowerCase();
  const oldPassword = body.oldPassword || '';
  const newPassword = body.newPassword || '';

  if (!email || !oldPassword || !newPassword) {
    return json({ ok: false, error: 'Missing fields' }, 400);
  }

  const owner = 'fontkemdoan';
  const repo = 'fontsdata';
  const path = 'emails.json';

  // Lấy file kèm sha để có thể ghi đè lại
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
    return json({ ok: false, error: 'not_found' });
  }

  const match = list[index];

  if (String(match.password || '') !== oldPassword) {
    return json({ ok: false, error: 'wrong_password' });
  }

  match.password = newPassword;
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
      message: `Change password for ${email}`,
      content: encoded,
      sha: sha
    })
  });

  if (!putRes.ok) {
    return json({ ok: false, error: 'Cannot save new password' }, 500);
  }

  return json({ ok: true });
}

function json(obj, status = 200) {
  return new Response(JSON.stringify(obj), {
    status,
    headers: { 'Content-Type': 'application/json' }
  });
}
