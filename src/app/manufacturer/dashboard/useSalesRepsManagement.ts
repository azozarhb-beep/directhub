'use client';

import React, { useCallback, useState } from 'react';
import type { SupabaseClient } from '@supabase/supabase-js';
import type { SalesRep } from './dashboardTypes';

interface UseSalesRepsManagementArgs {
  userId: string | undefined;
  supabase: SupabaseClient;
  md: any;
}

const EMPTY_INVITE = { email: '', full_name: '', role: 'sales_rep', notes: '' };

function generateInvitationToken(): string {
  const bytes = new Uint8Array(24);
  crypto.getRandomValues(bytes);
  return `inv_${Array.from(bytes, b => b.toString(16).padStart(2, '0')).join('')}`;
}

/**
 * Factory-owner sales team management. Every write is pinned to the signed-in
 * owner (factory_owner_id = auth.uid()); the database enforces the same rule via
 * RLS + the factory_sales_reps_guard trigger, so this is never UI-only.
 */
export function useSalesRepsManagement({ userId, supabase, md }: UseSalesRepsManagementArgs) {
  const [salesReps, setSalesReps] = useState<SalesRep[]>([]);
  const [salesRepsLoading, setSalesRepsLoading] = useState(false);
  const [showInviteModal, setShowInviteModal] = useState(false);
  const [inviteForm, setInviteForm] = useState(EMPTY_INVITE);
  const [inviteLoading, setInviteLoading] = useState(false);
  const [inviteError, setInviteError] = useState('');
  const [inviteSuccess, setInviteSuccess] = useState('');
  const [repActionLoading, setRepActionLoading] = useState<string | null>(null);

  const fetchSalesReps = useCallback(async () => {
    if (!userId) return;
    setSalesRepsLoading(true);
    try {
      const { data, error } = await supabase
        .from('factory_sales_reps')
        .select('*')
        .eq('factory_owner_id', userId)
        .order('created_at', { ascending: false });
      if (error) throw error;
      setSalesReps((data as SalesRep[]) || []);
    } catch (err) {
      console.error('Failed to fetch sales reps:', err);
    } finally {
      setSalesRepsLoading(false);
    }
  }, [userId, supabase]);

  const handleInviteSalesRep = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!userId) return;
    setInviteError('');
    setInviteSuccess('');
    if (!inviteForm.email.trim()) { setInviteError(md.emailRequiredMsg); return; }
    if (!inviteForm.full_name.trim()) { setInviteError(md.fullNameRequiredMsg); return; }
    setInviteLoading(true);
    try {
      const { error } = await supabase.from('factory_sales_reps').insert({
        factory_owner_id: userId,
        invited_email: inviteForm.email.trim().toLowerCase(),
        full_name: inviteForm.full_name.trim(),
        role: inviteForm.role,
        status: 'pending',
        invitation_token: generateInvitationToken(),
        notes: inviteForm.notes.trim() || null,
        can_manage_products: true,
        can_view_inventory: true,
        can_respond_rfq: true,
        can_view_orders: true,
      });
      if (error) throw error;
      setInviteSuccess((md.inviteSuccessMsg || '').replace('{name}', inviteForm.full_name));
      setInviteForm(EMPTY_INVITE);
      await fetchSalesReps();
      setTimeout(() => { setShowInviteModal(false); setInviteSuccess(''); }, 2500);
    } catch (err: any) {
      setInviteError(err.message || md.addRepFailed);
    } finally {
      setInviteLoading(false);
    }
  };

  const handleRepStatusChange = async (repId: string, newStatus: 'active' | 'suspended' | 'revoked') => {
    if (!userId) return;
    setRepActionLoading(repId);
    try {
      const updateData: Record<string, unknown> = { status: newStatus };
      if (newStatus === 'suspended') updateData.suspended_at = new Date().toISOString();
      const { error } = await supabase
        .from('factory_sales_reps')
        .update(updateData)
        .eq('id', repId)
        .eq('factory_owner_id', userId);
      if (error) throw error;
      await fetchSalesReps();
    } catch (err) {
      console.error('Failed to update rep status:', err);
    } finally {
      setRepActionLoading(null);
    }
  };

  const handleDeleteRep = async (repId: string) => {
    if (!userId) return;
    if (!confirm(md.confirmDeleteRep)) return;
    setRepActionLoading(repId);
    try {
      const { error } = await supabase
        .from('factory_sales_reps')
        .delete()
        .eq('id', repId)
        .eq('factory_owner_id', userId);
      if (error) throw error;
      setSalesReps(prev => prev.filter(r => r.id !== repId));
    } catch (err) {
      console.error('Failed to delete rep:', err);
    } finally {
      setRepActionLoading(null);
    }
  };

  return {
    salesReps,
    salesRepsLoading,
    showInviteModal,
    setShowInviteModal,
    inviteForm,
    setInviteForm,
    inviteLoading,
    inviteError,
    setInviteError,
    inviteSuccess,
    setInviteSuccess,
    repActionLoading,
    fetchSalesReps,
    handleInviteSalesRep,
    handleRepStatusChange,
    handleDeleteRep,
  };
}
