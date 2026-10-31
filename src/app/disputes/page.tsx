'use client';

import React, { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { useAuth } from '@/contexts/AuthContext';
import { createClient } from '@/lib/supabase/client';
import Header from '@/components/Header';
import BottomNav from '@/components/BottomNav';
import Icon from '@/components/ui/AppIcon';
import { useLanguage } from '@/contexts/LanguageContext';

interface Dispute {
  id: string;
  order_id: string;
  buyer_id: string;
  factory_id: string | null;
  reason: string;
  description: string | null;
  status: string;
  tier: number;
  escrow_frozen: boolean;
  opened_at: string;
  factory_resolution_type: string | null;
  factory_resolution_note: string | null;
  factory_resolved_at: string | null;
  buyer_response: string | null;
  buyer_responded_at: string | null;
  escalated_at: string | null;
  resolved_at: string | null;
  resolution_note: string | null;
  orders?: {
    order_number: string;
    total: number;
    status: string;
    escrow_status: string | null;
    dispute_status: string | null;
  };
  buyer_profile?: { full_name: string; email: string; company_name: string };
  factory_profile?: { full_name: string; email: string; company_name: string };
}

const STATUS_META: Record<string, { color: string; icon: string }> = {
  open: { color: 'bg-amber-50 text-amber-700 border-amber-200', icon: 'ExclamationCircleIcon' },
  factory_reviewing: { color: 'bg-blue-50 text-blue-700 border-blue-200', icon: 'MagnifyingGlassIcon' },
  factory_resolved: { color: 'bg-purple-50 text-purple-700 border-purple-200', icon: 'BuildingOffice2Icon' },
  buyer_accepted: { color: 'bg-emerald-50 text-emerald-700 border-emerald-200', icon: 'HandThumbUpIcon' },
  escalated: { color: 'bg-orange-50 text-orange-700 border-orange-200', icon: 'ArrowUpCircleIcon' },
  under_review: { color: 'bg-violet-50 text-violet-700 border-violet-200', icon: 'ShieldCheckIcon' },
  resolved_refund: { color: 'bg-emerald-50 text-emerald-700 border-emerald-200', icon: 'BanknotesIcon' },
  resolved_no_refund: { color: 'bg-gray-100 text-gray-600 border-gray-200', icon: 'XCircleIcon' },
  closed: { color: 'bg-gray-100 text-gray-600 border-gray-200', icon: 'CheckCircleIcon' },
};

export default function DisputesPage() {
  const router = useRouter();
  const { user, loading: authLoading } = useAuth();
  const supabase = createClient();
  const { t, dir, language } = useLanguage();
  const d = t.disputes;

  const [disputes, setDisputes] = useState<Dispute[]>([]);
  const [loading, setLoading] = useState(true);
  const [selectedDispute, setSelectedDispute] = useState<Dispute | null>(null);
  const [filterStatus, setFilterStatus] = useState('all');
  const [filterTier, setFilterTier] = useState('all');
  const [actionLoading, setActionLoading] = useState(false);
  const [toast, setToast] = useState<{ msg: string; type: 'success' | 'error' } | null>(null);
  const [resolutionType, setResolutionType] = useState('compensation');
  const [resolutionNote, setResolutionNote] = useState('');

  const userRole = user?.user_metadata?.role || 'buyer';
  const isAdmin = userRole === 'admin';
  const isFactory = userRole === 'manufacturer';
  const localeTag = language === 'ar' ? 'ar-SA' : language === 'zh' ? 'zh-CN' : language === 'tr' ? 'tr-TR' : 'en-US';

  const [factoryHubPath, setFactoryHubPath] = useState('/manufacturer/dashboard');

  useEffect(() => {
    if (!isFactory) return;
    try {
      const ref = document.referrer ? new URL(document.referrer) : null;
      const refPath = ref && ref.origin === window.location.origin ? ref.pathname : '';
      const hubPaths = ['/factory/local-dashboard', '/manufacturer/international-dashboard', '/manufacturer/dashboard', '/manufacturer/erp'];
      const match = hubPaths.find((p) => refPath.startsWith(p));
      if (match) {
        sessionStorage.setItem('disputes_factory_hub', match);
        setFactoryHubPath(match);
      } else {
        const saved = sessionStorage.getItem('disputes_factory_hub');
        if (saved) setFactoryHubPath(saved);
      }
    } catch {
      // keep default hub path
    }
  }, [isFactory]);

  useEffect(() => {
    if (authLoading) return;
    if (!user) router.push('/login');
  }, [user, authLoading, router]);

  useEffect(() => {
    if (user) fetchDisputes();
  }, [user]);

  const fetchDisputes = async () => {
    setLoading(true);
    try {
      let query = supabase
        .from('order_disputes')
        .select(`
          *,
          orders(order_number, total, status, escrow_status, dispute_status),
          buyer_profile:user_profiles!order_disputes_buyer_id_fkey(full_name, email, company_name),
          factory_profile:user_profiles!order_disputes_factory_id_fkey(full_name, email, company_name)
        `)
        .order('opened_at', { ascending: false });

      if (!isAdmin) {
        if (isFactory) {
          query = query.eq('factory_id', user!.id);
        } else {
          query = query.eq('buyer_id', user!.id);
        }
      }

      const { data, error } = await query;
      if (error) throw error;
      setDisputes(data || []);
    } catch (err) {
      console.error('Disputes fetch error:', err);
    } finally {
      setLoading(false);
    }
  };

  const showToast = (msg: string, type: 'success' | 'error' = 'success') => {
    setToast({ msg, type });
    setTimeout(() => setToast(null), 3500);
  };

  const handleAction = async (action: string, disputeId: string, orderId: string) => {
    setActionLoading(true);
    try {
      const body: any = { action, order_id: orderId };
      if (action === 'factory_resolve') {
        if (!resolutionNote.trim()) { showToast(d.errResolutionNote, 'error'); setActionLoading(false); return; }
        body.resolution_type = resolutionType;
        body.resolution_note = resolutionNote;
      }

      const res = await fetch('/api/escrow/dispute', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(body),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || d.errAction);

      showToast(data.message || d.actionSuccess);
      setSelectedDispute(null);
      setResolutionNote('');
      await fetchDisputes();
    } catch (err: any) {
      showToast(err.message || d.errGeneric, 'error');
    } finally {
      setActionLoading(false);
    }
  };

  const filteredDisputes = disputes.filter((item) => {
    if (filterStatus !== 'all' && item.status !== filterStatus) return false;
    if (filterTier !== 'all' && String(item.tier) !== filterTier) return false;
    return true;
  });

  const stats = {
    total: disputes.length,
    open: disputes.filter((x) => ['open', 'factory_reviewing'].includes(x.status)).length,
    escalated: disputes.filter((x) => ['escalated', 'under_review'].includes(x.status)).length,
    resolved: disputes.filter((x) => ['resolved_refund', 'resolved_no_refund', 'buyer_accepted', 'closed'].includes(x.status)).length,
  };

  const statusLabel = (key: string) => (d.status as Record<string, string>)[key] || key;
  const reasonLabel = (key: string) => (d.reasons as Record<string, string>)[key] || key;
  const resolutionLabel = (key: string) => (d.resolutionTypes as Record<string, string>)[key] || key;

  if (authLoading || loading) {
    return (
      <div className="min-h-screen bg-background flex items-center justify-center" dir={dir}>
        <div className="w-8 h-8 border-2 border-primary border-t-transparent rounded-full animate-spin" />
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-background" dir={dir}>
      <Header />

      {toast && (
        <div className={`fixed top-4 right-4 z-50 px-4 py-3 rounded-xl shadow-lg text-sm font-medium flex items-center gap-2 ${toast.type === 'success' ? 'bg-emerald-600 text-white' : 'bg-red-600 text-white'}`}>
          <Icon name={toast.type === 'success' ? 'CheckCircleIcon' : 'ExclamationCircleIcon'} size={16} />
          {toast.msg}
        </div>
      )}

      <div className="max-w-5xl mx-auto px-4 py-8 pb-24">
        <div className="flex items-center justify-between mb-8 flex-wrap gap-4">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 bg-red-50 rounded-xl flex items-center justify-center">
              <Icon name="ScaleIcon" size={22} className="text-red-600" />
            </div>
            <div>
              <h1 className="text-xl font-bold text-foreground">{d.title}</h1>
              <p className="text-sm text-muted-foreground">{d.subtitle}</p>
            </div>
          </div>
          <div className="flex items-center gap-2 flex-wrap">
            {isFactory && (
              <a
                href={factoryHubPath}
                className="flex items-center gap-2 px-4 py-2 border border-border bg-card text-foreground rounded-xl text-sm font-semibold hover:bg-muted transition-colors"
              >
                <Icon name="ArrowRightIcon" size={16} className={dir === 'rtl' ? '' : 'rotate-180'} />
                الرجوع إلى غرفة التحكم
              </a>
            )}
            <a
              href="/orders"
              className="flex items-center gap-2 px-4 py-2 bg-primary text-primary-foreground rounded-xl text-sm font-semibold"
            >
              <Icon name="PlusIcon" size={16} />
              {d.openNew}
            </a>
          </div>
        </div>

        <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-8">
          {[
            { label: d.statTotal, value: stats.total, icon: 'ScaleIcon', color: 'text-foreground bg-muted/60' },
            { label: d.statOpen, value: stats.open, icon: 'ExclamationCircleIcon', color: 'text-amber-700 bg-amber-50' },
            { label: d.statEscalated, value: stats.escalated, icon: 'ArrowUpCircleIcon', color: 'text-orange-700 bg-orange-50' },
            { label: d.statResolved, value: stats.resolved, icon: 'CheckCircleIcon', color: 'text-emerald-700 bg-emerald-50' },
          ].map((stat) => (
            <div key={stat.label} className={`rounded-2xl p-4 border border-border ${stat.color}`}>
              <Icon name={stat.icon as any} size={20} className="mb-2 opacity-70" />
              <p className="text-2xl font-bold">{stat.value}</p>
              <p className="text-xs font-medium opacity-70 mt-0.5">{stat.label}</p>
            </div>
          ))}
        </div>

        <div className="bg-card border border-border rounded-2xl p-5 mb-8">
          <h2 className="font-bold text-foreground mb-4 flex items-center gap-2">
            <Icon name="InformationCircleIcon" size={18} className="text-primary" />
            {d.howItWorks}
          </h2>
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            {[
              { tier: d.tier1Label, icon: 'BuildingOffice2Icon', color: 'bg-blue-50 text-blue-700', title: d.tier1Title, desc: d.tier1Desc },
              { tier: d.tier2Label, icon: 'ShieldCheckIcon', color: 'bg-orange-50 text-orange-700', title: d.tier2Title, desc: d.tier2Desc },
              { tier: d.finalLabel, icon: 'ScaleIcon', color: 'bg-emerald-50 text-emerald-700', title: d.finalTitle, desc: d.finalDesc },
            ].map((item) => (
              <div key={item.tier} className={`rounded-xl p-4 ${item.color}`}>
                <div className="flex items-center gap-2 mb-2">
                  <Icon name={item.icon as any} size={18} />
                  <span className="text-xs font-bold uppercase tracking-wide">{item.tier}</span>
                </div>
                <p className="text-sm font-semibold mb-1">{item.title}</p>
                <p className="text-xs opacity-80">{item.desc}</p>
              </div>
            ))}
          </div>
        </div>

        <div className="flex items-center gap-3 mb-5 flex-wrap">
          <select
            value={filterStatus}
            onChange={(e) => setFilterStatus(e.target.value)}
            className="px-3 py-2 text-sm border border-border rounded-xl bg-card text-foreground focus:outline-none focus:border-primary"
          >
            <option value="all">{d.allStatuses}</option>
            {Object.keys(STATUS_META).map((key) => (
              <option key={key} value={key}>{statusLabel(key)}</option>
            ))}
          </select>
          <select
            value={filterTier}
            onChange={(e) => setFilterTier(e.target.value)}
            className="px-3 py-2 text-sm border border-border rounded-xl bg-card text-foreground focus:outline-none focus:border-primary"
          >
            <option value="all">{d.allTiers}</option>
            <option value="1">{d.tierN.replace('{n}', '1')}</option>
            <option value="2">{d.tierN.replace('{n}', '2')}</option>
          </select>
          <span className="text-sm text-muted-foreground">{d.disputeCount.replace('{count}', String(filteredDisputes.length))}</span>
        </div>

        {filteredDisputes.length === 0 ? (
          <div className="text-center py-16 bg-card border border-border rounded-2xl">
            <div className="w-16 h-16 bg-muted rounded-2xl flex items-center justify-center mx-auto mb-4">
              <Icon name="ScaleIcon" size={32} className="text-muted-foreground" />
            </div>
            <p className="text-foreground font-semibold mb-1">{d.emptyTitle}</p>
            <p className="text-sm text-muted-foreground">{d.emptySubtitle}</p>
          </div>
        ) : (
          <div className="space-y-4">
            {filteredDisputes.map((dispute) => {
              const statusCfg = STATUS_META[dispute.status] || STATUS_META.open;
              const canFactoryResolve = isFactory && ['open', 'factory_reviewing'].includes(dispute.status);
              const canBuyerRespond = !isFactory && !isAdmin && dispute.status === 'factory_resolved';
              const canAdminAct = isAdmin && ['escalated', 'under_review'].includes(dispute.status);

              return (
                <div key={dispute.id} className="bg-card border border-border rounded-2xl overflow-hidden">
                  <div className="p-5">
                    <div className="flex items-start justify-between gap-3 mb-4">
                      <div className="flex items-start gap-3">
                        <div className={`w-10 h-10 rounded-xl flex items-center justify-center border ${statusCfg.color}`}>
                          <Icon name={statusCfg.icon as any} size={18} />
                        </div>
                        <div>
                          <p className="font-bold text-foreground">
                            {d.orderNum.replace('{num}', dispute.orders?.order_number || dispute.order_id.slice(0, 8))}
                          </p>
                          <p className="text-sm text-muted-foreground">
                            {reasonLabel(dispute.reason)}
                          </p>
                        </div>
                      </div>
                      <div className="flex flex-col items-end gap-2">
                        <span className={`px-2.5 py-1 rounded-full text-xs font-semibold border ${statusCfg.color}`}>
                          {statusLabel(dispute.status)}
                        </span>
                        <span className={`px-2 py-0.5 rounded-full text-xs font-medium ${dispute.tier === 2 ? 'bg-orange-50 text-orange-600' : 'bg-blue-50 text-blue-600'}`}>
                          {d.tierN.replace('{n}', String(dispute.tier))}
                        </span>
                      </div>
                    </div>

                    <div className="grid grid-cols-2 gap-3 mb-4">
                      <div className="bg-muted/40 rounded-xl p-3">
                        <p className="text-xs text-muted-foreground mb-1">{d.buyer}</p>
                        <p className="text-sm font-semibold text-foreground truncate">
                          {dispute.buyer_profile?.company_name || dispute.buyer_profile?.full_name || '—'}
                        </p>
                      </div>
                      <div className="bg-muted/40 rounded-xl p-3">
                        <p className="text-xs text-muted-foreground mb-1">{d.factory}</p>
                        <p className="text-sm font-semibold text-foreground truncate">
                          {dispute.factory_profile?.company_name || dispute.factory_profile?.full_name || '—'}
                        </p>
                      </div>
                    </div>

                    {dispute.description && (
                      <div className="bg-muted/30 rounded-xl p-3 mb-4">
                        <p className="text-xs text-muted-foreground mb-1">{d.complaintDetails}</p>
                        <p className="text-sm text-foreground">{dispute.description}</p>
                      </div>
                    )}

                    {dispute.factory_resolution_note && (
                      <div className="bg-purple-50 border border-purple-200 rounded-xl p-3 mb-4">
                        <p className="text-xs font-semibold text-purple-700 mb-1">
                          {d.factoryResolution.replace('{type}', resolutionLabel(dispute.factory_resolution_type || '') || dispute.factory_resolution_type || '')}
                        </p>
                        <p className="text-sm text-purple-800">{dispute.factory_resolution_note}</p>
                      </div>
                    )}

                    {dispute.escrow_frozen && (
                      <div className="flex items-center gap-2 bg-red-50 border border-red-200 rounded-xl p-3 mb-4">
                        <Icon name="LockClosedIcon" size={16} className="text-red-600" />
                        <p className="text-sm text-red-700 font-medium">{d.fundsFrozen}</p>
                      </div>
                    )}

                    <div className="flex items-center gap-4 text-xs text-muted-foreground mb-4 flex-wrap">
                      <span className="flex items-center gap-1">
                        <Icon name="CalendarIcon" size={12} />
                        {d.opened.replace('{date}', new Date(dispute.opened_at).toLocaleDateString(localeTag))}
                      </span>
                      {dispute.escalated_at && (
                        <span className="flex items-center gap-1 text-orange-600">
                          <Icon name="ArrowUpCircleIcon" size={12} />
                          {d.escalated.replace('{date}', new Date(dispute.escalated_at).toLocaleDateString(localeTag))}
                        </span>
                      )}
                      {dispute.resolved_at && (
                        <span className="flex items-center gap-1 text-emerald-600">
                          <Icon name="CheckCircleIcon" size={12} />
                          {d.resolved.replace('{date}', new Date(dispute.resolved_at).toLocaleDateString(localeTag))}
                        </span>
                      )}
                    </div>

                    {(canFactoryResolve || canBuyerRespond || canAdminAct) && (
                      <div className="border-t border-border pt-4">
                        {canFactoryResolve && (
                          <div>
                            {selectedDispute?.id === dispute.id ? (
                              <div className="space-y-3">
                                <select
                                  value={resolutionType}
                                  onChange={(e) => setResolutionType(e.target.value)}
                                  className="w-full px-3 py-2 text-sm border border-border rounded-xl bg-background focus:outline-none focus:border-primary"
                                >
                                  {Object.keys(d.resolutionTypes).map((k) => (
                                    <option key={k} value={k}>{resolutionLabel(k)}</option>
                                  ))}
                                </select>
                                <textarea
                                  value={resolutionNote}
                                  onChange={(e) => setResolutionNote(e.target.value)}
                                  placeholder={d.resolutionPlaceholder}
                                  rows={3}
                                  className="w-full px-3 py-2 text-sm border border-border rounded-xl bg-background focus:outline-none focus:border-primary resize-none"
                                />
                                <div className="flex gap-2">
                                  <button
                                    onClick={() => handleAction('factory_resolve', dispute.id, dispute.order_id)}
                                    disabled={actionLoading}
                                    className="flex-1 py-2.5 bg-primary text-primary-foreground text-sm font-semibold rounded-xl disabled:opacity-50"
                                  >
                                    {actionLoading ? d.sending : d.sendResolution}
                                  </button>
                                  <button
                                    onClick={() => setSelectedDispute(null)}
                                    className="px-4 py-2.5 bg-muted text-foreground text-sm rounded-xl"
                                  >
                                    {d.cancel}
                                  </button>
                                </div>
                              </div>
                            ) : (
                              <button
                                onClick={() => setSelectedDispute(dispute)}
                                className="w-full py-2.5 bg-primary text-primary-foreground text-sm font-semibold rounded-xl"
                              >
                                {d.proposeResolution}
                              </button>
                            )}
                          </div>
                        )}

                        {canBuyerRespond && (
                          <div className="flex gap-3">
                            <button
                              onClick={() => handleAction('buyer_accept', dispute.id, dispute.order_id)}
                              disabled={actionLoading}
                              className="flex-1 py-2.5 bg-emerald-600 text-white text-sm font-semibold rounded-xl disabled:opacity-50"
                            >
                              {d.acceptResolution}
                            </button>
                            <button
                              onClick={() => handleAction('buyer_escalate', dispute.id, dispute.order_id)}
                              disabled={actionLoading}
                              className="flex-1 py-2.5 bg-orange-500 text-white text-sm font-semibold rounded-xl disabled:opacity-50"
                            >
                              {d.escalateAdmin}
                            </button>
                          </div>
                        )}

                        {canAdminAct && (
                          <div className="flex gap-3">
                            <button
                              onClick={() => handleAction('admin_refund', dispute.id, dispute.order_id)}
                              disabled={actionLoading}
                              className="flex-1 py-2.5 bg-emerald-600 text-white text-sm font-semibold rounded-xl disabled:opacity-50"
                            >
                              {d.approveRefund}
                            </button>
                            <button
                              onClick={() => handleAction('admin_close', dispute.id, dispute.order_id)}
                              disabled={actionLoading}
                              className="flex-1 py-2.5 bg-red-500 text-white text-sm font-semibold rounded-xl disabled:opacity-50"
                            >
                              {d.closeNoRefund}
                            </button>
                          </div>
                        )}
                      </div>
                    )}
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </div>

      <BottomNav />
    </div>
  );
}
