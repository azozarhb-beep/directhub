'use client';

import React, { useState, useEffect, useCallback } from 'react';
import Icon from '@/components/ui/AppIcon';
import { createClient } from '@/lib/supabase/client';
import { useLanguage } from '@/contexts/LanguageContext';

// ── SSR-safe date formatter (no locale mismatch) ──────────────────────────────
function formatDateSafe(dateStr: string | null | undefined): string {
  if (!dateStr) return '—';
  const d = new Date(dateStr);
  if (isNaN(d.getTime())) return '—';
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, '0');
  const day = String(d.getDate()).padStart(2, '0');
  return `${y}-${m}-${day}`;
}

function formatDateTimeSafe(dateStr: string | null | undefined): string {
  if (!dateStr) return '—';
  const d = new Date(dateStr);
  if (isNaN(d.getTime())) return '—';
  const y = d.getFullYear();
  const mo = String(d.getMonth() + 1).padStart(2, '0');
  const day = String(d.getDate()).padStart(2, '0');
  const h = String(d.getHours()).padStart(2, '0');
  const min = String(d.getMinutes()).padStart(2, '0');
  return `${y}-${mo}-${day} ${h}:${min}`;
}

interface AmalConversation {
  id: string;
  session_id: string;
  user_id?: string;
  user_name?: string;
  user_email?: string;
  messages: Array<{ role: 'user' | 'assistant'; content: string; timestamp?: string }>;
  message_count: number;
  started_at: string;
  last_message_at: string;
  source_page?: string;
  language?: string;
}

export default function AmalLogsPanel() {
  const { t, dir, language, isRTL } = useLanguage();
  const ui = t.admin.amalLogs;

  const supabase = createClient();
  const [conversations, setConversations] = useState<AmalConversation[]>([]);
  const [loading, setLoading] = useState(true);
  const [selectedConv, setSelectedConv] = useState<AmalConversation | null>(null);
  const [searchQuery, setSearchQuery] = useState('');
  const [filterLanguage, setFilterLanguage] = useState<'all' | 'ar' | 'en' | 'zh' | 'tr'>('all');

  const fetchLogs = useCallback(async () => {
    setLoading(true);
    try {
      // Fetch from amal_conversations table if it exists, otherwise show demo structure
      const { data, error } = await supabase
        .from('amal_conversations')
        .select('*')
        .order('last_message_at', { ascending: false })
        .limit(100);

      if (error) {
        // Table may not exist yet — show empty state with guidance
        setConversations([]);
      } else {
        setConversations(data || []);
      }
    } catch {
      setConversations([]);
    } finally {
      setLoading(false);
    }
  }, [supabase]);

  useEffect(() => {
    fetchLogs();
  }, [fetchLogs]);

  const filtered = conversations.filter(conv => {
    const matchesSearch = !searchQuery ||
      (conv.user_name || '').toLowerCase().includes(searchQuery.toLowerCase()) ||
      (conv.user_email || '').toLowerCase().includes(searchQuery.toLowerCase()) ||
      (conv.session_id || '').toLowerCase().includes(searchQuery.toLowerCase()) ||
      conv.messages?.some(m => m.content.toLowerCase().includes(searchQuery.toLowerCase()));
    const matchesLang = filterLanguage === 'all' || conv.language === filterLanguage;
    return matchesSearch && matchesLang;
  });

  const totalMessages = conversations.reduce((sum, c) => sum + (c.message_count || c.messages?.length || 0), 0);

  return (
    <div className="space-y-5" dir={dir}>
      {/* Header */}
      <div className="bg-gradient-to-r from-orange-500 to-orange-700 rounded-2xl p-5 text-white">
        <div className="flex items-center gap-4">
          <div className="w-14 h-14 rounded-2xl bg-white/20 flex items-center justify-center shrink-0">
            <Icon name="ChatBubbleLeftEllipsisIcon" size={28} className="text-white" />
          </div>
          <div className="flex-1">
            <h2 className="text-lg font-bold">{ui.title}</h2>
            <p className="text-sm text-white/80">{ui.subtitle}</p>
          </div>
          <div className="text-right shrink-0">
            <p className="text-2xl font-bold">{conversations.length}</p>
            <p className="text-xs text-white/70">{totalMessages} رسالة إجمالية</p>
          </div>
        </div>
      </div>

      {/* Stats Row */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
        {[
          { label: ui.totalConversations, value: conversations.length, color: 'text-orange-600 bg-orange-50 border-orange-200' },
          { label: ui.totalMsgs, value: totalMessages, color: 'text-blue-600 bg-blue-50 border-blue-200' },
          { label: ui.registeredUsers, value: conversations.filter(c => c.user_id).length, color: 'text-emerald-600 bg-emerald-50 border-emerald-200' },
          { label: ui.anonymousVisitors, value: conversations.filter(c => !c.user_id).length, color: 'text-slate-600 bg-slate-50 border-slate-200' },
        ].map(stat => (
          <div key={stat.label} className={`rounded-xl border p-4 ${stat.color}`}>
            <p className="text-2xl font-bold">{stat.value}</p>
            <p className="text-xs font-medium mt-0.5">{stat.label}</p>
          </div>
        ))}
      </div>

      {/* Filters */}
      <div className="flex flex-col sm:flex-row gap-3">
        <div className="relative flex-1">
          <Icon name="MagnifyingGlassIcon" size={16} className="absolute top-1/2 -translate-y-1/2 right-3 text-muted-foreground" />
          <input
            type="text"
            value={searchQuery}
            onChange={e => setSearchQuery(e.target.value)}
            placeholder={ui.searchPlaceholder}
            className="w-full pr-9 pl-4 py-2.5 bg-background border border-border rounded-xl text-sm focus:outline-none focus:border-primary"
          />
        </div>
        <select
          value={filterLanguage}
          onChange={e => setFilterLanguage(e.target.value as any)}
          className="h-10 px-3 rounded-xl border border-border bg-background text-sm focus:outline-none focus:border-primary"
        >
          <option value="all">{ui.allLanguages}</option>
          <option value="ar">{ui.arabic}</option>
          <option value="en">English</option>
          <option value="zh">中文</option>
          <option value="tr">Türkçe</option>
        </select>
        <button
          onClick={fetchLogs}
          className="flex items-center gap-1.5 px-4 py-2.5 bg-orange-50 border border-orange-200 text-orange-700 rounded-xl text-sm font-semibold hover:bg-orange-100 transition-colors"
        >
          <Icon name="ArrowPathIcon" size={15} />
          تحديث
        </button>
      </div>

      {/* Conversations List */}
      <div className="bg-card border border-border rounded-xl overflow-hidden">
        <div className="flex items-center justify-between px-5 py-3 border-b border-border bg-muted/30">
          <div className="flex items-center gap-2">
            <Icon name="QueueListIcon" size={16} className="text-orange-600" />
            <h3 className="font-semibold text-foreground text-sm">{ui.logTitle}</h3>
            <span className="text-xs text-muted-foreground">({filtered.length})</span>
          </div>
        </div>

        {loading ? (
          <div className="flex items-center justify-center py-16">
            <div className="w-8 h-8 border-2 border-orange-500 border-t-transparent rounded-full animate-spin" />
          </div>
        ) : filtered.length === 0 ? (
          <div className="flex flex-col items-center justify-center py-16 gap-3">
            <div className="w-16 h-16 rounded-2xl bg-orange-50 flex items-center justify-center">
              <Icon name="ChatBubbleLeftEllipsisIcon" size={32} className="text-orange-300" />
            </div>
            <div className="text-center">
              <p className="font-semibold text-foreground">لا توجد محادثات مسجلة بعد</p>
              <p className="text-sm text-muted-foreground mt-1">
                {conversations.length === 0
                  ? 'سيتم عرض محادثات أمل هنا تلقائياً عند تفعيل نظام تسجيل المحادثات' :'لا توجد نتائج تطابق بحثك'}
              </p>
            </div>
            {conversations.length === 0 && (
              <div className="bg-amber-50 border border-amber-200 rounded-xl p-4 max-w-md text-center">
                <p className="text-xs text-amber-700 font-semibold mb-1">ملاحظة للمطور</p>
                <p className="text-xs text-amber-600">
                  لتفعيل تسجيل المحادثات، أنشئ جدول <code className="bg-amber-100 px-1 rounded">amal_conversations</code> في قاعدة البيانات مع حقول: session_id, user_id, messages (jsonb), language, source_page, started_at, last_message_at
                </p>
              </div>
            )}
          </div>
        ) : (
          <div className="divide-y divide-border">
            {filtered.map(conv => (
              <div
                key={conv.id}
                className="flex items-start gap-3 px-5 py-4 hover:bg-muted/20 transition-colors cursor-pointer"
                onClick={() => setSelectedConv(conv)}
              >
                {/* Avatar */}
                <div className="w-10 h-10 rounded-full bg-orange-100 flex items-center justify-center shrink-0">
                  <Icon name="UserCircleIcon" size={22} className="text-orange-500" />
                </div>

                {/* Content */}
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2 mb-0.5">
                    <p className="font-semibold text-foreground text-sm truncate">
                      {conv.user_name || conv.user_email || 'زائر مجهول'}
                    </p>
                    {conv.language && (
                      <span className="text-[10px] px-1.5 py-0.5 bg-muted rounded-full text-muted-foreground uppercase">
                        {conv.language}
                      </span>
                    )}
                    {conv.user_id && (
                      <span className="text-[10px] px-1.5 py-0.5 bg-emerald-50 text-emerald-700 rounded-full border border-emerald-200">
                        مسجل
                      </span>
                    )}
                  </div>
                  {conv.messages?.[conv.messages.length - 1] && (
                    <p className="text-xs text-muted-foreground truncate">
                      {conv.messages[conv.messages.length - 1].role === 'user' ? '👤 ' : '🤖 '}
                      {conv.messages[conv.messages.length - 1].content}
                    </p>
                  )}
                  {conv.source_page && (
                    <p className="text-[10px] text-muted-foreground mt-0.5">📍 {conv.source_page}</p>
                  )}
                </div>

                {/* Meta */}
                <div className="text-right shrink-0">
                  <p className="text-xs text-muted-foreground">
                    {conv.last_message_at ? formatDateSafe(conv.last_message_at) : '—'}
                  </p>
                  <span className="text-[10px] px-2 py-0.5 bg-orange-50 text-orange-700 rounded-full border border-orange-200 font-semibold">
                    {conv.message_count || conv.messages?.length || 0} رسالة
                  </span>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>

      {/* Conversation Detail Modal */}
      {selectedConv && (
        <div className="fixed inset-0 z-50 bg-black/50 flex items-center justify-center p-4" onClick={() => setSelectedConv(null)}>
          <div
            className="bg-card border border-border rounded-2xl shadow-2xl w-full max-w-lg max-h-[85vh] flex flex-col"
            onClick={e => e.stopPropagation()}
            dir={dir}
          >
            <div className="flex items-center justify-between px-5 py-4 border-b border-border">
              <div>
                <h3 className="font-bold text-foreground">
                  {selectedConv.user_name || selectedConv.user_email || 'زائر مجهول'}
                </h3>
                <p className="text-xs text-muted-foreground mt-0.5">
                  {selectedConv.started_at ? formatDateSafe(selectedConv.started_at) : '—'}
                  {selectedConv.source_page && ` · ${selectedConv.source_page}`}
                </p>
              </div>
              <button onClick={() => setSelectedConv(null)} className="w-8 h-8 rounded-lg hover:bg-muted flex items-center justify-center">
                <Icon name="XMarkIcon" size={16} className="text-muted-foreground" />
              </button>
            </div>
            <div className="flex-1 overflow-y-auto p-4 space-y-3">
              {selectedConv.messages?.length > 0 ? (
                selectedConv.messages.map((msg, idx) => (
                  <div key={idx} className={`flex gap-2 ${msg.role === 'user' ? 'justify-end' : 'justify-start'}`}>
                    {msg.role === 'assistant' && (
                      <div className="w-7 h-7 rounded-full bg-orange-100 flex items-center justify-center shrink-0 mt-0.5">
                        <span className="text-xs">🤖</span>
                      </div>
                    )}
                    <div className={`max-w-[80%] px-3 py-2 rounded-xl text-sm ${
                      msg.role === 'user' ?'bg-primary text-primary-foreground rounded-tr-none' :'bg-muted text-foreground rounded-tl-none'
                    }`}>
                      {msg.content}
                    </div>
                    {msg.role === 'user' && (
                      <div className="w-7 h-7 rounded-full bg-blue-100 flex items-center justify-center shrink-0 mt-0.5">
                        <span className="text-xs">👤</span>
                      </div>
                    )}
                  </div>
                ))
              ) : (
                <p className="text-center text-sm text-muted-foreground py-8">لا توجد رسائل مسجلة</p>
              )}
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
