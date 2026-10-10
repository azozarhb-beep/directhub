'use client';

import React, { useState } from 'react';
import Icon from '@/components/ui/AppIcon';
import { useLanguage } from '@/contexts/LanguageContext';
import { getChatCompletion } from '@/lib/ai/chatCompletion';
import toast from 'react-hot-toast';

interface ContractTerms {
  summary: string;
  paymentTerms: string[];
  deliveryTerms: string[];
  qualityGuarantees: string[];
  disputeResolution: string[];
  shippingConditions: string[];
  penaltyClauses: string[];
  recommendedIncoterm: string;
  riskAssessment: string;
  suggestedContractDuration: string;
}

interface ContractFormData {
  buyerCountry: string;
  supplierCountry: string;
  productType: string;
  orderValue: string;
  paymentMethod: string;
  deliveryTimeline: string;
  specialRequirements: string;
}

interface AIContractAssistantProps {
  prefillData?: Partial<ContractFormData>;
  onContractGenerated?: (terms: ContractTerms) => void;
}

export default function AIContractAssistant({ prefillData, onContractGenerated }: AIContractAssistantProps) {
  const { t, dir, isRTL, language } = useLanguage();
  const ui = t.aiContract;
  const [isGenerating, setIsGenerating] = useState(false);
  const [contractTerms, setContractTerms] = useState<ContractTerms | null>(null);
  const [copied, setCopied] = useState(false);
  const [formData, setFormData] = useState<ContractFormData>({
    buyerCountry: prefillData?.buyerCountry || '',
    supplierCountry: prefillData?.supplierCountry || '',
    productType: prefillData?.productType || '',
    orderValue: prefillData?.orderValue || '',
    paymentMethod: prefillData?.paymentMethod || '',
    deliveryTimeline: prefillData?.deliveryTimeline || '',
    specialRequirements: prefillData?.specialRequirements || '',
  });


  const updateField = (field: keyof ContractFormData, value: string) => {
    setFormData(prev => ({ ...prev, [field]: value }));
  };

  const generateContract = async () => {
    if (!formData.productType || !formData.orderValue) {
      toast.error(ui.fillRequired);
      return;
    }

    setIsGenerating(true);
    setContractTerms(null);

    try {
      const systemPrompt = `You are an expert B2B international trade contract lawyer for DirectHub marketplace.
Generate comprehensive supply contract terms based on the provided deal details.
Return ONLY valid JSON with this exact structure:
{
  "summary": "Brief 2-3 sentence contract summary",
  "paymentTerms": ["term 1", "term 2", "term 3", ...],
  "deliveryTerms": ["term 1", "term 2", ...],
  "qualityGuarantees": ["guarantee 1", "guarantee 2", ...],
  "disputeResolution": ["step 1", "step 2", ...],
  "shippingConditions": ["condition 1", "condition 2", ...],
  "penaltyClauses": ["clause 1", "clause 2", ...],
  "recommendedIncoterm": "e.g. FOB Shanghai",
  "riskAssessment": "Brief risk assessment paragraph",
  "suggestedContractDuration": "e.g. 12 months with renewal option"
}
Generate practical, legally sound terms appropriate for international B2B trade.
Return ONLY JSON, no markdown.`;

      const dealDetails = `
Buyer Country: ${formData.buyerCountry || 'Not specified'}
Supplier Country: ${formData.supplierCountry || 'Not specified'}
Product Type: ${formData.productType}
Order Value: $${formData.orderValue} USD
Payment Method: ${formData.paymentMethod || 'Not specified'}
Delivery Timeline: ${formData.deliveryTimeline || 'Standard'}
Special Requirements: ${formData.specialRequirements || 'None'}
      `.trim();

      const response = await getChatCompletion(
        'GEMINI',
        'gemini/gemini-3.6-flash',
        [
          { role: 'system', content: systemPrompt },
          { role: 'user', content: `Generate B2B supply contract terms for this deal:\n${dealDetails}` },
        ],
        { temperature: 0.5, max_tokens: 3000 },
        45000
      );

      const content = response?.choices?.[0]?.message?.content || '';
      const jsonMatch = content.match(/\{[\s\S]*\}/);
      if (jsonMatch) {
        const parsed: ContractTerms = JSON.parse(jsonMatch[0]);
        setContractTerms(parsed);
        onContractGenerated?.(parsed);
        toast.success(ui.generateSuccess);
      } else {
        toast.error(ui.generateError);
      }
    } catch (err) {
      const msg = err instanceof Error ? err.message : ui.generateError;
      toast.error(msg, { duration: 6000 });
      console.error('Contract generation error:', err);
    } finally {
      setIsGenerating(false);
    }
  };

  const handleCopy = () => {
    if (!contractTerms) return;
    const sections = [
      `=== ${ui.summary} ===\n${contractTerms.summary}`,
      `=== ${ui.paymentTerms} ===\n${contractTerms.paymentTerms.map(t => `• ${t}`).join('\n')}`,
      `=== ${ui.deliveryTerms} ===\n${contractTerms.deliveryTerms.map(t => `• ${t}`).join('\n')}`,
      `=== ${ui.qualityGuarantees} ===\n${contractTerms.qualityGuarantees.map(t => `• ${t}`).join('\n')}`,
      `=== ${ui.shippingTerms} ===\n${contractTerms.shippingConditions.map(t => `• ${t}`).join('\n')}`,
      `=== ${ui.penaltyClauses} ===\n${contractTerms.penaltyClauses.map(t => `• ${t}`).join('\n')}`,
      `=== ${ui.recommendedIncoterm} ===\n${contractTerms.recommendedIncoterm}`,
      `=== ${ui.riskAssessment} ===\n${contractTerms.riskAssessment}`,
    ].join('\n\n');

    navigator.clipboard.writeText(sections).then(() => {
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    });
  };

  const sectionConfig = contractTerms ? [
    { label: ui.paymentTerms, items: contractTerms.paymentTerms, icon: 'CreditCardIcon', color: 'blue' },
    { label: ui.deliveryTerms, items: contractTerms.deliveryTerms, icon: 'TruckIcon', color: 'green' },
    { label: ui.qualityGuarantees, items: contractTerms.qualityGuarantees, icon: 'ShieldCheckIcon', color: 'emerald' },
    { label: ui.shippingTerms, items: contractTerms.shippingConditions, icon: 'GlobeAltIcon', color: 'indigo' },
    { label: ui.penaltyClauses, items: contractTerms.penaltyClauses, icon: 'ExclamationTriangleIcon', color: 'orange' },
    { label: ui.disputeResolution, items: contractTerms.disputeResolution, icon: 'ScaleIcon', color: 'purple' },
  ] : [];

  const colorMap: Record<string, string> = {
    blue: 'bg-blue-50 border-blue-200',
    green: 'bg-green-50 border-green-200',
    emerald: 'bg-emerald-50 border-emerald-200',
    indigo: 'bg-indigo-50 border-indigo-200',
    orange: 'bg-orange-50 border-orange-200',
    purple: 'bg-purple-50 border-purple-200',
  };

  const iconColorMap: Record<string, string> = {
    blue: 'text-blue-600',
    green: 'text-green-600',
    emerald: 'text-emerald-600',
    indigo: 'text-indigo-600',
    orange: 'text-orange-600',
    purple: 'text-purple-600',
  };

  return (
    <div className="bg-card border border-border rounded-2xl overflow-hidden" dir={dir}>
      {/* Header */}
      <div className="flex items-center gap-3 px-5 py-4 bg-gradient-to-r from-amber-600 to-orange-600 text-white">
        <div className="w-10 h-10 rounded-xl bg-white/20 flex items-center justify-center shrink-0">
          <Icon name="DocumentCheckIcon" size={20} className="text-white" />
        </div>
        <div>
          <h3 className="font-bold text-base">{ui.title}</h3>
          <p className="text-xs text-white/80">{ui.subtitle}</p>
        </div>
        <span className="ms-auto text-xs bg-white/20 px-2 py-1 rounded-full">{ui.poweredBy}</span>
      </div>

      <div className="p-5 space-y-4">
        {/* Form */}
        <div className="grid grid-cols-2 gap-3">
          <div>
            <label className="block text-xs font-medium text-muted-foreground mb-1">{ui.buyerCountry}</label>
            <input
              type="text"
              value={formData.buyerCountry}
              onChange={e => updateField('buyerCountry', e.target.value)}
              className="w-full px-3 py-2 bg-background border border-border rounded-lg text-sm focus:outline-none focus:border-primary transition-colors"
              dir={isRTL ? 'rtl' : 'ltr'}
            />
          </div>
          <div>
            <label className="block text-xs font-medium text-muted-foreground mb-1">{ui.supplierCountry}</label>
            <input
              type="text"
              value={formData.supplierCountry}
              onChange={e => updateField('supplierCountry', e.target.value)}
              className="w-full px-3 py-2 bg-background border border-border rounded-lg text-sm focus:outline-none focus:border-primary transition-colors"
              dir={isRTL ? 'rtl' : 'ltr'}
            />
          </div>
          <div>
            <label className="block text-xs font-medium text-muted-foreground mb-1">{ui.productType} *</label>
            <input
              type="text"
              value={formData.productType}
              onChange={e => updateField('productType', e.target.value)}
              className="w-full px-3 py-2 bg-background border border-border rounded-lg text-sm focus:outline-none focus:border-primary transition-colors"
              dir={isRTL ? 'rtl' : 'ltr'}
            />
          </div>
          <div>
            <label className="block text-xs font-medium text-muted-foreground mb-1">{ui.orderValue} *</label>
            <input
              type="number"
              value={formData.orderValue}
              onChange={e => updateField('orderValue', e.target.value)}
              className="w-full px-3 py-2 bg-background border border-border rounded-lg text-sm focus:outline-none focus:border-primary transition-colors"
            />
          </div>
        </div>

        {/* Payment Method */}
        <div>
          <label className="block text-xs font-medium text-muted-foreground mb-1.5">{ui.paymentMethod}</label>
          <div className="flex flex-wrap gap-2">
            {[ui.pay100, ui.lc, ui.payOnDelivery, ui.partialAdvance, ui.openAccount].map((method, i) => (
              <button
                key={i}
                onClick={() => updateField('paymentMethod', method)}
                className={`px-3 py-1.5 rounded-lg text-xs font-medium border transition-colors ${formData.paymentMethod === method ? 'bg-amber-600 text-white border-amber-600' : 'bg-background border-border text-foreground hover:border-amber-400'}`}
              >
                {method}
              </button>
            ))}
          </div>
        </div>

        {/* Delivery & Special */}
        <div className="grid grid-cols-2 gap-3">
          <div>
            <label className="block text-xs font-medium text-muted-foreground mb-1">{ui.deliveryTimeline}</label>
            <input
              type="text"
              value={formData.deliveryTimeline}
              onChange={e => updateField('deliveryTimeline', e.target.value)}
              placeholder={ui.daysExample}
              className="w-full px-3 py-2 bg-background border border-border rounded-lg text-sm focus:outline-none focus:border-primary transition-colors"
              dir={isRTL ? 'rtl' : 'ltr'}
            />
          </div>
          <div>
            <label className="block text-xs font-medium text-muted-foreground mb-1">{ui.specialRequirements}</label>
            <input
              type="text"
              value={formData.specialRequirements}
              onChange={e => updateField('specialRequirements', e.target.value)}
              className="w-full px-3 py-2 bg-background border border-border rounded-lg text-sm focus:outline-none focus:border-primary transition-colors"
              dir={isRTL ? 'rtl' : 'ltr'}
            />
          </div>
        </div>

        {/* Generate Button */}
        <button
          onClick={generateContract}
          disabled={isGenerating}
          className="w-full flex items-center justify-center gap-2 px-4 py-3 bg-amber-600 hover:bg-amber-700 text-white rounded-xl font-semibold text-sm transition-colors disabled:opacity-60"
        >
          {isGenerating ? (
            <>
              <div className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin" />
              {ui.generating}
            </>
          ) : (
            <>
              <Icon name="SparklesIcon" size={16} />
              {ui.generate}
            </>
          )}
        </button>

        {/* Generated Contract Terms */}
        {contractTerms && (
          <div className="space-y-3">
            {/* Summary */}
            <div className="bg-amber-50 border border-amber-200 rounded-xl p-4">
              <h4 className="text-sm font-bold text-amber-800 mb-2 flex items-center gap-2">
                <Icon name="DocumentTextIcon" size={15} />
                {ui.summary}
              </h4>
              <p className="text-sm text-amber-900 leading-relaxed">{contractTerms.summary}</p>
            </div>

            {/* Incoterm & Duration */}
            <div className="grid grid-cols-2 gap-2">
              <div className="bg-background border border-border rounded-xl p-3">
                <p className="text-xs text-muted-foreground mb-1">{ui.recommendedIncoterm}</p>
                <p className="text-sm font-bold text-foreground">{contractTerms.recommendedIncoterm}</p>
              </div>
              <div className="bg-background border border-border rounded-xl p-3">
                <p className="text-xs text-muted-foreground mb-1">{ui.proposedDuration}</p>
                <p className="text-sm font-bold text-foreground">{contractTerms.suggestedContractDuration}</p>
              </div>
            </div>

            {/* Risk Assessment */}
            <div className="bg-muted/50 rounded-xl p-3">
              <p className="text-xs font-semibold text-muted-foreground mb-1">{ui.riskAssessment}</p>
              <p className="text-xs text-foreground leading-relaxed">{contractTerms.riskAssessment}</p>
            </div>

            {/* Sections */}
            {sectionConfig.map((section, idx) => (
              section.items?.length > 0 && (
                <div key={idx} className={`border rounded-xl p-4 ${colorMap[section.color]}`}>
                  <h4 className={`text-sm font-bold mb-2 flex items-center gap-2 ${iconColorMap[section.color]}`}>
                    <Icon name={section.icon as any} size={15} />
                    {section.label}
                  </h4>
                  <ul className="space-y-1.5">
                    {section.items.map((item, i) => (
                      <li key={i} className="flex items-start gap-2 text-xs text-foreground">
                        <span className={`mt-0.5 shrink-0 ${iconColorMap[section.color]}`}>•</span>
                        <span>{item}</span>
                      </li>
                    ))}
                  </ul>
                </div>
              )
            ))}

            {/* Copy Button */}
            <button
              onClick={handleCopy}
              className="w-full flex items-center justify-center gap-2 px-4 py-3 bg-card border border-border hover:border-amber-400 text-foreground rounded-xl text-sm font-medium transition-colors"
            >
              <Icon name={copied ? 'CheckIcon' : 'ClipboardDocumentIcon'} size={15} />
              {copied ? ui.copied : ui.copyTerms}
            </button>
          </div>
        )}
      </div>
    </div>
  );
}
