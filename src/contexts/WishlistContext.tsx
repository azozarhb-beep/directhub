'use client';

import React, { createContext, useContext, useEffect, useState, useCallback } from 'react';
import { createClient } from '@/lib/supabase/client';
import { useAuth } from '@/contexts/AuthContext';

interface WishlistContextValue {
  wishlistCount: number;
  loading: boolean;
  refreshWishlist: () => Promise<void>;
}

const WishlistContext = createContext<WishlistContextValue | null>(null);

export const useWishlist = () => {
  const ctx = useContext(WishlistContext);
  if (!ctx) throw new Error('useWishlist must be used within WishlistProvider');
  return ctx;
};

export const WishlistProvider = ({ children }: { children: React.ReactNode }) => {
  const { user } = useAuth();
  const [wishlistCount, setWishlistCount] = useState(0);
  const [loading, setLoading] = useState(false);
  const supabase = createClient();

  const fetchWishlistCount = useCallback(async () => {
    if (!user) { setWishlistCount(0); return; }
    setLoading(true);
    try {
      const { count, error } = await supabase
        .from('wishlists')
        .select('*', { count: 'exact', head: true })
        .eq('user_id', user.id);
      if (!error) setWishlistCount(count || 0);
    } catch {
      // silently fail
    } finally {
      setLoading(false);
    }
  }, [user]);

  useEffect(() => {
    fetchWishlistCount();
  }, [fetchWishlistCount]);

  return (
    <WishlistContext.Provider value={{ wishlistCount, loading, refreshWishlist: fetchWishlistCount }}>
      {children}
    </WishlistContext.Provider>
  );
};
