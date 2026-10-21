import { getChatCompletion } from '@/lib/ai/chatCompletion';

export interface ExtractedInvoiceItem {
  description: string;
  hs_code: string;
  quantity: number;
  unit_price: number;
}

export interface ExtractedInvoice {
  consignee_name: string;
  consignee_address: string;
  items: ExtractedInvoiceItem[];
  incoterm: 'FOB' | 'CIF';
  port_of_loading: string;
  port_of_discharge: string;
  payment_terms: string;
}

export interface InvoiceDraft {
  data: ExtractedInvoice;
  threadId: string | null;
  createdAt: number;
}

export const INVOICE_DRAFT_KEY = 'directhub_export_invoice_draft';
export const INVOICE_DRAFT_EVENT = 'directhub:export-invoice-draft';

const SYSTEM_PROMPT = `You are a trade-finance assistant for an export manufacturer. You read a negotiation chat between a factory and its counterparts and extract the agreed commercial invoice data.
Return ONLY one valid JSON object (no markdown, no code fences, no commentary) that follows exactly this schema:
{
  "consignee_name": string,
  "consignee_address": string,
  "items": [{ "description": string, "hs_code": string, "quantity": number, "unit_price": number }],
  "incoterm": "FOB" | "CIF",
  "port_of_loading": string,
  "port_of_discharge": string,
  "payment_terms": string
}
Rules:
- Use the latest agreed values in the conversation.
- quantity and unit_price are plain numbers (unit_price in USD, no currency symbols).
- If a value is not mentioned use "" for strings, 0 for numbers, "FOB" for incoterm and [] if there are no items.
- Never invent data that is not in the conversation.`;

const JSON_SCHEMA = {
  type: 'json_schema',
  json_schema: {
    name: 'export_invoice_extraction',
    strict: true,
    schema: {
      type: 'object',
      properties: {
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
      },
      required: [
        'consignee_name',
        'consignee_address',
        'items',
        'incoterm',
        'port_of_loading',
        'port_of_discharge',
        'payment_terms',
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

  return {
    consignee_name: toText(input?.consignee_name),
    consignee_address: toText(input?.consignee_address),
    items,
    incoterm: String(input?.incoterm).toUpperCase() === 'CIF' ? 'CIF' : 'FOB',
    port_of_loading: toText(input?.port_of_loading),
    port_of_discharge: toText(input?.port_of_discharge),
    payment_terms: toText(input?.payment_terms),
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
