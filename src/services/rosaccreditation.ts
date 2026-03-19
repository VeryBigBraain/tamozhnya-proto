import type { CertificateStatus } from '../types/product';

// ─── Mock Fallback ────────────────────────────────────────────────────────────

/**
 * Статусы по первым 4 цифрам кода ТНВЭД.
 * Используется как фолбэк, если реальный API недоступен или номер документа не указан.
 */
const MOCK_STATUS_MAP: Record<string, CertificateStatus> = {
  '8703': 'valid',    // Легковые автомобили
  '8704': 'expired',  // Грузовые автомобили
  '8708': 'valid',    // Запчасти для авто
  '9401': 'revoked',  // Сиденья
  '6203': 'valid',    // Мужская одежда
  '6110': 'expired',  // Трикотаж
  '3304': 'valid',    // Косметика
  '2106': 'valid',    // Пищевые продукты
};

/**
 * Моковая проверка по коду ТНВЭД (синхронная).
 * Используется как фолбэк при недоступности API и для начальных демо-данных.
 */
export function checkCertificateMock(tnvedCode: string): CertificateStatus {
  const prefix = tnvedCode.slice(0, 4);
  return MOCK_STATUS_MAP[prefix] ?? 'valid';
}

// ─── Token Cache ──────────────────────────────────────────────────────────────

/**
 * Маппинг idStatus ФГИС → внутренний CertificateStatus.
 *
 * Известные значения (на основе данных реального API):
 *   1  — Действует (РСТ / старый формат)     → valid
 *   2  — Приостановлен                        → revoked
 *   3  — Прекращён                            → expired
 *   4  — Архивный                             → expired
 *   6  — Действует (ЕАЭС / ТР ТС формат)     → valid
 *   иное                                      → unknown
 */
function mapIdStatus(idStatus: number): CertificateStatus {
  switch (idStatus) {
    case 1:
    case 6:  return 'valid';
    case 2:  return 'revoked';
    case 3:
    case 4:  return 'expired';
    default: return 'unknown';
  }
}

interface TokenCache {
  token: string;
  /** Unix-timestamp (секунды) */
  expiresAt: number;
}

let tokenCache: TokenCache | null = null;
const USE_DIRECT_EXTERNAL_APIS = import.meta.env.VITE_USE_DIRECT_EXTERNAL_APIS === 'true';
const FSA_ORIGIN = 'https://pub.fsa.gov.ru';

/**
 * Пытается извлечь JWT из ответа login.
 */
function extractJwtFromLoginResponse(
  headers: Headers,
  rawBody: string,
): string {
  const headerToken =
    headers.get('authorization')?.replace('Bearer ', '') ??
    headers.get('x-auth-token') ??
    headers.get('x-token') ??
    '';

  const bodyToken = rawBody.trim().replace(/^"|"$/g, '');
  const token = (headerToken.startsWith('eyJ') ? headerToken : bodyToken);

  if (!token.startsWith('eyJ')) {
    throw new Error(`ФГИС вернул некорректный токен: "${token.slice(0, 60)}"`);
  }
  return token;
}

/**
 * Получает анонимный JWT для ФГИС API через прямой браузерный запрос.
 * Может падать из-за CORS/ограничений источника — в этом случае используем fallback.
 */
async function getAnonymousTokenDirect(): Promise<string> {
  const response = await fetch(`${FSA_ORIGIN}/login`, {
    method: 'POST',
    mode: 'cors',
    headers: {
      'Content-Type': 'application/json',
      'Authorization': 'Bearer null',
    },
    body: JSON.stringify({ username: 'anonymous', password: 'hrgesf7HDR67Bd' }),
  });

  if (!response.ok) {
    throw new Error(`Прямой /login вернул ${response.status}`);
  }

  const rawBody = await response.text();
  return extractJwtFromLoginResponse(response.headers, rawBody);
}

/**
 * Получает анонимный JWT для ФГИС API через локальный прокси.
 * Токен кешируется до истечения срока (с запасом 60 сек).
 *
 * Анонимные credentials публично известны — они встроены в сайт pub.fsa.gov.ru
 * и не дают никаких привилегий сверх публичного доступа к реестрам.
 */
async function getAnonymousTokenViaProxy(): Promise<string> {
  const response = await fetch('/fsa-login', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      // Сервер ожидает этот заголовок даже при первом запросе (до получения токена)
      'Authorization': 'Bearer null',
    },
    body: JSON.stringify({ username: 'anonymous', password: 'hrgesf7HDR67Bd' }),
  });

  console.log('[Росаккредитация] 🔍 Статус /login:', response.status, response.headers.get('content-type'));

  if (!response.ok) {
    throw new Error(`Не удалось получить токен ФГИС: ${response.status}`);
  }

  // Vite-плагин (fsaAuthPlugin) возвращает { token: "eyJ..." }
  const data = (await response.json()) as { token?: string; error?: string };

  if (data.error) {
    throw new Error(`ФГИС auth ошибка: ${data.error}`);
  }

  const token = data.token ?? '';
  if (!token.startsWith('eyJ')) throw new Error(`ФГИС вернул некорректный токен: "${token.slice(0, 60)}"`);
  return token;
}

/**
 * Получает анонимный JWT для ФГИС API.
 * Стратегия: direct из браузера → fallback на локальный прокси.
 */
async function getAnonymousToken(): Promise<string> {
  const now = Math.floor(Date.now() / 1000);
  if (tokenCache && tokenCache.expiresAt > now + 60) return tokenCache.token;

  let token = '';
  try {
    token = await getAnonymousTokenDirect();
    console.log('[Росаккредитация] 🔑 Получен токен через direct-запрос');
  } catch (directErr) {
    console.warn('[Росаккредитация] ⚠️ Direct /login недоступен, fallback на /fsa-login:', directErr);
    token = await getAnonymousTokenViaProxy();
  }

  const payloadBase64 = token.split('.')[1];
  const payload = JSON.parse(atob(payloadBase64)) as { exp: number };

  tokenCache = { token, expiresAt: payload.exp };
  console.log('[Росаккредитация] 🔑 Получен анонимный токен ФГИС');
  return token;
}

// ─── Real API ─────────────────────────────────────────────────────────────────

/** Базовый URL: через Vite proxy или напрямую к pub.fsa.gov.ru */
const FSA_BASE = USE_DIRECT_EXTERNAL_APIS ? `${FSA_ORIGIN}/api` : '/api/fsa';
const FSA_BASE_DIRECT = `${FSA_ORIGIN}/api`;

type FsaEndpoint = 'certificates' | 'declarations';

interface FsaItem {
  id: number;
  idStatus: number;
  number: string;
}

/**
 * Запрашивает статус документа по номеру через ФГИС Росаккредитации.
 * @param docNumber - Номер СС или ДС (любой формат: ЕАЭС RU / РОСС RU / ...)
 * @param endpoint  - 'certificates' для СС, 'declarations' для ДС
 */
async function fetchDocumentStatus(
  docNumber: string,
  endpoint: FsaEndpoint,
): Promise<CertificateStatus> {
  const token = await getAnonymousToken();
  const requestBody = JSON.stringify({
    size: 1,
    page: 0,
    filter: {
      idCertScheme: [],
      regDate: { startDate: null, endDate: null },
      endDate:  { startDate: null, endDate: null },
      columnsSearch: [{ column: 'number', search: docNumber }],
    },
    columnsSort: [{ column: 'date', sort: 'DESC' }],
  });

  const requestInit: RequestInit = {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'Authorization': `Bearer ${token}`,
    },
    body: requestBody,
  };

  let data: { items?: FsaItem[]; total?: number } | null = null;
  try {
    const directResponse = await fetch(`${FSA_BASE_DIRECT}/v1/rss/common/${endpoint}/get`, {
      ...requestInit,
      mode: 'cors',
    });
    if (!directResponse.ok) {
      throw new Error(`Direct API вернул ${directResponse.status}`);
    }
    data = (await directResponse.json()) as { items?: FsaItem[]; total?: number };
  } catch (directErr) {
    console.warn('[Росаккредитация] ⚠️ Direct API недоступен, fallback на /api/fsa:', directErr);
    const proxyResponse = await fetch(`${FSA_BASE}/v1/rss/common/${endpoint}/get`, requestInit);
    if (!proxyResponse.ok) {
      throw new Error(`ФГИС API вернул ${proxyResponse.status}`);
    }
    data = (await proxyResponse.json()) as { items?: FsaItem[]; total?: number };
  }

  const item = data.items?.[0];

  const status = item ? mapIdStatus(item.idStatus) : 'unknown';
  console.log(
    `[Росаккредитация] ✅ API (${endpoint}) | номер: "${docNumber}"` +
    ` | idStatus: ${item?.idStatus ?? 'не найден'} → "${status}"`,
  );
  return status;
}

// ─── Public API ───────────────────────────────────────────────────────────────

/**
 * Проверяет статус сертификата/декларации соответствия.
 *
 * Стратегия (при наличии номеров документов):
 *   1. Пробуем проверить по номеру СС (ss) через реестр сертификатов.
 *   2. Если СС нет или запрос упал — пробуем по номеру ДС (ds) через реестр деклараций.
 *   3. Если оба варианта недоступны — используем мок по коду ТНВЭД.
 *
 * @param tnvedCode - Код ТН ВЭД (10 знаков), используется только для фолбэка
 * @param ss        - Номер сертификата соответствия (приоритетный)
 * @param ds        - Номер декларации соответствия
 */
export async function checkCertificate({
  tnvedCode,
  ss,
  ds,
}: {
  tnvedCode: string;
  ss?: string;
  ds?: string;
}): Promise<CertificateStatus> {
  // 1. Пробуем СС (приоритет)
  if (ss) {
    try {
      return await fetchDocumentStatus(ss, 'certificates');
    } catch (err) {
      console.warn(`[Росаккредитация] ⚠️ СС запрос упал ("${ss}"):`, err);
    }
  }

  // 2. Пробуем ДС
  if (ds) {
    try {
      return await fetchDocumentStatus(ds, 'declarations');
    } catch (err) {
      console.warn(`[Росаккредитация] ⚠️ ДС запрос упал ("${ds}"):`, err);
    }
  }

  // 3. Мок-фолбэк по ТНВЭД
  const fallback = checkCertificateMock(tnvedCode);
  console.log(`[Росаккредитация] 🔶 Мок-фолбэк | ТНВЭД: "${tnvedCode}" → "${fallback}"`);
  return fallback;
}
