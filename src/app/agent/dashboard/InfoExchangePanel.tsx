'use client';

import React, { useState, useEffect, useCallback, useMemo } from 'react';
import { createClient } from '@/lib/supabase/client';
import Icon from '@/components/ui/AppIcon';
import { useLanguage } from '@/contexts/LanguageContext';

interface AgentFactory {
  id: string;
  company_name: string;
  factory_type: string;
}

interface InfoEntry {
  id: string;
  agent_id: string;
  factory_reg_id: string;
  direction: 'agent_to_factory' | 'factory_to_agent';
  entry_type: string;
  title: string;
  content: string;
  is_resolved: boolean;
  resolved_at: string | null;
  created_at: string;
  updated_at: string;
}

const ENTRY_TYPE_KEYS = [
  { key: 'note', labelKey: 'typeNote' as const, icon: 'PencilSquareIcon', color: 'text-blue-700', bg: 'bg-blue-50 border-blue-200' },
  { key: 'requirement', labelKey: 'typeRequirement' as const, icon: 'ClipboardDocumentCheckIcon', color: 'text-amber-700', bg: 'bg-amber-50 border-amber-200' },
  { key: 'update', labelKey: 'typeUpdate' as const, icon: 'ArrowPathIcon', color: 'text-emerald-700', bg: 'bg-emerald-50 border-emerald-200' },
  { key: 'document_request', labelKey: 'typeDocumentRequest' as const, icon: 'DocumentArrowDownIcon', color: 'text-purple-700', bg: 'bg-purple-50 border-purple-200' },
  { key: 'status_change', labelKey: 'typeStatusChange' as const, icon: 'ArrowsRightLeftIcon', color: 'text-orange-700', bg: 'bg-orange-50 border-orange-200' },
  { key: 'general', labelKey: 'typeGeneral' as const, icon: 'InformationCircleIcon', color: 'text-gray-700', bg: 'bg-gray-50 border-gray-200' },
];

const FACTORY_TYPE_KEYS: Record<string, 'typeLocalFactory' | 'typeIntlFactory' | 'typeLocalSupplier'> = {
  local_factory: 'typeLocalFactory',
  international_factory: 'typeIntlFactory',
  local_supplier: 'typeLocalSupplier',
};

interface InfoExchangePanelProps {
  userId: string;
  factories: AgentFactory[];
}

export default function InfoExchangePanel({ userId, factories }: InfoExchangePanelProps) {
  const { t, dir, language } = useLanguage();
  const ix = t.infoExchange;
  const supabase = createClient();

  const [entries, setEntries] = useState<InfoEntry[]>([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [filterFactory, setFilterFactory] = useState('');
  const [filterType, setFilterType] = useState('');
  const [filterDirection, setFilterDirection] = useState('');
  const [showResolved, setShowResolved] = useState(false);
  const [success, setSuccess] = useState('');
  const [error, setError] = useState('');

  const [formFactory, setFormFactory] = useState('');
  const [formDirection, setFormDirection] = useState<'agent_to_factory' | 'factory_to_agent'>('agent_to_factory');
  const [formType, setFormType] = useState('note');
  const [formTitle, setFormTitle] = useState('');
  const [formContent, setFormContent] = useState('');
  const [showForm, setShowForm] = useState(false);

  const entryTypeConfig = useMemo(() => {
    const map: Record<string, { label: string; icon: string; color: string; bg: string }> = {};
    for (const def of ENTRY_TYPE_KEYS) {
      map[def.key] = { label: ix[def.labelKey], icon: def.icon, color: def.color, bg: def.bg };
    }
    return map;
  }, [ix]);

  const localeTag = language === 'ar' ? 'ar-YE' : language === 'zh' ? 'zh-CN' : language === 'tr' ? 'tr-TR' : 'en-US';

  const fetchEntries = useCallback(async () => {
    setLoading(true);
    const { data } = await supabase
      .from('agent_info_exchange')
      .select('*')
      .eq('agent_id', userId)
      .order('created_at', { ascending: false });
    if (data) setEntries(data);
    setLoading(false);
  }, [userId, supabase]);

  useEffect(() => {
    fetchEntries();
  }, [fetchEntries]);

  const handleSubmit = async () => {
    if (!formFactory || !formTitle.trim() || !formContent.trim()) {
      setError(ix.errorRequired);
      return;
    }
    setSaving(true);
    setError('');
    const { error: err } = await supabase.from('agent_info_exchange').insert({
      agent_id: userId,
      factory_reg_id: formFactory,
      direction: formDirection,
      entry_type: formType,
      title: formTitle.trim(),
      content: formContent.trim(),
      is_resolved: false,
    });
    if (!err) {
      setSuccess(ix.successAdded);
      setTimeout(() => setSuccess(''), 4000);
      setFormTitle('');
      setFormContent('');
      setFormFactory('');
      setShowForm(false);
      fetchEntries();
    } else {
      setError(err.message);
    }
    setSaving(false);
  };

  const handleToggleResolved = async (entry: InfoEntry) => {
    const { error: err } = await supabase
      .from('agent_info_exchange')
      .update({
        is_resolved: !entry.is_resolved,
        resolved_at: !entry.is_resolved ? new Date().toISOString() : null,
      })
      .eq('id', entry.id)
      .eq('agent_id', userId);
    if (!err) {
      setEntries(prev =>
        prev.map(e =>
          e.id === entry.id
            ? { ...e, is_resolved: !e.is_resolved, resolved_at: !e.is_resolved ? new Date().toISOString() : null }
            : e
        )
      );
    }
  };

  const handleDelete = async (id: string) => {
    if (!confirm(ix.confirmDelete)) return;
    const { error: err } = await supabase
      .from('agent_info_exchange')
      .delete()
      .eq('id', id)
      .eq('agent_id', userId);
    if (!err) setEntries(prev => prev.filter(e => e.id !== id));
  };

  const filteredEntries = entries.filter(e => {
    if (filterFactory && e.factory_reg_id !== filterFactory) return false;
    if (filterType && e.entry_type !== filterType) return false;
    if (filterDirection && e.direction !== filterDirection) return false;
    if (!showResolved && e.is_resolved) return false;
    return true;
  });

  const unresolvedCount = entries.filter(e => !e.is_resolved).length;

  const factoryTypeLabel = (ft: string) =>
    FACTORY_TYPE_KEYS[ft] ? ix[FACTORY_TYPE_KEYS[ft]] : ft;

  return (
    <div className="space-y-5" dir={dir}>
      <div className="bg-card border border-border rounded-2xl p-5">
        <div className="flex items-center justify-between mb-4">
          <div className="flex items-center gap-2.5">
            <div className="w-8 h-8 bg-emerald-50 rounded-lg flex items-center justify-center">
              <Icon name="ArrowsRightLeftIcon" size={16} className="text-emerald-600" />
            </div>
            <div>
              <h3 className="font-bold text-foreground text-sm">{ix.title}</h3>
              <p className="text-xs text-muted-foreground">
                {ix.unresolvedCount.replace('{count}', String(unresolvedCount))}
              </p>
            </div>
          </div>
          <button
            onClick={() => setShowForm(!showForm)}
            className="flex items-center gap-1.5 px-3 py-1.5 bg-primary text-white rounded-lg text-xs font-semibold hover:bg-primary/90 transition-colors"
          >
            <Icon name={showForm ? 'ChevronUpIcon' : 'PlusIcon'} size={13} />
            {showForm ? ix.hideForm : ix.addInfo}
          </button>
        </div>

        {success && (
          <div className="mb-3 px-3 py-2 bg-emerald-50 border border-emerald-200 text-emerald-700 rounded-lg text-xs flex items-center gap-2">
            <Icon name="CheckCircleIcon" size={14} />
            {success}
          </div>
        )}
        {error && (
          <div className="mb-3 px-3 py-2 bg-red-50 border border-red-200 text-red-700 rounded-lg text-xs flex items-center gap-2">
            <Icon name="ExclamationCircleIcon" size={14} />
            {error}
            <button onClick={() => setError('')} className="mr-auto">
              <Icon name="XMarkIcon" size={12} />
            </button>
          </div>
        )}

        {showForm && (
          <div className="border border-border rounded-xl p-4 bg-muted/20 space-y-3">
            <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
              <div>
                <label className="block text-xs font-semibold text-foreground mb-1.5">{ix.factorySupplier}</label>
                <select
                  value={formFactory}
                  onChange={e => setFormFactory(e.target.value)}
                  className="w-full px-3 py-2 bg-background border border-border rounded-xl text-sm text-foreground focus:outline-none focus:border-primary"
                >
                  <option value="">{ix.select}</option>
                  {factories.map(f => (
                    <option key={f.id} value={f.id}>
                      {f.company_name} ({factoryTypeLabel(f.factory_type)})
                    </option>
                  ))}
                </select>
              </div>
              <div>
                <label className="block text-xs font-semibold text-foreground mb-1.5">{ix.direction}</label>
                <div className="flex gap-2">
                  <button
                    onClick={() => setFormDirection('agent_to_factory')}
                    className={`flex-1 py-2 rounded-xl text-xs font-semibold border transition-colors ${
                      formDirection === 'agent_to_factory' ?'bg-primary text-white border-primary' :'bg-background border-border text-muted-foreground hover:bg-muted'
                    }`}
                  >
                    {ix.agentToFactory}
                  </button>
                  <button
                    onClick={() => setFormDirection('factory_to_agent')}
                    className={`flex-1 py-2 rounded-xl text-xs font-semibold border transition-colors ${
                      formDirection === 'factory_to_agent' ?'bg-primary text-white border-primary' :'bg-background border-border text-muted-foreground hover:bg-muted'
                    }`}
                  >
                    {ix.factoryToAgent}
                  </button>
                </div>
              </div>
              <div>
                <label className="block text-xs font-semibold text-foreground mb-1.5">{ix.entryType}</label>
                <select
                  value={formType}
                  onChange={e => setFormType(e.target.value)}
                  className="w-full px-3 py-2 bg-background border border-border rounded-xl text-sm text-foreground focus:outline-none focus:border-primary"
                >
                  {ENTRY_TYPE_KEYS.map(def => (
                    <option key={def.key} value={def.key}>{ix[def.labelKey]}</option>
                  ))}
                </select>
              </div>
              <div>
                <label className="block text-xs font-semibold text-foreground mb-1.5">{ix.titleLabel}</label>
                <input
                  type="text"
                  value={formTitle}
                  onChange={e => setFormTitle(e.target.value)}
                  placeholder={ix.titlePlaceholder}
                  className="w-full px-3 py-2 bg-background border border-border rounded-xl text-sm text-foreground placeholder:text-muted-foreground focus:outline-none focus:border-primary"
                />
              </div>
            </div>
            <div>
              <label className="block text-xs font-semibold text-foreground mb-1.5">{ix.contentLabel}</label>
              <textarea
                value={formContent}
                onChange={e => setFormContent(e.target.value)}
                rows={3}
                placeholder={ix.contentPlaceholder}
                className="w-full px-3 py-2 bg-background border border-border rounded-xl text-sm text-foreground placeholder:text-muted-foreground focus:outline-none focus:border-primary resize-none"
              />
            </div>
            <div className="flex gap-3">
              <button
                onClick={() => setShowForm(false)}
                className="px-4 py-2 border border-border rounded-xl text-sm font-semibold text-muted-foreground hover:bg-muted transition-colors"
              >
                {ix.cancel}
              </button>
              <button
                onClick={handleSubmit}
                disabled={saving}
                className="flex items-center gap-2 px-5 py-2 bg-primary text-white rounded-xl text-sm font-semibold hover:bg-primary/90 transition-colors disabled:opacity-50"
              >
                {saving ? (
                  <div className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin" />
                ) : (
                  <Icon name="CheckIcon" size={14} />
                )}
                {ix.save}
              </button>
            </div>
          </div>
        )}
      </div>

      <div className="bg-card border border-border rounded-2xl p-5">
        <div className="flex gap-2 mb-4 flex-wrap">
          <select
            value={filterFactory}
            onChange={e => setFilterFactory(e.target.value)}
            className="px-2.5 py-1.5 bg-background border border-border rounded-lg text-xs text-foreground focus:outline-none focus:border-primary"
          >
            <option value="">{ix.allFactories}</option>
            {factories.map(f => (
              <option key={f.id} value={f.id}>{f.company_name}</option>
            ))}
          </select>
          <select
            value={filterType}
            onChange={e => setFilterType(e.target.value)}
            className="px-2.5 py-1.5 bg-background border border-border rounded-lg text-xs text-foreground focus:outline-none focus:border-primary"
          >
            <option value="">{ix.allTypes}</option>
            {ENTRY_TYPE_KEYS.map(def => (
              <option key={def.key} value={def.key}>{ix[def.labelKey]}</option>
            ))}
          </select>
          <select
            value={filterDirection}
            onChange={e => setFilterDirection(e.target.value)}
            className="px-2.5 py-1.5 bg-background border border-border rounded-lg text-xs text-foreground focus:outline-none focus:border-primary"
          >
            <option value="">{ix.allDirections}</option>
            <option value="agent_to_factory">{ix.agentToFactory}</option>
            <option value="factory_to_agent">{ix.factoryToAgent}</option>
          </select>
          <button
            onClick={() => setShowResolved(!showResolved)}
            className={`px-2.5 py-1.5 rounded-lg text-xs font-semibold border transition-colors ${
              showResolved
                ? 'bg-primary text-white border-primary' :'bg-background border-border text-muted-foreground hover:bg-muted'
            }`}
          >
            {showResolved ? ix.hideResolved : ix.showResolved}
          </button>
        </div>

        {loading ? (
          <div className="flex items-center justify-center py-8">
            <div className="w-6 h-6 border-2 border-primary border-t-transparent rounded-full animate-spin" />
          </div>
        ) : filteredEntries.length === 0 ? (
          <div className="text-center py-8">
            <Icon name="ArrowsRightLeftIcon" size={32} className="text-muted-foreground mx-auto mb-2" />
            <p className="text-sm text-muted-foreground">{ix.empty}</p>
          </div>
        ) : (
          <div className="space-y-3">
            {filteredEntries.map(entry => {
              const cfg = entryTypeConfig[entry.entry_type] || entryTypeConfig.general;
              const factory = factories.find(f => f.id === entry.factory_reg_id);
              const isAgentToFactory = entry.direction === 'agent_to_factory';
              return (
                <div
                  key={entry.id}
                  className={`rounded-xl border p-4 transition-opacity ${entry.is_resolved ? 'opacity-60' : ''} ${cfg.bg}`}
                >
                  <div className="flex items-start justify-between gap-3">
                    <div className="flex items-start gap-2.5 flex-1 min-w-0">
                      <div className="w-7 h-7 rounded-lg bg-white/60 flex items-center justify-center shrink-0 mt-0.5">
                        <Icon name={cfg.icon as any} size={14} className={cfg.color} />
                      </div>
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center gap-2 flex-wrap mb-1">
                          <span className={`text-[11px] font-bold ${cfg.color}`}>{cfg.label}</span>
                          <span className="text-[10px] text-muted-foreground">
                            {isAgentToFactory ? ix.toFactory : ix.toAgent}
                          </span>
                          {factory && (
                            <span className="text-[10px] font-semibold text-foreground bg-white/60 px-1.5 py-0.5 rounded-md">
                              {factory.company_name}
                            </span>
                          )}
                          {entry.is_resolved && (
                            <span className="text-[10px] font-semibold text-emerald-700 bg-emerald-100 px-1.5 py-0.5 rounded-md flex items-center gap-0.5">
                              <Icon name="CheckCircleIcon" size={10} />
                              {ix.resolved}
                            </span>
                          )}
                        </div>
                        <p className="font-semibold text-foreground text-sm mb-1">{entry.title}</p>
                        <p className="text-sm text-foreground/80 leading-relaxed">{entry.content}</p>
                        <p className="text-[10px] text-muted-foreground mt-1.5">
                          {new Date(entry.created_at).toLocaleDateString(localeTag)}
                          {entry.resolved_at && ` · ${ix.resolvedOn.replace('{date}', new Date(entry.resolved_at).toLocaleDateString(localeTag))}`}
                        </p>
                      </div>
                    </div>
                    <div className="flex items-center gap-1.5 shrink-0">
                      <button
                        onClick={() => handleToggleResolved(entry)}
                        className={`w-7 h-7 rounded-lg flex items-center justify-center transition-colors ${
                          entry.is_resolved
                            ? 'bg-white/60 hover:bg-white/80' :'bg-emerald-100 hover:bg-emerald-200'
                        }`}
                        title={entry.is_resolved ? ix.reopen : ix.markResolved}
                      >
                        <Icon
                          name={entry.is_resolved ? 'ArrowUturnLeftIcon' : 'CheckIcon'}
                          size={13}
                          className={entry.is_resolved ? 'text-muted-foreground' : 'text-emerald-700'}
                        />
                      </button>
                      <button
                        onClick={() => handleDelete(entry.id)}
                        className="w-7 h-7 rounded-lg bg-white/60 hover:bg-red-100 flex items-center justify-center transition-colors"
                        title={ix.delete}
                      >
                        <Icon name="TrashIcon" size={13} className="text-red-500" />
                      </button>
                    </div>
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </div>
    </div>
  );
}
