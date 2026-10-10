'use client';

import React, { useState, useEffect } from 'react';
import Icon from '@/components/ui/AppIcon';
import { useLanguage } from '@/contexts/LanguageContext';
import { getChatCompletion } from '@/lib/ai/chatCompletion';
import toast from 'react-hot-toast';

interface RFQMatchResult {
  factoryName: string;
  matchScore: number;
  specialization: string;
  location: string;
  certifications: string[];
  estimatedLeadTime: string;
  reason: string;
}

interface AIRFQMatchmakerProps {
  rfqData?: {
    title?: string;
    description?: string;
    category?: string;
    quantity?: string;
    targetPrice?: string;
  };
  onMatchFound?: (matches: RFQMatchResult[]) => void;
}

export default function AIRFQMatchmaker({ rfqData, onMatchFound }: AIRFQMatchmakerProps) {
  const { isRTL, language } = useLanguage();
  const [isAnalyzing, setIsAnalyzing] = useState(false);
  const [matches, setMatches] = useState<RFQMatchResult[]>([]);
  const [analysisText, setAnalysisText] = useState('');
  const [rfqText, setRfqText] = useState('');
  const [hasAnalyzed, setHasAnalyzed] = useState(false);

  const labels = {
    ar: {
      title: 'نظام المطابقة الذكي للطلبات',
      subtitle: 'تحليل طلبك ومطابقته مع أفضل المصانع والموردين',
      placeholder: 'اكتب تفاصيل طلبك هنا... (المادة الخام، الكمية، المواصفات، الميزانية المستهدفة)',
      analyze: 'تحليل ومطابقة بالذكاء الاصطناعي',
      analyzing: 'جارٍ التحليل والمطابقة...',
      matchScore: 'نسبة التطابق',
      location: 'الموقع',
      leadTime: 'وقت التسليم',
      certifications: 'الشهادات',
      reason: 'سبب التوصية',
      noMatches: 'لم يتم العثور على تطابقات. يرجى تفصيل طلبك أكثر.',
      notifyTitle: 'إشعار المصانع المطابقة',
      notifyBtn: 'إرسال إشعار للمصانع المطابقة',
      notified: 'تم إرسال الإشعارات للمصانع المطابقة ✓',
      poweredBy: 'مدعوم بـ Gemini AI',
    },
    en: {
      title: 'AI RFQ Matchmaker',
      subtitle: 'Analyze your request and match with the best factories & suppliers',
      placeholder: 'Describe your RFQ here... (raw material, quantity, specifications, target budget)',
      analyze: 'Analyze & Match with AI',
      analyzing: 'Analyzing & Matching...',
      matchScore: 'Match Score',
      location: 'Location',
      leadTime: 'Lead Time',
      certifications: 'Certifications',
      reason: 'Recommendation Reason',
      noMatches: 'No matches found. Please provide more details about your request.',
      notifyTitle: 'Notify Matched Factories',
      notifyBtn: 'Send Notifications to Matched Factories',
      notified: 'Notifications sent to matched factories ✓',
      poweredBy: 'Powered by Gemini AI',
    },
  };

  const t = language === 'ar' ? labels.ar : labels.en;

  const analyzeRFQ = async () => {
    const query = rfqText.trim() || (rfqData ? JSON.stringify(rfqData) : '');
    if (!query) {
      toast.error(language === 'ar' ? 'يرجى إدخال تفاصيل الطلب' : 'Please enter RFQ details');
      return;
    }

    setIsAnalyzing(true);
    setMatches([]);
    setAnalysisText('');

    try {
      const systemPrompt = `You are an AI RFQ Matchmaker for DirectHub (دايركت هب) B2B marketplace. 
Analyze buyer RFQ requests and suggest the best matching factories/suppliers.
Always respond with a valid JSON array of matches. Each match must have:
- factoryName (string): realistic factory name
- matchScore (number 0-100): compatibility percentage
- specialization (string): what they specialize in
- location (string): country/city
- certifications (array of strings): ISO, CE, Halal, etc.
- estimatedLeadTime (string): e.g. "15-30 days"
- reason (string): why this factory is a good match

Return ONLY a JSON array, no markdown, no explanation outside the array.
Generate 3-5 realistic matches based on the RFQ details.`;

      const response = await getChatCompletion(
        'GEMINI',
        'gemini/gemini-3.6-flash',
        [
          { role: 'system', content: systemPrompt },
          { role: 'user', content: `Analyze this RFQ and find matching factories:\n${query}` },
        ],
        { temperature: 0.7, max_tokens: 2000 },
        45000
      );

      const content = response?.choices?.[0]?.message?.content || '';
      setAnalysisText(content);

      // Parse JSON from response
      const jsonMatch = content.match(/\[[\s\S]*\]/);
      if (jsonMatch) {
        const parsed: RFQMatchResult[] = JSON.parse(jsonMatch[0]);
        setMatches(parsed);
        setHasAnalyzed(true);
        onMatchFound?.(parsed);
        toast.success(language === 'ar' ? `تم العثور على ${parsed.length} مصانع مطابقة` : `Found ${parsed.length} matching factories`);
      } else {
        toast.error(language === 'ar' ? 'لم يتم العثور على تطابقات' : 'No matches found');
      }
    } catch (err) {
      const msg = err instanceof Error
        ? err.message
        : (language === 'ar' ? 'حدث خطأ في التحليل' : 'Analysis error occurred');
      toast.error(msg, { duration: 6000 });
      console.error('RFQ matchmaker error:', err);
    } finally {
      setIsAnalyzing(false);
    }
  };

  const [notified, setNotified] = useState(false);
  const handleNotify = () => {
    setNotified(true);
    toast.success(t.notified);
  };

  return (
    <div className="bg-card border border-border rounded-2xl overflow-hidden" dir={isRTL ? 'rtl' : 'ltr'}>
      {/* Header */}
      <div className="flex items-center gap-3 px-5 py-4 bg-gradient-to-r from-blue-600 to-indigo-600 text-white">
        <div className="w-10 h-10 rounded-xl bg-white/20 flex items-center justify-center shrink-0">
          <Icon name="MagnifyingGlassIcon" size={20} className="text-white" />
        </div>
        <div>
          <h3 className="font-bold text-base">{t.title}</h3>
          <p className="text-xs text-white/80">{t.subtitle}</p>
        </div>
        <span className="ms-auto text-xs bg-white/20 px-2 py-1 rounded-full">{t.poweredBy}</span>
      </div>

      <div className="p-5 space-y-4">
        {/* Input */}
        <textarea
          value={rfqText}
          onChange={e => setRfqText(e.target.value)}
          placeholder={t.placeholder}
          rows={4}
          className="w-full px-4 py-3 bg-background border border-border rounded-xl text-sm text-foreground placeholder:text-muted-foreground focus:outline-none focus:border-primary resize-none transition-colors"
          dir={isRTL ? 'rtl' : 'ltr'}
        />

        <button
          onClick={analyzeRFQ}
          disabled={isAnalyzing}
          className="w-full flex items-center justify-center gap-2 px-4 py-3 bg-blue-600 hover:bg-blue-700 text-white rounded-xl font-semibold text-sm transition-colors disabled:opacity-60"
        >
          {isAnalyzing ? (
            <>
              <div className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin" />
              {t.analyzing}
            </>
          ) : (
            <>
              <Icon name="SparklesIcon" size={16} />
              {t.analyze}
            </>
          )}
        </button>

        {/* Results */}
        {matches.length > 0 && (
          <div className="space-y-3">
            {matches.map((match, idx) => (
              <div key={idx} className="border border-border rounded-xl p-4 space-y-2 hover:border-blue-300 transition-colors">
                <div className="flex items-start justify-between gap-2">
                  <div>
                    <h4 className="font-semibold text-sm text-foreground">{match.factoryName}</h4>
                    <p className="text-xs text-muted-foreground">{match.specialization}</p>
                  </div>
                  <div className="shrink-0 flex items-center gap-1.5">
                    <div className="w-10 h-10 rounded-full bg-blue-50 border-2 border-blue-200 flex items-center justify-center">
                      <span className="text-xs font-bold text-blue-600">{match.matchScore}%</span>
                    </div>
                  </div>
                </div>

                <div className="grid grid-cols-2 gap-2 text-xs">
                  <div className="flex items-center gap-1 text-muted-foreground">
                    <Icon name="MapPinIcon" size={12} />
                    <span>{match.location}</span>
                  </div>
                  <div className="flex items-center gap-1 text-muted-foreground">
                    <Icon name="ClockIcon" size={12} />
                    <span>{match.estimatedLeadTime}</span>
                  </div>
                </div>

                {match.certifications?.length > 0 && (
                  <div className="flex flex-wrap gap-1">
                    {match.certifications.map((cert, i) => (
                      <span key={i} className="px-2 py-0.5 bg-green-50 text-green-700 border border-green-200 rounded-full text-xs">{cert}</span>
                    ))}
                  </div>
                )}

                <p className="text-xs text-muted-foreground bg-muted/50 rounded-lg px-3 py-2">{match.reason}</p>
              </div>
            ))}

            {/* Notify button */}
            {!notified ? (
              <button
                onClick={handleNotify}
                className="w-full flex items-center justify-center gap-2 px-4 py-3 bg-green-600 hover:bg-green-700 text-white rounded-xl font-semibold text-sm transition-colors"
              >
                <Icon name="BellIcon" size={16} />
                {t.notifyBtn}
              </button>
            ) : (
              <div className="flex items-center justify-center gap-2 px-4 py-3 bg-green-50 border border-green-200 text-green-700 rounded-xl text-sm font-semibold">
                <Icon name="CheckCircleIcon" size={16} />
                {t.notified}
              </div>
            )}
          </div>
        )}
      </div>
    </div>
  );
}
