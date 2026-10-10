/**
 * DirectHub Privacy Shield
 * Protects the platform business model by masking/blocking contact information
 * in public listings and internal chat to prevent off-platform communication.
 *
 * ALLOWED in chat:
 *  - Business file attachments: PDFs, product catalogs, technical spec documents
 *  - Platform-internal storage links (Supabase storage / directhub domain)
 *
 * BLOCKED in chat:
 *  - Phone numbers
 *  - Email addresses
 *  - External links (non-platform URLs)
 *  - Social media handles (@username)
 *  - Messenger app contacts (WhatsApp, Telegram, etc.)
 *  - Off-platform contact phrases
 */

// ─── Allowed File Extensions (business documents) ────────────────────────────

/** File extensions that represent shareable business documents */
const ALLOWED_FILE_EXTENSIONS =
  /\.(pdf|doc|docx|xls|xlsx|ppt|pptx|csv|zip|rar|dwg|dxf|step|stp|iges|igs|stl|png|jpg|jpeg|gif|webp|mp4|mov)(\?[^\s]*)?$/i;

/** Platform-internal domains that are always allowed */
const ALLOWED_DOMAINS_REGEX =
  /(directhub[a-z0-9.\-]*\.builtwithrocket\.new|supabase\.co|supabase\.in|localhost)/i;

// ─── Regex Patterns ──────────────────────────────────────────────────────────

/** Matches international phone numbers in various formats */
const PHONE_REGEX =
  /(\+?\d[\s\-.]?\(?\d{1,4}\)?[\s\-.]?\d{1,4}[\s\-.]?\d{1,9}([\s\-.]?\d{1,9})?)/g;

/** Matches email addresses */
const EMAIL_REGEX = /[a-zA-Z0-9._%+\-]+@[a-zA-Z0-9.\-]+\.[a-zA-Z]{2,}/g;

/** Matches http/https/ftp URLs and www. domains */
const URL_REGEX =
  /(https?:\/\/[^\s]+|ftp:\/\/[^\s]+|www\.[a-zA-Z0-9\-]+\.[a-zA-Z]{2,}[^\s]*)/gi;

/** Matches WhatsApp, Telegram, WeChat, Line, Viber handles/links */
const MESSENGER_REGEX =
  /(whatsapp|telegram|wechat|viber|line|signal|skype)[:\s\/]+[\w\d\+\-@.]+/gi;

/** Matches social media handles like @username */
const SOCIAL_HANDLE_REGEX = /@[a-zA-Z0-9_]{3,}/g;

/** Matches explicit contact sharing phrases */
const CONTACT_PHRASE_REGEX =
  /(call me|contact me|reach me|my (number|phone|mobile|cell|email|whatsapp|telegram|wechat)|send (email|mail) to|email me at|text me|DM me|message me on|find me on|add me on)/gi;

// ─── Helpers ─────────────────────────────────────────────────────────────────

/**
 * Returns true if a URL is an allowed platform-internal link or a business
 * file attachment (PDF, catalog, spec doc, image, etc.).
 */
function isAllowedUrl(url: string): boolean {
  // Allow platform-internal domains (Supabase storage, DirectHub)
  if (ALLOWED_DOMAINS_REGEX.test(url)) return true;
  // Allow direct file attachment links by extension
  if (ALLOWED_FILE_EXTENSIONS.test(url)) return true;
  return false;
}

/**
 * Checks whether a string contains any *external* (non-allowed) URLs.
 * Platform storage links and file attachments are excluded from detection.
 */
function containsExternalUrl(text: string): boolean {
  URL_REGEX.lastIndex = 0;
  const matches = text.match(URL_REGEX);
  if (!matches) return false;
  // If every URL match is an allowed (platform/file) URL, don't flag it
  return matches.some((url) => !isAllowedUrl(url));
}

// ─── Masking ─────────────────────────────────────────────────────────────────

const PHONE_MASK = '📵 [Phone Hidden]';
const EMAIL_MASK = '✉️ [Email Hidden]';
const URL_MASK = '🔗 [Link Hidden]';
const MESSENGER_MASK = '💬 [Messenger Hidden]';
const SOCIAL_MASK = '[Handle Hidden]';

/**
 * Masks all contact information in a string for display in public listings.
 * File attachment URLs are preserved; only external links are masked.
 */
export function maskContactInfo(text: string): string {
  if (!text) return text;

  // Replace external URLs only (preserve platform/file URLs)
  const maskedUrls = text.replace(URL_REGEX, (match) =>
    isAllowedUrl(match) ? match : URL_MASK
  );

  return maskedUrls
    .replace(EMAIL_REGEX, EMAIL_MASK)
    .replace(MESSENGER_REGEX, MESSENGER_MASK)
    .replace(PHONE_REGEX, PHONE_MASK)
    .replace(SOCIAL_HANDLE_REGEX, SOCIAL_MASK);
}

/**
 * Checks whether a string contains any contact information that should be hidden.
 * File attachment URLs are NOT considered contact information.
 */
export function containsContactInfo(text: string): boolean {
  if (!text) return false;

  EMAIL_REGEX.lastIndex = 0;
  PHONE_REGEX.lastIndex = 0;
  MESSENGER_REGEX.lastIndex = 0;
  CONTACT_PHRASE_REGEX.lastIndex = 0;
  SOCIAL_HANDLE_REGEX.lastIndex = 0;

  return (
    EMAIL_REGEX.test(text) ||
    PHONE_REGEX.test(text) ||
    containsExternalUrl(text) ||
    MESSENGER_REGEX.test(text) ||
    CONTACT_PHRASE_REGEX.test(text) ||
    SOCIAL_HANDLE_REGEX.test(text)
  );
}

/**
 * Sanitizes a chat message for the privacy shield.
 *
 * ALLOWED: Business file attachments (PDF, catalogs, spec docs) and
 *          platform-internal storage links are always permitted.
 *
 * BLOCKED: Phone numbers, email addresses, external links,
 *          social media handles, and messenger app contacts.
 *
 * Returns { blocked: true, reason } if the message should be blocked,
 * or { blocked: false, sanitized } with the cleaned message.
 */
export function sanitizeChatMessage(text: string): {
  blocked: boolean;
  reason?: string;
  sanitized?: string;
} {
  if (!text) return { blocked: false, sanitized: text };

  // Reset regex lastIndex (global regexes are stateful)
  EMAIL_REGEX.lastIndex = 0;
  PHONE_REGEX.lastIndex = 0;
  URL_REGEX.lastIndex = 0;
  MESSENGER_REGEX.lastIndex = 0;
  CONTACT_PHRASE_REGEX.lastIndex = 0;
  SOCIAL_HANDLE_REGEX.lastIndex = 0;

  const hasEmail = EMAIL_REGEX.test(text);
  EMAIL_REGEX.lastIndex = 0;

  const hasPhone = PHONE_REGEX.test(text);
  PHONE_REGEX.lastIndex = 0;

  // Only flag external URLs — platform storage & file attachments are allowed
  const hasExternalUrl = containsExternalUrl(text);

  const hasMessenger = MESSENGER_REGEX.test(text);
  MESSENGER_REGEX.lastIndex = 0;

  const hasContactPhrase = CONTACT_PHRASE_REGEX.test(text);
  CONTACT_PHRASE_REGEX.lastIndex = 0;

  const hasSocialHandle = SOCIAL_HANDLE_REGEX.test(text);
  SOCIAL_HANDLE_REGEX.lastIndex = 0;

  if (hasEmail || hasPhone || hasExternalUrl || hasMessenger || hasContactPhrase || hasSocialHandle) {
    const reasons: string[] = [];
    if (hasEmail) reasons.push('email address');
    if (hasPhone) reasons.push('phone number');
    if (hasExternalUrl) reasons.push('external link');
    if (hasMessenger) reasons.push('messaging app contact');
    if (hasContactPhrase) reasons.push('off-platform contact request');
    if (hasSocialHandle) reasons.push('social media handle');

    return {
      blocked: true,
      reason: `Message blocked: contains ${reasons.join(', ')}. All communication must happen through DirectHub. You may still share business files (PDFs, catalogs, spec documents) using the file attachment feature.`,
    };
  }

  return { blocked: false, sanitized: text };
}

/**
 * Privacy notice banner text shown in chat.
 */
export const PRIVACY_NOTICE =
  '🔒 DirectHub Privacy Shield is active. Sharing phone numbers, emails, or external links is not permitted. You may safely share business files such as PDFs, product catalogs, and technical specification documents through the platform.';
