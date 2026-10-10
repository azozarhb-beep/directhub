/**
 * WhatsApp Click-to-Chat Service — wa.me URL Generator
 *
 * DirectHub uses 100% FREE, client-side click-to-chat via wa.me links.
 * No Meta API, no access tokens, no paid services.
 *
 * All messaging is handled via dynamically generated:
 *   https://wa.me/{phone}?text=...
 *
 * See: src/lib/whatsappOrderLinks.ts for the full bilingual link engine.
 */

/**
 * Normalize a phone number to international format (without +).
 * - Strips spaces, dashes, parentheses
 * - Removes leading +
 * - If the number starts with 7 (Yemeni mobile) and is 9 digits, prepends 967
 * - If the number starts with 0, replaces leading 0 with 967
 * - Otherwise leaves as-is (assumes already has country code)
 */
export function normalizePhone(phone: string): string {
  let clean = String(phone).replace(/[\s\-\(\)]/g, '').replace(/^\+/, '');

  // Already has country code (11+ digits) — return as-is
  if (clean.length >= 11) return clean;

  // Yemeni mobile: starts with 7 and is 9 digits → prepend 967
  if (/^7\d{8}$/.test(clean)) return `967${clean}`;

  // Starts with 0 → replace with 967
  if (clean.startsWith('0')) return `967${clean.slice(1)}`;

  // Default: prepend 967 if 9 digits
  if (clean.length === 9) return `967${clean}`;

  return clean;
}

/**
 * Build a wa.me click-to-chat URL.
 * @param phone - Phone number (will be normalized)
 * @param text  - Pre-filled message text (will be URL-encoded)
 */
export function buildWaLink(phone: string, text: string): string {
  const normalized = normalizePhone(phone);
  return `https://api.whatsapp.com/send?phone=${normalized}&text=${encodeURIComponent(text)}`;
}

// ── Stub exports for backward compatibility ──────────────────────────────────
// These stubs prevent import errors in any files that still reference the old
// Meta API functions. They do nothing — all messaging is now wa.me based.

export function isWhatsAppConfigured(): boolean {
  return false; // Meta API removed — use wa.me links instead
}

export async function sendWhatsAppText(): Promise<{ success: false; error: string }> {
  return { success: false, error: 'Meta API removed. Use wa.me links from whatsappOrderLinks.ts.' };
}

export async function sendWhatsAppOtp(): Promise<{ success: false; error: string }> {
  return { success: false, error: 'Meta API removed. Use wa.me links from whatsappOrderLinks.ts.' };
}

export async function sendWhatsAppOrderUpdate(): Promise<{ success: false; error: string }> {
  return { success: false, error: 'Meta API removed. Use wa.me links from whatsappOrderLinks.ts.' };
}

export async function sendWhatsAppInstantAlert(): Promise<{ success: false; error: string }> {
  return { success: false, error: 'Meta API removed. Use wa.me links from whatsappOrderLinks.ts.' };
}

export async function sendWhatsAppPromotion(): Promise<{ success: false; error: string }> {
  return { success: false, error: 'Meta API removed. Use wa.me links from whatsappOrderLinks.ts.' };
}
