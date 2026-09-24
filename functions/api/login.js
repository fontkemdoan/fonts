export async function onRequestPost(context) {
  const { request, env } = context;

  let body;
  try {
    body = await request.json();
  } catch (e) {
    return json({ ok: false, error: 'Invalid request' }, 400);
  }

  const email = (body.email || '').trim().toLowerCase();
  if (!email) {
    return json({ ok: false, error: 'Missing email' }, 400);
  }

  const owner = 'fontkemdoan';
  const repo = 'fontsdata';
  const path = 'emails.json';
  const githubUrl = `https://api.github.com/repos/${owner}/${repo}/contents/${path}`;

  const res = await fetch(githubUrl, {
    headers: {
      'Authorization': `Bearer ${env.GITHUB_TOKEN}`,
      'Accept': 'application/vnd.github.v3.raw',
      'User-Agent': 'font-search-app'
    }
  });

  if (!res.ok) {
    return json({ ok: false, error: 'Cannot load email list' }, 500);
  }

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

  return json({ ok: true, avatar: match.avatar || null, name: match.name || null });
}

function json(obj, status = 200) {
  return new Response(JSON.stringify(obj), {
    status,
    headers: { 'Content-Type': 'application/json' }
  });
}
 
