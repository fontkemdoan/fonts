import { json, validateSession, getEmailList, findUser } from '../_lib.js';

export async function onRequestPost({ request, env }) {
  let body;
  try {
    body = await request.json();
  } catch (e) {
    return json({ ok: false }, 400);
  }

  const token = String((body && body.token) || '').trim();
  const session = await validateSession(env, token);
  if (!session) return json({ ok: false });

  let user = null;
  try {
    const list = await getEmailList(env);
    user = list ? findUser(list, session.email) : null;
  } catch (e) {}

  return json({
    ok: true,
    email: session.email,
    avatar: (user && user.avatar) || null,
    name: (user && user.name) || null
  });
}
