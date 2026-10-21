import { getChatCompletion } from '@/lib/ai/chatCompletion';

export type InvoiceScope = 'export' | 'local';
export type LocalCurrency = 'YER' | 'SAR' | 'USD';
export type LocalPaymentMethod = 'kuraimi' | 'local_bank' | 'cod' | 'tt';
export type LocalDeliveryTerms = 'ex_factory' | 'delivered';

export interface ExtractedInvoiceItem {
  description: string;
  hs_code: string;
  quantity: number;
  unit_price: number;
}

export interface ExtractedInvoice {
  scope: InvoiceScope;
  consignee_name: string;
  consignee_address: string;
  items: ExtractedInvoiceItem[];
  incoterm: 'FOB' | 'CIF';
  port_of_loading: string;
  port_of_discharge: string;
  payment_terms: string;
  currency: LocalCurrency;
  governorate: string;
  delivery_terms: LocalDeliveryTerms | '';
  payment_method: LocalPaymentMethod | '';
  local_bank_details: string;
}

export interface InvoiceDraft {
  data: ExtractedInvoice;
  threadId: string | null;
  createdAt: number;
}

export const INVOICE_DRAFT_KEY = 'directhub_export_invoice_draft';
export const INVOICE_DRAFT_EVENT = 'directhub:export-invoice-draft';

const SYSTEM_PROMPT = `You are a trade-finance assistant for a manufacturer in Yemen. You read a negotiation chat (Arabic and/or English) between a factory and its counterparts and extract the agreed invoice data.
Return ONLY one valid JSON object (no markdown, no code fences, no commentary) that follows exactly this schema:
{
  "scope": "export" | "local",
  "consignee_name": string,
  "consignee_address": string,
  "items": [{ "description": string, "hs_code": string, "quantity": number, "unit_price": number }],
  "incoterm": "FOB" | "CIF",
  "port_of_loading": string,
  "port_of_discharge": string,
  "payment_terms": string,
  "currency": "USD" | "YER" | "SAR",
  "governorate": string,
  "delivery_terms": "ex_factory" | "delivered" | "",
  "payment_method": "kuraimi" | "local_bank" | "cod" | "tt" | "",
  "local_bank_details": string
}
Rules:
- Use the latest agreed values in the conversation.
- quantity and unit_price are plain numbers (no currency symbols, no thousand separators).
- Decide "scope": use "local" when the deal is domestic inside Yemen — signals include a Yemeni governorate/city as the delivery place (e.g. "التسليم في صنعاء", "عدن", "تعز", "الحديدة", "إب", "حضرموت"), payment in Yemeni Rial or Saudi Riyal ("بالريال اليمني", "بالريال السعودي"), payment via a local bank/wallet account (e.g. "الكريمي", "حساب الكريمي"), cash on delivery ("الدفع عند الاستلام"), or pickup/delivery to a buyer inside Yemen. Use "export" when the deal mentions international ports, Incoterms (FOB/CIF), SWIFT, or a foreign destination country.
- For local deals: set "currency" from the stated price currency ("ريال يمني"/YER → "YER", "ريال سعودي"/SAR → "SAR", dollars → "USD"); set "governorate" to the governorate/city of delivery (Arabic as written); set "delivery_terms" to "ex_factory" for pickup from the factory warehouse ("استلام من المصنع/المستودع") or "delivered" for delivery to the buyer's premises ("توصيل إلى مقر المشتري/التسليم في ..."); set "payment_method" to "kuraimi" when paying through a Kuraimi account ("الكريمي"), "local_bank" for another local bank account, "cod" for cash on delivery, "tt" for telegraphic transfer; put any account number / account holder / bank text mentioned into "local_bank_details".
- For local deals leave port_of_loading and port_of_discharge as "" and incoterm as "FOB".
- For export deals use currency "USD", and leave governorate, delivery_terms, payment_method and local_bank_details as "". - If a value is not mentioned use"" for strings, 0 for numbers, "FOB" for incoterm, "USD" for currency, "export" for scope and [] if there are no items.
- Never invent data that is not in the conversation.`;

const JSON_SCHEMA = {
  type: 'json_schema',
  json_schema: {
    name: 'export_invoice_extraction',
    strict: true,
    schema: {
      type: 'object',
      properties: {
        scope: { type: 'string', enum: ['export', 'local'] },
        consignee_name: { type: 'string' },
        consignee_address: { type: 'string' },
        items: {
          type: 'array',
          items: {
            type: 'object',
            properties: {
              description: { type: 'string' },
              hs_code: { type: 'string' },
              quantity: { type: 'number' },
              unit_price: { type: 'number' },
            },
            required: ['description', 'hs_code', 'quantity', 'unit_price'],
            additionalProperties: false,
          },
        },
        incoterm: { type: 'string', enum: ['FOB', 'CIF'] },
        port_of_loading: { type: 'string' },
        port_of_discharge: { type: 'string' },
        payment_terms: { type: 'string' },
        currency: { type: 'string', enum: ['USD', 'YER', 'SAR'] },
        governorate: { type: 'string' },
        delivery_terms: { type: 'string', enum: ['ex_factory', 'delivered', ''] },
        payment_method: { type: 'string', enum: ['kuraimi', 'local_bank', 'cod', 'tt', ''] },
        local_bank_details: { type: 'string' },
      },
      required: [
        'scope',
        'consignee_name',
        'consignee_address',
        'items',
        'incoterm',
        'port_of_loading',
        'port_of_discharge',
        'payment_terms',
        'currency',
        'governorate',
        'delivery_terms',
        'payment_method',
        'local_bank_details',
      ],
      additionalProperties: false,
    },
  },
};

function toNumber(value: unknown): number {
  const n = typeof value === 'number' ? value : parseFloat(String(value ?? '').replace(/[^0-9.\-]/g, ''));
  return Number.isFinite(n) && n > 0 ? n : 0;
}

function toText(value: unknown): string {
  return typeof value === 'string' ? value.trim() : '';
}

function parseJsonLoose(raw: string): any {
  const cleaned = raw
    .trim()
    .replace(/^```(?:json)?/i, '')
    .replace(/```$/, '')
    .trim();
  try {
    return JSON.parse(cleaned);
  } catch {
    const start = cleaned.indexOf('{');
    const end = cleaned.lastIndexOf('}');
    if (start >= 0 && end > start) return JSON.parse(cleaned.slice(start, end + 1));
    throw new Error('تعذر قراءة استجابة الذكاء الاصطناعي');
  }
}

const LOCAL_CURRENCIES: LocalCurrency[] = ['USD', 'YER', 'SAR'];
const LOCAL_PAYMENT_METHODS: LocalPaymentMethod[] = ['kuraimi', 'local_bank', 'cod', 'tt'];

export function sanitizeExtraction(input: any): ExtractedInvoice {
  const items: ExtractedInvoiceItem[] = Array.isArray(input?.items)
    ? input.items
        .map((it: any) => ({
          description: toText(it?.description),
          hs_code: toText(it?.hs_code),
          quantity: toNumber(it?.quantity) || 1,
          unit_price: toNumber(it?.unit_price),
        }))
        .filter((it: ExtractedInvoiceItem) => it.description || it.unit_price > 0)
    : [];

  const scope: InvoiceScope = input?.scope === 'local' ? 'local' : 'export';
  const currencyRaw = String(input?.currency ?? '').toUpperCase() as LocalCurrency;
  const currency: LocalCurrency = LOCAL_CURRENCIES.includes(currencyRaw) ? currencyRaw : 'USD';
  const methodRaw = String(input?.payment_method ?? '') as LocalPaymentMethod;
  const deliveryRaw = String(input?.delivery_terms ?? '');

  return {
    scope,
    consignee_name: toText(input?.consignee_name),
    consignee_address: toText(input?.consignee_address),
    items,
    incoterm: String(input?.incoterm).toUpperCase() === 'CIF' ? 'CIF' : 'FOB',
    port_of_loading: scope === 'local' ? '' : toText(input?.port_of_loading),
    port_of_discharge: scope === 'local' ? '' : toText(input?.port_of_discharge),
    payment_terms: toText(input?.payment_terms),
    currency: scope === 'export' ? 'USD' : currency,
    governorate: scope === 'local' ? toText(input?.governorate) : '',
    delivery_terms:
      scope === 'local' && (deliveryRaw === 'ex_factory' || deliveryRaw === 'delivered') ? deliveryRaw : '',
    payment_method: scope === 'local' && LOCAL_PAYMENT_METHODS.includes(methodRaw) ? methodRaw : '',
    local_bank_details: scope === 'local' ? toText(input?.local_bank_details) : '',
  };
}

export async function extractInvoiceFromConversation(transcript: string): Promise<ExtractedInvoice> {
  const result = await getChatCompletion(
    'GEMINI',
    'gemini/gemini-3.7-flash',
    [
      { role: 'system', content: SYSTEM_PROMPT },
      { role: 'user', content: `Negotiation conversation:\n\n${transcript}` },
    ],
    { temperature: 0.1, max_tokens: 2000, response_format: JSON_SCHEMA },
    60000
  );
  const content: string = result?.choices?.[0]?.message?.content || '';
  if (!content) throw new Error('لم يتم استلام رد من الذكاء الاصطناعي');
  return sanitizeExtraction(parseJsonLoose(content));
}

export function saveInvoiceDraft(data: ExtractedInvoice, threadId: string | null): void {
  const draft: InvoiceDraft = { data, threadId, createdAt: Date.now() };
  try {
    window.localStorage.setItem(INVOICE_DRAFT_KEY, JSON.stringify(draft));
  } catch {
    // storage unavailable — event still carries the payload
  }
  window.dispatchEvent(new CustomEvent<InvoiceDraft>(INVOICE_DRAFT_EVENT, { detail: draft }));
}

export function readInvoiceDraft(): InvoiceDraft | null {
  try {
    const raw = window.localStorage.getItem(INVOICE_DRAFT_KEY);
    if (!raw) return null;
    const parsed = JSON.parse(raw) as InvoiceDraft;
    if (!parsed?.data) return null;
    return { ...parsed, data: sanitizeExtraction(parsed.data) };
  } catch {
    return null;
  }
}

export function clearInvoiceDraft(): void {
  try {
    window.localStorage.removeItem(INVOICE_DRAFT_KEY);
  } catch {
    // ignore
  }
}
