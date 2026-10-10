import { SupabaseClient } from '@supabase/supabase-js';

export async function getFactoryNotificationEmails(
  supabase: SupabaseClient,
  factoryId: string
): Promise<string[]> {
  try {
    const emails: string[] = [];

    // 1. جلب البريد الأساسي للمصنع من جدول التسجيل
    const { data: factoryData } = await supabase
      .from('factory_registrations')
      .select('email')
      .eq('id', factoryId)
      .single();

    if (factoryData && factoryData.email) {
      emails.push(factoryData.email);
    }

    // 2. جلب الإيميلات الإضافية من جدول الإيميلات المحفوظة
    const { data: savedEmailsData } = await supabase
      .from('factory_saved_emails')
      .select('email')
      .eq('factory_id', factoryId);

    if (savedEmailsData && Array.isArray(savedEmailsData)) {
      savedEmailsData.forEach((item: { email: string }) => {
        if (item.email && !emails.includes(item.email)) {
          emails.push(item.email);
        }
      });
    }

    // 3. إعادة القائمة النهائية المجمعة للإيميلات
    return emails;
  } catch (err) {
    console.error('Error fetching factory notification emails:', err);
    return [];
  }
}
