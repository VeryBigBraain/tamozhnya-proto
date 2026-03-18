import { createContext, useCallback, useContext, useEffect, useState } from 'react';
import type { ReactNode } from 'react';
import type { Product, ProductFormValues } from '../types/product';
import { computeMetadata } from '../services/statusService';
import { generateId } from '../utils/id';
import { MOCK_PRODUCTS } from '../utils/mockData';

// ─── Context Interface ────────────────────────────────────────────────────────

interface ProductContextValue {
  products: Product[];
  /** ID продуктов, у которых сейчас пересчитываются метаданные через API */
  loadingProductIds: Set<string>;
  getProduct: (id: string) => Product | undefined;
  addProduct: (values: ProductFormValues) => Promise<Product>;
  updateProduct: (id: string, values: ProductFormValues) => Promise<void>;
  deleteProduct: (id: string) => void;
  /** Заменяет все продукты (используется при импорте Excel) */
  replaceProducts: (products: Product[]) => void;
}

// ─── Context Creation ─────────────────────────────────────────────────────────

const ProductContext = createContext<ProductContextValue | null>(null);

// ─── Helpers ──────────────────────────────────────────────────────────────────

function addLoadingId(prev: Set<string>, id: string): Set<string> {
  const next = new Set(prev);
  next.add(id);
  return next;
}

function removeLoadingId(prev: Set<string>, id: string): Set<string> {
  const next = new Set(prev);
  next.delete(id);
  return next;
}

// ─── Provider ─────────────────────────────────────────────────────────────────

export function ProductProvider({ children }: { children: ReactNode }) {
  const [products, setProducts] = useState<Product[]>(MOCK_PRODUCTS);
  const [loadingProductIds, setLoadingProductIds] = useState<Set<string>>(
    () => new Set(MOCK_PRODUCTS.map((p) => p.id)),
  );

  // При монтировании обновляем метаданные мок-продуктов через реальный API
  useEffect(() => {
    let cancelled = false;
    Promise.all(
      MOCK_PRODUCTS.map(async (p) => {
        const metadata = await computeMetadata(p);
        return { id: p.id, metadata };
      }),
    ).then((updates) => {
      if (cancelled) return;
      setProducts((prev) =>
        prev.map((p) => {
          const upd = updates.find((u) => u.id === p.id);
          return upd ? { ...p, metadata: upd.metadata } : p;
        }),
      );
    }).catch((err) => {
      console.error('[ProductContext] Ошибка при начальной загрузке метаданных:', err);
    }).finally(() => {
      if (!cancelled) {
        setLoadingProductIds(new Set());
      }
    });
    return () => {
      cancelled = true;
    };
  }, []);

  const getProduct = (id: string): Product | undefined =>
    products.find((p) => p.id === id);

  const addProduct = useCallback(async (values: ProductFormValues): Promise<Product> => {
    const id = generateId();
    // Добавляем продукт сразу с синхронными mock-метаданными, затем пересчитываем
    const placeholderProduct: Product = {
      id,
      ...values,
      metadata: { certificateStatus: 'unknown', chestnyZnakStatus: false, sgrStatus: 'unknown' },
    };
    setProducts((prev) => [...prev, placeholderProduct]);
    setLoadingProductIds((prev) => addLoadingId(prev, id));

    try {
      const metadata = await computeMetadata(values);
      setProducts((prev) => prev.map((p) => (p.id === id ? { ...p, metadata } : p)));
    } finally {
      setLoadingProductIds((prev) => removeLoadingId(prev, id));
    }

    return { ...placeholderProduct };
  }, []);

  const updateProduct = useCallback(async (id: string, values: ProductFormValues): Promise<void> => {
    // Применяем новые значения полей немедленно, запускаем пересчёт метаданных
    setProducts((prev) => prev.map((p) => (p.id === id ? { ...p, ...values } : p)));
    setLoadingProductIds((prev) => addLoadingId(prev, id));

    try {
      const metadata = await computeMetadata(values);
      setProducts((prev) => prev.map((p) => (p.id === id ? { ...p, metadata } : p)));
    } finally {
      setLoadingProductIds((prev) => removeLoadingId(prev, id));
    }
  }, []);

  const deleteProduct = (id: string): void => {
    setProducts((prev) => prev.filter((p) => p.id !== id));
    setLoadingProductIds((prev) => removeLoadingId(prev, id));
  };

  const replaceProducts = (incoming: Product[]): void => {
    setProducts(incoming);
    setLoadingProductIds(new Set());
  };

  return (
    <ProductContext.Provider
      value={{ products, loadingProductIds, getProduct, addProduct, updateProduct, deleteProduct, replaceProducts }}
    >
      {children}
    </ProductContext.Provider>
  );
}

// ─── Hook ─────────────────────────────────────────────────────────────────────

// eslint-disable-next-line react-refresh/only-export-components
export function useProducts(): ProductContextValue {
  const ctx = useContext(ProductContext);
  if (!ctx) throw new Error('useProducts must be used inside <ProductProvider>');
  return ctx;
}
