import { contentsUrl, githubHeaders, validateSession } from '../_lib.js';

export async function onRequestGet({ request, env }) {
  const url = new URL(request.url);
  const filePath = url.searchParams.get('file');
  const token = url.searchParams.get('token');

  if (!filePath) {
    return new Response('Missing file parameter', { status: 400 });
  }

  // ---- Bắt buộc có session hợp lệ mới cho tải ----
  if (!(await validateSession(env, token))) {
    return new Response('Unauthorized', { status: 401 });
  }

  // ---- Chặn path traversal (../emails.json, đường dẫn tuyệt đối, ...) ----
  const parts = filePath.split('/');
  if (parts.some(p => !p || p === '.' || p === '..' || p.includes('\\'))) {
    return new Response('Invalid file parameter', { status: 400 });
  }

  // ---- Session hợp lệ -> lấy file từ repo private ----
  const res = await fetch(contentsUrl(['fonts', ...parts].map(encodeURIComponent).join('/')), {
    headers: githubHeaders(env, 'application/vnd.github.v3.raw')
  });

  if (!res.ok) {
    return new Response('File not found', { status: 404 });
  }

  const fileName = parts[parts.length - 1];

  return new Response(res.body, {
    headers: {
      'Content-Type': 'application/octet-stream',
      'Content-Disposition': `attachment; filename="${fileName}"`
    }
  });
}
