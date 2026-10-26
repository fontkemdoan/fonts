const json = (obj, status = 200) =>
  new Response(JSON.stringify(obj), { status, headers: { 'Content-Type': 'application/json' } });

const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
const MAX_PHOTO = 10 * 1024 * 1024; // giới hạn sendPhoto của Telegram

export async function onRequestPost({ request, env }) {
  if (!env.TG_BOT_TOKEN || !env.TG_CHAT_ID) return json({ ok: false, error: 'not_configured' }, 500);

  let form;
  try { form = await request.formData(); } catch (_) { return json({ ok: false, error: 'bad_request' }, 400); }

  const email = String(form.get('email') || '').trim().toLowerCase().slice(0, 200);
  const contact = String(form.get('contact') || '').trim().slice(0, 200);
  const photo = form.get('photo');

  if (!emailRegex.test(email)) return json({ ok: false, error: 'invalid' }, 400);
  if (!photo || typeof photo === 'string' || !String(photo.type).startsWith('image/') || photo.size > MAX_PHOTO) {
    return json({ ok: false, error: 'invalid_photo' }, 400);
  }

  const time = new Date().toLocaleString('vi-VN', { timeZone: 'Asia/Ho_Chi_Minh' });
  const caption = `ĐĂNG KÝ THÀNH VIÊN\nGmail: ${email}\nLiên hệ: ${contact || 'Không có'}\nThời gian: ${time}`;

  const tg = new FormData();
  tg.append('chat_id', env.TG_CHAT_ID);
  tg.append('caption', caption);
  tg.append('photo', photo, 'chuyen-khoan.jpg');

  const res = await fetch(`https://api.telegram.org/bot${env.TG_BOT_TOKEN}/sendPhoto`, { method: 'POST', body: tg });
  if (!res.ok) return json({ ok: false, error: 'telegram_failed' }, 502);
  return json({ ok: true });
}
