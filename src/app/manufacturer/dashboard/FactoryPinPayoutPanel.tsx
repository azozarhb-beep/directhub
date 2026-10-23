'use client';

import React, { useEffect, useState } from 'react';
import { PinSetupCard } from '@/components/PinSecurity';
import FactoryPayoutSection from './FactoryPayoutSection';
import { createClient } from '@/lib/supabase/client';

interface FactoryPinPayoutPanelProps {
  userId: string;
}

export default function FactoryPinPayoutPanel({ userId }: FactoryPinPayoutPanelProps) {
  const [hasPinSet, setHasPinSet] = useState(false);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let cancelled = false;
    const loadPin = async () => {
      try {
        const supabase = createClient();
        const { data } = await supabase
          .from('user_profiles')
          .select('transaction_pin_hash')
          .eq('id', userId)
          .maybeSingle();
        if (!cancelled) setHasPinSet(!!data?.transaction_pin_hash);
      } catch {
        if (!cancelled) setHasPinSet(false);
      } finally {
        if (!cancelled) setLoading(false);
      }
    };
    loadPin();
    return () => {
      cancelled = true;
    };
  }, [userId]);

  if (loading) {
    return <div className="h-40 bg-muted/40 rounded-2xl animate-pulse mb-6" />;
  }

  return (
    <div className="grid grid-cols-1 lg:grid-cols-2 gap-5 mb-6">
      <div className="flex flex-col gap-4">
        <PinSetupCard hasPinSet={hasPinSet} onPinSet={() => setHasPinSet(true)} />
      </div>
      <div className="flex flex-col gap-4">
        <FactoryPayoutSection userId={userId} hasPinSet={hasPinSet} />
      </div>
    </div>
  );
}
