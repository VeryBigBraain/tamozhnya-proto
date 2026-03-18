// ─── Status Types ────────────────────────────────────────────────────────────

export type CertificateStatus = 'valid' | 'expired' | 'revoked' | 'unknown';

export type SGRStatus = 'required' | 'not_required' | 'ok' | 'unknown';

// ─── Metadata ─────────────────────────────────────────────────────────────────

export interface ProductMetadata {
  /** Результат проверки через Росаккредитацию (mock) */
  certificateStatus: CertificateStatus;
  /** Подлежит ли маркировке Честный знак (mock) */
  chestnyZnakStatus: boolean;
  /** Статус СГР (mock) */
  sgrStatus: SGRStatus;
}

// ─── Core Product ─────────────────────────────────────────────────────────────

export interface Product {
  id: string;
  /** base64 image string */
  image?: string;

  // Наименования
  chineseName: string;
  russianTranslation?: string;
  russianName: string;

  // Классификация
  category?: string;
  description?: string;

  // Количество и вес
  places?: number;
  quantity?: number;
  grossWeight?: number;

  // Справочные данные
  notes?: string;
  article?: string;
  model?: string;
  tnvedCode: string;
  marking?: string;
  trademark?: string;
  manufacturer?: string;

  // Документы
  ss?: string;
  ssValidUntil?: string;
  ds?: string;
  dsValidFrom?: string;
  dsValidUntil?: string;
  sgr?: string;

  // Флаги
  isFrontSeat?: boolean;

  // Вычисляемые статусы (автоматически пересчитываются при create/edit/import)
  metadata: ProductMetadata;
}

// Тип для создания/редактирования — без id и metadata (они вычисляются)
export type ProductFormValues = Omit<Product, 'id' | 'metadata'>;
