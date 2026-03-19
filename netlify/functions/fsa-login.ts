let cachedToken = '';
let tokenExpiry = 0;
let sessionCookie = '';

const FSA_ORIGIN = 'https://pub.fsa.gov.ru';
const USER_AGENT =
  'Mozilla/5.0 (X11; Linux x86_64) AppleWebKit/537.36 Chrome/120.0.0.0 Safari/537.36';

function extractCookiesFromHeaders(headers: Headers): string {
  const getSetCookie = (headers as Headers & { getSetCookie?: () => string[] }).getSetCookie;
  const cookies: string[] =
    typeof getSetCookie === 'function'
      ? getSetCookie.call(headers)
      : (headers.get('set-cookie') ?? '')
          .split(/,(?=[^ ])/)
          .filter(Boolean);

  return cookies
    .map((cookie) => cookie.split(';')[0].trim())
    .filter(Boolean)
    .join('; ');
}

async function fetchFreshToken(): Promise<string> {
  const initRes = await fetch(`${FSA_ORIGIN}/rss/certificate`, {
    headers: {
      'User-Agent': USER_AGENT,
      'Accept': 'text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8',
    },
  });

  const extracted = extractCookiesFromHeaders(initRes.headers);
  if (extracted) {
    sessionCookie = extracted;
  }

  const loginRes = await fetch(`${FSA_ORIGIN}/login`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'Authorization': 'Bearer null',
      'Origin': FSA_ORIGIN,
      'Referer': `${FSA_ORIGIN}/rss/certificate`,
      'User-Agent': USER_AGENT,
      ...(sessionCookie ? { 'Cookie': sessionCookie } : {}),
    },
    body: JSON.stringify({ username: 'anonymous', password: 'hrgesf7HDR67Bd' }),
  });

  const raw = await loginRes.text();
  const headerToken =
    loginRes.headers.get('authorization')?.replace('Bearer ', '') ??
    loginRes.headers.get('x-auth-token') ??
    loginRes.headers.get('x-token') ??
    '';

  const bodyToken = raw.trim().replace(/^"|"$/g, '');
  const token = (headerToken.startsWith('eyJ') ? headerToken : bodyToken);
  if (!token.startsWith('eyJ')) {
    throw new Error(`Некорректный токен от ФГИС: "${token.slice(0, 60)}"`);
  }

  const payloadB64 = token.split('.')[1];
  const payload = JSON.parse(Buffer.from(payloadB64, 'base64').toString()) as { exp: number };

  cachedToken = token;
  tokenExpiry = payload.exp;
  return token;
}

export async function handler() {
  try {
    const now = Math.floor(Date.now() / 1000);
    if (cachedToken && tokenExpiry > now + 60) {
      return {
        statusCode: 200,
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ token: cachedToken }),
      };
    }

    const token = await fetchFreshToken();
    return {
      statusCode: 200,
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ token }),
    };
  } catch (error) {
    console.error('[fsa-login] error:', error);
    return {
      statusCode: 500,
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ error: String(error) }),
    };
  }
}

