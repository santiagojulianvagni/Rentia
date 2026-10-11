import { BarChart3, Megaphone, Package, Wallet, type LucideIcon } from 'lucide-react';

export type ProductKind = 'profit' | 'products' | 'inventory' | 'ads';

export const productIcons: Record<ProductKind, LucideIcon> = {
  profit: Wallet,
  products: BarChart3,
  inventory: Package,
  ads: Megaphone,
};
