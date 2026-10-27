import { json, contentsUrl, githubHeaders, normEmail, findUser, createSession, GOOGLE_CLIENT_ID } from '../_lib.js';

export async function onRequestPost({ request, env }) {
  let body;
  try {
    body = await request.json();
  } catch (e) {
    return json({ ok: false, error: 'Invalid request' }, 400);
  }

  const credential = String((body && body.credential) || '').trim();
  if (!credential) return json({ ok: false, error: 'Missing credential' }, 400);

  const clientId = env.GOOGLE_CLIENT_ID || GOOGLE_CLIENT_ID;

  let info;
  try {
    const r = await fetch('https://oauth2.googleapis.com/tokeninfo?id_token=' + encodeURIComponent(credential));
    if (!r.ok) return json({ ok: false, error: 'invalid_token' });
    info = await r.json();
  } catch (e) {
    return json({ ok: false, error: 'Cannot verify token' }, 500);
  }

  const issuerOk = info.iss === 'accounts.google.com' || info.iss === 'https://accounts.google.com';
  if (!issuerOk || info.aud !== clientId) return json({ ok: false, error: 'invalid_token' });
  if (info.email_verified !== true && info.email_verified !== 'true') {
    return json({ ok: false, error: 'invalid_token' });
  }

  const email = normEmail(info.email);
  if (!email) return json({ ok: false, error: 'invalid_token' });

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
  if (!match) return json({ ok: false, error: 'not_registered' });

  const token = await createSession(env, email);

  return json({ ok: true, email, avatar: match.avatar || null, name: match.name || null, picture: info.picture || null, token });
}
