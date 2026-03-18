import type { Product, ProductFormValues } from '../types/product';
import { computeMetadataSync } from '../services/statusService';
import { generateId } from './id';
import kreslo from '../assets/kreslo.jpeg';
import kyrtka from '../assets/kyrtka.jpeg';
import arom from '../assets/arom.jpeg';
import krem from '../assets/krem.jpeg';
import sviter from '../assets/sviter.jpeg';

/** Вспомогательная функция: строит Product из FormValues + автогенерирует id и metadata */
function makeProduct(values: ProductFormValues): Product {
  return {
    id: generateId(),
    ...values,
    metadata: computeMetadataSync(values),
  };
}

/**
 * Начальные демо-данные для прототипа.
 * TODO: Заменить загрузкой с сервера при старте приложения.
 */
export const MOCK_PRODUCTS: Product[] = [
  makeProduct({
    image: kreslo,
    chineseName: '汽车儿童安全座椅',
    russianTranslation: 'Детское автомобильное кресло',
    russianName: 'Кресло автомобильное детское SafeRide Pro',
    category: 'Детские товары / Автотовары',
    description: 'Детское автокресло (0–18 кг), крепление ремнём безопасности',
    tnvedCode: '8212200000',
    article: 'ART-001',
    model: 'SafeRide Pro',
    places: 10,
    quantity: 100,
    grossWeight: 250,
    marking: 'EAC',
    trademark: 'SafeRide',
    manufacturer: 'Guangzhou Auto Parts Co., Ltd.',
    isFrontSeat: true,
    ss: 'ЕАЭС RU С-RU.НК79.В.00026/26',
    ssValidUntil: '2031-03-17',
    notes: 'Возрастная группа 0-18 кг',
  }),

  makeProduct({
    image: kyrtka,
    chineseName: '男士运动夹克',
    russianTranslation: 'Мужская спортивная куртка',
    russianName: 'Куртка спортивная мужская SportFlex',
    category: 'Одежда / Спорт',
    description: 'Мужская куртка для активного отдыха, синтетика, демисезон',
    tnvedCode: '6203410000',
    article: 'ART-002',
    model: 'SportFlex M-500',
    places: 5,
    quantity: 500,
    grossWeight: 150,
    marking: 'EAC',
    trademark: 'SportFlex',
    manufacturer: 'Beijing Textile Industry Co.',
    isFrontSeat: false,
    ds: 'ДС-2023-002',
    dsValidFrom: '2023-06-01',
    dsValidUntil: '2026-05-31',
  }),

  makeProduct({
    image: arom,
    chineseName: '汽车前减震器',
    russianTranslation: 'Передний амортизатор автомобиля',
    russianName: 'Амортизатор передний ShockMax',
    category: 'Автозапчасти / Подвеска',
    description: 'Передний амортизатор, аналог OEM, применимость: Toyota Camry V50/V55',
    tnvedCode: '8708800000',
    article: 'ART-003',
    model: 'ShockMax X200',
    places: 20,
    quantity: 200,
    grossWeight: 400,
    marking: 'EAC',
    trademark: 'ShockMax',
    manufacturer: 'Shanghai Auto Works Manufacturing',
    isFrontSeat: false,
    ss: 'ЕАЭС RU С-DE.АЯ46.В.46655/26',
    ssValidUntil: '2025-06-30',
    notes: 'Подходит для Toyota Camry V50, V55',
  }),

  makeProduct({
    image: krem,
    chineseName: '玻尿酸面霜',
    russianTranslation: 'Крем с гиалуроновой кислотой',
    russianName: 'Крем для лица с гиалуроновой кислотой HyaluMax',
    category: 'Косметика / Уход за лицом',
    description: 'Увлажняющий крем, 50 мл, с гиалуроновой кислотой',
    tnvedCode: '3304990000',
    article: 'ART-004',
    model: 'HyaluMax Ultra',
    places: 50,
    quantity: 1000,
    grossWeight: 300,
    marking: 'EAC',
    trademark: 'HyaluMax',
    manufacturer: 'Shenzhen Beauty Cosmetics Co.',
    isFrontSeat: false,
    notes: '50 мл, для всех типов кожи',
  }),

  makeProduct({
    image: sviter,
    chineseName: '女式针织毛衣',
    russianTranslation: 'Женский вязаный свитер',
    russianName: 'Свитер женский трикотажный',
    category: 'Одежда / Женская',
    description: 'Женский трикотажный свитер, базовая модель, повседневный',
    tnvedCode: '6110200000',
    article: 'ART-005',
    model: 'KnitWear W-200',
    places: 8,
    quantity: 300,
    grossWeight: 180,
    marking: 'EAC',
    trademark: 'KnitWear',
    manufacturer: 'Hangzhou Textile Factory',
    isFrontSeat: false,
    ds: 'ДС-2023-005',
    dsValidFrom: '2023-01-01',
    dsValidUntil: '2025-12-31',
  }),
];
