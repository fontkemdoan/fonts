export async function onRequestGet(context) {
  const { request, env } = context;
  const url = new URL(request.url);
  const fileName = url.searchParams.get('file');

  if (!fileName) {
    return new Response('Missing file parameter', { status: 400 });
  }

  const owner = 'fontkemdoan';
  const repo = 'fontsdata';
  const path = `fonts/${fileName}`;

  const githubUrl = `https://api.github.com/repos/${owner}/${repo}/contents/${encodeURIComponent(path)}`;

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

  return new Response(fileBuffer, {
    headers: {
      'Content-Type': 'application/octet-stream',
      'Content-Disposition': `attachment; filename="${fileName}"`
    }
  });
}
