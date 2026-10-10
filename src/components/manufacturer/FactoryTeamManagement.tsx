'use client';

import React, { useState, useEffect, useCallback } from 'react';
import { createClient } from '@/lib/supabase/client';
import Icon from '@/components/ui/AppIcon';

// ── Types ─────────────────────────────────────────────────────────────────────

interface TeamMember {
  id: string;
  full_name: string;
  email: string;
  role: string;
  is_active: boolean;
  factory_id: string | null;
  created_at: string;
  // Derived from factory_sales_reps if linked
  can_manage_products?: boolean;
  can_respond_rfq?: boolean;
  can_view_orders?: boolean;
  can_view_inventory?: boolean;
  sales_rep_id?: string | null;
  sales_rep_status?: string | null;
}

interface FactoryTeamManagementProps {
  factoryOwnerId: string;
  isRTL?: boolean;
}

// ── Component ─────────────────────────────────────────────────────────────────

export default function FactoryTeamManagement({ factoryOwnerId, isRTL = false }: FactoryTeamManagementProps) {
  const supabase = createClient();

  const [members, setMembers] = useState<TeamMember[]>([]);
  const [loading, setLoading] = useState(true);
  const [actionLoading, setActionLoading] = useState<string | null>(null);

  // Invite form state
  const [showInviteModal, setShowInviteModal] = useState(false);
  const [inviteForm, setInviteForm] = useState({
    email: '',
    full_name: '',
    can_manage_products: true,
    can_respond_rfq: true,
    can_view_orders: true,
    can_view_inventory: true,
    notes: '',
  });
  const [inviteLoading, setInviteLoading] = useState(false);
  const [inviteError, setInviteError] = useState('');
  const [inviteSuccess, setInviteSuccess] = useState('');

  // ── Fetch team members ────────────────────────────────────────────────────
  const fetchTeamMembers = useCallback(async () => {
    setLoading(true);
    try {
      // Fetch user_profiles with manufacturer_agent role linked to this factory
      const { data: agentProfiles, error } = await supabase
        .from('user_profiles')
        .select('id, full_name, email, role, is_active, factory_id, created_at')
        .eq('factory_id', factoryOwnerId)
        .eq('role', 'manufacturer_agent')
        .order('created_at', { ascending: false });

      if (error) throw error;

      // Also fetch factory_sales_reps for permission details
      const { data: salesReps } = await supabase
        .from('factory_sales_reps')
        .select('id, rep_user_id, status, can_manage_products, can_respond_rfq, can_view_orders, can_view_inventory')
        .eq('factory_owner_id', factoryOwnerId);

      const repMap = new Map<string, any>();
      (salesReps || []).forEach((r: any) => {
        if (r.rep_user_id) repMap.set(r.rep_user_id, r);
      });

      const combined: TeamMember[] = (agentProfiles || []).map((p: any) => {
        const rep = repMap.get(p.id);
        return {
          id: p.id,
          full_name: p.full_name || '',
          email: p.email || '',
          role: p.role,
          is_active: p.is_active ?? true,
          factory_id: p.factory_id,
          created_at: p.created_at,
          can_manage_products: rep?.can_manage_products ?? true,
          can_respond_rfq: rep?.can_respond_rfq ?? true,
          can_view_orders: rep?.can_view_orders ?? true,
          can_view_inventory: rep?.can_view_inventory ?? true,
          sales_rep_id: rep?.id ?? null,
          sales_rep_status: rep?.status ?? null,
        };
      });

      setMembers(combined);
    } catch (err) {
      console.error('FactoryTeamManagement: fetchTeamMembers error', err);
    } finally {
      setLoading(false);
    }
  }, [factoryOwnerId, supabase]);

  useEffect(() => {
    fetchTeamMembers();
  }, [fetchTeamMembers]);

  // ── Toggle member active status ───────────────────────────────────────────
  const handleToggleActive = async (memberId: string, currentActive: boolean) => {
    setActionLoading(memberId);
    try {
      const { error } = await supabase
        .from('user_profiles')
        .update({ is_active: !currentActive })
        .eq('id', memberId)
        .eq('factory_id', factoryOwnerId);
      if (error) throw error;

      // Also update factory_sales_reps status if linked
      const member = members.find(m => m.id === memberId);
      if (member?.sales_rep_id) {
        await supabase
          .from('factory_sales_reps')
          .update({ status: !currentActive ? 'active' : 'suspended' })
          .eq('id', member.sales_rep_id);
      }

      setMembers(prev => prev.map(m => m.id === memberId ? { ...m, is_active: !currentActive } : m));
    } catch (err) {
      console.error('FactoryTeamManagement: toggleActive error', err);
    } finally {
      setActionLoading(null);
    }
  };

  // ── Remove member ─────────────────────────────────────────────────────────
  const handleRemoveMember = async (memberId: string) => {
    if (!confirm('هل أنت متأكد من إزالة هذا العضو من الفريق؟\nAre you sure you want to remove this team member?')) return;
    setActionLoading(memberId);
    try {
      // Unlink factory_id and reset role to buyer
      const { error } = await supabase
        .from('user_profiles')
        .update({ factory_id: null, role: 'buyer', is_active: false })
        .eq('id', memberId)
        .eq('factory_id', factoryOwnerId);
      if (error) throw error;

      // Remove from factory_sales_reps if linked
      const member = members.find(m => m.id === memberId);
      if (member?.sales_rep_id) {
        await supabase
          .from('factory_sales_reps')
          .update({ status: 'revoked' })
          .eq('id', member.sales_rep_id);
      }

      setMembers(prev => prev.filter(m => m.id !== memberId));
    } catch (err) {
      console.error('FactoryTeamManagement: removeMember error', err);
    } finally {
      setActionLoading(null);
    }
  };

  // ── Invite / register new agent ───────────────────────────────────────────
  const handleInviteAgent = async (e: React.FormEvent) => {
    e.preventDefault();
    setInviteError('');
    setInviteSuccess('');

    if (!inviteForm.email.trim()) { setInviteError('البريد الإلكتروني مطلوب / Email is required'); return; }
    if (!inviteForm.full_name.trim()) { setInviteError('الاسم الكامل مطلوب / Full name is required'); return; }

    setInviteLoading(true);
    try {
      // Check if user already exists in user_profiles
      const { data: existingProfile } = await supabase
        .from('user_profiles')
        .select('id, role, factory_id')
        .eq('email', inviteForm.email.trim().toLowerCase())
        .maybeSingle();

      if (existingProfile) {
        if (existingProfile.factory_id && existingProfile.factory_id !== factoryOwnerId) {
          setInviteError('هذا المستخدم مرتبط بمصنع آخر / This user is already linked to another factory');
          setInviteLoading(false);
          return;
        }

        // Link existing user as manufacturer_agent
        const { error: updateError } = await supabase
          .from('user_profiles')
          .update({
            factory_id: factoryOwnerId,
            role: 'manufacturer_agent',
            is_active: true,
          })
          .eq('id', existingProfile.id);
        if (updateError) throw updateError;

        // Create or update factory_sales_reps record for permission tracking
        const token = `mfg_agent_${Date.now()}_${Math.random().toString(36).substring(2, 10)}`;
        await supabase.from('factory_sales_reps').upsert({
          factory_owner_id: factoryOwnerId,
          rep_user_id: existingProfile.id,
          invited_email: inviteForm.email.trim().toLowerCase(),
          full_name: inviteForm.full_name.trim(),
          role: 'sales_rep',
          status: 'active',
          invitation_token: token,
          accepted_at: new Date().toISOString(),
          can_manage_products: inviteForm.can_manage_products,
          can_respond_rfq: inviteForm.can_respond_rfq,
          can_view_orders: inviteForm.can_view_orders,
          can_view_inventory: inviteForm.can_view_inventory,
          notes: inviteForm.notes.trim() || null,
        }, { onConflict: 'rep_user_id,factory_owner_id', ignoreDuplicates: false });

      } else {
        // Create a pending invitation in factory_sales_reps (user will register later)
        const token = `mfg_agent_${Date.now()}_${Math.random().toString(36).substring(2, 10)}`;
        const { error: insertError } = await supabase.from('factory_sales_reps').insert({
          factory_owner_id: factoryOwnerId,
          rep_user_id: null,
          invited_email: inviteForm.email.trim().toLowerCase(),
          full_name: inviteForm.full_name.trim(),
          role: 'sales_rep',
          status: 'pending',
          invitation_token: token,
          can_manage_products: inviteForm.can_manage_products,
          can_respond_rfq: inviteForm.can_respond_rfq,
          can_view_orders: inviteForm.can_view_orders,
          can_view_inventory: inviteForm.can_view_inventory,
          notes: inviteForm.notes.trim() || null,
        });
        if (insertError) throw insertError;
      }

      setInviteSuccess(`تم إضافة ${inviteForm.full_name} بنجاح / ${inviteForm.full_name} added successfully`);
      setInviteForm({ email: '', full_name: '', can_manage_products: true, can_respond_rfq: true, can_view_orders: true, can_view_inventory: true, notes: '' });
      await fetchTeamMembers();
      setTimeout(() => { setShowInviteModal(false); setInviteSuccess(''); }, 2500);
    } catch (err: any) {
      setInviteError(err.message || 'فشل في إضافة العضو / Failed to add member');
    } finally {
      setInviteLoading(false);
    }
  };

  // ── Render ────────────────────────────────────────────────────────────────
  return (
    <div className="space-y-5" dir={isRTL ? 'rtl' : 'ltr'}>
      {/* Header */}
      <div className="bg-gradient-to-r from-indigo-600 to-purple-700 rounded-2xl p-5 text-white">
        <div className="flex items-center gap-4">
          <div className="w-12 h-12 rounded-2xl bg-white/20 flex items-center justify-center shrink-0">
            <Icon name="UserGroupIcon" size={24} className="text-white" />
          </div>
          <div className="flex-1">
            <h2 className="text-lg font-bold">
              {isRTL ? 'إدارة فريق المصنع — ممثلو المبيعات' : 'Factory Team Management — Sales Agents'}
            </h2>
            <p className="text-sm text-white/80">
              {isRTL
                ? 'إدارة الحسابات الفرعية لموظفي المصنع بصلاحية manufacturer_agent' :'Manage sub-accounts for factory staff with manufacturer_agent permissions'}
            </p>
          </div>
          <button
            onClick={() => { setShowInviteModal(true); setInviteError(''); setInviteSuccess(''); }}
            className="flex items-center gap-2 px-4 py-2 bg-white/20 hover:bg-white/30 text-white text-sm font-semibold rounded-xl transition-colors shrink-0"
          >
            <Icon name="UserPlusIcon" size={16} />
            {isRTL ? 'إضافة عضو' : 'Add Member'}
          </button>
        </div>
      </div>

      {/* Permission Matrix */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        <div className="bg-green-50 border border-green-200 rounded-xl p-4">
          <div className="flex items-center gap-2 mb-3">
            <Icon name="CheckCircleIcon" size={18} className="text-green-600" />
            <p className="text-sm font-bold text-green-800">
              {isRTL ? 'صلاحيات ممثل المصنع' : 'Agent Permissions'}
            </p>
          </div>
          <ul className="space-y-1.5 text-xs text-green-700">
            <li className="flex items-center gap-2"><Icon name="CheckIcon" size={12} /> {isRTL ? 'إدارة المنتجات والمخزون' : 'Manage products & inventory'}</li>
            <li className="flex items-center gap-2"><Icon name="CheckIcon" size={12} /> {isRTL ? 'الرد على طلبات الأسعار (RFQ)' : 'Respond to RFQ requests'}</li>
            <li className="flex items-center gap-2"><Icon name="CheckIcon" size={12} /> {isRTL ? 'عرض الطلبات والمحادثات' : 'View orders & conversations'}</li>
            <li className="flex items-center gap-2"><Icon name="CheckIcon" size={12} /> {isRTL ? 'التواصل مع المشترين نيابة عن المصنع' : 'Chat with buyers on behalf of factory'}</li>
          </ul>
        </div>
        <div className="bg-red-50 border border-red-200 rounded-xl p-4">
          <div className="flex items-center gap-2 mb-3">
            <Icon name="LockClosedIcon" size={18} className="text-red-600" />
            <p className="text-sm font-bold text-red-800">
              {isRTL ? 'محظور على الممثلين' : 'Blocked for Agents'}
            </p>
          </div>
          <ul className="space-y-1.5 text-xs text-red-700">
            <li className="flex items-center gap-2"><Icon name="XMarkIcon" size={12} /> {isRTL ? 'إعدادات الدفع والحسابات البنكية' : 'Payment settings & bank accounts'}</li>
            <li className="flex items-center gap-2"><Icon name="XMarkIcon" size={12} /> {isRTL ? 'بيانات الإيرادات والضمان المالي' : 'Revenue & escrow data'}</li>
            <li className="flex items-center gap-2"><Icon name="XMarkIcon" size={12} /> {isRTL ? 'المحافظ الرقمية والبيانات الضريبية' : 'Digital wallets & tax data'}</li>
          </ul>
        </div>
      </div>

      {/* Info notice */}
      <div className="bg-blue-50 border border-blue-200 rounded-xl p-4 flex items-start gap-3">
        <Icon name="InformationCircleIcon" size={18} className="text-blue-600 shrink-0 mt-0.5" />
        <div>
          <p className="text-sm font-bold text-blue-800">
            {isRTL ? 'ربط الحساب عبر factory_id' : 'Account Linking via factory_id'}
          </p>
          <p className="text-xs text-blue-700 mt-1">
            {isRTL
              ? 'يتم ربط كل ممثل مبيعات بالمصنع عبر حقل factory_id في جدول user_profiles مع صلاحية manufacturer_agent. يمكنهم إدارة RFQs والمحادثات نيابةً عن المصنع.' :'Each agent is linked to the factory via factory_id in user_profiles with manufacturer_agent role. They can manage RFQs and conversations on behalf of the factory.'}
          </p>
        </div>
      </div>

      {/* Members List */}
      {loading ? (
        <div className="flex items-center justify-center py-16">
          <Icon name="ArrowPathIcon" size={24} className="animate-spin text-primary" />
        </div>
      ) : members.length === 0 ? (
        <div className="bg-card border border-border rounded-2xl p-12 text-center">
          <div className="w-16 h-16 rounded-2xl bg-muted flex items-center justify-center mx-auto mb-4">
            <Icon name="UserGroupIcon" size={28} className="text-muted-foreground" />
          </div>
          <p className="text-sm font-semibold text-foreground mb-1">
            {isRTL ? 'لا يوجد أعضاء في الفريق بعد' : 'No team members yet'}
          </p>
          <p className="text-xs text-muted-foreground mb-4">
            {isRTL ? 'أضف موظفي المصنع لإدارة RFQs والمحادثات نيابةً عنك' : 'Add factory staff to manage RFQs and conversations on your behalf'}
          </p>
          <button
            onClick={() => { setShowInviteModal(true); setInviteError(''); setInviteSuccess(''); }}
            className="inline-flex items-center gap-2 px-4 py-2 bg-primary text-primary-foreground text-sm font-semibold rounded-xl hover:opacity-90 transition-opacity"
          >
            <Icon name="UserPlusIcon" size={16} />
            {isRTL ? 'إضافة عضو جديد' : 'Add New Member'}
          </button>
        </div>
      ) : (
        <div className="space-y-3">
          {members.map((member) => (
            <div key={member.id} className="bg-card border border-border rounded-xl overflow-hidden">
              <div className="flex items-center gap-4 p-4">
                {/* Avatar */}
                <div className="w-10 h-10 rounded-full bg-indigo-100 flex items-center justify-center shrink-0 text-indigo-700 font-bold text-sm">
                  {(member.full_name || member.email).charAt(0).toUpperCase()}
                </div>
                {/* Info */}
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2 flex-wrap">
                    <p className="text-sm font-bold text-foreground">{member.full_name || member.email}</p>
                    <span className="text-[10px] font-semibold px-2 py-0.5 rounded-full bg-indigo-50 text-indigo-700 border border-indigo-200">
                      manufacturer_agent
                    </span>
                    <span className={`text-[10px] font-bold px-2 py-0.5 rounded-full border ${
                      member.is_active
                        ? 'bg-green-50 text-green-700 border-green-200' :'bg-red-50 text-red-700 border-red-200'
                    }`}>
                      {member.is_active
                        ? (isRTL ? 'نشط' : 'Active')
                        : (isRTL ? 'موقوف' : 'Suspended')}
                    </span>
                    {member.sales_rep_status === 'pending' && (
                      <span className="text-[10px] font-bold px-2 py-0.5 rounded-full border bg-amber-50 text-amber-700 border-amber-200">
                        {isRTL ? 'في انتظار التسجيل' : 'Pending Registration'}
                      </span>
                    )}
                  </div>
                  <p className="text-xs text-muted-foreground mt-0.5">{member.email}</p>
                  <p className="text-[10px] text-muted-foreground mt-0.5">
                    {isRTL ? 'مرتبط عبر factory_id' : 'Linked via factory_id'} · {new Date(member.created_at).toLocaleDateString()}
                  </p>
                </div>
                {/* Permission chips */}
                <div className="hidden md:flex items-center gap-1 flex-wrap justify-end max-w-[180px]">
                  {member.can_manage_products && (
                    <span className="text-[9px] px-1.5 py-0.5 bg-green-50 text-green-700 rounded border border-green-200">
                      {isRTL ? 'منتجات' : 'Products'}
                    </span>
                  )}
                  {member.can_respond_rfq && (
                    <span className="text-[9px] px-1.5 py-0.5 bg-green-50 text-green-700 rounded border border-green-200">RFQ</span>
                  )}
                  {member.can_view_orders && (
                    <span className="text-[9px] px-1.5 py-0.5 bg-green-50 text-green-700 rounded border border-green-200">
                      {isRTL ? 'طلبات' : 'Orders'}
                    </span>
                  )}
                  {member.can_view_inventory && (
                    <span className="text-[9px] px-1.5 py-0.5 bg-green-50 text-green-700 rounded border border-green-200">
                      {isRTL ? 'مخزون' : 'Inventory'}
                    </span>
                  )}
                  <span className="text-[9px] px-1.5 py-0.5 bg-red-50 text-red-600 rounded border border-red-200">
                    {isRTL ? 'مالية 🔒' : 'Finance 🔒'}
                  </span>
                </div>
                {/* Actions */}
                <div className="flex items-center gap-1 shrink-0">
                  <button
                    onClick={() => handleToggleActive(member.id, member.is_active)}
                    disabled={actionLoading === member.id}
                    className={`px-3 py-1.5 text-xs font-semibold rounded-lg transition-colors disabled:opacity-50 ${
                      member.is_active
                        ? 'bg-orange-100 text-orange-700 hover:bg-orange-200' :'bg-green-100 text-green-700 hover:bg-green-200'
                    }`}
                  >
                    {actionLoading === member.id ? (
                      <Icon name="ArrowPathIcon" size={12} className="animate-spin" />
                    ) : member.is_active ? (isRTL ? 'إيقاف' : 'Suspend') : (isRTL ? 'تفعيل' : 'Activate')}
                  </button>
                  <button
                    onClick={() => handleRemoveMember(member.id)}
                    disabled={actionLoading === member.id}
                    className="w-8 h-8 rounded-lg hover:bg-red-50 flex items-center justify-center transition-colors"
                    title={isRTL ? 'إزالة من الفريق' : 'Remove from team'}
                  >
                    <Icon name="TrashIcon" size={14} className="text-red-500" />
                  </button>
                </div>
              </div>
            </div>
          ))}
        </div>
      )}

      {/* Invite Modal */}
      {showInviteModal && (
        <div className="fixed inset-0 z-50 flex flex-col bg-background">
          <div className="flex items-center justify-between px-5 py-4 border-b border-border bg-card shrink-0">
            <div className="flex items-center gap-2">
              <Icon name="UserPlusIcon" size={18} className="text-primary" />
              <h3 className="font-bold text-foreground">
                {isRTL ? 'إضافة ممثل مبيعات جديد' : 'Add New Sales Agent'}
              </h3>
            </div>
            <button
              onClick={() => setShowInviteModal(false)}
              className="w-8 h-8 rounded-lg hover:bg-muted flex items-center justify-center"
            >
              <Icon name="XMarkIcon" size={16} className="text-muted-foreground" />
            </button>
          </div>

          <form onSubmit={handleInviteAgent} className="flex-1 overflow-y-auto p-5 space-y-4">
            {inviteError && (
              <div className="bg-red-50 border border-red-200 text-red-700 rounded-lg px-4 py-3 text-sm flex items-center gap-2">
                <Icon name="ExclamationCircleIcon" size={16} />
                {inviteError}
              </div>
            )}
            {inviteSuccess && (
              <div className="bg-green-50 border border-green-200 text-green-700 rounded-lg px-4 py-3 text-sm flex items-center gap-2">
                <Icon name="CheckCircleIcon" size={16} />
                {inviteSuccess}
              </div>
            )}

            <div>
              <label className="block text-xs font-semibold text-foreground mb-1.5">
                {isRTL ? 'الاسم الكامل *' : 'Full Name *'}
              </label>
              <input
                type="text"
                value={inviteForm.full_name}
                onChange={e => setInviteForm(f => ({ ...f, full_name: e.target.value }))}
                placeholder={isRTL ? 'اسم الموظف' : 'Employee name'}
                className="w-full px-3 py-2.5 text-sm border border-border rounded-xl bg-background focus:outline-none focus:ring-2 focus:ring-primary/30"
                required
              />
            </div>

            <div>
              <label className="block text-xs font-semibold text-foreground mb-1.5">
                {isRTL ? 'البريد الإلكتروني *' : 'Email Address *'}
              </label>
              <input
                type="email"
                value={inviteForm.email}
                onChange={e => setInviteForm(f => ({ ...f, email: e.target.value }))}
                placeholder={isRTL ? 'البريد الإلكتروني للموظف' : 'Employee email'}
                className="w-full px-3 py-2.5 text-sm border border-border rounded-xl bg-background focus:outline-none focus:ring-2 focus:ring-primary/30"
                required
              />
              <p className="text-[10px] text-muted-foreground mt-1">
                {isRTL
                  ? 'إذا كان الحساب موجوداً سيتم ربطه فوراً، وإلا سيُرسل دعوة للتسجيل' :'If account exists it will be linked immediately, otherwise an invitation will be sent'}
              </p>
            </div>

            {/* Permissions */}
            <div className="bg-muted/30 rounded-xl p-4 space-y-3">
              <p className="text-xs font-bold text-foreground">
                {isRTL ? 'الصلاحيات الممنوحة' : 'Granted Permissions'}
              </p>
              {[
                { key: 'can_manage_products', labelAr: 'إدارة المنتجات والمخزون', labelEn: 'Manage products & inventory' },
                { key: 'can_respond_rfq', labelAr: 'الرد على طلبات الأسعار (RFQ)', labelEn: 'Respond to RFQ requests' },
                { key: 'can_view_orders', labelAr: 'عرض الطلبات', labelEn: 'View orders' },
                { key: 'can_view_inventory', labelAr: 'عرض المخزون', labelEn: 'View inventory' },
              ].map(perm => (
                <label key={perm.key} className="flex items-center gap-3 cursor-pointer">
                  <input
                    type="checkbox"
                    checked={inviteForm[perm.key as keyof typeof inviteForm] as boolean}
                    onChange={e => setInviteForm(f => ({ ...f, [perm.key]: e.target.checked }))}
                    className="w-4 h-4 rounded border-border text-primary"
                  />
                  <span className="text-xs text-foreground">
                    {isRTL ? perm.labelAr : perm.labelEn}
                  </span>
                </label>
              ))}
              <div className="flex items-center gap-2 pt-1 border-t border-border/50">
                <Icon name="LockClosedIcon" size={12} className="text-red-500" />
                <p className="text-[10px] text-red-600 font-medium">
                  {isRTL
                    ? 'الوصول المالي محظور دائماً على الممثلين' :'Financial access is always blocked for agents'}
                </p>
              </div>
            </div>

            <div>
              <label className="block text-xs font-semibold text-foreground mb-1.5">
                {isRTL ? 'ملاحظات (اختياري)' : 'Notes (optional)'}
              </label>
              <textarea
                value={inviteForm.notes}
                onChange={e => setInviteForm(f => ({ ...f, notes: e.target.value }))}
                rows={2}
                placeholder={isRTL ? 'ملاحظات إضافية...' : 'Additional notes...'}
                className="w-full px-3 py-2.5 text-sm border border-border rounded-xl bg-background focus:outline-none focus:ring-2 focus:ring-primary/30 resize-none"
              />
            </div>

            <div className="flex gap-3 pt-2">
              <button
                type="button"
                onClick={() => setShowInviteModal(false)}
                className="flex-1 px-4 py-2.5 text-sm font-semibold border border-border rounded-xl hover:bg-muted transition-colors"
              >
                {isRTL ? 'إلغاء' : 'Cancel'}
              </button>
              <button
                type="submit"
                disabled={inviteLoading}
                className="flex-1 px-4 py-2.5 text-sm font-semibold bg-primary text-primary-foreground rounded-xl hover:opacity-90 transition-opacity disabled:opacity-50 flex items-center justify-center gap-2"
              >
                {inviteLoading ? (
                  <><Icon name="ArrowPathIcon" size={14} className="animate-spin" /> {isRTL ? 'جاري الإضافة...' : 'Adding...'}</>
                ) : (
                  <><Icon name="UserPlusIcon" size={14} /> {isRTL ? 'إضافة الممثل' : 'Add Agent'}</>
                )}
              </button>
            </div>
          </form>
        </div>
      )}
    </div>
  );
}
