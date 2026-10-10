'use client';

/**
 * DIRECTHUB SECURITY RULE — Contact Info Validator
 * ─────────────────────────────────────────────────
 * Prevents manufacturers from embedding external contact details
 * (phone numbers, emails, physical addresses) in product descriptions
 * or promotional fields. All communication must stay inside DirectHub.
 *
 * Localized warnings are returned in the user's browser language.
 */

export type ContactInfoViolationType = 'phone' | 'email' | 'address' | null;

export interface ContactInfoValidationResult {
  hasViolation: boolean;
  violationType: ContactInfoViolationType;
  warningMessage: string;
}

// ── Regex Patterns ──────────────────────────────────────────────────────────

/** Matches international and local phone number formats */
const PHONE_REGEX =
  /(\+?\d[\s\-.]?\(?\d{2,4}\)?[\s\-.]?\d{2,4}[\s\-.]?\d{2,6})|(\b0\d{8,11}\b)|(tel:|phone:|هاتف|جوال|موبايل|واتساب|whatsapp|call us|تواصل على|اتصل)/i;

/** Matches email addresses */
const EMAIL_REGEX =
  /[a-zA-Z0-9._%+\-]+@[a-zA-Z0-9.\-]+\.[a-zA-Z]{2,}|(email:|mail:|بريد|إيميل|ايميل|e-mail)/i;

/** Matches physical/postal address indicators */
const ADDRESS_REGEX =
  /(p\.?o\.?\s*box|po box|postal code|zip code|street|avenue|blvd|road|شارع|حي|منطقة|مدينة|عنوان|ص\.ب|صندوق بريد|الرياض|جدة|الدمام|مكة|المدينة|الطائف|address:|location:|موقعنا|عنواننا)/i;

// ── Warning messages by language ────────────────────────────────────────────

const WARNINGS: Record<string, Record<NonNullable<ContactInfoViolationType>, string>> = {
  ar: {
    phone:
      '⚠️ تنبيه أمني: يُمنع إدراج أرقام الهاتف في وصف المنتج. يجب أن يتم التواصل حصرياً عبر منصة دايركت هب.',
    email:
      '⚠️ تنبيه أمني: يُمنع إدراج عناوين البريد الإلكتروني في وصف المنتج. يجب أن يتم التواصل حصرياً عبر منصة دايركت هب.',
    address:
      '⚠️ تنبيه أمني: يُمنع إدراج العناوين البريدية أو الفيزيائية في وصف المنتج. يجب أن يتم التواصل حصرياً عبر منصة دايركت هب.',
  },
  en: {
    phone:
      '⚠️ Security Notice: Phone numbers are not allowed in product descriptions. All communication must happen exclusively through the DirectHub platform.',
    email:
      '⚠️ Security Notice: Email addresses are not allowed in product descriptions. All communication must happen exclusively through the DirectHub platform.',
    address:
      '⚠️ Security Notice: Physical or postal addresses are not allowed in product descriptions. All communication must happen exclusively through the DirectHub platform.',
  },
  zh: {
    phone:
      '⚠️ 安全提示：产品描述中不允许包含电话号码。所有沟通必须通过DirectHub平台进行。',
    email:
      '⚠️ 安全提示：产品描述中不允许包含电子邮件地址。所有沟通必须通过DirectHub平台进行。',
    address:
      '⚠️ 安全提示：产品描述中不允许包含实体或邮政地址。所有沟通必须通过DirectHub平台进行。',
  },
  tr: {
    phone:
      '⚠️ Güvenlik Uyarısı: Ürün açıklamalarında telefon numaralarına izin verilmez. Tüm iletişim yalnızca DirectHub platformu üzerinden yapılmalıdır.',
    email:
      '⚠️ Güvenlik Uyarısı: Ürün açıklamalarında e-posta adreslerine izin verilmez. Tüm iletişim yalnızca DirectHub platformu üzerinden yapılmalıdır.',
    address:
      '⚠️ Güvenlik Uyarısı: Ürün açıklamalarında fiziksel veya posta adreslerine izin verilmez. Tüm iletişim yalnızca DirectHub platformu üzerinden yapılmalıdır.',
  },
};

const BLOCKED_SUBMIT_MESSAGES: Record<string, string> = {
  ar: 'لا يمكن حفظ المنتج: يحتوي الوصف على بيانات تواصل خارجية محظورة. يرجى إزالتها والمحاولة مجدداً.',
  en: 'Cannot save product: the description contains blocked external contact information. Please remove it and try again.',
  zh: '无法保存产品：描述中包含被禁止的外部联系信息，请删除后重试。',
  tr: 'Ürün kaydedilemez: Açıklama yasaklı harici iletişim bilgileri içeriyor. Lütfen kaldırın ve tekrar deneyin.',
};

// ── Core validation function ─────────────────────────────────────────────────

export function validateContactInfo(
  text: string,
  language: string = 'ar'
): ContactInfoValidationResult {
  if (!text || !text.trim()) {
    return { hasViolation: false, violationType: null, warningMessage: '' };
  }

  const lang = WARNINGS[language] ? language : 'ar';

  if (EMAIL_REGEX.test(text)) {
    return {
      hasViolation: true,
      violationType: 'email',
      warningMessage: WARNINGS[lang].email,
    };
  }

  if (PHONE_REGEX.test(text)) {
    return {
      hasViolation: true,
      violationType: 'phone',
      warningMessage: WARNINGS[lang].phone,
    };
  }

  if (ADDRESS_REGEX.test(text)) {
    return {
      hasViolation: true,
      violationType: 'address',
      warningMessage: WARNINGS[lang].address,
    };
  }

  return { hasViolation: false, violationType: null, warningMessage: '' };
}

/** Returns the blocked-submit error message for the given language */
export function getBlockedSubmitMessage(language: string = 'ar'): string {
  return BLOCKED_SUBMIT_MESSAGES[language] || BLOCKED_SUBMIT_MESSAGES['ar'];
}
