const ORIGIN = 'https://xn--80ajghhoc2aj1c8b.xn--p1ai';
const UA =
  'Mozilla/5.0 (X11; Linux x86_64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/142.0.0.0 Safari/537.36';

type AjaxResponse = {
  data?: {
    result?: {
      query?: Record<string, unknown>;
    };
  };
  errors?: Array<{ message?: string }>;
};

function extractBitrixSessId(html: string): string | null {
  const patterns = [
    /bitrix_sessid'?\s*:\s*'([a-f0-9]{16,64})'/i,
    /bitrix_sessid'?\s*=\s*'([a-f0-9]{16,64})'/i,
    /bitrix_sessid'?\s*:\s*"([a-f0-9]{16,64})"/i,
    /bitrix_sessid[^a-zA-Z0-9]{0,10}([a-f0-9]{16,64})/i,
  ];
  for (const pattern of patterns) {
    const match = html.match(pattern);
    if (match?.[1]) return match[1];
  }
  return null;
}

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

export async function handler(event: { queryStringParameters?: { tnvedCode?: string } }) {
  try {
    const tnvedCode = event.queryStringParameters?.tnvedCode ?? '';
    if (!/^\d{4,10}$/.test(tnvedCode)) {
      return {
        statusCode: 400,
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ error: 'Некорректный tnvedCode' }),
      };
    }

    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), 15_000);
    try {
      const getRes = await fetch(`${ORIGIN}/checking_codes/`, {
        method: 'GET',
        headers: {
          'User-Agent': UA,
          'Accept': 'text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8',
        },
        signal: controller.signal,
      });
      if (!getRes.ok) {
        throw new Error(`GET checking_codes → HTTP ${getRes.status}`);
      }

      const html = await getRes.text();
      const cookieHeader = extractCookiesFromHeaders(getRes.headers);
      const bitrixSessId = extractBitrixSessId(html);
      if (!bitrixSessId) {
        throw new Error('Не удалось извлечь bitrix_sessid');
      }

      const endpoint =
        `${ORIGIN}/bitrix/services/main/ajax.php` +
        '?mode=class&c=dev%3AcodeSearch&action=getByTnVed';
      const body = new URLSearchParams({
        inputValue: tnvedCode,
        SITE_ID: 's1',
        sessid: bitrixSessId,
      }).toString();

      const postRes = await fetch(endpoint, {
        method: 'POST',
        headers: {
          'User-Agent': UA,
          'Accept': '*/*',
          'bx-ajax': 'true',
          'Content-Type': 'application/x-www-form-urlencoded',
          'Origin': ORIGIN,
          'Referer': `${ORIGIN}/checking_codes/`,
          ...(cookieHeader ? { 'Cookie': cookieHeader } : {}),
        },
        body,
        signal: controller.signal,
      });

      const json = (await postRes.json().catch(() => null)) as AjaxResponse | null;
      if (!postRes.ok || !json) {
        throw new Error(
          `POST ajax.php → HTTP ${postRes.status} ${json?.errors?.[0]?.message ? `: ${json.errors[0].message}` : ''}`,
        );
      }

      const query = json.data?.result?.query;
      const required = query ? Object.keys(query).length > 0 : false;
      return {
        statusCode: 200,
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ required }),
      };
    } finally {
      clearTimeout(timer);
    }
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    return {
      statusCode: 200,
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ error: message }),
    };
  }
}

