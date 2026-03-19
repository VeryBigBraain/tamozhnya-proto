const FSA_ORIGIN = 'https://pub.fsa.gov.ru';

export async function handler(event: {
  path: string;
  httpMethod: string;
  headers: Record<string, string | undefined>;
  body: string | null;
}) {
  try {
    if (event.httpMethod !== 'POST') {
      return {
        statusCode: 405,
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ error: 'Method Not Allowed' }),
      };
    }

    const fnPrefix = '/.netlify/functions/fsa-proxy';
    const incomingPath = event.path.startsWith(fnPrefix)
      ? event.path.slice(fnPrefix.length)
      : event.path;

    // Netlify local/prod могут передавать путь без/с ведущим "/", а редирект может
    // оставлять кусок вида "/api/fsa". Нормализуем перед маппингом.
    let normalizedPath = incomingPath.replace(/^\/+/, '/');
    normalizedPath = normalizedPath.replace(/^\/api\/fsa/, '');

    const allowed =
      /^\/v1\/rss\/common\/(certificates|declarations)\/get\/?$/.test(normalizedPath);

    if (!allowed) {
      return {
        statusCode: 400,
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          error: 'Unsupported FSA endpoint',
          rawPath: event.path,
          normalizedPath,
        }),
      };
    }

    const finalPath = normalizedPath.replace(/\/$/, '');
    const targetUrl = `${FSA_ORIGIN}/api${finalPath}`;
    const upstream = await fetch(targetUrl, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': event.headers.authorization ?? event.headers.Authorization ?? '',
      },
      body: event.body ?? '{}',
    });

    const text = await upstream.text();
    return {
      statusCode: upstream.status,
      headers: { 'Content-Type': upstream.headers.get('content-type') ?? 'application/json' },
      body: text,
    };
  } catch (error) {
    console.error('[fsa-proxy] error:', error);
    return {
      statusCode: 500,
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ error: String(error) }),
    };
  }
}

