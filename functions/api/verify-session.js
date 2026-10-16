import { json, validateSession } from '../_lib.js';

export async function onRequestPost({ request, env }) {
  let body;
  try {
    body = await request.json();
  } catch (e) {
    return json({ ok: false }, 400);
  }

  const token = String((body && body.token) || '').trim();
  const session = await validateSession(env, token);
  return json({ ok: !!session });
}
