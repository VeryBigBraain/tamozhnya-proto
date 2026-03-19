import express from 'express';
import morgan from 'morgan';

const app = express();
const PORT = process.env.PORT || 8080;
const FSA_ORIGIN = 'https://pub.fsa.gov.ru';

app.disable('x-powered-by');
app.use(morgan('tiny'));
app.use(express.json({ limit: '256kb' }));

// Simple CORS for Netlify site
const ALLOW_ORIGIN = process.env.ALLOW_ORIGIN || '*';
app.use((req, res, next) => {
  res.setHeader('Access-Control-Allow-Origin', ALLOW_ORIGIN);
  res.setHeader('Access-Control-Allow-Methods', 'GET,POST,OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type,Authorization');
  if (req.method === 'OPTIONS') return res.sendStatus(204);
  next();
});

function extractCookiesFromHeaders(headers) {
  const raw = headers.get('set-cookie') ?? '';
  return raw
    .split(/,(?=[^ ])/)
    .filter(Boolean)
    .map((c) => c.split(';')[0].trim())
    .filter(Boolean)
    .join('; ');
}

// POST /fsa-login → { token }
app.post('/fsa-login', async (_req, res) => {
  try {
    // Step 1: warm session
    const initRes = await fetch(`${FSA_ORIGIN}/rss/certificate`, {
      headers: {
        'User-Agent':
          'Mozilla/5.0 (X11; Linux x86_64) AppleWebKit/537.36 Chrome/120.0.0.0 Safari/537.36',
        Accept: 'text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8',
      },
      // Render allows outbound; timeout handled by platform defaults
    });

    const sessionCookie = extractCookiesFromHeaders(initRes.headers);

    // Step 2: login
    const loginRes = await fetch(`${FSA_ORIGIN}/login`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: 'Bearer null',
        Origin: FSA_ORIGIN,
        Referer: `${FSA_ORIGIN}/rss/certificate`,
        'User-Agent':
          'Mozilla/5.0 (X11; Linux x86_64) AppleWebKit/537.36 Chrome/120.0.0.0 Safari/537.36',
        ...(sessionCookie ? { Cookie: sessionCookie } : {}),
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
    const token = headerToken.startsWith('eyJ') ? headerToken : bodyToken;
    if (!token.startsWith('eyJ')) {
      return res.status(502).json({ error: 'Invalid token from FSA' });
    }
    return res.json({ token });
  } catch (e) {
    return res.status(502).json({ error: String(e) });
  }
});

// POST /api/fsa/v1/rss/common/:type(get)
app.post('/api/fsa/v1/rss/common/:type/get', async (req, res) => {
  try {
    const { type } = req.params;
    if (!['certificates', 'declarations'].includes(type)) {
      return res.status(400).json({ error: 'Unsupported endpoint' });
    }
    const upstream = await fetch(`${FSA_ORIGIN}/api/v1/rss/common/${type}/get`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: req.header('authorization') ?? '',
      },
      body: JSON.stringify(req.body ?? {}),
    });
    const text = await upstream.text();
    res
      .status(upstream.status)
      .set('Content-Type', upstream.headers.get('content-type') ?? 'application/json')
      .send(text);
  } catch (e) {
    res.status(502).json({ error: String(e) });
  }
});

app.get('/', (_req, res) => {
  res.type('text/plain').send('tamozhnya external backend: OK');
});

app.listen(PORT, () => {
  // eslint-disable-next-line no-console
  console.log(`External backend listening on :${PORT}`);
});

