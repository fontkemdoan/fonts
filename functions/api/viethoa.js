const ORDER_IMAGE = '/imgdemo/demoviethoa.jpg';
const MAX_CAPTION = 1024;

const TIMES = {
  normal: { label: 'Tiêu chuẩn', price: '100.000đ' },
  fast: { label: 'Nhanh', price: '150.000đ' }
};

const esc = (s) => String(s).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
const json = (obj, status = 200) =>
  new Response(JSON.stringify(obj), { status, headers: { 'Content-Type': 'application/json' } });

const botToken = (env) => env.TG_BOT_TOKEN || env.TELEGRAM_BOT_TOKEN;
const chatId = (env) => env.TG_CHAT_ID || env.TELEGRAM_CHAT_ID;

async function tg(env, method, body) {
  const res = await fetch('https://api.telegram.org/bot' + botToken(env) + '/' + method, {
    method: 'POST',
    body
  });
  return res.ok;
}

export async function handleOrder(request, env) {
  if (!botToken(env) || !chatId(env)) return json({ ok: false, error: 'not_configured' }, 500);

  let form;
  try { form = await request.formData(); } catch (_) { return json({ ok: false }, 400); }

  const link = String(form.get('link') || '').trim().slice(0, 1000);
  const contact = String(form.get('contact') || '').trim().slice(0, 200);
  const note = String(form.get('note') || '').trim().slice(0, 500);
  const time = TIMES[form.get('time')];
  const files = form.getAll('files').filter((f) => typeof f === 'object' && f.size > 0);

  if (!time || !contact || (!link && !files.length)) return json({ ok: false }, 400);

  const plain = [
    'ĐẶT VIỆT HÓA',
    'Thời gian: ' + time.label + ' (' + time.price + ')'
  ];
  const html = [
    '🆕 <b>ĐẶT VIỆT HÓA</b>',
    '⏱ Thời gian: ' + esc(time.label) + ' (' + time.price + ')'
  ];
  const add = (icon, label, value) => {
    plain.push(label + ': ' + value);
    html.push(icon + ' ' + label + ': ' + esc(value));
  };
  if (link) add('🔗', 'Link font', link);
  if (note) add('📝', 'Yêu cầu', note);
  add('📞', 'Liên hệ', contact);
  if (files.length) add('📎', 'File font', String(files.length));

  const fits = plain.join('\n').length <= MAX_CAPTION;
  const shortCaption = [html[0], html[1], html[html.length - (files.length ? 2 : 1)]].join('\n');

  const photo = new FormData();
  photo.append('chat_id', chatId(env));
  photo.append('photo', new URL(ORDER_IMAGE, request.url).href);
  photo.append('caption', fits ? html.join('\n') : shortCaption);
  photo.append('parse_mode', 'HTML');

  let sentPhoto = false;
  try { sentPhoto = await tg(env, 'sendPhoto', photo); } catch (_) {}

  if (!sentPhoto || !fits) {
    const msg = new FormData();
    msg.append('chat_id', chatId(env));
    msg.append('text', html.join('\n'));
    msg.append('parse_mode', 'HTML');
    msg.append('disable_web_page_preview', 'true');
    if (!(await tg(env, 'sendMessage', msg))) return json({ ok: false }, 502);
  }

  for (const f of files) {
    const doc = new FormData();
    doc.append('chat_id', chatId(env));
    doc.append('document', f, f.name);
    if (!(await tg(env, 'sendDocument', doc))) return json({ ok: false }, 502);
  }

  return json({ ok: true });
}

export const onRequestPost = ({ request, env }) => handleOrder(request, env);
