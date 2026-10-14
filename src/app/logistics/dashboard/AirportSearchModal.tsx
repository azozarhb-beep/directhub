'use client';

import React, { useEffect, useMemo, useRef, useState } from 'react';
import Icon from '@/components/ui/AppIcon';
import { AirportOption, filterAirports } from './airportData';

interface AirportSearchModalProps {
  title: string;
  placeholder: string;
  airports: AirportOption[];
  value: string;
  onSelect: (value: string) => void;
  onClear?: () => void;
}

export default function AirportSearchModal({
  title,
  placeholder,
  airports,
  value,
  onSelect,
  onClear,
}: AirportSearchModalProps) {
  const [open, setOpen] = useState(false);
  const [query, setQuery] = useState('');
  const inputRef = useRef<HTMLInputElement>(null);

  const selected = useMemo(
    () => airports.find(ap => ap.value === value) || null,
    [airports, value]
  );

  const filtered = useMemo(() => filterAirports(airports, query), [airports, query]);

  const grouped = useMemo(() => {
    const map = new Map<string, AirportOption[]>();
    filtered.forEach(ap => {
      const list = map.get(ap.region) || [];
      list.push(ap);
      map.set(ap.region, list);
    });
    return Array.from(map.entries());
  }, [filtered]);

  useEffect(() => {
    if (open) {
      const t = setTimeout(() => inputRef.current?.focus(), 50);
      const prev = document.body.style.overflow;
      document.body.style.overflow = 'hidden';
      return () => {
        clearTimeout(t);
        document.body.style.overflow = prev;
      };
    }
    setQuery('');
    return undefined;
  }, [open]);

  useEffect(() => {
    if (!open) return undefined;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') setOpen(false);
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [open]);

  const handlePick = (ap: AirportOption) => {
    onSelect(ap.value);
    setOpen(false);
  };

  return (
    <>
      <button
        type="button"
        onClick={() => setOpen(true)}
        className="w-full px-3 py-2.5 rounded-xl border border-border bg-background text-sm text-start flex items-center justify-between gap-2 focus:outline-none focus:ring-2 focus:ring-primary/30 hover:border-primary/50 transition-colors"
      >
        {selected ? (
          <span className="flex items-center gap-2 min-w-0">
            <span className="font-mono text-xs font-bold bg-primary/10 text-primary px-1.5 py-0.5 rounded">
              {selected.iata}
            </span>
            <span className="truncate text-foreground">
              {selected.label} — {selected.labelAr}
            </span>
          </span>
        ) : (
          <span className="text-muted-foreground">{placeholder}</span>
        )}
        <span className="flex items-center gap-1 shrink-0">
          {selected && onClear && (
            <span
              role="button"
              tabIndex={0}
              aria-label="مسح الاختيار"
              onClick={e => {
                e.stopPropagation();
                onClear();
              }}
              onKeyDown={e => {
                if (e.key === 'Enter') {
                  e.stopPropagation();
                  onClear();
                }
              }}
              className="text-muted-foreground hover:text-red-500 px-1"
            >
              ✕
            </span>
          )}
          <Icon name="MagnifyingGlassIcon" size={16} className="text-muted-foreground" />
        </span>
      </button>

      {open && (
        <div
          className="fixed inset-0 z-[120] flex items-end sm:items-center justify-center bg-black/50 p-0 sm:p-4"
          onClick={() => setOpen(false)}
          role="dialog"
          aria-modal="true"
          aria-label={title}
        >
          <div
            className="bg-background w-full sm:max-w-lg rounded-t-2xl sm:rounded-2xl shadow-2xl border border-border flex flex-col max-h-[85vh]"
            onClick={e => e.stopPropagation()}
            dir="rtl"
          >
            <div className="flex items-center justify-between px-4 pt-4 pb-2">
              <h3 className="font-bold text-foreground text-base">✈️ {title}</h3>
              <button
                type="button"
                onClick={() => setOpen(false)}
                className="w-8 h-8 rounded-full hover:bg-muted flex items-center justify-center text-muted-foreground"
                aria-label="إغلاق"
              >
                ✕
              </button>
            </div>

            <div className="px-4 pb-3">
              <div className="relative">
                <span className="absolute top-1/2 -translate-y-1/2 right-3 text-muted-foreground pointer-events-none">
                  <Icon name="MagnifyingGlassIcon" size={16} />
                </span>
                <input
                  ref={inputRef}
                  type="text"
                  value={query}
                  onChange={e => setQuery(e.target.value)}
                  placeholder="ابحث بالمدينة أو اسم المطار أو رمز IATA... (Search city, airport, IATA)"
                  className="w-full pr-9 pl-3 py-2.5 rounded-xl border border-border bg-background text-sm focus:outline-none focus:ring-2 focus:ring-primary/30"
                />
              </div>
              <p className="text-[11px] text-muted-foreground mt-1.5">
                {filtered.length} نتيجة — اكتب حرفين على الأقل لتصفية فورية
              </p>
            </div>

            <div className="overflow-y-auto px-2 pb-4 flex-1">
              {grouped.length === 0 ? (
                <div className="text-center text-sm text-muted-foreground py-10">
                  لا توجد مطارات مطابقة للبحث
                </div>
              ) : (
                grouped.map(([region, items]) => (
                  <div key={region} className="mb-2">
                    <p className="sticky top-0 bg-muted/80 backdrop-blur px-3 py-1.5 text-[11px] font-bold text-muted-foreground rounded-lg">
                      {region}
                    </p>
                    <ul>
                      {items.map(ap => (
                        <li key={ap.value}>
                          <button
                            type="button"
                            onClick={() => handlePick(ap)}
                            className={`w-full flex items-center gap-3 px-3 py-2.5 rounded-lg text-start hover:bg-primary/5 transition-colors ${
                              ap.value === value ? 'bg-primary/10' : ''
                            }`}
                          >
                            <span className="font-mono text-xs font-bold bg-primary/10 text-primary px-2 py-1 rounded min-w-[44px] text-center">
                              {ap.iata}
                            </span>
                            <span className="flex-1 min-w-0">
                              <span className="block text-sm text-foreground truncate">{ap.labelAr}</span>
                              <span className="block text-xs text-muted-foreground truncate" dir="ltr">
                                {ap.label}
                              </span>
                            </span>
                            {ap.value === value && <span className="text-primary text-sm">✓</span>}
                          </button>
                        </li>
                      ))}
                    </ul>
                  </div>
                ))
              )}
            </div>
          </div>
        </div>
      )}
    </>
  );
}
