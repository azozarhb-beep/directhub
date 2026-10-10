'use client';

import React, { useState, useEffect, useCallback } from 'react';
import { createClient } from '@/lib/supabase/client';
import Icon from '@/components/ui/AppIcon';
import { useLanguage } from '@/contexts/LanguageContext';

interface AgentFactory {
  id: string;
  company_name: string;
  factory_type: string;
}

interface Complaint {
  id: string;
  agent_id: string;
  factory_reg_id: string | null;
  factory_name: string;
  complainant_name: string;
  complainant_phone: string;
  subject: string;
  description: string;
  complaint_type: string;
  priority: 'low' | 'medium' | 'high' | 'urgent';
  status: 'open' | 'in_progress' | 'resolved' | 'closed';
  agent_notes: string;
  resolution: string;
  resolved_at: string | null;
  created_at: string;
  updated_at: string;
}

const PRIORITY_CONFIG: Record<string, { label: string; color: string; bg: string }> = {
  low: { label: '', color: 'text-gray-600', bg: 'bg-gray-50 border-gray-200' },
  medium: { label: '', color: 'text-amber-600', bg: 'bg-amber-50 border-amber-200' },
  high: { label: '', color: 'text-orange-600', bg: 'bg-orange-50 border-orange-200' },
  urgent: { label: '', color: 'text-red-600', bg: 'bg-red-50 border-red-200' },
};

const STATUS_CONFIG: Record<string, { color: string; icon: string }> = {
  open: { color: 'bg-blue-50 text-blue-700 border-blue-200', icon: 'ExclamationCircleIcon' },
  in_progress: { color: 'bg-amber-50 text-amber-700 border-amber-200', icon: 'ClockIcon' },
  resolved: { color: 'bg-emerald-50 text-emerald-700 border-emerald-200', icon: 'CheckCircleIcon' },
  closed: { color: 'bg-gray-50 text-gray-600 border-gray-200', icon: 'XCircleIcon' },
};

const COMPLAINT_TYPES = [
  'product_quality',
  'delivery',
  'payment',
  'service',
  'general',
  'other',
];

interface Props {
  userId: string;
  factories: AgentFactory[];
}

export default function AgentComplaintsPanel({ userId, factories }: Props) {
  const { t, dir } = useLanguage();
  const ui = t.agentDashboard.complaints;
  const supabase = createClient();

  const [complaints, setComplaints] = useState<Complaint[]>([]);
  const [loading, setLoading] = useState(true);
  const [showForm, setShowForm] = useState(false);
  const [selectedComplaint, setSelectedComplaint] = useState<Complaint | null>(null);
  const [filterStatus, setFilterStatus] = useState('');
  const [saving, setSaving] = useState(false);
  const [successMsg, setSuccessMsg] = useState('');
  const [errorMsg, setErrorMsg] = useState('');

  const [form, setForm] = useState({
    factory_reg_id: '',
    factory_name: '',
    complainant_name: '',
    complainant_phone: '',
    subject: '',
    description: '',
    complaint_type: 'general',
    priority: 'medium' as Complaint['priority'],
  });

  const [editForm, setEditForm] = useState({
    status: 'open' as Complaint['status'],
    agent_notes: '',
    resolution: '',
  });

  const fetchComplaints = useCallback(async () => {
    setLoading(true);
    const { data, error } = await supabase
      .from('agent_complaints')
      .select('*')
      .eq('agent_id', userId)
      .order('created_at', { ascending: false });
    if (data) setComplaints(data);
    if (error) setErrorMsg(error.message);
    setLoading(false);
  }, [userId, supabase]);

  useEffect(() => {
    fetchComplaints();
  }, [fetchComplaints]);

  const handleSubmitNew = async () => {
    if (!form.complainant_name || !form.subject || !form.description) {
      setErrorMsg(ui.errorRequired);
      return;
    }
    setSaving(true);
    const factoryName = form.factory_reg_id
      ? factories.find(f => f.id === form.factory_reg_id)?.company_name || form.factory_name
      : form.factory_name;

    const { error } = await supabase.from('agent_complaints').insert({
      agent_id: userId,
      factory_reg_id: form.factory_reg_id || null,
      factory_name: factoryName,
      complainant_name: form.complainant_name,
      complainant_phone: form.complainant_phone,
      subject: form.subject,
      description: form.description,
      complaint_type: form.complaint_type,
      priority: form.priority,
      status: 'open',
    });
    if (!error) {
      setSuccessMsg(ui.successCreated);
      setTimeout(() => setSuccessMsg(''), 3000);
      setShowForm(false);
      setForm({
        factory_reg_id: '',
        factory_name: '',
        complainant_name: '',
        complainant_phone: '',
        subject: '',
        description: '',
        complaint_type: 'general',
        priority: 'medium',
      });
      fetchComplaints();
    } else {
      setErrorMsg(error.message);
    }
    setSaving(false);
  };

  const handleUpdateComplaint = async () => {
    if (!selectedComplaint) return;
    setSaving(true);
    const updatePayload: Record<string, unknown> = {
      status: editForm.status,
      agent_notes: editForm.agent_notes,
      resolution: editForm.resolution,
    };
    if (editForm.status === 'resolved' || editForm.status === 'closed') {
      updatePayload.resolved_at = new Date().toISOString();
    }
    const { error } = await supabase
      .from('agent_complaints')
      .update(updatePayload)
      .eq('id', selectedComplaint.id)
      .eq('agent_id', userId);
    if (!error) {
      setSuccessMsg(ui.successUpdated);
      setTimeout(() => setSuccessMsg(''), 3000);
      setSelectedComplaint(null);
      fetchComplaints();
    } else {
      setErrorMsg(error.message);
    }
    setSaving(false);
  };

  const openEditModal = (complaint: Complaint) => {
    setSelectedComplaint(complaint);
    setEditForm({
      status: complaint.status,
      agent_notes: complaint.agent_notes || '',
      resolution: complaint.resolution || '',
    });
  };

  const filtered = filterStatus
    ? complaints.filter(c => c.status === filterStatus)
    : complaints;

  const stats = {
    open: complaints.filter(c => c.status === 'open').length,
    in_progress: complaints.filter(c => c.status === 'in_progress').length,
    resolved: complaints.filter(c => c.status === 'resolved').length,
    urgent: complaints.filter(c => c.priority === 'urgent' && c.status !== 'closed').length,
  };

  return (
    <div dir={dir} className="space-y-4">
      {/* Alerts */}
      {successMsg && (
        <div className="flex items-center gap-2 px-4 py-3 bg-emerald-50 border border-emerald-200 text-emerald-700 rounded-xl text-sm">
          <Icon name="CheckCircleIcon" size={16} />
          {successMsg}
        </div>
      )}
      {errorMsg && (
        <div className="flex items-center gap-2 px-4 py-3 bg-red-50 border border-red-200 text-red-700 rounded-xl text-sm">
          <Icon name="ExclamationCircleIcon" size={16} />
          {errorMsg}
          <button onClick={() => setErrorMsg('')} className="mr-auto">
            <Icon name="XMarkIcon" size={14} />
          </button>
        </div>
      )}

      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-lg font-bold text-foreground">{ui.title}</h2>
          <p className="text-sm text-muted-foreground">{ui.subtitle}</p>
        </div>
        <button
          onClick={() => setShowForm(true)}
          className="flex items-center gap-2 px-4 py-2.5 bg-primary text-white rounded-xl text-sm font-semibold hover:bg-primary/90 transition-colors"
        >
          <Icon name="PlusIcon" size={15} />
          {ui.newComplaint}
        </button>
      </div>

      {/* Stats */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
        {[
          { label: ui.statOpen, value: stats.open, color: 'text-blue-600', bg: 'bg-blue-50' },
          { label: ui.statInProgress, value: stats.in_progress, color: 'text-amber-600', bg: 'bg-amber-50' },
          { label: ui.statResolved, value: stats.resolved, color: 'text-emerald-600', bg: 'bg-emerald-50' },
          { label: ui.statUrgent, value: stats.urgent, color: 'text-red-600', bg: 'bg-red-50' },
        ].map(s => (
          <div key={s.label} className="bg-card border border-border rounded-xl p-3">
            <div className={`w-8 h-8 rounded-lg ${s.bg} flex items-center justify-center mb-2`}>
              <Icon name="ExclamationTriangleIcon" size={16} className={s.color} />
            </div>
            <p className="text-xl font-bold text-foreground">{s.value}</p>
            <p className="text-xs text-muted-foreground">{s.label}</p>
          </div>
        ))}
      </div>

      {/* Filter */}
      <div className="flex gap-2 overflow-x-auto pb-1">
        {[
          { value: '', label: ui.filterAll },
          { value: 'open', label: ui.filterOpen },
          { value: 'in_progress', label: ui.filterInProgress },
          { value: 'resolved', label: ui.filterResolved },
          { value: 'closed', label: ui.filterClosed },
        ].map(f => (
          <button
            key={f.value}
            onClick={() => setFilterStatus(f.value)}
            className={`shrink-0 px-3 py-1.5 rounded-lg text-xs font-semibold border transition-colors ${
              filterStatus === f.value
                ? 'bg-primary text-white border-primary' :'bg-card border-border text-muted-foreground hover:bg-muted'
            }`}
          >
            {f.label}
          </button>
        ))}
      </div>

      {/* Complaints List */}
      {loading ? (
        <div className="flex items-center justify-center py-12">
          <div className="w-8 h-8 border-4 border-primary border-t-transparent rounded-full animate-spin" />
        </div>
      ) : filtered.length === 0 ? (
        <div className="bg-card border border-border rounded-xl p-10 text-center">
          <div className="w-12 h-12 bg-muted rounded-2xl flex items-center justify-center mx-auto mb-3">
            <Icon name="ExclamationTriangleIcon" size={22} className="text-muted-foreground" />
          </div>
          <p className="font-semibold text-foreground mb-1">{ui.emptyTitle}</p>
          <p className="text-sm text-muted-foreground">{ui.emptyHint}</p>
        </div>
      ) : (
        <div className="space-y-3">
          {filtered.map(complaint => {
            const statusCfg = STATUS_CONFIG[complaint.status] || STATUS_CONFIG.open;
            const priorityCfg = PRIORITY_CONFIG[complaint.priority] || PRIORITY_CONFIG.medium;
            return (
              <div key={complaint.id} className="bg-card border border-border rounded-xl p-4">
                <div className="flex items-start justify-between gap-3">
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2 flex-wrap mb-1">
                      <h3 className="font-bold text-foreground text-sm">{complaint.subject}</h3>
                      <span className={`text-[10px] font-semibold px-2 py-0.5 rounded-full border ${statusCfg.color}`}>
                        {ui[`status_${complaint.status}` as keyof typeof ui] as string || complaint.status}
                      </span>
                      <span className={`text-[10px] font-semibold px-2 py-0.5 rounded-full border ${priorityCfg.bg} ${priorityCfg.color}`}>
                        {ui[`priority_${complaint.priority}` as keyof typeof ui] as string || complaint.priority}
                      </span>
                    </div>
                    <p className="text-xs text-muted-foreground mb-1">
                      {complaint.complainant_name}
                      {complaint.complainant_phone && ` · ${complaint.complainant_phone}`}
                    </p>
                    {complaint.factory_name && (
                      <p className="text-xs text-muted-foreground flex items-center gap-1">
                        <Icon name="BuildingOffice2Icon" size={11} />
                        {complaint.factory_name}
                      </p>
                    )}
                    <p className="text-sm text-foreground mt-2 line-clamp-2">{complaint.description}</p>
                    {complaint.resolution && (
                      <p className="text-xs text-emerald-600 mt-1 italic">✓ {complaint.resolution}</p>
                    )}
                    <p className="text-xs text-muted-foreground mt-1">
                      {new Date(complaint.created_at).toLocaleDateString()}
                    </p>
                  </div>
                  <button
                    onClick={() => openEditModal(complaint)}
                    className="shrink-0 flex items-center gap-1.5 px-3 py-1.5 bg-primary/10 text-primary border border-primary/20 rounded-lg text-xs font-semibold hover:bg-primary/20 transition-colors"
                  >
                    <Icon name="PencilSquareIcon" size={13} />
                    {ui.manage}
                  </button>
                </div>
              </div>
            );
          })}
        </div>
      )}

      {/* New Complaint Modal */}
      {showForm && (
        <div className="fixed inset-0 z-50 bg-black/60 flex items-center justify-center p-4" onClick={() => setShowForm(false)}>
          <div
            className="bg-card border border-border rounded-2xl shadow-2xl w-full max-w-lg max-h-[90vh] flex flex-col"
            onClick={e => e.stopPropagation()}
          >
            <div className="flex items-center justify-between px-5 py-4 border-b border-border shrink-0">
              <h3 className="font-bold text-foreground">{ui.newComplaintTitle}</h3>
              <button onClick={() => setShowForm(false)} className="w-8 h-8 rounded-lg hover:bg-muted flex items-center justify-center">
                <Icon name="XMarkIcon" size={16} className="text-muted-foreground" />
              </button>
            </div>
            <div className="flex-1 overflow-y-auto px-5 py-4 space-y-4">
              {/* Factory */}
              <div>
                <label className="block text-sm font-semibold text-foreground mb-1.5">{ui.fieldFactory}</label>
                <select
                  value={form.factory_reg_id}
                  onChange={e => setForm(p => ({ ...p, factory_reg_id: e.target.value, factory_name: '' }))}
                  className="w-full px-3 py-2.5 bg-background border border-border rounded-xl text-sm text-foreground focus:outline-none focus:border-primary"
                >
                  <option value="">{ui.selectFactory}</option>
                  {factories.map(f => (
                    <option key={f.id} value={f.id}>{f.company_name}</option>
                  ))}
                </select>
                {!form.factory_reg_id && (
                  <input
                    type="text"
                    value={form.factory_name}
                    onChange={e => setForm(p => ({ ...p, factory_name: e.target.value }))}
                    placeholder={ui.factoryNamePlaceholder}
                    className="mt-2 w-full px-3 py-2.5 bg-background border border-border rounded-xl text-sm text-foreground placeholder:text-muted-foreground focus:outline-none focus:border-primary"
                  />
                )}
              </div>
              {/* Complainant */}
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-sm font-semibold text-foreground mb-1.5">{ui.fieldComplainant} *</label>
                  <input
                    type="text"
                    value={form.complainant_name}
                    onChange={e => setForm(p => ({ ...p, complainant_name: e.target.value }))}
                    placeholder={ui.complainantPlaceholder}
                    className="w-full px-3 py-2.5 bg-background border border-border rounded-xl text-sm text-foreground placeholder:text-muted-foreground focus:outline-none focus:border-primary"
                  />
                </div>
                <div>
                  <label className="block text-sm font-semibold text-foreground mb-1.5">{ui.fieldPhone}</label>
                  <input
                    type="text"
                    value={form.complainant_phone}
                    onChange={e => setForm(p => ({ ...p, complainant_phone: e.target.value }))}
                    placeholder={ui.phonePlaceholder}
                    className="w-full px-3 py-2.5 bg-background border border-border rounded-xl text-sm text-foreground placeholder:text-muted-foreground focus:outline-none focus:border-primary"
                    dir="ltr"
                  />
                </div>
              </div>
              {/* Subject */}
              <div>
                <label className="block text-sm font-semibold text-foreground mb-1.5">{ui.fieldSubject} *</label>
                <input
                  type="text"
                  value={form.subject}
                  onChange={e => setForm(p => ({ ...p, subject: e.target.value }))}
                  placeholder={ui.subjectPlaceholder}
                  className="w-full px-3 py-2.5 bg-background border border-border rounded-xl text-sm text-foreground placeholder:text-muted-foreground focus:outline-none focus:border-primary"
                />
              </div>
              {/* Type & Priority */}
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-sm font-semibold text-foreground mb-1.5">{ui.fieldType}</label>
                  <select
                    value={form.complaint_type}
                    onChange={e => setForm(p => ({ ...p, complaint_type: e.target.value }))}
                    className="w-full px-3 py-2.5 bg-background border border-border rounded-xl text-sm text-foreground focus:outline-none focus:border-primary"
                  >
                    {COMPLAINT_TYPES.map(ct => (
                      <option key={ct} value={ct}>{ui[`type_${ct}` as keyof typeof ui] as string || ct}</option>
                    ))}
                  </select>
                </div>
                <div>
                  <label className="block text-sm font-semibold text-foreground mb-1.5">{ui.fieldPriority}</label>
                  <select
                    value={form.priority}
                    onChange={e => setForm(p => ({ ...p, priority: e.target.value as Complaint['priority'] }))}
                    className="w-full px-3 py-2.5 bg-background border border-border rounded-xl text-sm text-foreground focus:outline-none focus:border-primary"
                  >
                    {['low', 'medium', 'high', 'urgent'].map(p => (
                      <option key={p} value={p}>{ui[`priority_${p}` as keyof typeof ui] as string || p}</option>
                    ))}
                  </select>
                </div>
              </div>
              {/* Description */}
              <div>
                <label className="block text-sm font-semibold text-foreground mb-1.5">{ui.fieldDescription} *</label>
                <textarea
                  value={form.description}
                  onChange={e => setForm(p => ({ ...p, description: e.target.value }))}
                  rows={4}
                  placeholder={ui.descriptionPlaceholder}
                  className="w-full px-3 py-2.5 bg-background border border-border rounded-xl text-sm text-foreground placeholder:text-muted-foreground focus:outline-none focus:border-primary resize-none"
                />
              </div>
            </div>
            <div className="flex gap-3 px-5 py-4 border-t border-border shrink-0">
              <button
                onClick={() => setShowForm(false)}
                className="flex-1 px-4 py-2.5 border border-border rounded-xl text-sm font-semibold text-muted-foreground hover:bg-muted transition-colors"
              >
                {ui.cancel}
              </button>
              <button
                onClick={handleSubmitNew}
                disabled={saving}
                className="flex-1 px-4 py-2.5 bg-primary text-white rounded-xl text-sm font-semibold hover:bg-primary/90 transition-colors disabled:opacity-50 flex items-center justify-center gap-2"
              >
                {saving ? (
                  <div className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin" />
                ) : (
                  <Icon name="CheckIcon" size={15} />
                )}
                {ui.submit}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Edit/Manage Modal */}
      {selectedComplaint && (
        <div className="fixed inset-0 z-50 bg-black/60 flex items-center justify-center p-4" onClick={() => setSelectedComplaint(null)}>
          <div
            className="bg-card border border-border rounded-2xl shadow-2xl w-full max-w-lg max-h-[90vh] flex flex-col"
            onClick={e => e.stopPropagation()}
          >
            <div className="flex items-center justify-between px-5 py-4 border-b border-border shrink-0">
              <div>
                <h3 className="font-bold text-foreground text-sm">{selectedComplaint.subject}</h3>
                <p className="text-xs text-muted-foreground">{selectedComplaint.complainant_name}</p>
              </div>
              <button onClick={() => setSelectedComplaint(null)} className="w-8 h-8 rounded-lg hover:bg-muted flex items-center justify-center">
                <Icon name="XMarkIcon" size={16} className="text-muted-foreground" />
              </button>
            </div>
            <div className="flex-1 overflow-y-auto px-5 py-4 space-y-4">
              {/* Description */}
              <div className="bg-muted/50 rounded-xl p-3">
                <p className="text-xs font-semibold text-muted-foreground mb-1">{ui.fieldDescription}</p>
                <p className="text-sm text-foreground">{selectedComplaint.description}</p>
              </div>
              {/* Status */}
              <div>
                <label className="block text-sm font-semibold text-foreground mb-2">{ui.fieldStatus}</label>
                <div className="grid grid-cols-2 gap-2">
                  {(['open', 'in_progress', 'resolved', 'closed'] as Complaint['status'][]).map(s => {
                    const cfg = STATUS_CONFIG[s];
                    return (
                      <button
                        key={s}
                        onClick={() => setEditForm(p => ({ ...p, status: s }))}
                        className={`flex items-center gap-2 px-3 py-2 rounded-xl border text-xs font-semibold transition-all ${
                          editForm.status === s ? cfg.color + ' border-2' : 'bg-background border-border text-muted-foreground hover:bg-muted'
                        }`}
                      >
                        <Icon name={cfg.icon as any} size={13} />
                        {ui[`status_${s}` as keyof typeof ui] as string || s}
                      </button>
                    );
                  })}
                </div>
              </div>
              {/* Agent Notes */}
              <div>
                <label className="block text-sm font-semibold text-foreground mb-1.5">{ui.fieldAgentNotes}</label>
                <textarea
                  value={editForm.agent_notes}
                  onChange={e => setEditForm(p => ({ ...p, agent_notes: e.target.value }))}
                  rows={3}
                  placeholder={ui.agentNotesPlaceholder}
                  className="w-full px-3 py-2.5 bg-background border border-border rounded-xl text-sm text-foreground placeholder:text-muted-foreground focus:outline-none focus:border-primary resize-none"
                />
              </div>
              {/* Resolution */}
              <div>
                <label className="block text-sm font-semibold text-foreground mb-1.5">{ui.fieldResolution}</label>
                <textarea
                  value={editForm.resolution}
                  onChange={e => setEditForm(p => ({ ...p, resolution: e.target.value }))}
                  rows={3}
                  placeholder={ui.resolutionPlaceholder}
                  className="w-full px-3 py-2.5 bg-background border border-border rounded-xl text-sm text-foreground placeholder:text-muted-foreground focus:outline-none focus:border-primary resize-none"
                />
              </div>
            </div>
            <div className="flex gap-3 px-5 py-4 border-t border-border shrink-0">
              <button
                onClick={() => setSelectedComplaint(null)}
                className="flex-1 px-4 py-2.5 border border-border rounded-xl text-sm font-semibold text-muted-foreground hover:bg-muted transition-colors"
              >
                {ui.cancel}
              </button>
              <button
                onClick={handleUpdateComplaint}
                disabled={saving}
                className="flex-1 px-4 py-2.5 bg-primary text-white rounded-xl text-sm font-semibold hover:bg-primary/90 transition-colors disabled:opacity-50 flex items-center justify-center gap-2"
              >
                {saving ? (
                  <div className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin" />
                ) : (
                  <Icon name="CheckIcon" size={15} />
                )}
                {ui.saveChanges}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
