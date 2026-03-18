import type { SGRStatus } from '../types/product';

// MOCK: Замените на реальный API-вызов для проверки СГР
// TODO: Интегрировать с реестром Роспотребнадзора

/**
 * Коды ТНВЭД (первые 4 знака), для которых СГР уже имеется и действителен.
 */
const SGR_OK_CODES = new Set([
  '8703', // Автомобили легковые
  '8708', // Запчасти авто
]);

/**
 * Коды ТНВЭД, для которых СГР обязателен.
 */
const SGR_REQUIRED_CODES = new Set([
  '2106', // Пищевые продукты
  '2202', // Напитки безалкогольные
  '3304', // Косметика (парфюм, крем)
  '3401', // Мыло
  '3924', // Пластиковые изделия для стола
  '9401', // Сиденья
]);

/**
 * Проверяет необходимость СГР по коду ТНВЭД и названию товара.
 * @param tnvedCode - Код ТН ВЭД (10 знаков)
 * @param russianName - Русское наименование товара
 * @returns Статус СГР
 */
export function checkSGR(tnvedCode: string, russianName: string): SGRStatus {
  const prefix = tnvedCode.slice(0, 4);

  if (SGR_OK_CODES.has(prefix)) return 'ok';

  if (SGR_REQUIRED_CODES.has(prefix)) return 'required';

  // Дополнительная проверка по ключевым словам в названии
  const lowerName = russianName.toLowerCase();
  if (
    lowerName.includes('косметик') ||
    lowerName.includes('питани') ||
    lowerName.includes('продукт') ||
    lowerName.includes('крем') ||
    lowerName.includes('шампун') ||
    lowerName.includes('мыло')
  ) {
    return 'required';
  }

  return 'not_required';
}
