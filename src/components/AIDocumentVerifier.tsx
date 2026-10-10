'use client';

import React, { useState, useRef } from 'react';
import Icon from '@/components/ui/AppIcon';
import { useLanguage } from '@/contexts/LanguageContext';
import { getChatCompletion } from '@/lib/ai/chatCompletion';
import toast from 'react-hot-toast';

interface ExtractedDocumentData {
  companyName: string;
  registrationNumber: string;
  licenseType: string;
  issueDate: string;
  expiryDate: string;
  issuingAuthority: string;
  businessActivity: string;
  address: string;
  ownerName: string;
  taxId: string;
  verificationStatus: 'valid' | 'expired' | 'suspicious' | 'unreadable';
  verificationNotes: string;
  confidence: number;
}

interface AIDocumentVerifierProps {
  onDataExtracted?: (data: ExtractedDocumentData) => void;
}

export default function AIDocumentVerifier({ onDataExtracted }: AIDocumentVerifierProps) {
  const { t, dir, isRTL, language } = useLanguage();
  const ui = t.aiDocument;
  const [docFile, setDocFile] = useState<File | null>(null);
  const [docPreview, setDocPreview] = useState<string | null>(null);
  const [isVerifying, setIsVerifying] = useState(false);
  const [extractedData, setExtractedData] = useState<ExtractedDocumentData | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);


  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    const validTypes = ['image/jpeg', 'image/png', 'image/webp', 'application/pdf'];
    if (!validTypes.includes(file.type)) {
      toast.error(ui.needImageOrPdf);
      return;
    }
    setDocFile(file);
    if (file.type.startsWith('image/')) {
      const reader = new FileReader();
      reader.onload = () => setDocPreview(reader.result as string);
      reader.readAsDataURL(file);
    } else {
      setDocPreview('pdf');
    }
  };

  const verifyDocument = async () => {
    if (!docFile) {
      toast.error(ui.needDocumentFirst);
      return;
    }

    setIsVerifying(true);
    setExtractedData(null);

    try {
      const systemPrompt = `You are an AI Document OCR & Verification specialist for DirectHub B2B marketplace.
Analyze the uploaded business document (trade license, commercial registration, etc.) and extract all data.
Return ONLY valid JSON with this exact structure:
{
  "companyName": "extracted company name",
  "registrationNumber": "registration/license number",
  "licenseType": "type of license",
  "issueDate": "YYYY-MM-DD or as shown",
  "expiryDate": "YYYY-MM-DD or as shown",
  "issuingAuthority": "government body that issued it",
  "businessActivity": "described business activities",
  "address": "company address",
  "ownerName": "owner or authorized person name",
  "taxId": "tax identification number if present",
  "verificationStatus": "valid|expired|suspicious|unreadable",
  "verificationNotes": "brief notes about document authenticity and any concerns",
  "confidence": 85
}
If you cannot read the document clearly, set verificationStatus to "unreadable" and confidence to a low number.
Return ONLY JSON, no markdown.`;

      const userContent: any[] = [
        { type: 'text', text: 'Please analyze this business document and extract all information:' },
      ];

      if (docPreview && docPreview !== 'pdf') {
        userContent.push({
          type: 'image_url',
          image_url: { url: docPreview },
        });
      } else if (docPreview === 'pdf') {
        // For PDF, read as base64
        const base64 = await new Promise<string>((resolve, reject) => {
          const reader = new FileReader();
          reader.onload = () => resolve(reader.result as string);
          reader.onerror = () => reject(new Error(ui.scanError || 'Failed to read PDF'));
          reader.readAsDataURL(docFile);
        });
        userContent.push({
          type: 'file',
          file: { file_data: base64 },
        });
      }

      const response = await getChatCompletion(
        'GEMINI',
        'gemini/gemini-3.6-flash',
        [
          { role: 'system', content: systemPrompt },
          { role: 'user', content: userContent },
        ],
        { temperature: 0.3, max_tokens: 2000 },
        60000
      );

      const content = response?.choices?.[0]?.message?.content || '';
      const jsonMatch = content.match(/\{[\s\S]*\}/);
      if (jsonMatch) {
        const parsed: ExtractedDocumentData = JSON.parse(jsonMatch[0]);
        setExtractedData(parsed);
        onDataExtracted?.(parsed);
        toast.success(ui.extractSuccess);
      } else {
        toast.error(ui.scanError);
      }
    } catch (err) {
      const msg = err instanceof Error ? err.message : ui.scanError;
      toast.error(msg, { duration: 6000 });
      console.error('Document verification error:', err);
    } finally {
      setIsVerifying(false);
    }
  };

  const [autoFilled, setAutoFilled] = useState(false);
  const handleAutoFill = () => {
    if (!extractedData) return;
    setAutoFilled(true);
    onDataExtracted?.(extractedData);
    toast.success(ui.autofilled);
  };

  const statusColors: Record<string, string> = {
    valid: 'bg-green-50 border-green-200 text-green-700',
    expired: 'bg-yellow-50 border-yellow-200 text-yellow-700',
    suspicious: 'bg-red-50 border-red-200 text-red-700',
    unreadable: 'bg-gray-50 border-gray-200 text-gray-700',
  };

  const statusLabels: Record<string, string> = {
    valid: ui.valid,
    expired: ui.expired,
    suspicious: ui.suspicious,
    unreadable: ui.unreadable,
  };

  const fields = extractedData ? [
    { label: ui.companyName, value: extractedData.companyName },
    { label: ui.registryNumber, value: extractedData.registrationNumber },
    { label: ui.licenseType, value: extractedData.licenseType },
    { label: ui.issueDate, value: extractedData.issueDate },
    { label: ui.expiryDate, value: extractedData.expiryDate },
    { label: ui.issuer, value: extractedData.issuingAuthority },
    { label: ui.businessActivity, value: extractedData.businessActivity },
    { label: ui.address, value: extractedData.address },
    { label: ui.ownerName, value: extractedData.ownerName },
    { label: ui.taxId, value: extractedData.taxId },
  ].filter(f => f.value) : [];

  return (
    <div className="bg-card border border-border rounded-2xl overflow-hidden" dir={dir}>
      {/* Header */}
      <div className="flex items-center gap-3 px-5 py-4 bg-gradient-to-r from-emerald-600 to-teal-600 text-white">
        <div className="w-10 h-10 rounded-xl bg-white/20 flex items-center justify-center shrink-0">
          <Icon name="IdentificationIcon" size={20} className="text-white" />
        </div>
        <div>
          <h3 className="font-bold text-base">{ui.title}</h3>
          <p className="text-xs text-white/80">{ui.subtitle}</p>
        </div>
        <span className="ms-auto text-xs bg-white/20 px-2 py-1 rounded-full">{ui.poweredBy}</span>
      </div>

      <div className="p-5 space-y-4">
        {/* Upload Area */}
        <input ref={fileInputRef} type="file" accept="image/*,.pdf" onChange={handleFileChange} className="hidden" />

        {docPreview ? (
          <div className="relative rounded-xl overflow-hidden border border-border bg-muted/30">
            {docPreview === 'pdf' ? (
              <div className="flex items-center gap-3 p-4">
                <div className="w-10 h-10 bg-red-100 rounded-lg flex items-center justify-center">
                  <Icon name="DocumentIcon" size={20} className="text-red-600" />
                </div>
                <div>
                  <p className="text-sm font-medium text-foreground">{docFile?.name}</p>
                  <p className="text-xs text-muted-foreground">PDF Document</p>
                </div>
                <button
                  onClick={() => { setDocFile(null); setDocPreview(null); setExtractedData(null); }}
                  className="ms-auto w-7 h-7 bg-muted rounded-full flex items-center justify-center hover:bg-muted/80 transition-colors"
                >
                  <Icon name="XMarkIcon" size={14} />
                </button>
              </div>
            ) : (
              <>
                <img src={docPreview} alt="Document" className="w-full h-48 object-contain bg-white" />
                <button
                  onClick={() => { setDocFile(null); setDocPreview(null); setExtractedData(null); }}
                  className="absolute top-2 end-2 w-7 h-7 bg-black/60 text-white rounded-full flex items-center justify-center hover:bg-black/80 transition-colors"
                >
                  <Icon name="XMarkIcon" size={14} />
                </button>
              </>
            )}
          </div>
        ) : (
          <button
            onClick={() => fileInputRef.current?.click()}
            className="w-full flex flex-col items-center justify-center gap-2 px-4 py-8 border-2 border-dashed border-border rounded-xl text-muted-foreground hover:border-emerald-400 hover:text-emerald-600 transition-colors"
          >
            <Icon name="ArrowUpTrayIcon" size={28} />
            <span className="text-sm font-medium">{ui.uploadDoc}</span>
            <span className="text-xs">JPG, PNG, WebP, PDF</span>
          </button>
        )}

        {/* Verify Button */}
        <button
          onClick={verifyDocument}
          disabled={isVerifying || !docFile}
          className="w-full flex items-center justify-center gap-2 px-4 py-3 bg-emerald-600 hover:bg-emerald-700 text-white rounded-xl font-semibold text-sm transition-colors disabled:opacity-60"
        >
          {isVerifying ? (
            <>
              <div className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin" />
              {ui.verifying}
            </>
          ) : (
            <>
              <Icon name="ShieldCheckIcon" size={16} />
              {ui.verify}
            </>
          )}
        </button>

        {/* Extracted Data */}
        {extractedData && (
          <div className="space-y-3">
            {/* Verification Status */}
            <div className={`flex items-center justify-between px-4 py-3 rounded-xl border ${statusColors[extractedData.verificationStatus]}`}>
              <span className="font-semibold text-sm">{statusLabels[extractedData.verificationStatus]}</span>
              <div className="flex items-center gap-1.5">
                <div className="w-16 h-2 bg-white/50 rounded-full overflow-hidden">
                  <div
                    className="h-full bg-current rounded-full transition-all"
                    style={{ width: `${extractedData.confidence}%` }}
                  />
                </div>
                <span className="text-xs font-medium">{extractedData.confidence}%</span>
              </div>
            </div>

            {/* Verification Notes */}
            {extractedData.verificationNotes && (
              <p className="text-xs text-muted-foreground bg-muted/50 rounded-lg px-3 py-2">{extractedData.verificationNotes}</p>
            )}

            {/* Extracted Fields */}
            <div className="grid grid-cols-1 gap-2">
              {fields.map((field, i) => (
                <div key={i} className="flex items-start justify-between gap-3 bg-background border border-border rounded-lg px-3 py-2.5">
                  <span className="text-xs text-muted-foreground shrink-0">{field.label}</span>
                  <span className="text-xs font-medium text-foreground text-end">{field.value}</span>
                </div>
              ))}
            </div>

            {/* Auto-Fill Button */}
            {!autoFilled ? (
              <button
                onClick={handleAutoFill}
                className="w-full flex items-center justify-center gap-2 px-4 py-3 bg-emerald-600 hover:bg-emerald-700 text-white rounded-xl font-semibold text-sm transition-colors"
              >
                <Icon name="PencilSquareIcon" size={16} />
                {ui.autofill}
              </button>
            ) : (
              <div className="flex items-center justify-center gap-2 px-4 py-3 bg-green-50 border border-green-200 text-green-700 rounded-xl text-sm font-semibold">
                <Icon name="CheckCircleIcon" size={16} />
                {ui.autofilled}
              </div>
            )}
          </div>
        )}
      </div>
    </div>
  );
}
