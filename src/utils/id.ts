/**
 * Генерирует уникальный ID на основе времени + случайного числа.
 * Для прототипа достаточно; в production использовать uuid или nanoid.
 */
export function generateId(): string {
  return `${Date.now()}-${Math.random().toString(36).slice(2, 9)}`;
}
