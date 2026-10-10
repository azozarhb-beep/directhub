'use client';

import React, { useState, useEffect } from 'react';
import Icon from '@/components/ui/AppIcon';
import { createClient } from '@/lib/supabase/client';
import { useAuth } from '@/contexts/AuthContext';

interface WishlistButtonProps {
  itemType: 'product' | 'seller';
  productId?: string;
  sellerId?: string;
  size?: 'sm' | 'md';
  className?: string;
  showLabel?: boolean;
}

export default function WishlistButton({
  itemType,
  productId,
  sellerId,
  size = 'md',
  className = '',
  showLabel = false,
}: WishlistButtonProps) {
  const { user, requireAuth } = useAuth();
  const supabase = createClient();

  const [isSaved, setIsSaved] = useState(false);
  const [loading, setLoading] = useState(false);
  const [checked, setChecked] = useState(false);

  useEffect(() => {
    if (!user) { setChecked(true); return; }
    const checkWishlist = async () => {
      try {
        let query = supabase.from('wishlists').select('id').eq('user_id', user.id).eq('item_type', itemType);
        if (itemType === 'product' && productId) query = query.eq('product_id', productId);
        if (itemType === 'seller' && sellerId) query = query.eq('seller_id', sellerId);
        const { data } = await query.maybeSingle();
        setIsSaved(!!data);
      } finally {
        setChecked(true);
      }
    };
    checkWishlist();
  }, [user, productId, sellerId, itemType]);

  const performToggle = async () => {
    setLoading(true);
    try {
      if (isSaved) {
        let query = supabase.from('wishlists').delete().eq('user_id', user.id).eq('item_type', itemType);
        if (itemType === 'product' && productId) query = query.eq('product_id', productId);
        if (itemType === 'seller' && sellerId) query = query.eq('seller_id', sellerId);
        await query;
        setIsSaved(false);
      } else {
        const payload: any = { user_id: user.id, item_type: itemType };
        if (itemType === 'product' && productId) payload.product_id = productId;
        if (itemType === 'seller' && sellerId) payload.seller_id = sellerId;
        await supabase.from('wishlists').insert(payload);
        setIsSaved(true);
      }
    } finally {
      setLoading(false);
    }
  };

  const toggle = (e: React.MouseEvent) => {
    e.preventDefault();
    e.stopPropagation();
    // Use login-on-demand: show modal if not logged in, then run action
    requireAuth(
      () => performToggle(),
      'لحفظ هذا العنصر في قائمة المفضلة · To save to your wishlist'
    );
  };

  if (!checked) return null;

  const iconSize = size === 'sm' ? 14 : 18;
  const btnBase = size === 'sm' ?'w-8 h-8 rounded-full flex items-center justify-center transition-all' :'flex items-center gap-2 px-4 py-2 rounded-xl text-sm font-bold transition-all';

  return (
    <button
      onClick={toggle}
      disabled={loading}
      title={isSaved ? 'Remove from wishlist' : 'Save to wishlist'}
      className={`${btnBase} ${
        isSaved
          ? 'bg-red-50 text-red-500 hover:bg-red-100 border border-red-200' :'bg-muted text-muted-foreground hover:bg-red-50 hover:text-red-500 border border-border'
      } ${className}`}
    >
      {loading ? (
        <div className={`border-2 border-current border-t-transparent rounded-full animate-spin ${size === 'sm' ? 'w-3.5 h-3.5' : 'w-4 h-4'}`} />
      ) : (
        <Icon name="HeartIcon" size={iconSize} variant={isSaved ? 'solid' : 'outline'} />
      )}
      {showLabel && <span>{isSaved ? 'Saved' : 'Save'}</span>}
    </button>
  );
}
