import { NextRequest, NextResponse } from 'next/server';
import { completion } from '@rocketnew/llm-sdk';
import { getServerCached, setServerCache, checkServerThrottle, normalizeServerKey } from '@/lib/ai/serverCache';
import { createClient } from '@/lib/supabase/server';

/**
 * DirectHub Admin Analysis API Route — المرشد التنفيذي (Executive Guide)
 *
 * BACKEND ONLY — General Manager's Control Room
 * - Master Platform Engineer & Architect with full codebase awareness
 * - Full-stack diagnostic: dead buttons, missing features, runtime glitches
 * - Auto-generates precise, ready-to-use technical fix prompts
 * - Legal document analysis, business analytics, operations monitoring
 * - Uses gemini/gemini-3.6-flash for fast, efficient operations analysis
 */

// ── DirectHub Full Codebase Manifest ─────────────────────────────────────────
const DIRECTHUB_CODEBASE_MANIFEST = `
## DirectHub Platform — Full Technical Architecture

### Tech Stack
- **Framework**: Next.js 15 (App Router, TypeScript)
- **Database**: Supabase (PostgreSQL + RLS + Realtime)
- **AI**: Google Gemini via @rocketnew/llm-sdk
- **Styling**: Tailwind CSS v3
- **Auth**: Supabase Auth (email/password + social OAuth)
- **Payments**: Escrow system (custom), Stripe (publishable key configured)
- **Messaging**: WhatsApp Business API + in-app real-time chat
- **Storage**: Supabase Storage (factory docs, product images)
- **Email**: Resend API
- **Deployment**: Vercel (directhub3220.builtwithrocket.new / direct-hub.net)

### Frontend Pages & Routes
| Route | Component | Purpose |
|-------|-----------|---------|
| / | src/app/page.tsx | Homepage — hero, categories, featured products |
| /admin/control-room | src/app/admin/control-room/page.tsx | Admin dashboard (8000+ lines) |
| /buyer-dashboard | src/app/buyer-dashboard/page.tsx | Buyer analytics & orders |
| /manufacturer/dashboard | src/app/manufacturer/dashboard/page.tsx | Factory management |
| /manufacturer/erp | src/app/manufacturer/erp/page.tsx | ERP system |
| /rfq-board | src/app/rfq-board/page.tsx | Public RFQ marketplace |
| /rfq/create | src/app/rfq/create/page.tsx | Create RFQ form |
| /rfq-management | src/app/rfq-management/page.tsx | RFQ management |
| /messaging | src/app/messaging/page.tsx | Real-time chat |
| /chat/[productId] | src/app/chat/[productId]/page.tsx | Product-specific chat |
| /checkout | src/app/checkout/page.tsx | Checkout flow |
| /checkout/rfq | src/app/checkout/rfq/page.tsx | RFQ checkout |
| /orders | src/app/orders/page.tsx | Order management |
| /order-tracking | src/app/order-tracking/page.tsx | Live order tracking |
| /order-fulfillment | src/app/order-fulfillment/page.tsx | Fulfillment workflow |
| /disputes | src/app/disputes/page.tsx | Dispute resolution |
| /financial-accounts | src/app/financial-accounts/page.tsx | Financial management |
| /invoices | src/app/invoices/page.tsx | Invoice management |
| /analytics | src/app/analytics/page.tsx | Platform analytics |
| /kyc | src/app/kyc/page.tsx | KYC verification |
| /logistics | src/app/logistics/page.tsx | Logistics marketplace |
| /logistics/register | src/app/logistics/register/page.tsx | Logistics partner registration |
| /suppliers | src/app/suppliers/page.tsx | Supplier directory |
| /suppliers/[id] | src/app/suppliers/[id]/page.tsx | Supplier profile |
| /storefront/[supplierId] | src/app/storefront/[supplierId]/page.tsx | Supplier storefront |
| /store/[factoryId] | src/app/store/[factoryId]/page.tsx | Factory store |
| /factory/register | src/app/factory/register/page.tsx | Factory registration |
| /factory/products | src/app/factory/products/page.tsx | Factory product management |
| /seller/products | src/app/seller/products/page.tsx | Seller product management |
| /my-account | src/app/my-account/page.tsx | User account |
| /my-account/edit-profile | src/app/my-account/edit-profile/page.tsx | Edit profile |
| /login | src/app/login/page.tsx | Login page |
| /auth/role-selection | src/app/auth/role-selection/page.tsx | Role selection after signup |
| /auth/social-login | src/app/auth/social-login/page.tsx | Social OAuth |
| /wishlist | src/app/wishlist/page.tsx | Wishlist |
| /cart | src/app/cart/page.tsx | Shopping cart |
| /search | src/app/search/page.tsx | Product search |
| /categories | src/app/categories/page.tsx | Category browser |
| /product/[id] | src/app/product/[id]/page.tsx | Product detail |
| /notifications | src/app/notifications/page.tsx | Notifications |
| /operations | src/app/operations/page.tsx | Operations management |
| /management | src/app/management/page.tsx | Management panel |
| /simulation | src/app/simulation/page.tsx | Platform simulation |
| /ai-features | src/app/ai-features/page.tsx | AI features showcase |
| /about | src/app/about/page.tsx | About page |
| /agent/dashboard | src/app/agent/dashboard/page.tsx | Field agent dashboard |

### API Routes
| Endpoint | Purpose |
|----------|---------|
| /api/ai/admin-analysis | Executive Guide AI (this route) |
| /api/ai/factory-assistant | أمل — Factory AI assistant |
| /api/ai/chat-completion | General Gemini chat completion |
| /api/ai/rfq-routing | Smart RFQ routing & supplier matching |
| /api/ai/partner-verify | Partner verification AI |
| /api/ai/translate | Multi-language translation |
| /api/quotes/send | Send quote to buyer |
| /api/quotes/accept | Accept quote |
| /api/payment/submit | Payment submission |
| /api/invoices/generate-from-order | Invoice generation |
| /api/whatsapp/send | WhatsApp notifications |
| /api/escrow/otp | Escrow OTP verification |
| /api/escrow/billing-engine | Escrow billing |
| /api/escrow/release-by-code | Escrow release |
| /api/escrow/admin-payout | Admin payout approval |
| /api/escrow/pin | Transaction PIN |
| /api/escrow/dispute | Dispute filing |
| /api/escrow/green-light | Escrow green light |
| /api/escrow/delivery-pin | Delivery PIN |
| /api/escrow/mark-ready | Mark order ready |
| /api/track-visit | Visitor analytics |
| /api/manifest | PWA manifest |

### Admin Control Room Tabs
| Tab Key | Component | Purpose |
|---------|-----------|---------|
| overview | inline | Platform KPIs, analytics, quick actions |
| amal | inline (AmalPanel) | Executive Guide AI chat + operations monitor |
| escrow | PhasedEscrowPanel | Escrow workflow management |
| verification | ManualReviewQueuePanel | Factory/KYC verification queue |
| users | inline | User management |
| factories | inline | Factory & supplier management |
| field_agents | inline | Field agent management |
| rfq | inline | RFQ management |
| orders | inline | Order management |
| disputes | inline | Dispute resolution |
| logistics | inline | Logistics partners |
| analytics | inline | Detailed analytics |
| iban | IBANVerificationPanel | IBAN verification |
| ocr | OCRVerificationPanel | OCR document verification |
| customs | CustomsValidatorPanel | Customs validation |
| live_updates | LiveUpdatesInfraPanel | Live updates infrastructure |
| system_health | SystemHealthPanel | System health monitoring |
| amal_logs | AmalLogsPanel | AI operation logs |
| chat_monitor | BuyerSellerChatMonitorPanel | Chat monitoring |
| rfq_routing | SmartRFQRoutingPanel | AI RFQ routing |
| system_audit | AISystemAuditorPanel | AI system auditor |

### Database Tables (Supabase)
| Table | Purpose |
|-------|---------|
| user_profiles | User accounts (buyer/manufacturer/admin roles) |
| factory_registrations | Factory registration & KYC |
| products | Product catalog |
| orders | Order management |
| order_items | Order line items |
| rfq_requests | RFQ submissions |
| rfq_responses | Supplier RFQ responses |
| chat_messages | Real-time messaging |
| chat_rooms | Chat room management |
| escrow_transactions | Escrow payment tracking |
| disputes | Dispute cases |
| invoices | Invoice records |
| notifications | User notifications |
| admin_notifications | Admin-specific notifications |
| logistics_partners | Logistics provider registry |
| field_agents | Field agent accounts |
| visitor_analytics | Traffic analytics |
| system_health_logs | System health records |
| live_updates | Real-time update feed |
| rfq_routing_results | AI routing results |
| supplier_specializations | Supplier expertise mapping |
| rfq_routing_notifications | Routing notifications |
| partner_verifications | Partner verification records |

### Key Components
| Component | Location | Purpose |
|-----------|----------|---------|
| Header | src/components/Header.tsx | Main navigation header |
| BottomNav | src/components/BottomNav.tsx | Mobile bottom navigation |
| AdminAssistant | src/components/AdminAssistant.tsx | Floating admin AI widget |
| DirectHubAssistant | src/components/DirectHubAssistant.tsx | Public AI assistant |
| AmalPartnerAssistant | src/components/AmalPartnerAssistant.tsx | Partner AI assistant |
| AIRFQMatchmaker | src/components/AIRFQMatchmaker.tsx | RFQ matching AI |
| AICatalogGenerator | src/components/AICatalogGenerator.tsx | AI catalog generation |
| AIContractAssistant | src/components/AIContractAssistant.tsx | Contract AI |
| AIDocumentVerifier | src/components/AIDocumentVerifier.tsx | Document verification AI |
| RFQCopilot | src/components/RFQCopilot.tsx | RFQ creation assistant |
| AIProductAssistant | src/components/AIProductAssistant.tsx | Product AI assistant |
| CreateRFQModal | src/components/CreateRFQModal.tsx | RFQ creation modal |
| LoginModal | src/components/LoginModal.tsx | Login modal |
| InvoiceTemplate | src/components/InvoiceTemplate.tsx | Invoice PDF template |
| PinSecurity | src/components/PinSecurity.tsx | Transaction PIN security |

### Auth & Security
- **Roles**: buyer, manufacturer, admin
- **Admin check**: user_metadata.role === 'admin' OR app_metadata.role === 'admin' OR user_profiles.role === 'admin'
- **Middleware**: src/middleware.ts (route protection)
- **Privacy Shield**: src/lib/privacyShield.ts (PII protection)
- **AI Security Firewall**: src/lib/aiSecurityFirewall.ts (prompt injection prevention)

### Multi-Language Support
- Languages: Arabic (ar), English (en), Chinese (zh), Turkish (tr)
- Locale files: src/locales/{ar,en,zh,tr}.json
- i18n lib: src/lib/i18n.ts
- Context: src/contexts/LanguageContext.tsx

### Environment Variables
- NEXT_PUBLIC_SUPABASE_URL ✅
- NEXT_PUBLIC_SUPABASE_ANON_KEY ✅
- GEMINI_API_KEY ✅
- WhatsApp (wa.me click-to-chat) ✅
- OPENAI_API_KEY ❌ (not configured)
- ANTHROPIC_API_KEY ❌ (not configured)
- RESEND_API_KEY ❌ (not configured)
- NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY ❌ (not configured)
`;

// ── Master Platform Engineer System Prompt ────────────────────────────────────
const MASTER_ENGINEER_SYSTEM_PROMPT = `أنتَ "المرشد التنفيذي" — مهندس المنصة الرئيسي والمعماري الأول لمنصة دايركت هب.

## هويتك ودورك المزدوج

### 1. المستشار التنفيذي الاستراتيجي
أنتَ الذراع اليمنى للمدير العام — تحوّل البيانات الخام إلى قرارات استراتيجية، وتمكّن المدير من قيادة المنصة بثقة ووضوح تام.

### 2. مهندس المنصة الرئيسي (Master Platform Engineer)
لديك وعي كامل وعميق بكامل كودبيس دايركت هب:
- **الواجهة الأمامية (Frontend)**: جميع صفحات Next.js، المكونات، hooks، contexts، وأنماط التصميم
- **الواجهة الخلفية (Backend)**: جميع API routes، منطق الأعمال، middleware، والتكاملات
- **قاعدة البيانات**: مخططات Supabase، RLS policies، الجداول، والعلاقات
- **نظام RFQ**: التوجيه الذكي، المطابقة، والتصنيف متعدد اللغات
- **طبقة الترجمة**: دعم العربية والإنجليزية والصينية والتركية
- **نظام الدردشة المباشرة**: الرسائل الفورية، غرف الدردشة، مراقبة المحادثات
- **نظام الضمان المالي (Escrow)**: دورة حياة الدفع الكاملة
- **نظام الإشعارات**: WhatsApp، البريد الإلكتروني، الإشعارات الفورية

## معرفتك التقنية الكاملة بالمنصة

${DIRECTHUB_CODEBASE_MANIFEST}

## قدراتك التشخيصية الكاملة (Full-Stack Diagnostic)

### فحص الأزرار والعناصر التفاعلية
- تحديد الأزرار الميتة أو غير المستجيبة
- اكتشاف handlers المفقودة أو المعطوبة
- فحص navigation links المكسورة
- تحليل form submissions الفاشلة

### فحص الأنظمة الفرعية
- اكتشاف الميزات الناقصة أو غير المكتملة
- تحديد workflows المتقطعة
- فحص integrations المعطوبة
- تحليل API endpoints غير المتصلة بالواجهة

### فحص الأخطاء والاستثناءات
- تحليل أخطاء API في الوقت الفعلي
- اكتشاف unhandled exceptions
- فحص database query errors
- تحليل auth/permission failures

### توليد Prompts التصحيح التلقائي
عند اكتشاف أي خلل، قم تلقائياً بتوليد prompt تقني دقيق وجاهز للاستخدام بهذا الشكل:

\`\`\`
🔧 FIX PROMPT — [اسم المشكلة]
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
[وصف المشكلة بالتفصيل]

الملف المستهدف: [مسار الملف]
السطر التقريبي: [رقم السطر إن أمكن]

الإصلاح المطلوب:
[وصف دقيق للتغيير المطلوب]

الكود المقترح:
\`\`\`[لغة البرمجة]
[الكود الجاهز للنسخ واللصق]
\`\`\`
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
\`\`\`

## نطاق صلاحياتك وخبراتك

### 1. الرؤية الاستراتيجية
- تحليل الاتجاهات السوقية في قطاع سلاسل الإمداد الصناعية والتجارة B2B
- تقديم توصيات استراتيجية مبنية على بيانات المنصة
- تقييم الفرص التوسعية والمخاطر المحتملة
- مقارنة أداء دايركت هب بمعايير الصناعة

### 2. التحليل التشغيلي
- مراقبة دورة حياة الطلبات الكاملة
- تتبع RFQs وتحليل معدلات التحويل
- رصد أداء الموردين والمصانع
- تحليل نظام الضمان المالي ومؤشرات الثقة
- إدارة تنبيهات النزاعات والحالات الحرجة

### 3. التشخيص التقني العميق
- فحص شامل للكودبيس بأكمله
- اكتشاف الأخطاء والثغرات التقنية
- تحليل الأداء وتحديد نقاط الاختناق
- توليد prompts تصحيح دقيقة وجاهزة للتنفيذ

### 4. الذكاء التجاري والمالي
- تحليل KPIs وربطها بالأهداف الاستراتيجية
- تقييم الأداء المالي: الإيرادات، العمولات، معدلات النمو
- تحليل سلوك المستخدمين وأنماط التعامل
- تقديم توقعات وسيناريوهات مستقبلية

## أسلوب التواصل
- **اللغة**: العربية الفصحى مع المصطلحات التقنية بالإنجليزية
- **النبرة**: مهنية، واثقة، استباقية — كمهندس رئيسي ومستشار تنفيذي
- **الهيكل**: ملخص تنفيذي → التفاصيل والتحليل → التوصيات المرقمة → Prompts التصحيح
- **التشخيص**: عند طلب فحص المنصة، قدّم تقريراً منظماً بالمشاكل المكتشفة مع prompts جاهزة

## تنسيق التقارير التشغيلية
- 🔴 **حرج** — يستدعي تدخلاً فورياً
- 🟡 **تحذير** — يحتاج متابعة خلال 24 ساعة  
- 🟢 **جيد** — يسير وفق الخطة
- 🔧 **إصلاح تقني** — prompt جاهز للتنفيذ
- 📊 **مؤشرات الأداء** — الأرقام والنسب المئوية
- ✅ **توصيات** — إجراءات مرقمة وقابلة للتنفيذ

أنتَ المهندس الرئيسي والمستشار التنفيذي — لا حدود لنطاق تحليلك، ولا قيود على عمق تشخيصك.`;

export async function POST(request: NextRequest) {
  try {
    const supabase = await createClient();
    const { data: { user }, error: authError } = await supabase.auth.getUser();
    if (authError || !user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }
    if (user.app_metadata?.role !== 'admin') {
      return NextResponse.json({ error: 'Admin access required' }, { status: 403 });
    }

    const body = await request.json();
    const { task, messages, fileData, analyticsData, liveData, stream = false, parameters = {} } = body;

    if (!task && !messages?.length) {
      return NextResponse.json({ error: 'Missing required field: task or messages' }, { status: 400 });
    }

    const geminiApiKey = process.env.GEMINI_API_KEY;
    if (!geminiApiKey) {
      return NextResponse.json({ error: 'GEMINI API key is not configured' }, { status: 500 });
    }

    // ── Free-Tier Cache Check (non-streaming, cacheable tasks) ────────────────
    const cacheableTasks = ['document_analysis', 'business_analytics', 'amal_chat'];
    if (!stream && cacheableTasks.includes(task)) {
      const lastUser = messages?.length
        ? [...messages].reverse().find((m: any) => m.role === 'user')?.content || ''
        : JSON.stringify(analyticsData || {}).slice(0, 200);
      const cacheKey = normalizeServerKey(`admin:${task}:${lastUser}`);
      const cached = getServerCached(cacheKey);
      if (cached) {
        return NextResponse.json({ choices: [{ message: { content: cached } }], _cached: true });
      }
    }

    // ── Free-Tier Throttle Check ──────────────────────────────────────────────
    const throttleCheck = checkServerThrottle();
    if (!throttleCheck.allowed) {
      if (stream) {
        const encoder = new TextEncoder();
        const readable = new ReadableStream({
          start(controller) {
            controller.enqueue(encoder.encode(`data: ${JSON.stringify({ type: 'error', error: throttleCheck.reason })}\n\n`));
            controller.close();
          },
        });
        return new NextResponse(readable, {
          headers: { 'Content-Type': 'text/event-stream', 'Cache-Control': 'no-cache', Connection: 'keep-alive' },
        });
      }
      return NextResponse.json(
        { error: throttleCheck.reason, details: 'Free-tier quota protection active' },
        { status: 429 }
      );
    }

    // ── Build messages based on task type ─────────────────────────────────────
    let apiMessages: any[] = [];

    if (task === 'document_analysis') {
      const systemPrompt = `أنتَ خبير تحليل وثائق قانونية وتجارية لمنصة دايركت هب — منصة B2B صناعية.
حلّل الوثيقة المقدمة واستخرج:
1. نوع الوثيقة وصلاحيتها
2. اسم الشركة وتفاصيل التسجيل
3. أرقام التراخيص وتواريخ الانتهاء
4. أي مشاكل امتثال أو علامات تحذيرية
5. التوصية: موافقة / رفض / طلب معلومات إضافية

كن موجزاً ومهنياً ومنظماً. الإخراج بالعربية والإنجليزية.`;

      const userContent: any[] = [
        { type: 'text', text: `حلّل هذه الوثيقة للتحقق من تسجيل المصنع:\n${body.documentDescription || 'الوثيقة مرفقة أدناه.'}` }
      ];

      if (fileData) {
        if (fileData.type === 'image') {
          userContent.push({ type: 'image_url', image_url: { url: fileData.data } });
        } else {
          userContent.push({ type: 'file', file: { file_data: fileData.data } });
        }
      }

      apiMessages = [
        { role: 'system', content: systemPrompt },
        { role: 'user', content: userContent },
      ];
    } else if (task === 'business_analytics') {
      apiMessages = [
        {
          role: 'system', content: `${MASTER_ENGINEER_SYSTEM_PROMPT}

أنتَ الآن في وضع تحليل الأعمال. حلّل بيانات المنصة المقدمة وأنشئ:
1. رؤى الأداء الرئيسية
2. اتجاهات النمو والأنماط
3. مؤشرات المخاطر
4. توصيات قابلة للتنفيذ للمدير العام
5. الإجراءات ذات الأولوية للـ 30 يوماً القادمة

كن مدفوعاً بالبيانات، استراتيجياً، وموجزاً.`
        },
        {
          role: 'user',
          content: `حلّل بيانات المنصة هذه وقدّم رؤى استراتيجية:\n\n${JSON.stringify(analyticsData || {}, null, 2)}`
        },
      ];
    } else if (task === 'amal_operations_monitor') {
      const { orders = [], rfqs = [], pendingVerifications = 0, analytics: analyticsSnap = {} } = liveData || {};

      const urgentOrders = orders.filter((o: any) => o.status === 'processing' || o.status === 'shipped');
      const deliveredOrders = orders.filter((o: any) => o.status === 'delivered');
      const disputedOrders = orders.filter((o: any) => o.dispute_status === 'reported');
      const urgentRFQs = rfqs.filter((r: any) => r.urgency === 'critical' || r.urgency === 'urgent');
      const pendingRFQs = rfqs.filter((r: any) => r.status === 'pending' || r.status === 'submitted');

      const operationsSnapshot = {
        timestamp: new Date().toISOString(),
        orders: {
          total: orders.length,
          urgent_in_progress: urgentOrders.length,
          delivered_today: deliveredOrders.length,
          disputed: disputedOrders.length,
          samples: urgentOrders.slice(0, 3).map((o: any) => ({
            id: o.id?.slice(0, 8),
            status: o.status,
            total: o.total,
            buyer: o.buyer_name || 'Unknown',
          })),
        },
        rfqs: {
          total: rfqs.length,
          pending_response: pendingRFQs.length,
          urgent_critical: urgentRFQs.length,
          samples: urgentRFQs.slice(0, 3).map((r: any) => ({
            id: r.id?.slice(0, 8),
            urgency: r.urgency,
            product: r.product_name || r.product_id,
            quantity: r.quantity,
          })),
        },
        verifications: { pending: pendingVerifications },
        platform: analyticsSnap,
      };

      apiMessages = [
        { role: 'system', content: MASTER_ENGINEER_SYSTEM_PROMPT },
        {
          role: 'user',
          content: `قم بمراجعة عمليات المنصة الآن وأنشئ تقرير العمليات اللحظي:\n\n${JSON.stringify(operationsSnapshot, null, 2)}\n\nأنشئ:\n1. ملخص تنفيذي سريع\n2. قائمة التنبيهات العاجلة مع الأولوية\n3. الإجراءات المطلوبة فوراً\n4. حالة المنصة العامة\n5. أي مشاكل تقنية مكتشفة مع prompts الإصلاح`,
        },
      ];
    } else if (task === 'amal_chat') {
      const chatMessages = messages || [];

      // Detect if any user message contains an image payload
      const hasImagePayload = chatMessages.some((m: any) => {
        if (m.role !== 'user') return false;
        if (Array.isArray(m.content)) {
          return m.content.some((part: any) => part.type === 'image_url');
        }
        return false;
      });

      // Build vision-aware system prompt when image is present
      const visionSystemAddendum = hasImagePayload
        ? `\n\n## تحليل الصور (Vision Mode)
أنتَ الآن في وضع تحليل الصور. عند استلام لقطة شاشة أو صورة:
1. حدّد نوع الواجهة أو الخطأ المعروض
2. اكتشف الأزرار المعطوبة، الرسائل الخاطئة، أو مشاكل التصميم
3. اقترح إصلاحاً تقنياً دقيقاً مع prompt جاهز للتنفيذ في Rocket
4. إذا كانت الصورة تحتوي على كود أو stack trace، حلّله فوراً
5. قدّم تقريراً منظماً: المشكلة → السبب الجذري → الإصلاح المقترح`
        : '';

      apiMessages = [
        {
          role: 'system',
          content: MASTER_ENGINEER_SYSTEM_PROMPT + visionSystemAddendum + `\n\nبيانات المنصة الحالية:\n${JSON.stringify(analyticsData || {}, null, 2)}`
        },
        ...chatMessages.filter((m: any) => m.role !== 'system'),
      ];

      // Use vision-capable model when image is present
      if (hasImagePayload) {
        (body as any)._useVisionModel = true;
      }
    } else if (task === 'image_analysis') {
      // Dedicated image/screenshot analysis task
      const { imageData, analysisPrompt } = body;
      const userContent: any[] = [
        {
          type: 'text',
          text: analysisPrompt || 'حلّل هذه الصورة/لقطة الشاشة واكتشف أي مشاكل تقنية أو أخطاء في الواجهة وقدّم توصيات الإصلاح.'
        }
      ];

      if (imageData) {
        userContent.push({ type: 'image_url', image_url: { url: imageData } });
      }

      apiMessages = [
        {
          role: 'system',
          content: MASTER_ENGINEER_SYSTEM_PROMPT + `\n\n## وضع تحليل الصور
أنتَ الآن في وضع تحليل الصور والواجهات. حلّل الصورة المقدمة وأنشئ:
1. وصف دقيق لما تراه في الصورة
2. اكتشاف أي أخطاء برمجية أو مشاكل في الواجهة
3. تحديد الأزرار المعطوبة أو العناصر غير المستجيبة
4. prompt إصلاح جاهز للتنفيذ في Rocket إذا وُجدت مشاكل
5. توصيات تحسين UX إن أمكن`
        },
        { role: 'user', content: userContent }
      ];

      (body as any)._useVisionModel = true;
    } else if (task === 'platform_diagnostic') {
      const { diagnosticData = {} } = body;
      apiMessages = [
        { role: 'system', content: MASTER_ENGINEER_SYSTEM_PROMPT },
        {
          role: 'user',
          content: `قم بإجراء فحص تشخيصي شامل للمنصة بناءً على البيانات التالية:\n\n${JSON.stringify(diagnosticData, null, 2)}\n\nأنشئ تقريراً تشخيصياً كاملاً يتضمن:\n1. الأزرار والعناصر الميتة أو المعطوبة\n2. الأنظمة الفرعية الناقصة أو غير المكتملة\n3. أخطاء API وexceptions غير المعالجة\n4. مشاكل قاعدة البيانات\n5. لكل مشكلة: prompt تصحيح دقيق وجاهز للنسخ واللصق في Rocket`,
        },
      ];
    } else if (messages?.length) {
      apiMessages = messages;
    }

    // ── Use correct model ──────────────────────────────────────────────────────
    // gemini-3.5-flash-lite is vision-capable, so the same model serves both
    // paths; the previous vision model (3.7-flash) returned 503 under load.
    const model = 'gemini/gemini-3.5-flash-lite';

    // ── Call LLM SDK ──────────────────────────────────────────────────────────
    if (stream) {
      const response = await completion({
        model,
        messages: apiMessages,
        stream: true,
        api_key: geminiApiKey,
        ...parameters,
      });

      const encoder = new TextEncoder();
      const readable = new ReadableStream({
        async start(controller) {
          try {
            controller.enqueue(encoder.encode(`data: ${JSON.stringify({ type: 'start' })}\n\n`));

            for await (const chunk of response as unknown as AsyncIterable<unknown>) {
              controller.enqueue(encoder.encode(`data: ${JSON.stringify({ type: 'chunk', chunk })}\n\n`));
            }

            controller.enqueue(encoder.encode(`data: ${JSON.stringify({ type: 'done' })}\n\n`));
            controller.close();
          } catch (error) {
            const message = error instanceof Error ? error.message : String(error);
            controller.enqueue(encoder.encode(`data: ${JSON.stringify({ type: 'error', error: `Admin AI error: ${message}` })}\n\n`));
            controller.close();
          }
        },
      });

      return new NextResponse(readable, {
        headers: {
          'Content-Type': 'text/event-stream',
          'Cache-Control': 'no-cache',
          Connection: 'keep-alive',
        },
      });
    }

    const response = await completion({
      model,
      messages: apiMessages,
      stream: false,
      api_key: geminiApiKey,
      ...parameters,
    });

    // Cache the response for cacheable tasks
    const content = (response as any)?.choices?.[0]?.message?.content || '';
    if (content.length > 10 && cacheableTasks.includes(task)) {
      const lastUser = messages?.length
        ? [...messages].reverse().find((m: any) => m.role === 'user')?.content || ''
        : JSON.stringify(analyticsData || {}).slice(0, 200);
      const cacheKey = normalizeServerKey(`admin:${task}:${lastUser}`);
      setServerCache(cacheKey, content);
    }

    return NextResponse.json(response);
  } catch (error) {
    const statusCode = (error as any)?.statusCode || (error as any)?.status || 500;
    const message = error instanceof Error ? error.message : String(error);

    if (statusCode === 429 || message?.includes('RESOURCE_EXHAUSTED') || message?.includes('quota')) {
      console.warn('[Admin Analysis] ⚠️ Gemini quota limit reached.');
      return NextResponse.json(
        { error: 'AI analysis temporarily unavailable due to quota limits. Please try again in a moment.', details: 'Gemini API quota exhausted.' },
        { status: 429 }
      );
    }

    console.error('Admin Analysis API Error:', { error: message });
    return NextResponse.json(
      { error: `Admin AI error: ${message}`, details: message },
      { status: statusCode }
    );
  }
}
