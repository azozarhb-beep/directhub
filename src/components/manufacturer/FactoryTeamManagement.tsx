'use client';

import React, { useState, useEffect, useCallback, useMemo } from 'react';
import { createClient } from '@/lib/supabase/client';
import Icon from '@/components/ui/AppIcon';

const PHONE_PLACEHOLDER_DOMAIN = 'phone.directhub.local';

function normalizeYemeniPhone(raw: string): string | null {
  let digits = (raw || '').replace(/[\s\-()+]/g, '');
  if (digits.startsWith('00967')) digits = digits.slice(5);
  else if (digits.startsWith('967')) digits = digits.slice(3);
  if (digits.startsWith('0')) digits = digits.slice(1);
  if (!/^7\d{8}$/.test(digits)) return null;
  return `+967${digits}`;
}

function isPlaceholderEmail(email: string | null | undefined): boolean {
  return !!email && email.endsWith(`@${PHONE_PLACEHOLDER_DOMAIN}`);
}

const YEMEN_GOVERNORATES = [
  'أمانة العاصمة (صنعاء)',
  'صنعاء (المحافظة)',
  'عدن',
  'تعز',
  'الحديدة',
  'حضرموت (المكلا)',
  'حضرموت (سيئون)',
  'مأرب',
  'إب',
  'ذمار',
  'لحج',
  'أبين',
  'شبوة',
  'صعدة',
  'عمران',
  'حجة',
  'البيضاء',
  'الضالع',
  'المهرة',
  'المحويت',
  'ريمة',
  'الجوف',
  'سقطرى',
  'جميع المحافظات (مبيعات عامة)',
];

// ── Types ─────────────────────────────────────────────────────────────────────

interface TeamMember {
  id: string;
  full_name: string;
  email: string;
  phone?: string;
  role: string;
  is_active: boolean;
  factory_id: string | null;
  created_at: string;
  can_manage_products?: boolean;
  can_respond_rfq?: boolean;
  can_view_orders?: boolean;
  can_view_inventory?: boolean;
  sales_rep_id?: string | null;
  sales_rep_status?: string | null;
  pending_invite?: boolean;
  invite_phone?: string;
  invitation_token?: string | null;
  assigned_governorate?: string;
  commission_rate?: string;
  notes?: string;
}

interface FactoryTeamManagementProps {
  factoryOwnerId: string;
  isRTL?: boolean;
}

function extractInvitePhone(invitedEmail: string | null | undefined, notes: string | null | undefined): string {
  const fromNotes = (notes || '').match(/\+?\d{9,15}/);
  if (fromNotes) return fromNotes[0].replace('+', '');
  if (invitedEmail && invitedEmail.endsWith(`@${PHONE_PLACEHOLDER_DOMAIN}`)) {
    return invitedEmail.split('@')[0].replace(/\D/g, '');
  }
  return '';
}

function extractDetailsFromNotes(notes: string | null | undefined) {
  const text = notes || '';
  let gov = 'أمانة العاصمة (صنعاء)';
  let comm = '';

  const govMatch = text.match(/المحافظة:\s*([^|]+)/);
  if (govMatch && govMatch[1]) gov = govMatch[1].trim();

  const commMatch = text.match(/العمولة:\s*([^|]+)/);
  if (commMatch && commMatch[1]) comm = commMatch[1].trim();

  return { gov, comm };
}

function buildWhatsAppInviteUrl(name: string, phone: string, factoryName: string, token: string, gov?: string): string {
  const clean = (phone || '').replace(/\D/g, '');
  const govText = gov ? ` لمحافظة (${gov})` : '';
  const text = `مرحباً ${name}، تمت إضافتك كممثل مبيعات معتمد${govText} لمصنع ${factoryName} على منصة Direct Hub. اضغط على الرابط التالي لتعيين كلمة المرور وتفعيل حسابك مباشرة:\nhttps://direct-hub.net/accept-invite?token=${token}`;
  return `https://wa.me/${clean}?text=${encodeURIComponent(text)}`;
}

function generateInvitationToken(): string {
  if (typeof crypto !== 'undefined' && typeof crypto.randomUUID === 'function') {
    return crypto.randomUUID();
  }
  const bytes = new Uint8Array(16);
  crypto.getRandomValues(bytes);
  return Array.from(bytes, (b) => b.toString(16).padStart(2, '0')).join('');
}

// ── Component ─────────────────────────────────────────────────────────────────

export default function FactoryTeamManagement({ factoryOwnerId, isRTL = true }: FactoryTeamManagementProps) {
  const supabase = createClient();

  const [members, setMembers] = useState<TeamMember[]>([]);
  const [loading, setLoading] = useState(true);
  const [actionLoading, setActionLoading] = useState<string | null>(null);
  const [factoryName, setFactoryName] = useState('');
  const [filterGov, setFilterGov] = useState<string>('all');

  useEffect(() => {
    let cancelled = false;
    const loadFactoryName = async () => {
      const { data } = await supabase
        .from('user_profiles')
        .select('company_name, full_name')
        .eq('id', factoryOwnerId)
        .maybeSingle();
      const p = data as { company_name?: string | null; full_name?: string | null } | null;
      if (!cancelled) setFactoryName(p?.company_name?.trim() || p?.full_name?.trim() || 'المصنع');
    };
    void loadFactoryName();
    return () => {
      cancelled = true;
    };
  }, [factoryOwnerId, supabase]);

  // Invite form state
  const [showInviteModal, setShowInviteModal] = useState(false);
  const [inviteForm, setInviteForm] = useState({
    email: '',
    phone: '',
    full_name: '',
    assigned_governorate: 'أمانة العاصمة (صنعاء)',
    commission_rate: '2.5%',
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
      const { data: agentProfiles, error } = await supabase
        .from('user_profiles')
        .select('id, full_name, email, phone, role, is_active, factory_id, created_at')
        .eq('factory_id', factoryOwnerId)
        .eq('role', 'manufacturer_agent')
        .order('created_at', { ascending: false });

      if (error) throw error;

      const { data: salesReps } = await supabase
        .from('factory_sales_reps')
        .select('id, rep_user_id, status, full_name, invited_email, notes, created_at, invitation_token, can_manage_products, can_respond_rfq, can_view_orders, can_view_inventory')
        .eq('factory_owner_id', factoryOwnerId);

      const repMap = new Map<string, any>();
      (salesReps || []).forEach((r: any) => {
        if (r.rep_user_id) repMap.set(r.rep_user_id, r);
      });

      const combined: TeamMember[] = (agentProfiles || []).map((p: any) => {
        const rep = repMap.get(p.id);
        const { gov, comm } = extractDetailsFromNotes(rep?.notes);
        return {
          id: p.id,
          full_name: p.full_name || '',
          email: isPlaceholderEmail(p.email) ? '' : (p.email || ''),
          phone: p.phone || '',
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
          assigned_governorate: gov,
          commission_rate: comm,
          notes: rep?.notes,
        };
      });

      const pendingInvites: TeamMember[] = (salesReps || [])
        .filter((r: any) => r.status === 'pending' && !r.rep_user_id)
        .map((r: any) => {
          const { gov, comm } = extractDetailsFromNotes(r.notes);
          return {
            id: `pending_${r.id}`,
            full_name: r.full_name || '',
            email: isPlaceholderEmail(r.invited_email) ? '' : (r.invited_email || ''),
            phone: '',
            role: 'manufacturer_agent',
            is_active: true,
            factory_id: factoryOwnerId,
            created_at: r.created_at || new Date(0).toISOString(),
            can_manage_products: r.can_manage_products ?? true,
            can_respond_rfq: r.can_respond_rfq ?? true,
            can_view_orders: r.can_view_orders ?? true,
            can_view_inventory: r.can_view_inventory ?? true,
            sales_rep_id: r.id,
            sales_rep_status: 'pending',
            pending_invite: true,
            invite_phone: extractInvitePhone(r.invited_email, r.notes),
            invitation_token: r.invitation_token ?? null,
            assigned_governorate: gov,
            commission_rate: comm,
            notes: r.notes,
          };
        });

      setMembers([...pendingInvites, ...combined]);
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
    if (!confirm('هل أنت متأكد من إزالة هذا المندوب من فريق مبيعات المصنع؟')) return;
    setActionLoading(memberId);
    try {
      const { error } = await supabase
        .from('user_profiles')
        .update({ factory_id: null, role: 'buyer', is_active: false })
        .eq('id', memberId)
        .eq('factory_id', factoryOwnerId);
      if (error) throw error;

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

    if (!inviteForm.full_name.trim()) { setInviteError('يرجى إدخال اسم المندوب كاملاً'); return; }
    const normalizedPhone = normalizeYemeniPhone(inviteForm.phone);
    if (!normalizedPhone) { setInviteError('أدخل رقم هاتف يمني صحيح يبدأ بـ 7 (مثال: 771234567)'); return; }
    const emailValue = inviteForm.email.trim().toLowerCase();
    if (emailValue && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(emailValue)) { setInviteError('صيغة البريد الإلكتروني غير صحيحة'); return; }
    const invitedEmail = emailValue || `${normalizedPhone.replace('+', '')}@${PHONE_PLACEHOLDER_DOMAIN}`;
    const localPhone = normalizedPhone.replace('+967', '');

    const phoneNote = `هاتف/واتساب: ${normalizedPhone}`;
    const govNote = `المحافظة: ${inviteForm.assigned_governorate}`;
    const commNote = `العمولة: ${inviteForm.commission_rate}`;
    const combinedNotes = [phoneNote, govNote, commNote, inviteForm.notes.trim()].filter(Boolean).join(' | ');

    setInviteLoading(true);
    try {
      let existingProfile: { id: string; role: string; factory_id: string | null } | null = null;
      if (emailValue) {
        const { data } = await supabase
          .from('user_profiles')
          .select('id, role, factory_id')
          .eq('email', emailValue)
          .maybeSingle();
        existingProfile = data;
      }
      if (!existingProfile) {
        const { data } = await supabase
          .from('user_profiles')
          .select('id, role, factory_id')
          .in('phone', [normalizedPhone, localPhone, `967${localPhone}`, `0${localPhone}`])
          .limit(1)
          .maybeSingle();
        existingProfile = data;
      }

      if (existingProfile) {
        if (existingProfile.factory_id && existingProfile.factory_id !== factoryOwnerId) {
          setInviteError('هذا المندوب مسجل مسبقاً ومرتبط بمصنع آخر');
          setInviteLoading(false);
          return;
        }

        const { error: updateError } = await supabase
          .from('user_profiles')
          .update({
            factory_id: factoryOwnerId,
            role: 'manufacturer_agent',
            is_active: true,
          })
          .eq('id', existingProfile.id);
        if (updateError) throw updateError;

        const token = generateInvitationToken();
        await supabase.from('factory_sales_reps').upsert({
          factory_owner_id: factoryOwnerId,
          rep_user_id: existingProfile.id,
          invited_email: invitedEmail,
          full_name: inviteForm.full_name.trim(),
          role: 'sales_rep',
          status: 'active',
          invitation_token: token,
          accepted_at: new Date().toISOString(),
          can_manage_products: inviteForm.can_manage_products,
          can_respond_rfq: inviteForm.can_respond_rfq,
          can_view_orders: inviteForm.can_view_orders,
          can_view_inventory: inviteForm.can_view_inventory,
          notes: combinedNotes,
        }, { onConflict: 'rep_user_id,factory_owner_id', ignoreDuplicates: false });

      } else {
        const token = generateInvitationToken();
        const { error: insertError } = await supabase.from('factory_sales_reps').insert({
          factory_owner_id: factoryOwnerId,
          rep_user_id: null,
          invited_email: invitedEmail,
          full_name: inviteForm.full_name.trim(),
          role: 'sales_rep',
          status: 'pending',
          invitation_token: token,
          can_manage_products: inviteForm.can_manage_products,
          can_respond_rfq: inviteForm.can_respond_rfq,
          can_view_orders: inviteForm.can_view_orders,
          can_view_inventory: inviteForm.can_view_inventory,
          notes: combinedNotes,
        });
        if (insertError) throw insertError;
      }

      setInviteSuccess(`تمت إضافة المندوب (${inviteForm.full_name}) وتعيينه لمحافظة ${inviteForm.assigned_governorate} بنجاح`);
      setInviteForm({
        email: '',
        phone: '',
        full_name: '',
        assigned_governorate: 'أمانة العاصمة (صنعاء)',
        commission_rate: '2.5%',
        can_manage_products: true,
        can_respond_rfq: true,
        can_view_orders: true,
        can_view_inventory: true,
        notes: '',
      });
      await fetchTeamMembers();
      setTimeout(() => { setShowInviteModal(false); setInviteSuccess(''); }, 2000);
    } catch (err: any) {
      setInviteError(err.message || 'فشل في إضافة الممثل');
    } finally {
      setInviteLoading(false);
    }
  };

  const filteredMembers = useMemo(() => {
    if (filterGov === 'all') return members;
    return members.filter(m => m.assigned_governorate?.includes(filterGov));
  }, [members, filterGov]);

  // ── Render ────────────────────────────────────────────────────────────────
  return (
    <div className="space-y-5" dir="rtl">
      {/* Header */}
      <div className="bg-gradient-to-r from-indigo-700 to-purple-800 rounded-2xl p-5 text-white shadow-md">
        <div className="flex items-center justify-between gap-4 flex-wrap">
          <div className="flex items-center gap-3.5">
            <div className="w-12 h-12 rounded-2xl bg-white/20 flex items-center justify-center shrink-0">
              <Icon name="UserGroupIcon" size={24} className="text-white" />
            </div>
            <div>
              <h2 className="text-lg font-bold">إدارة مناديب وموظفي مبيعات المصنع بالمحافظات</h2>
              <p className="text-xs sm:text-sm text-white/85 mt-0.5">
                توزيع صلاحيات المناديب في المحافظات لتسويق المنتجات والرد على طلبات الأسعار والعمولات.
              </p>
            </div>
          </div>
          <button
            onClick={() => { setShowInviteModal(true); setInviteError(''); setInviteSuccess(''); }}
            className="flex items-center gap-2 px-4 py-2.5 bg-white text-indigo-900 text-xs sm:text-sm font-bold rounded-xl hover:bg-white/90 transition-all shadow-sm shrink-0"
          >
            <Icon name="UserPlusIcon" size={16} />
            + تعيين مندوب مبيعات جديد
          </button>
        </div>
      </div>

      {/* Stats Cards */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
        <div className="bg-card border border-border p-3.5 rounded-xl text-right">
          <p className="text-2xl font-black text-foreground">{members.length}</p>
          <p className="text-xs font-semibold text-muted-foreground mt-0.5">إجمالي المناديب</p>
        </div>
        <div className="bg-emerald-50/70 border border-emerald-200 p-3.5 rounded-xl text-right">
          <p className="text-2xl font-black text-emerald-800">{members.filter(m => m.is_active && !m.pending_invite).length}</p>
          <p className="text-xs font-bold text-emerald-700 mt-0.5">مناديب نشطون بالميدان</p>
        </div>
        <div className="bg-amber-50/70 border border-amber-200 p-3.5 rounded-xl text-right">
          <p className="text-2xl font-black text-amber-800">{members.filter(m => m.pending_invite).length}</p>
          <p className="text-xs font-bold text-amber-700 mt-0.5">بانتظار قبول الدعوة</p>
        </div>
        <div className="bg-purple-50/70 border border-purple-200 p-3.5 rounded-xl text-right">
          <p className="text-2xl font-black text-purple-800">
            {new Set(members.map(m => m.assigned_governorate).filter(Boolean)).size}
          </p>
          <p className="text-xs font-bold text-purple-700 mt-0.5">محافظات مغطاة</p>
        </div>
      </div>

      {/* Permission Matrix */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        <div className="bg-emerald-50 border border-emerald-200 rounded-xl p-4">
          <div className="flex items-center gap-2 mb-2.5">
            <Icon name="CheckCircleIcon" size={18} className="text-emerald-600" />
            <p className="text-xs sm:text-sm font-bold text-emerald-900">صلاحيات المندوب الميداني المعتمدة</p>
          </div>
          <ul className="space-y-1.5 text-xs text-emerald-800 font-medium">
            <li className="flex items-center gap-2"><Icon name="CheckIcon" size={13} className="text-emerald-600" /> تسويق وعرض كتالوج منتجات المصنع للعملاء بالمحافظة</li>
            <li className="flex items-center gap-2"><Icon name="CheckIcon" size={13} className="text-emerald-600" /> تقديم عروض الأسعار والرد على طلبات الشراء (RFQ)</li>
            <li className="flex items-center gap-2"><Icon name="CheckIcon" size={13} className="text-emerald-600" /> متابعة أوامر التوريد ومواعيد التسليم مع المشترين</li>
          </ul>
        </div>
        <div className="bg-red-50 border border-red-200 rounded-xl p-4">
          <div className="flex items-center gap-2 mb-2.5">
            <Icon name="LockClosedIcon" size={18} className="text-red-600" />
            <p className="text-xs sm:text-sm font-bold text-red-900">الأمان المالي (محظور تماماً على المناديب)</p>
          </div>
          <ul className="space-y-1.5 text-xs text-red-700 font-medium">
            <li className="flex items-center gap-2"><Icon name="XMarkIcon" size={13} className="text-red-500" /> حسابات البنوك والمحافظ وأرقام الآيبان محجوبة بالكامل</li>
            <li className="flex items-center gap-2"><Icon name="XMarkIcon" size={13} className="text-red-500" /> لا يمكن للمندوب سحب أو تحويل مستحقات الضمان المالي</li>
            <li className="flex items-center gap-2"><Icon name="XMarkIcon" size={13} className="text-red-500" /> السحب المالي محصور بمالك المصنع المسجل فقط</li>
          </ul>
        </div>
      </div>

      {/* Filter by Governorate */}
      <div className="bg-card border border-border rounded-xl p-3 flex items-center justify-between gap-3 flex-wrap">
        <span className="text-xs font-bold text-foreground">تصفية المناديب حسب المحافظة:</span>
        <select
          value={filterGov}
          onChange={(e) => setFilterGov(e.target.value)}
          className="h-9 px-3 rounded-lg border border-border bg-background text-foreground text-xs font-semibold focus:outline-none focus:border-indigo-500"
        >
          <option value="all">كافة المحافظات ({members.length})</option>
          {YEMEN_GOVERNORATES.map(g => (
            <option key={g} value={g}>{g}</option>
          ))}
        </select>
      </div>

      {/* Members List */}
      {loading ? (
        <div className="flex items-center justify-center py-16 bg-card border border-border rounded-2xl">
          <Icon name="ArrowPathIcon" size={24} className="animate-spin text-primary" />
        </div>
      ) : filteredMembers.length === 0 ? (
        <div className="bg-card border border-border rounded-2xl p-12 text-center shadow-sm">
          <div className="w-16 h-16 rounded-2xl bg-muted flex items-center justify-center mx-auto mb-4">
            <Icon name="UserGroupIcon" size={28} className="text-muted-foreground" />
          </div>
          <p className="text-sm font-bold text-foreground mb-1">لا يوجد مناديب مبيعات في هذه الفئة</p>
          <p className="text-xs text-muted-foreground mb-4">
            قم بإضافة موظفيك أو وكلائك التجاريين لتمثيل المصنع ميدانياً وجلب صفقات التوريد.
          </p>
          <button
            onClick={() => { setShowInviteModal(true); setInviteError(''); setInviteSuccess(''); }}
            className="inline-flex items-center gap-2 px-4 py-2 bg-primary text-primary-foreground text-xs sm:text-sm font-bold rounded-xl shadow-sm hover:opacity-90 transition-opacity"
          >
            <Icon name="UserPlusIcon" size={16} />
            + إضافة أول مندوب مبيعات
          </button>
        </div>
      ) : (
        <div className="space-y-3">
          {filteredMembers.map((member) => (
            <div key={member.id} className="bg-card border border-border rounded-2xl p-4 shadow-sm hover:border-indigo-200 transition-all">
              <div className="flex items-center justify-between gap-4 flex-wrap">
                <div className="flex items-center gap-3.5 min-w-0">
                  <div className="w-11 h-11 rounded-2xl bg-indigo-100 flex items-center justify-center shrink-0 text-indigo-700 font-bold text-sm">
                    {(member.full_name || member.email).charAt(0).toUpperCase()}
                  </div>
                  <div>
                    <div className="flex items-center gap-2 flex-wrap">
                      <p className="text-sm font-bold text-foreground">{member.full_name || member.email}</p>
                      <span className="text-[10px] font-bold px-2 py-0.5 rounded-full bg-indigo-50 text-indigo-700 border border-indigo-200">
                        📍 {member.assigned_governorate || 'صنعاء'}
                      </span>
                      {member.commission_rate && (
                        <span className="text-[10px] font-bold px-2 py-0.5 rounded-full bg-emerald-50 text-emerald-700 border border-emerald-200">
                          عمولة: {member.commission_rate}
                        </span>
                      )}
                      <span className={`text-[10px] font-bold px-2 py-0.5 rounded-full border ${
                        member.is_active ? 'bg-green-50 text-green-700 border-green-200' : 'bg-red-50 text-red-700 border-red-200'
                      }`}>
                        {member.is_active ? 'نشط' : 'موقوف'}
                      </span>
                      {member.sales_rep_status === 'pending' && (
                        <span className="text-[10px] font-bold px-2 py-0.5 rounded-full border bg-amber-50 text-amber-700 border-amber-200">
                          بانتظار قبول الدعوة
                        </span>
                      )}
                    </div>
                    {member.phone && (
                      <p className="text-xs text-muted-foreground font-mono mt-0.5" dir="ltr">{member.phone}</p>
                    )}
                  </div>
                </div>

                {/* Actions */}
                <div className="flex items-center gap-2 shrink-0">
                  {member.pending_invite && member.invite_phone && member.invitation_token && (
                    <a
                      href={buildWhatsAppInviteUrl(member.full_name || member.email, member.invite_phone, factoryName || 'المصنع', member.invitation_token, member.assigned_governorate)}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="px-3 py-1.5 text-xs font-bold rounded-xl bg-emerald-600 text-white hover:bg-emerald-700 transition-colors shadow-sm flex items-center gap-1.5"
                    >
                      <span>📲 إرسال الدعوة عبر واتساب</span>
                    </a>
                  )}
                  {!member.pending_invite && (
                    <button
                      onClick={() => handleToggleActive(member.id, member.is_active)}
                      disabled={actionLoading === member.id}
                      className={`px-3 py-1.5 text-xs font-bold rounded-xl transition-colors disabled:opacity-50 ${
                        member.is_active ? 'bg-amber-100 text-amber-800 hover:bg-amber-200' : 'bg-green-100 text-green-800 hover:bg-green-200'
                      }`}
                    >
                      {actionLoading === member.id ? (
                        <Icon name="ArrowPathIcon" size={12} className="animate-spin" />
                      ) : member.is_active ? 'إيقاف مؤقت' : 'تفعيل'}
                    </button>
                  )}
                  {!member.pending_invite && (
                    <button
                      onClick={() => handleRemoveMember(member.id)}
                      disabled={actionLoading === member.id}
                      className="w-8 h-8 rounded-xl hover:bg-red-50 flex items-center justify-center transition-colors border border-transparent hover:border-red-200"
                      title="إزالة المندوب"
                    >
                      <Icon name="TrashIcon" size={15} className="text-red-500" />
                    </button>
                  )}
                </div>
              </div>

              {/* Permission badges */}
              <div className="mt-3 pt-2.5 border-t border-border/50 flex items-center gap-1.5 flex-wrap text-[11px]">
                <span className="text-muted-foreground font-medium text-[10px]">الصلاحيات:</span>
                {member.can_manage_products && (
                  <span className="px-2 py-0.5 bg-muted rounded-md text-foreground font-semibold">عرض وإدارة المنتجات</span>
                )}
                {member.can_respond_rfq && (
                  <span className="px-2 py-0.5 bg-muted rounded-md text-foreground font-semibold">تقديم عروض الأسعار</span>
                )}
                {member.can_view_orders && (
                  <span className="px-2 py-0.5 bg-muted rounded-md text-foreground font-semibold">متابعة الطلبات</span>
                )}
                {member.can_view_inventory && (
                  <span className="px-2 py-0.5 bg-muted rounded-md text-foreground font-semibold">معاينة مخزون الخام</span>
                )}
                <span className="px-2 py-0.5 bg-red-50 text-red-600 rounded-md font-bold">الحسابات والمالية محجوبة 🔒</span>
              </div>
            </div>
          ))}
        </div>
      )}

      {/* Invite Modal */}
      {showInviteModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 p-4 backdrop-blur-sm">
          <div className="bg-card border border-border rounded-2xl w-full max-w-lg max-h-[90vh] overflow-y-auto shadow-2xl flex flex-col">
            <div className="flex items-center justify-between px-5 py-4 border-b border-border bg-card shrink-0">
              <div className="flex items-center gap-2.5">
                <div className="w-9 h-9 rounded-xl bg-indigo-500/15 flex items-center justify-center">
                  <Icon name="UserPlusIcon" size={18} className="text-indigo-600" />
                </div>
                <h3 className="font-bold text-foreground text-sm sm:text-base">
                  تعيين مندوب مبيعات وممثل مصنع جديد
                </h3>
              </div>
              <button
                onClick={() => setShowInviteModal(false)}
                className="w-8 h-8 rounded-lg hover:bg-muted flex items-center justify-center transition-colors"
              >
                <Icon name="XMarkIcon" size={18} className="text-muted-foreground" />
              </button>
            </div>

            <form onSubmit={handleInviteAgent} className="p-5 space-y-4">
              {inviteError && (
                <div className="bg-red-50 border border-red-200 text-red-700 rounded-xl px-4 py-2.5 text-xs font-bold flex items-center gap-2">
                  <Icon name="ExclamationCircleIcon" size={16} />
                  {inviteError}
                </div>
              )}
              {inviteSuccess && (
                <div className="bg-green-50 border border-green-200 text-green-700 rounded-xl px-4 py-2.5 text-xs font-bold flex items-center gap-2">
                  <Icon name="CheckCircleIcon" size={16} />
                  {inviteSuccess}
                </div>
              )}

              <div>
                <label className="block text-xs font-bold text-foreground mb-1.5">
                  اسم المندوب الكامل *
                </label>
                <input
                  type="text"
                  value={inviteForm.full_name}
                  onChange={e => setInviteForm(f => ({ ...f, full_name: e.target.value }))}
                  placeholder="مثال: يحيى عبده الشميري"
                  className="w-full px-3 py-2 text-xs sm:text-sm border border-border rounded-xl bg-background focus:outline-none focus:border-indigo-500"
                  required
                />
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs font-bold text-foreground mb-1.5">
                    رقم الهاتف / واتساب (يمني) *
                  </label>
                  <input
                    type="tel"
                    inputMode="tel"
                    dir="ltr"
                    value={inviteForm.phone}
                    onChange={e => setInviteForm(f => ({ ...f, phone: e.target.value }))}
                    placeholder="77X XXX XXX"
                    className="w-full px-3 py-2 text-xs sm:text-sm font-mono border border-border rounded-xl bg-background focus:outline-none focus:border-indigo-500 text-right"
                    required
                  />
                </div>
                <div>
                  <label className="block text-xs font-bold text-foreground mb-1.5">
                    نطاق المحافظة المسندة *
                  </label>
                  <select
                    value={inviteForm.assigned_governorate}
                    onChange={e => setInviteForm(f => ({ ...f, assigned_governorate: e.target.value }))}
                    className="w-full px-3 py-2 text-xs sm:text-sm border border-border rounded-xl bg-background focus:outline-none focus:border-indigo-500 font-semibold"
                  >
                    {YEMEN_GOVERNORATES.map(gov => (
                      <option key={gov} value={gov}>{gov}</option>
                    ))}
                  </select>
                </div>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs font-bold text-foreground mb-1.5">
                    نسبة / قيمة العمولة
                  </label>
                  <input
                    type="text"
                    value={inviteForm.commission_rate}
                    onChange={e => setInviteForm(f => ({ ...f, commission_rate: e.target.value }))}
                    placeholder="مثال: 2.5% أو 500 ر.ي/كرتون"
                    className="w-full px-3 py-2 text-xs sm:text-sm border border-border rounded-xl bg-background focus:outline-none focus:border-indigo-500"
                  />
                </div>
                <div>
                  <label className="block text-xs font-semibold text-muted-foreground mb-1.5">
                    البريد الإلكتروني (اختياري)
                  </label>
                  <input
                    type="email"
                    value={inviteForm.email}
                    onChange={e => setInviteForm(f => ({ ...f, email: e.target.value }))}
                    placeholder="email@example.com"
                    className="w-full px-3 py-2 text-xs sm:text-sm border border-border rounded-xl bg-background focus:outline-none focus:border-indigo-500"
                  />
                </div>
              </div>

              {/* Permissions */}
              <div className="bg-muted/40 rounded-xl p-3.5 space-y-2.5 border border-border">
                <p className="text-xs font-bold text-foreground">الصلاحيات الممنوحة للمندوب بالميدان:</p>
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 text-xs">
                  <label className="flex items-center gap-2 cursor-pointer">
                    <input
                      type="checkbox"
                      checked={inviteForm.can_manage_products}
                      onChange={e => setInviteForm(f => ({ ...f, can_manage_products: e.target.checked }))}
                      className="w-4 h-4 rounded text-indigo-600"
                    />
                    <span>إدراج المنتجات بالكتالوج</span>
                  </label>
                  <label className="flex items-center gap-2 cursor-pointer">
                    <input
                      type="checkbox"
                      checked={inviteForm.can_respond_rfq}
                      onChange={e => setInviteForm(f => ({ ...f, can_respond_rfq: e.target.checked }))}
                      className="w-4 h-4 rounded text-indigo-600"
                    />
                    <span>الرد على عروض الأسعار</span>
                  </label>
                  <label className="flex items-center gap-2 cursor-pointer">
                    <input
                      type="checkbox"
                      checked={inviteForm.can_view_orders}
                      onChange={e => setInviteForm(f => ({ ...f, can_view_orders: e.target.checked }))}
                      className="w-4 h-4 rounded text-indigo-600"
                    />
                    <span>معاينة أوامر التوريد</span>
                  </label>
                  <label className="flex items-center gap-2 cursor-pointer">
                    <input
                      type="checkbox"
                      checked={inviteForm.can_view_inventory}
                      onChange={e => setInviteForm(f => ({ ...f, can_view_inventory: e.target.checked }))}
                      className="w-4 h-4 rounded text-indigo-600"
                    />
                    <span>معاينة مخزون المواد الخام</span>
                  </label>
                </div>
              </div>

              <div>
                <label className="block text-xs font-semibold text-muted-foreground mb-1.5">
                  ملاحظات أو توجيهات للمندوب (اختياري)
                </label>
                <textarea
                  value={inviteForm.notes}
                  onChange={e => setInviteForm(f => ({ ...f, notes: e.target.value }))}
                  rows={2}
                  placeholder="مثال: مسؤول مبيعات التجزئة لقطاع البلاستيك في سوق شميلة..."
                  className="w-full px-3 py-2 text-xs sm:text-sm border border-border rounded-xl bg-background focus:outline-none focus:border-indigo-500 resize-none"
                />
              </div>

              <div className="flex gap-2.5 pt-2">
                <button
                  type="button"
                  onClick={() => setShowInviteModal(false)}
                  className="flex-1 px-4 py-2.5 text-xs sm:text-sm font-semibold border border-border rounded-xl hover:bg-muted transition-colors"
                >
                  إلغاء
                </button>
                <button
                  type="submit"
                  disabled={inviteLoading}
                  className="flex-1 px-4 py-2.5 text-xs sm:text-sm font-bold bg-indigo-600 text-white rounded-xl hover:bg-indigo-700 transition-colors disabled:opacity-50 flex items-center justify-center gap-1.5 shadow-sm"
                >
                  {inviteLoading ? (
                    <><Icon name="ArrowPathIcon" size={14} className="animate-spin" /> جارٍ الإضافة والتوليد...</>
                  ) : (
                    <><Icon name="UserPlusIcon" size={14} /> تأكيد وإرسال رابط الدعوة</>
                  )}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
