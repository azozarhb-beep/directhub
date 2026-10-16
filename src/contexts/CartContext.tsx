'use client';

import React, { createContext, useContext, useEffect, useState, useCallback } from 'react';
import { createClient } from '@/lib/supabase/client';
import { useAuth } from '@/contexts/AuthContext';

export interface CartItem {
  id: string;
  productId: string;
  name: string;
  nameAr: string;
  image: string;
  alt: string;
  price: number;
  currency: string;
  moq: string;
  moqNumber: number;
  quantity: number;
  supplier: string;
  countryFlag: string;
  verified: boolean;
  category: string;
  isRetailAvailable: boolean;
  retailPrice: number;
  shippingTerms?: string;
}

export type OrderMode = 'B2B' | 'B2C';

interface CartContextValue {
  items: CartItem[];
  loading: boolean;
  totalItems: number;
  subtotal: number;
  orderMode: OrderMode;
  vatAmount: number;
  orderTotal: number;
  addItem: (item: Omit<CartItem, 'id'>) => Promise<void>;
  removeItem: (productId: string) => Promise<void>;
  updateQuantity: (productId: string, quantity: number) => Promise<void>;
  clearCart: () => Promise<void>;
  isInCart: (productId: string) => boolean;
}

const CartContext = createContext<CartContextValue | null>(null);

export const useCart = () => {
  const ctx = useContext(CartContext);
  if (!ctx) throw new Error('useCart must be used within CartProvider');
  return ctx;
};

function parseMoqNumber(moq: string): number {
  if (!moq) return 1;
  const match = moq.match(/\d+/);
  return match ? parseInt(match[0], 10) : 1;
}

function dbRowToCartItem(row: any): CartItem {
  const moqStr = row.moq || '1';
  return {
    id: row.id,
    productId: row.product_id,
    name: row.product_name,
    nameAr: row.product_name_ar,
    image: row.image_url,
    alt: row.image_alt,
    price: Number(row.unit_price),
    currency: row.currency,
    moq: moqStr,
    moqNumber: parseMoqNumber(moqStr),
    quantity: row.quantity,
    supplier: row.supplier_name,
    countryFlag: row.supplier_country_flag,
    verified: row.is_verified,
    category: row.category,
    isRetailAvailable: row.is_retail_available ?? false,
    retailPrice: Number(row.retail_price ?? row.unit_price),
    shippingTerms: row.shipping_terms || 'CALCULATED_SHIPPING',
  };
}

function detectOrderMode(user: any): OrderMode {
  if (!user) return 'B2B';
  const meta = user.user_metadata || {};
  const app = user.app_metadata || {};
  const accountType = (meta.account_type || app.account_type || '').toLowerCase();
  const role = (meta.role || app.role || '').toLowerCase();
  // B2C: individual consumers
  if (accountType === 'individual' || accountType === 'consumer' || accountType === 'b2c') return 'B2C';
  // B2B: companies, factories, wholesale, suppliers, manufacturers, agents
  if (
    accountType === 'company' ||
    accountType === 'business' ||
    accountType === 'b2b' ||
    accountType === 'wholesale' ||
    role === 'seller' ||
    role === 'manufacturer' ||
    role === 'agent' ||
    role === 'supplier' ||
    role === 'logistics'
  ) return 'B2B';
  // Default: B2B (platform is primarily B2B)
  return 'B2B';
}

export const CartProvider = ({ children }: { children: React.ReactNode }) => {
  const { user } = useAuth();
  const [items, setItems] = useState<CartItem[]>([]);
  const [loading, setLoading] = useState(false);
  const supabase = createClient();

  const orderMode: OrderMode = detectOrderMode(user);

  const fetchCart = useCallback(async () => {
    if (!user) { setItems([]); return; }
    setLoading(true);
    try {
      const { data, error } = await supabase
        .from('cart_items')
        .select('*')
        .eq('user_id', user.id)
        .order('created_at', { ascending: true });
      if (!error && data) setItems(data.map(dbRowToCartItem));
    } catch {
      // silently fail
    } finally {
      setLoading(false);
    }
  }, [user]);

  useEffect(() => {
    fetchCart();
  }, [fetchCart]);

  const addItem = async (item: Omit<CartItem, 'id'>) => {
    if (!user) return;
    const { data, error } = await supabase
      .from('cart_items')
      .upsert(
        {
          user_id: user.id,
          product_id: item.productId,
          product_name: item.name,
          product_name_ar: item.nameAr,
          image_url: item.image,
          image_alt: item.alt,
          unit_price: item.price,
          currency: item.currency,
          moq: item.moq,
          quantity: item.quantity,
          supplier_name: item.supplier,
          supplier_country_flag: item.countryFlag,
          is_verified: item.verified,
          category: item.category,
          is_retail_available: item.isRetailAvailable,
          retail_price: item.retailPrice,
          shipping_terms: item.shippingTerms || 'CALCULATED_SHIPPING',
        },
        { onConflict: 'user_id,product_id' }
      )
      .select()
      .single();
    if (!error && data) {
      setItems((prev) => {
        const exists = prev.find((i) => i.productId === item.productId);
        if (exists) return prev.map((i) => (i.productId === item.productId ? dbRowToCartItem(data) : i));
        return [...prev, dbRowToCartItem(data)];
      });
    }
  };

  const removeItem = async (productId: string) => {
    if (!user) return;
    await supabase
      .from('cart_items')
      .delete()
      .eq('user_id', user.id)
      .eq('product_id', productId);
    setItems((prev) => prev.filter((i) => i.productId !== productId));
  };

  const updateQuantity = async (productId: string, quantity: number) => {
    if (!user || quantity < 1) return;
    await supabase
      .from('cart_items')
      .update({ quantity })
      .eq('user_id', user.id)
      .eq('product_id', productId);
    setItems((prev) =>
      prev.map((i) => (i.productId === productId ? { ...i, quantity } : i))
    );
  };

  const clearCart = async () => {
    if (!user) return;
    await supabase.from('cart_items').delete().eq('user_id', user.id);
    setItems([]);
  };

  const isInCart = (productId: string) => items.some((i) => i.productId === productId);

  const totalItems = items.reduce((s, i) => s + i.quantity, 0);

  // All prices are net factory/wholesale prices — no VAT for any order type
  const subtotal = items.reduce((s, i) => {
    const unitPrice = orderMode === 'B2C' && i.isRetailAvailable ? i.retailPrice : i.price;
    return s + unitPrice * i.quantity;
  }, 0);

  const vatAmount = 0;
  const orderTotal = subtotal;

  return (
    <CartContext.Provider value={{ items, loading, totalItems, subtotal, orderMode, vatAmount, orderTotal, addItem, removeItem, updateQuantity, clearCart, isInCart }}>
      {children}
    </CartContext.Provider>
  );
};
