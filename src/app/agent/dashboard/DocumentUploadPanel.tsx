'use client';

import { useLanguage } from '@/contexts/LanguageContext';

import React, { useState, useEffect, useCallback, useRef } from 'react';
import { createClient } from '@/lib/supabase/client';
import Icon from '@/components/ui/AppIcon';

interface AgentFactory {
  id: string;
  company_name: string;
  factory_type: string;
}

interface FactoryDocument {
  id: string;
  agent_id: string;
  factory_reg_id: string;
  doc_type: string;
  file_url: string;
  file_name: string;
  file_size: number;
  mime_type: string;
  description: string;
  created_at: string;
}

const DOC_TYPE_CONFIG: Record<string, { labelKey: string; icon: string; color: string }> = {
  license: { labelKey: 'typeLicense', icon: 'DocumentCheckIcon', color: 'text-emerald-600' },
  registration: { labelKey: 'typeRegistry', icon: 'ClipboardDocumentListIcon', color: 'text-blue-600' },
  product_catalog: { labelKey: 'typeCatalog', icon: 'BookOpenIcon', color: 'text-purple-600' },
  image: { labelKey: 'typeImage', icon: 'PhotoIcon', color: 'text-pink-600' },
  certificate: { labelKey: 'typeCertificate', icon: 'AcademicCapIcon', color: 'text-amber-600' },
  other: { labelKey: 'typeOther', icon: 'DocumentIcon', color: 'text-gray-600' },
};

const FACTORY_TYPE_KEYS: Record<string, string> = {
  local_factory: 'localFactory',
  international_factory: 'intlFactory',
  local_supplier: 'localSupplier',
};

interface DocumentUploadPanelProps {
  userId: string;
  factories: AgentFactory[];
}

export default function DocumentUploadPanel({ userId, factories }: DocumentUploadPanelProps) {
  const { t, dir } = useLanguage();
  const ui = t.agentDashboard.documentUpload;

  const supabase = createClient();
  const fileInputRef = useRef<HTMLInputElement>(null);

  const [documents, setDocuments] = useState<FactoryDocument[]>([]);
  const [loading, setLoading] = useState(true);
  const [uploading, setUploading] = useState(false);
  const [selectedFactory, setSelectedFactory] = useState('');
  const [docType, setDocType] = useState('license');
  const [description, setDescription] = useState('');
  const [selectedFile, setSelectedFile] = useState<File | null>(null);
  const [filterFactory, setFilterFactory] = useState('');
  const [filterType, setFilterType] = useState('');
  const [success, setSuccess] = useState('');
  const [error, setError] = useState('');

  const fetchDocuments = useCallback(async () => {
    setLoading(true);
    const { data } = await supabase
      .from('agent_factory_documents')
      .select('*')
      .eq('agent_id', userId)
      .order('created_at', { ascending: false });
    if (data) setDocuments(data);
    setLoading(false);
  }, [userId, supabase]);

  useEffect(() => {
    fetchDocuments();
  }, [fetchDocuments]);

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) setSelectedFile(file);
  };

  const handleUpload = async () => {
    if (!selectedFile || !selectedFactory) {
      setError(ui.needFactoryAndFile);
      return;
    }

    setUploading(true);
    setError('');

    try {
      // Path MUST start with factory-docs/ — storage RLS rejects agent-docs/
      const fileExt = selectedFile.name.split('.').pop();
      const fileName = `factory-docs/agent/${userId}/${selectedFactory}/${Date.now()}.${fileExt}`;

      const { error: uploadError } = await supabase.storage
        .from('factory-documents')
        .upload(fileName, selectedFile, { upsert: false });

      if (uploadError) throw uploadError;

      const { data: urlData } = supabase.storage
        .from('factory-documents')
        .getPublicUrl(fileName);

      const { error: dbError } = await supabase.from('agent_factory_documents').insert({
        agent_id: userId,
        factory_reg_id: selectedFactory,
        doc_type: docType,
        file_url: urlData.publicUrl,
        file_name: selectedFile.name,
        file_size: selectedFile.size,
        mime_type: selectedFile.type,
        description: description.trim(),
        uploaded_by: userId,
      });

      if (dbError) throw dbError;

      setSuccess(ui.uploadSuccess);
      setTimeout(() => setSuccess(''), 4000);
      setSelectedFile(null);
      setDescription('');
      if (fileInputRef.current) fileInputRef.current.value = '';
      fetchDocuments();
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : ui.uploadError);
    } finally {
      setUploading(false);
    }
  };

  const handleDelete = async (doc: FactoryDocument) => {
    if (!confirm(ui.confirmDelete)) return;
    const { error: err } = await supabase
      .from('agent_factory_documents')
      .delete()
      .eq('id', doc.id)
      .eq('agent_id', userId);
    if (!err) {
      setDocuments(prev => prev.filter(d => d.id !== doc.id));
    }
  };

  const filteredDocs = documents.filter(d => {
    if (filterFactory && d.factory_reg_id !== filterFactory) return false;
    if (filterType && d.doc_type !== filterType) return false;
    return true;
  });

  const formatFileSize = (bytes: number) => {
    if (bytes < 1024) return `${bytes} B`;
    if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
    return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
  };

  return (
    <div className="space-y-5" dir={dir}>
      {/* Upload Form */}
      <div className="bg-card border border-border rounded-2xl p-5">
        <div className="flex items-center gap-2.5 mb-4">
          <div className="w-8 h-8 bg-purple-50 rounded-lg flex items-center justify-center">
            <Icon name="ArrowUpTrayIcon" size={16} className="text-purple-600" />
          </div>
          <h3 className="font-bold text-foreground text-sm">{ui.title}</h3>
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

        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          {/* Factory Select */}
          <div>
            <label className="block text-xs font-semibold text-foreground mb-1.5">{ui.factoryRequired}</label>
            <select
              value={selectedFactory}
              onChange={e => setSelectedFactory(e.target.value)}
              className="w-full px-3 py-2.5 bg-background border border-border rounded-xl text-sm text-foreground focus:outline-none focus:border-primary"
            >
              <option value="">{ui.select}</option>
              {factories.map(f => (
                <option key={f.id} value={f.id}>
                  {f.company_name} ({((ui as any)[FACTORY_TYPE_KEYS[f.factory_type]] || f.factory_type) || f.factory_type})
                </option>
              ))}
            </select>
          </div>

          {/* Doc Type */}
          <div>
            <label className="block text-xs font-semibold text-foreground mb-1.5">{ui.fileType}</label>
            <select
              value={docType}
              onChange={e => setDocType(e.target.value)}
              className="w-full px-3 py-2.5 bg-background border border-border rounded-xl text-sm text-foreground focus:outline-none focus:border-primary"
            >
              {Object.entries(DOC_TYPE_CONFIG).map(([key, cfg]) => (
                <option key={key} value={key}>{(ui as any)[cfg.labelKey]}</option>
              ))}
            </select>
          </div>

          {/* Description */}
          <div>
            <label className="block text-xs font-semibold text-foreground mb-1.5">{ui.description}</label>
            <input
              type="text"
              value={description}
              onChange={e => setDescription(e.target.value)}
              placeholder={ui.descriptionPlaceholder}
              className="w-full px-3 py-2.5 bg-background border border-border rounded-xl text-sm text-foreground placeholder:text-muted-foreground focus:outline-none focus:border-primary"
            />
          </div>

          {/* File Input */}
          <div>
            <label className="block text-xs font-semibold text-foreground mb-1.5">{ui.fileRequired}</label>
            <div
              className="border-2 border-dashed border-border rounded-xl p-3 text-center cursor-pointer hover:border-primary transition-colors"
              onClick={() => fileInputRef.current?.click()}
            >
              {selectedFile ? (
                <div className="flex items-center gap-2 justify-center">
                  <Icon name="DocumentIcon" size={16} className="text-primary" />
                  <span className="text-xs font-semibold text-foreground truncate max-w-[150px]">{selectedFile.name}</span>
                  <span className="text-xs text-muted-foreground">({formatFileSize(selectedFile.size)})</span>
                </div>
              ) : (
                <div>
                  <Icon name="CloudArrowUpIcon" size={20} className="text-muted-foreground mx-auto mb-1" />
                  <p className="text-xs text-muted-foreground">{ui.clickChoose}</p>
                  <p className="text-[10px] text-muted-foreground/70">{ui.fileHint}</p>
                </div>
              )}
            </div>
            <input
              ref={fileInputRef}
              type="file"
              accept=".pdf,.jpg,.jpeg,.png"
              onChange={handleFileChange}
              className="hidden"
            />
          </div>
        </div>

        <button
          onClick={handleUpload}
          disabled={uploading || !selectedFile || !selectedFactory}
          className="mt-4 flex items-center gap-2 px-5 py-2.5 bg-primary text-white rounded-xl text-sm font-semibold hover:bg-primary/90 transition-colors disabled:opacity-50"
        >
          {uploading ? (
            <>
              <div className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin" />
              {ui.uploading}
            </>
          ) : (
            <>
              <Icon name="ArrowUpTrayIcon" size={15} />
              {ui.uploadFile}
            </>
          )}
        </button>
      </div>

      {/* Documents List */}
      <div className="bg-card border border-border rounded-2xl p-5">
        <div className="flex items-center justify-between mb-4">
          <div className="flex items-center gap-2.5">
            <div className="w-8 h-8 bg-blue-50 rounded-lg flex items-center justify-center">
              <Icon name="FolderOpenIcon" size={16} className="text-blue-600" />
            </div>
            <h3 className="font-bold text-foreground text-sm">{ui.uploadedFiles.replace('{count}', String(filteredDocs.length))}</h3>
          </div>
          <div className="flex gap-2">
            <select
              value={filterFactory}
              onChange={e => setFilterFactory(e.target.value)}
              className="px-2.5 py-1.5 bg-background border border-border rounded-lg text-xs text-foreground focus:outline-none focus:border-primary"
            >
              <option value="">{ui.allFactories}</option>
              {factories.map(f => (
                <option key={f.id} value={f.id}>{f.company_name}</option>
              ))}
            </select>
            <select
              value={filterType}
              onChange={e => setFilterType(e.target.value)}
              className="px-2.5 py-1.5 bg-background border border-border rounded-lg text-xs text-foreground focus:outline-none focus:border-primary"
            >
              <option value="">{ui.allTypes}</option>
              {Object.entries(DOC_TYPE_CONFIG).map(([key, cfg]) => (
                <option key={key} value={key}>{(ui as any)[cfg.labelKey]}</option>
              ))}
            </select>
          </div>
        </div>

        {loading ? (
          <div className="flex items-center justify-center py-8">
            <div className="w-6 h-6 border-2 border-primary border-t-transparent rounded-full animate-spin" />
          </div>
        ) : filteredDocs.length === 0 ? (
          <div className="text-center py-8">
            <Icon name="FolderIcon" size={32} className="text-muted-foreground mx-auto mb-2" />
            <p className="text-sm text-muted-foreground">{ui.empty}</p>
          </div>
        ) : (
          <div className="space-y-2">
            {filteredDocs.map(doc => {
              const cfg = DOC_TYPE_CONFIG[doc.doc_type] || DOC_TYPE_CONFIG.other;
              const factory = factories.find(f => f.id === doc.factory_reg_id);
              return (
                <div key={doc.id} className="flex items-center gap-3 p-3 bg-muted/30 rounded-xl border border-border/50 hover:bg-muted/50 transition-colors">
                  <div className="w-9 h-9 bg-card rounded-lg border border-border flex items-center justify-center shrink-0">
                    <Icon name={cfg.icon as any} size={16} className={cfg.color} />
                  </div>
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2 flex-wrap">
                      <p className="font-semibold text-foreground text-xs truncate">{doc.file_name}</p>
                      <span className={`text-[10px] font-semibold px-1.5 py-0.5 rounded-full bg-muted border border-border ${cfg.color}`}>
                        {(ui as any)[cfg.labelKey]}
                      </span>
                    </div>
                    {factory && (
                      <p className="text-[11px] text-muted-foreground mt-0.5">{factory.company_name}</p>
                    )}
                    {doc.description && (
                      <p className="text-[11px] text-muted-foreground italic">{doc.description}</p>
                    )}
                    <p className="text-[10px] text-muted-foreground/70 mt-0.5">
                      {formatFileSize(doc.file_size)} · {new Date(doc.created_at).toLocaleDateString('ar-YE')}
                    </p>
                  </div>
                  <div className="flex items-center gap-1.5 shrink-0">
                    <a
                      href={doc.file_url}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="w-7 h-7 rounded-lg bg-primary/10 hover:bg-primary/20 flex items-center justify-center transition-colors"
                      title={ui.view}
                    >
                      <Icon name="EyeIcon" size={13} className="text-primary" />
                    </a>
                    <button
                      onClick={() => handleDelete(doc)}
                      className="w-7 h-7 rounded-lg bg-red-50 hover:bg-red-100 flex items-center justify-center transition-colors"
                      title={ui.delete}
                    >
                      <Icon name="TrashIcon" size={13} className="text-red-500" />
                    </button>
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
