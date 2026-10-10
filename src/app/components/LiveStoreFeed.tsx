'use client';

import React, { useState, useEffect, useRef } from 'react';
import { createClient } from '@/lib/supabase/client';
import Link from 'next/link';
import { useLanguage } from '@/contexts/LanguageContext';


interface LiveUpdate {
  id: string;
  update_type: string;
  title: string;
  title_ar: string | null;
  body: string | null;
  body_ar: string | null;
  icon: string;
  color: string;
  link_url: string | null;
  link_label: string | null;
  status: string;
  display_order: number;
  created_at: string;
}

const COLOR_MAP: Record<string, { bg: string; text: string; border: string; dot: string }> = {
  emerald: { bg: 'bg-emerald-50', text: 'text-emerald-700', border: 'border-emerald-200', dot: 'bg-emerald-500' },
  blue: { bg: 'bg-blue-50', text: 'text-blue-700', border: 'border-blue-200', dot: 'bg-blue-500' },
  violet: { bg: 'bg-violet-50', text: 'text-violet-700', border: 'border-violet-200', dot: 'bg-violet-500' },
  sky: { bg: 'bg-sky-50', text: 'text-sky-700', border: 'border-sky-200', dot: 'bg-sky-500' },
  amber: { bg: 'bg-amber-50', text: 'text-amber-700', border: 'border-amber-200', dot: 'bg-amber-500' },
  rose: { bg: 'bg-rose-50', text: 'text-rose-700', border: 'border-rose-200', dot: 'bg-rose-500' },
  slate: { bg: 'bg-slate-50', text: 'text-slate-700', border: 'border-slate-200', dot: 'bg-slate-400' },
  red: { bg: 'bg-red-50', text: 'text-red-700', border: 'border-red-200', dot: 'bg-red-500' },
  teal: { bg: 'bg-teal-50', text: 'text-teal-700', border: 'border-teal-200', dot: 'bg-teal-500' },
};

export default function LiveStoreFeed() {
  const { dir, isRTL } = useLanguage();

  const supabase = createClient();
  const [updates, setUpdates] = useState<LiveUpdate[]>([]);
  const [loading, setLoading] = useState(true);
  const scrollRef = useRef<HTMLDivElement>(null);
  const [isPaused, setIsPaused] = useState(false);

  useEffect(() => {
    const fetchUpdates = async () => {
      const { data } = await supabase
        .from('platform_live_updates')
        .select('*')
        .eq('status', 'active')
        .order('display_order', { ascending: true })
        .order('created_at', { ascending: false })
        .limit(20);
      setUpdates(data || []);
      setLoading(false);
    };
    fetchUpdates();

    // Real-time subscription for data changes
    const channel = supabase
      .channel('live_updates_feed')
      .on('postgres_changes', { event: '*', schema: 'public', table: 'platform_live_updates' }, () => {
        fetchUpdates();
      })
      .subscribe();

    // Presence tracking subscription so users appear in the subscriber count
    const presenceChannel = supabase.channel('platform_live_updates', {
      config: { presence: { key: 'live_store_feed' } },
    });

    presenceChannel.subscribe(async (status) => {
      if (status === 'SUBSCRIBED') {
        await presenceChannel.track({ online_at: new Date().toISOString() });
      }
    });

    return () => {
      supabase.removeChannel(channel);
      supabase.removeChannel(presenceChannel);
    };
  }, [supabase]);

  // Auto-scroll
  useEffect(() => {
    if (!scrollRef.current || updates.length === 0 || isPaused) return;
    const el = scrollRef.current;
    let animFrame: number;
    let pos = 0;

    const scroll = () => {
      if (isPaused) return;
      pos += 0.5;
      if (pos >= el.scrollWidth / 2) pos = 0;
      el.scrollLeft = pos;
      animFrame = requestAnimationFrame(scroll);
    };
    animFrame = requestAnimationFrame(scroll);
    return () => cancelAnimationFrame(animFrame);
  }, [updates, isPaused]);

  if (loading || updates.length === 0) return null;

  // Duplicate for seamless loop
  const displayUpdates = [...updates, ...updates];

  return (
    <div className="bg-white border-b border-gray-100 py-2 overflow-hidden" dir={dir}>
      <div className="max-w-7xl mx-auto px-4 flex items-center gap-3">
        {/* Label */}
        <div className="flex items-center gap-1.5 flex-shrink-0">
          <span className="w-2 h-2 bg-emerald-500 rounded-full animate-pulse" />
          <span className="text-xs font-bold text-gray-700 whitespace-nowrap">مباشر</span>
        </div>
        <div className="w-px h-4 bg-gray-200 flex-shrink-0" />

        {/* Scrolling Feed */}
        <div
          ref={scrollRef}
          className="flex items-center gap-3 overflow-hidden flex-1"
          style={{ scrollBehavior: 'auto' }}
          onMouseEnter={() => setIsPaused(true)}
          onMouseLeave={() => setIsPaused(false)}
        >
          {displayUpdates.map((update, i) => {
            const colors = COLOR_MAP[update.color] || COLOR_MAP.blue;
            return (
              <div
                key={`${update.id}-${i}`}
                className={`flex items-center gap-2 px-3 py-1.5 rounded-full border text-xs font-medium whitespace-nowrap flex-shrink-0 ${colors.bg} ${colors.text} ${colors.border}`}
              >
                <span className={`w-1.5 h-1.5 rounded-full ${colors.dot}`} />
                <span>{update.title_ar || update.title}</span>
                {update.link_url && (
                  <Link href={update.link_url} className="underline opacity-70 hover:opacity-100">
                    {update.link_label || 'عرض'}
                  </Link>
                )}
              </div>
            );
          })}
        </div>
      </div>
    </div>
  );
}
