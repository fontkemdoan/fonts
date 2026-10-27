import { json, contentsUrl, githubHeaders, normEmail, findUser, getPwver } from '../_lib.js';

function decodeBase64Utf8(b64) {
  const bin = atob(b64.replace(/\n/g, ''));
  return new TextDecoder().decode(Uint8Array.from(bin, c => c.charCodeAt(0)));
}

function encodeBase64Utf8(str) {
  let bin = '';
  for (const b of new TextEncoder().encode(str)) bin += String.fromCharCode(b);
  return btoa(bin);
}

export async function onRequestPost({ request, env }) {
  let body;
  try {
    body = await request.json();
  } catch (e) {
    return json({ ok: false, error: 'Invalid request' }, 400);
  }

  const email = normEmail(body.email);
  const oldPassword = body.oldPassword || '';
  const newPassword = body.newPassword || '';

  if (!email || !oldPassword || !newPassword) {
    return json({ ok: false, error: 'Missing fields' }, 400);
  }

  const emailsUrl = contentsUrl('emails.json');

  const getRes = await fetch(emailsUrl, {
    headers: githubHeaders(env, 'application/vnd.github.v3+json')
  });
  if (!getRes.ok) return json({ ok: false, error: 'Cannot load email list' }, 500);

  const fileData = await getRes.json();
  const sha = fileData.sha;

  let list;
  try {
    list = JSON.parse(decodeBase64Utf8(fileData.content));
  } catch (e) {
    return json({ ok: false, error: 'Cannot decode file' }, 500);
  }

  const match = findUser(list, email);
  if (!match) {
    return json({ ok: false, error: 'not_found' });
  }

  if (String(match.password || '') !== oldPassword) {
    return json({ ok: false, error: 'wrong_password' });
  }

  match.password = newPassword;

  const putRes = await fetch(emailsUrl, {
    method: 'PUT',
    headers: {
      ...githubHeaders(env, 'application/vnd.github.v3+json'),
      'Content-Type': 'application/json'
    },
    body: JSON.stringify({
      message: `Change password for ${email}`,
      content: encodeBase64Utf8(JSON.stringify(list, null, 2)),
      sha
    })
  });

  if (!putRes.ok) {
    return json({ ok: false, error: 'Cannot save new password' }, 500);
  }

  // Tăng phiên bản mật khẩu -> mọi session/token cũ (mọi máy) lập tức bị vô hiệu
  const currentPwver = parseInt(await getPwver(env, email), 10);
  await env.KD_SESSIONS.put('pwver:' + email, String(currentPwver + 1));

  return json({ ok: true });
}
