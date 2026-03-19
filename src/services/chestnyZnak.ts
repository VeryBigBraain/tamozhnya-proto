/**
 * Фолбэк-логика "по префиксу ТНВЭД" для сценария, когда реальная проверка
 * (Честный знак / Bitrix endpoint) недоступна.
 */
const CHESTNY_ZNAK_CODES = new Set([
  '6110', // Трикотажные изделия
  '6203', // Мужская одежда
  '6204', // Женская одежда
  '6403', // Обувь
  '6404', // Обувь текстильная
  '3304', // Косметика
  '8544', // Провода и кабели
  '6105', // Рубашки мужские
  '6106', // Блузки
]);

export function checkChestnyZnakMock(tnvedCode: string): boolean {
  const prefix = tnvedCode.slice(0, 4);
  return CHESTNY_ZNAK_CODES.has(prefix);
}

type ChestnyZnakCheckResponse = {
  required?: boolean;
  error?: string;
};

const USE_DIRECT_EXTERNAL_APIS = import.meta.env.VITE_USE_DIRECT_EXTERNAL_APIS === 'true';
const CHECK_ENDPOINT = '/api/chestnyznak/check';
const DIRECT_CHECK_ENDPOINT =
  'https://xn--80ajghhoc2aj1c8b.xn--p1ai/bitrix/services/main/ajax.php' +
  '?mode=class&c=dev%3AcodeSearch&action=getByTnVed';

// Простой TTL-кеш, чтобы не дёргать внешний сервис на каждый ввод.
const cache = new Map<string, { value: boolean; expiresAt: number }>();
const TTL_MS = 10 * 60 * 1000; // 10 минут

async function checkChestnyZnakReal(tnvedCode: string): Promise<boolean> {
  if (USE_DIRECT_EXTERNAL_APIS) {
    // Эксперимент: прямой запрос из браузера к внешнему сервису без proxy.
    const body = new URLSearchParams({
      inputValue: tnvedCode,
      SITE_ID: 's1',
    }).toString();
    const directRes = await fetch(DIRECT_CHECK_ENDPOINT, {
      method: 'POST',
      headers: {
        'Accept': '*/*',
        'Content-Type': 'application/x-www-form-urlencoded',
      },
      body,
    });
    const json = (await directRes.json().catch(() => null)) as
      | { data?: { result?: { query?: Record<string, unknown> } }; errors?: Array<{ message?: string }> }
      | null;
    if (!directRes.ok || !json) {
      throw new Error(json?.errors?.[0]?.message ?? `HTTP ${directRes.status}`);
    }
    const query = json.data?.result?.query;
    return query ? Object.keys(query).length > 0 : false;
  }

  // В реальном сервисе важны cookies+CSRF, поэтому обычно ходим через middleware.
  const res = await fetch(`${CHECK_ENDPOINT}?tnvedCode=${encodeURIComponent(tnvedCode)}`, {
    method: 'GET',
    headers: { 'Accept': 'application/json' },
  });

  if (!res.ok) {
    const data = (await res.json().catch(() => null)) as ChestnyZnakCheckResponse | null;
    throw new Error(data?.error ?? `HTTP ${res.status}`);
  }

  const data = (await res.json()) as ChestnyZnakCheckResponse;
  if (typeof data.required !== 'boolean') {
    throw new Error('Некорректный ответ прокси Честный знак');
  }

  return data.required;
}

/**
 * Проверяет, подлежит ли товар маркировке Честный знак.
 * Стратегия: реальный запрос → при ошибке фолбэк по префиксу ТНВЭД.
 */
export async function checkChestnyZnak(tnvedCode: string): Promise<boolean> {
  const cached = cache.get(tnvedCode);
  if (cached && cached.expiresAt > Date.now()) return cached.value;

  try {
    const required = await checkChestnyZnakReal(tnvedCode);
    cache.set(tnvedCode, { value: required, expiresAt: Date.now() + TTL_MS });
    return required;
  } catch (e) {
    // При любой ошибке (CORS/CSRF/HTTP/парсинг) используем безопасный фолбэк.
    const fallback = checkChestnyZnakMock(tnvedCode);
    console.warn(`[Честный знак] ⚠️ реальная проверка упала, fallback:`, e);
    return fallback;
  }
}
