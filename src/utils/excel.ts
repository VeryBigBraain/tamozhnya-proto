import * as XLSX from 'xlsx';
import type { Product } from '../types/product';
import { computeMetadata } from '../services/statusService';
import { generateId } from './id';

// ─── Column Headers Mapping ───────────────────────────────────────────────────

/** Маппинг полей Product → заголовки колонок Excel */
const HEADERS: Record<keyof Omit<Product, 'id' | 'image' | 'metadata'>, string> = {
  chineseName: 'Китайское название',
  russianTranslation: 'Русский перевод',
  russianName: 'Наименование',
  category: 'Категория',
  description: 'Описание',
  tnvedCode: 'Код ТНВЭД',
  article: 'Артикул',
  model: 'Модель',
  places: 'Мест',
  quantity: 'Количество',
  grossWeight: 'Вес брутто (кг)',
  notes: 'Примечания',
  marking: 'Маркировка',
  trademark: 'Торговая марка',
  manufacturer: 'Производитель',
  ss: 'СС (номер)',
  ssValidUntil: 'СС действует до',
  ds: 'ДС (номер)',
  dsValidFrom: 'ДС действует с',
  dsValidUntil: 'ДС действует до',
  sgr: 'СГР (номер)',
  isFrontSeat: 'На переднем сиденье',
};

// ─── Export ───────────────────────────────────────────────────────────────────

/**
 * Экспортирует массив товаров в файл Excel (.xlsx).
 */
export function exportToExcel(products: Product[], fileName = 'товары.xlsx'): void {
  const rows = products.map((p) => ({
    ID: p.id,
    [HEADERS.chineseName]: p.chineseName,
    [HEADERS.russianTranslation]: p.russianTranslation ?? '',
    [HEADERS.russianName]: p.russianName,
    [HEADERS.category]: p.category ?? '',
    [HEADERS.description]: p.description ?? '',
    [HEADERS.tnvedCode]: p.tnvedCode,
    [HEADERS.article]: p.article ?? '',
    [HEADERS.model]: p.model ?? '',
    [HEADERS.places]: p.places ?? '',
    [HEADERS.quantity]: p.quantity ?? '',
    [HEADERS.grossWeight]: p.grossWeight ?? '',
    [HEADERS.notes]: p.notes ?? '',
    [HEADERS.marking]: p.marking ?? '',
    [HEADERS.trademark]: p.trademark ?? '',
    [HEADERS.manufacturer]: p.manufacturer ?? '',
    [HEADERS.ss]: p.ss ?? '',
    [HEADERS.ssValidUntil]: p.ssValidUntil ?? '',
    [HEADERS.ds]: p.ds ?? '',
    [HEADERS.dsValidFrom]: p.dsValidFrom ?? '',
    [HEADERS.dsValidUntil]: p.dsValidUntil ?? '',
    [HEADERS.sgr]: p.sgr ?? '',
    [HEADERS.isFrontSeat]: p.isFrontSeat ? 'Да' : 'Нет',
    'Статус сертификата': p.metadata.certificateStatus,
    'Честный знак': p.metadata.chestnyZnakStatus ? 'Да' : 'Нет',
    'Статус СГР': p.metadata.sgrStatus,
  }));

  const worksheet = XLSX.utils.json_to_sheet(rows);
  const workbook = XLSX.utils.book_new();
  XLSX.utils.book_append_sheet(workbook, worksheet, 'Товары');
  XLSX.writeFile(workbook, fileName);
}

// ─── Import ───────────────────────────────────────────────────────────────────

/**
 * Парсит файл Excel и возвращает массив Product с пересчитанными статусами.
 *
 * Ожидаемая структура файла: те же заголовки, что и при экспорте.
 * Изображения при импорте не поддерживаются (TODO: поддержка вложений).
 */
export function importFromExcel(file: File): Promise<Product[]> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();

    reader.onload = (event) => {
      try {
        const raw = event.target?.result;
        if (!raw) throw new Error('Файл не удалось прочитать');

        const workbook = XLSX.read(raw, { type: 'binary' });
        const sheetName = workbook.SheetNames[0];
        const worksheet = workbook.Sheets[sheetName];
        const rows = XLSX.utils.sheet_to_json<Record<string, unknown>>(worksheet);

        const productPromises = rows.map(async (row) => {
          const str = (key: string) => String(row[key] ?? '').trim();
          const num = (key: string) => {
            const v = Number(row[key]);
            return isNaN(v) || v === 0 ? undefined : v;
          };

          const formValues = {
            chineseName: str(HEADERS.chineseName),
            russianTranslation: str(HEADERS.russianTranslation) || undefined,
            russianName: str(HEADERS.russianName),
            category: str(HEADERS.category) || undefined,
            description: str(HEADERS.description) || undefined,
            tnvedCode: str(HEADERS.tnvedCode),
            article: str(HEADERS.article) || undefined,
            model: str(HEADERS.model) || undefined,
            places: num(HEADERS.places),
            quantity: num(HEADERS.quantity),
            grossWeight: num(HEADERS.grossWeight),
            notes: str(HEADERS.notes) || undefined,
            marking: str(HEADERS.marking) || undefined,
            trademark: str(HEADERS.trademark) || undefined,
            manufacturer: str(HEADERS.manufacturer) || undefined,
            ss: str(HEADERS.ss) || undefined,
            ssValidUntil: str(HEADERS.ssValidUntil) || undefined,
            ds: str(HEADERS.ds) || undefined,
            dsValidFrom: str(HEADERS.dsValidFrom) || undefined,
            dsValidUntil: str(HEADERS.dsValidUntil) || undefined,
            sgr: str(HEADERS.sgr) || undefined,
            isFrontSeat: false, // не импортируется — задаётся вручную после импорта
          };

          return {
            ...formValues,
            id: str('ID') || generateId(),
            metadata: await computeMetadata(formValues),
          };
        });

        Promise.all(productPromises).then(resolve).catch(reject);
      } catch (error) {
        reject(error);
      }
    };

    reader.onerror = () => reject(new Error('Ошибка чтения файла'));
    reader.readAsBinaryString(file);
  });
}
