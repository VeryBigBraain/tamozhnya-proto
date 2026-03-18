import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';
import type { Plugin } from 'vite';
import type { IncomingMessage, ServerResponse } from 'http';

// ─── FSA Auth Plugin ──────────────────────────────────────────────────────────

/**
 * Vite-плагин, который выступает серверным посредником для получения JWT ФГИС.
 *
 * Проблема: pub.fsa.gov.ru возвращает пустой ответ на POST /login без session-cookie,
 * который ставится только при первом визите на сайт из браузера.
 * Решение: Node.js сам идёт на сайт, получает session-cookie и затем логинится.
 *
 * Эндпоинт: POST /fsa-login → возвращает { token: "eyJ..." }
 */
function fsaAuthPlugin(): Plugin {
  const FSA_ORIGIN = 'https://pub.fsa.gov.ru';

  let cachedToken   = '';
  let tokenExpiry   = 0;   // Unix-timestamp (секунды)
  let sessionCookie = '';  // Кешированный session-cookie от FSA

  async function fetchFreshToken(): Promise<string> {
    // Шаг 1: Получаем session-cookie через первый визит на страницу реестра
    const initRes = await fetch(`${FSA_ORIGIN}/rss/certificate`, {
      headers: {
        'User-Agent': 'Mozilla/5.0 (X11; Linux x86_64) AppleWebKit/537.36 Chrome/120.0.0.0 Safari/537.36',
        'Accept': 'text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8',
      },
    });

    // Node 18+ fetch: getSetCookie() возвращает массив Set-Cookie значений
    const cookies: string[] =
      typeof initRes.headers.getSetCookie === 'function'
        ? initRes.headers.getSetCookie()
        : (initRes.headers.get('set-cookie') ?? '').split(/,(?=[^ ])/).filter(Boolean);

    const extracted = cookies
      .map((c) => c.split(';')[0].trim())
      .filter(Boolean)
      .join('; ');

    if (extracted) {
      sessionCookie = extracted;
      console.log('[FSA Auth] 🍪 Session получен');
    } else {
      console.warn('[FSA Auth] ⚠️ Session-cookie не получен, пробуем без него');
    }

    // Шаг 2: Логинимся с session-cookie
    const loginRes = await fetch(`${FSA_ORIGIN}/login`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': 'Bearer null',
        'Origin': FSA_ORIGIN,
        'Referer': `${FSA_ORIGIN}/rss/certificate`,
        'User-Agent': 'Mozilla/5.0 (X11; Linux x86_64) AppleWebKit/537.36 Chrome/120.0.0.0 Safari/537.36',
        ...(sessionCookie ? { 'Cookie': sessionCookie } : {}),
      },
      body: JSON.stringify({ username: 'anonymous', password: 'hrgesf7HDR67Bd' }),
    });

    console.log(`[FSA Auth] 🔑 POST /login → ${loginRes.status}`);
    console.log('[FSA Auth] 📋 Response headers:');
    loginRes.headers.forEach((value, key) => {
      console.log(`  ${key}: ${value}`);
    });

    const raw = await loginRes.text();
    console.log(`[FSA Auth] 📦 Body (${raw.length} chars):`, raw.slice(0, 200) || '(пусто)');

    // Токен может быть в теле ИЛИ в заголовке Authorization/X-Auth-Token
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

    // Декодируем exp из JWT payload
    const payloadB64 = token.split('.')[1];
    const payload = JSON.parse(Buffer.from(payloadB64, 'base64').toString()) as { exp: number };

    cachedToken  = token;
    tokenExpiry  = payload.exp;
    console.log(`[FSA Auth] ✅ Токен получен, действует до ${new Date(tokenExpiry * 1000).toISOString()}`);
    return token;
  }

  return {
    name: 'fsa-auth-proxy',
    configureServer(server) {
      server.middlewares.use(
        '/fsa-login',
        async (_req: IncomingMessage, res: ServerResponse) => {
          try {
            const now = Math.floor(Date.now() / 1000);

            // Возвращаем кешированный токен если он ещё действует
            if (cachedToken && tokenExpiry > now + 60) {
              res.writeHead(200, { 'Content-Type': 'application/json' });
              res.end(JSON.stringify({ token: cachedToken }));
              return;
            }

            const token = await fetchFreshToken();
            res.writeHead(200, { 'Content-Type': 'application/json' });
            res.end(JSON.stringify({ token }));
          } catch (err) {
            console.error('[FSA Auth] ✗ Ошибка:', err);
            res.writeHead(500, { 'Content-Type': 'application/json' });
            res.end(JSON.stringify({ error: String(err) }));
          }
        },
      );
    },
  };
}

/**
 * Прокси для проверки Честный знак.
 *
 * Проблема: прямой запрос из браузера в Bitrix endpoint обычно упирается в CSRF/cookies.
 * Поэтому делаем серверный цикл: GET `/checking_codes/` → достаём `bitrix_sessid` + cookies
 * → POST в `ajax.php` и маппим ответ в boolean.
 */
function chestnyZnakPlugin(): Plugin {
  const ORIGIN = 'https://xn--80ajghhoc2aj1c8b.xn--p1ai';
  const UA =
    'Mozilla/5.0 (X11; Linux x86_64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/142.0.0.0 Safari/537.36';

  type AjaxResponse = {
    status?: string;
    data?: {
      result?: {
        query?: Record<string, unknown>;
      };
    };
    errors?: Array<{ message?: string }>;
  };

  function extractBitrixSessId(html: string): string | null {
    // Пробуем несколько вариантов: переменная может быть в JS-объекте/скриптах.
    const patterns = [
      /bitrix_sessid'?\s*:\s*'([a-f0-9]{16,64})'/i,
      /bitrix_sessid'?\s*=\s*'([a-f0-9]{16,64})'/i,
      /bitrix_sessid'?\s*:\s*"([a-f0-9]{16,64})"/i,
      /bitrix_sessid[^a-zA-Z0-9]{0,10}([a-f0-9]{16,64})/i,
    ];
    for (const p of patterns) {
      const m = html.match(p);
      if (m?.[1]) return m[1];
    }
    return null;
  }

  return {
    name: 'chestnyznak-proxy',
    configureServer(server) {
      server.middlewares.use(
        '/api/chestnyznak/check',
        async (req: IncomingMessage, res: ServerResponse) => {
          try {
            const url = new URL(req.url ?? '', `http://${req.headers.host}`);
            const tnvedCode = url.searchParams.get('tnvedCode') ?? '';
            if (!/^\d{4,10}$/.test(tnvedCode)) {
              res.writeHead(400, { 'Content-Type': 'application/json' });
              res.end(JSON.stringify({ error: 'Некорректный tnvedCode' }));
              return;
            }

            const controller = new AbortController();
            const timer = setTimeout(() => controller.abort(), 15_000);
            // 1) GET page to get session cookies + bitrix_sessid
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

            const setCookies: string[] =
              typeof getRes.headers.getSetCookie === 'function'
                ? getRes.headers.getSetCookie()
                : (getRes.headers.get('set-cookie') ?? '')
                    .split(/,(?=[^ ])/)
                    .filter(Boolean);

            const cookieHeader = setCookies
              .map((c) => c.split(';')[0].trim())
              .filter(Boolean)
              .join('; ');

            const bitrixSessId = extractBitrixSessId(html);
            if (!bitrixSessId) {
              throw new Error('Не удалось извлечь bitrix_sessid');
            }

            // 2) POST to ajax.php
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

            clearTimeout(timer);
            const json = (await postRes.json().catch(() => null)) as AjaxResponse | null;
            if (!postRes.ok || !json) {
              throw new Error(
                `POST ajax.php → HTTP ${postRes.status} ${
                  json?.errors?.[0]?.message ? `: ${json.errors[0].message}` : ''
                }`,
              );
            }

            const query = json.data?.result?.query;
            const required = query ? Object.keys(query).length > 0 : false;

            res.writeHead(200, { 'Content-Type': 'application/json' });
            res.end(JSON.stringify({ required }));
          } catch (e) {
            const message = e instanceof Error ? e.message : String(e);
            res.writeHead(200, { 'Content-Type': 'application/json' });
            res.end(JSON.stringify({ error: message }));
          }
        },
      );
    },
  };
}

// ─── Vite Config ──────────────────────────────────────────────────────────────

export default defineConfig({
  plugins: [react(), fsaAuthPlugin(), chestnyZnakPlugin()],
  server: {
    proxy: {
      // /api/fsa/* → https://pub.fsa.gov.ru/api/*
      // Запросы к реестрам сертификатов и деклараций.
      // В production замените на nginx/backend proxy.
      '/api/fsa': {
        target: 'https://pub.fsa.gov.ru',
        changeOrigin: true,
        secure: true,
        rewrite: (path) => path.replace(/^\/api\/fsa/, '/api'),
        configure: (proxy) => {
          proxy.on('proxyReq', (proxyReq, req) => {
            console.log(`[FSA Proxy] → ${req.method} ${proxyReq.path}`);
          });
          proxy.on('proxyRes', (proxyRes, req) => {
            console.log(`[FSA Proxy] ← ${proxyRes.statusCode} ${req.url}`);
          });
          proxy.on('error', (err, req) => {
            console.error(`[FSA Proxy] ✗ Ошибка для ${req.url}:`, err.message);
          });
        },
      },
    },
  },
});
