// src/lib/ideaGeneratorEngine.ts
import { safeGenerateAIContent } from './aiResilienceEngine';

interface PlatformStats {
  totalOrders: number;
  totalRevenue: number;
  totalUsers: number;
  activeFactories: number;
  disputedOrders: number;
}

// أفكار احتياطية ذكية ومفصلة تعمل فوريًا في حال تعطل الـ API تمامًا (ضمان الاستمرارية 100%)
export const FALLBACK_IDEAS = [
  {
    title: "تفعيل حملة الموردين الأوائل (Pioneer Suppliers)",
    category: "نمو المنصة",
    description: "بما أن عدد المصانع النشطة يحتاج نمواً، اقترح تقديم اشتراك مجاني لمدة 3 أشهر لأول 50 مصنعاً مسجلاً لجذب السيولة والمنتجات.",
    impact: "عالي جداً"
  },
  {
    title: "أتمتة التحقق من الهوية (KYC Automation)",
    category: "العمليات والثقة",
    description: "تسريع عملية قبول المصانع عبر الفحص الآلي للرقم الضريبي والسجل التجاري باستخدام الذكاء الاصطناعي لتقليل وقت الانتظار.",
    impact: "متوسط"
  },
  {
    title: "برنامج حوافز المشترين (Buyer Cashback)",
    category: "المبيعات",
    description: "منح خصم 1% على الطلب الأول عبر نظام الضمان المالي (Escrow) لكسر حاجز الخوف لدى المشترين الجدد.",
    impact: "عالي"
  }
];

/**
 * توليد أفكار استراتيجية ذكية للوحة التحكم مع حماية كاملة ضد التوقف
 */
export async function generatePlatformIdeas(stats: PlatformStats): Promise<any[]> {
  const prompt = `You are the Executive Growth Advisor for DirectHub (B2B industrial platform). 
  Current platform metrics:
  - Total Orders: ${stats.totalOrders}
  - Total Revenue: $${stats.totalRevenue}
  - Total Users: ${stats.totalUsers}
  - Active Factories: ${stats.activeFactories}
  - Disputed Orders: ${stats.disputedOrders}

  Provide 3 distinct, highly actionable, strategic business ideas in JSON format (an array of objects with keys: title, category, description, impact). Write the response in Arabic. Return ONLY valid JSON array.`;

  try {
    // استدعاء آمن ومحمي عبر محرك المرونة
    const responseText = await safeGenerateAIContent(prompt, {
      model: 'gemini/gemini-3.5-flash-lite',
      fallbackModel: 'gemini/gemini-3.5-flash',
      temperature: 0.7,
      maxOutputTokens: 1024
    });

    // محاولة استخراج الـ JSON من استجابة الذكاء الاصطناعي
    const jsonMatch = responseText.match(/\[[\s\S]*\]/);
    if (jsonMatch) {
      return JSON.parse(jsonMatch[0]);
    }

    throw new Error('Could not parse AI response as JSON');
  } catch (error) {
    console.warn('⚠️ تعذر جلب أفكار جديدة من الذكاء الاصطناعي حالياً. تفعيل نظام الأفكار الاحتياطية الذكية...');
    // إرجاع الأفكار الاحتياطية لضمان عدم توقف واجهة المشرف أبداً
    return FALLBACK_IDEAS;
  }
}
