'use client';

import { useEffect, useRef } from 'react';
import { createClient } from '@/lib/supabase/client';

interface UseRealtimeOrdersOptions {
  /** Unique channel name — must be different per dashboard instance */
  channelName: string;
  /** Column to filter on, e.g. 'factory_user_id', 'seller_id', 'user_id', 'logistics_partner_id' */
  filterColumn: string;
  /** The authenticated user's ID to filter orders */
  userId: string | undefined | null;
  /** Callback invoked whenever an order row changes */
  onOrderChange: () => void;
  /** Set to false to pause the subscription (e.g. while user is not authenticated) */
  enabled?: boolean;
}

/**
 * useRealtimeOrders
 * -----------------
 * Subscribes to real-time INSERT / UPDATE / DELETE events on the `orders` table
 * filtered by a specific column (e.g. factory_user_id, seller_id, user_id).
 * Calls `onOrderChange` whenever a matching row changes so the dashboard can
 * re-fetch its orders list and stay in sync across all open tabs / dashboards.
 */
export function useRealtimeOrders({
  channelName,
  filterColumn,
  userId,
  onOrderChange,
  enabled = true,
}: UseRealtimeOrdersOptions) {
  const supabase = createClient();
  // Keep a stable ref to the callback to avoid re-subscribing on every render
  const callbackRef = useRef(onOrderChange);
  callbackRef.current = onOrderChange;

  useEffect(() => {
    if (!enabled || !userId) return;

    const channel = supabase
      .channel(channelName)
      .on(
        'postgres_changes',
        {
          event: 'INSERT',
          schema: 'public',
          table: 'orders',
          filter: `${filterColumn}=eq.${userId}`,
        },
        () => { callbackRef.current(); }
      )
      .on(
        'postgres_changes',
        {
          event: 'UPDATE',
          schema: 'public',
          table: 'orders',
          filter: `${filterColumn}=eq.${userId}`,
        },
        () => { callbackRef.current(); }
      )
      .on(
        'postgres_changes',
        {
          event: 'DELETE',
          schema: 'public',
          table: 'orders',
          filter: `${filterColumn}=eq.${userId}`,
        },
        () => { callbackRef.current(); }
      )
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, [channelName, filterColumn, userId, enabled]);
}
