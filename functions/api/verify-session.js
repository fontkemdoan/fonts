export async function onRequestPost(context) {
  const { request, env } = context;

  let body;
  try {
    body = await request.json();
  } catch (e) {
    return json({ ok: false }, 400);
  }

  const token = (body.token || '').trim();
  if (!token) {
    return json({ ok: false });
  }

  const raw = await env.KD_SESSIONS.get('session:' + token);
  if (!raw) {
    return json({ ok: false });
  }

  let session;
  try {
    session = JSON.parse(raw);
  } catch (e) {
    return json({ ok: false });
  }

  const currentPwver = (await env.KD_SESSIONS.get('pwver:' + session.email)) || '1';

  if (String(session.pwver) !== String(currentPwver)) {
    // Mật khẩu đã đổi từ máy khác -> token này không còn hợp lệ
    await env.KD_SESSIONS.delete('session:' + token);
    return json({ ok: false });
  }

  return json({ ok: true });
}

function json(obj, status = 200) {
  return new Response(JSON.stringify(obj), {
    status,
    headers: { 'Content-Type': 'application/json' }
  });
}
