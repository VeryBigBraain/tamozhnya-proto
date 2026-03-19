const FSA_ORIGIN = 'https://pub.fsa.gov.ru';
const ALLOWED_ENDPOINT = /^\/v1\/rss\/common\/(certificates|declarations)\/get$/;

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

    if (!ALLOWED_ENDPOINT.test(incomingPath)) {
      return {
        statusCode: 400,
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ error: 'Unsupported FSA endpoint' }),
      };
    }

    const targetUrl = `${FSA_ORIGIN}/api${incomingPath}`;
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

