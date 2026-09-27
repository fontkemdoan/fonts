export async function onRequestGet(context) {
  const { request, env } = context;
  const url = new URL(request.url);
  const filePath = url.searchParams.get('file');
  const token = url.searchParams.get('token');

  if (!filePath) {
    return new Response('Missing file parameter', { status: 400 });
  }

  // ---- Bắt buộc có session hợp lệ mới cho tải ----
  if (!token) {
    return new Response('Unauthorized', { status: 401 });
  }

  const raw = await env.KD_SESSIONS.get('session:' + token);
  if (!raw) {
    return new Response('Unauthorized', { status: 401 });
  }

  let session;
  try {
    session = JSON.parse(raw);
  } catch (e) {
    return new Response('Unauthorized', { status: 401 });
  }

  const currentPwver = (await env.KD_SESSIONS.get('pwver:' + session.email)) || '1';
  if (String(session.pwver) !== String(currentPwver)) {
    await env.KD_SESSIONS.delete('session:' + token);
    return new Response('Session expired', { status: 401 });
  }

  // ---- Session hợp lệ -> lấy file từ repo private ----
  const owner = 'fontkemdoan';
  const repo = 'fontsdata';
  const path = `fonts/${filePath}`;

  const githubUrl = `https://api.github.com/repos/${owner}/${repo}/contents/${path.split('/').map(encodeURIComponent).join('/')}`;

  const res = await fetch(githubUrl, {
    headers: {
      'Authorization': `Bearer ${env.GITHUB_TOKEN}`,
      'Accept': 'application/vnd.github.v3.raw',
      'User-Agent': 'font-search-app'
    }
  });

  if (!res.ok) {
    return new Response('File not found', { status: 404 });
  }

  const fileBuffer = await res.arrayBuffer();
  const fileName = filePath.split('/').pop();

  return new Response(fileBuffer, {
    headers: {
      'Content-Type': 'application/octet-stream',
      'Content-Disposition': `attachment; filename="${fileName}"`
    }
  });
}
