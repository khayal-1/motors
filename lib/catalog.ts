export type PublicMotorcycle = {
  id: string;
  stock_code: string;
  brand: string;
  model: string;
  year: number;
  color: string | null;
  engine_cc: number | null;
  engine_type: string | null;
  price: number | string;
  description: string;
  status: 'Available' | 'Coming Soon';
  created_at: string;
};

/** Restrict free-text terms before composing PostgREST's OR filter expression. */
export function sanitizeCatalogSearch(value: string): string {
  return value
    .normalize('NFKC')
    .replace(/[^\p{L}\p{N}\s-]/gu, ' ')
    .trim()
    .replace(/\s+/g, ' ')
    .slice(0, 80);
}

export function formatPrice(value: number | string): string {
  const price = Number(value);
  if (!Number.isFinite(price) || price < 0) return 'السعر عند التواصل';
  return new Intl.NumberFormat('ar-EG', {
    style: 'currency',
    currency: 'EGP',
    maximumFractionDigits: 0,
  }).format(price);
}

export function formatMotorcycleStatus(status: PublicMotorcycle['status']): string {
  return status === 'Coming Soon' ? 'قريبًا' : 'متاحة';
}
