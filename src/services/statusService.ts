import type { ProductFormValues, ProductMetadata } from '../types/product';
import { checkCertificate, checkCertificateMock } from './rosaccreditation';
import { checkChestnyZnak, checkChestnyZnakMock } from './chestnyZnak';
import { checkSGR } from './sgr';

// ─── Sync (mock-only) ─────────────────────────────────────────────────────────

/**
 * Синхронная версия на основе только моков.
 * Используется исключительно для начальных демо-данных (mockData.ts),
 * где async невозможен на уровне модуля.
 */
export function computeMetadataSync(values: ProductFormValues): ProductMetadata {
  return {
    certificateStatus: checkCertificateMock(values.tnvedCode),
    chestnyZnakStatus: checkChestnyZnakMock(values.tnvedCode),
    sgrStatus: checkSGR(values.tnvedCode, values.russianName ?? ''),
  };
}

// ─── Async (real API + mock fallback) ─────────────────────────────────────────

/**
 * Вычисляет metadata товара.
 * Проверка сертификата идёт через ФГИС Росаккредитации (реальный API),
 * при недоступности — фолбэк на мок по коду ТНВЭД.
 *
 * Вызывается при создании, редактировании и импорте товаров.
 */
export async function computeMetadata(values: ProductFormValues): Promise<ProductMetadata> {
  return {
    certificateStatus: await checkCertificate({
      tnvedCode: values.tnvedCode,
      ss: values.ss,
      ds: values.ds,
    }),
    chestnyZnakStatus: await checkChestnyZnak(values.tnvedCode),
    sgrStatus: checkSGR(values.tnvedCode, values.russianName ?? ''),
  };
}
