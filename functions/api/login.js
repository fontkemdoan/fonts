export async function onRequestPost(context) {
  const { request, env } = context;

  let body;
  try {
    body = await request.json();
  } catch (e) {
    return new Response(JSON.stringify({ ok: false, error: 'Invalid request' }), {
      status: 400,
      headers: { 'Content-Type': 'application/json' }
    });
  }

  const email = (body.email || '').trim().toLowerCase();
  if (!email) {
    return new Response(JSON.stringify({ ok: false, error: 'Missing email' }), {
      status: 400,
      headers: { 'Content-Type': 'application/json' }
    });
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
    return new Response(JSON.stringify({ ok: false, error: 'Cannot load email list' }), {
      status: 500,
      headers: { 'Content-Type': 'application/json' }
    });
  }

  let allowedEmails;
  try {
    allowedEmails = await res.json();
  } catch (e) {
    return new Response(JSON.stringify({ ok: false, error: 'Invalid email list format' }), {
      status: 500,
      headers: { 'Content-Type': 'application/json' }
    });
  }

  const normalizedList = allowedEmails.map(e => String(e).trim().toLowerCase());
  const allowed = normalizedList.includes(email);

  return new Response(JSON.stringify({ ok: allowed }), {
    status: 200,
    headers: { 'Content-Type': 'application/json' }
  });
}
