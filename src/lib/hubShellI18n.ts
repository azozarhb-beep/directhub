import type { Language } from '@/lib/i18n';

export interface HubShellStrings {
  loadingDashboard: string;
  // Logistics hub
  logisticsRoomTitle: string;
  logisticsRoomSubtitle: string;
  logisticsPartnerBadge: string;
  logisticsPortalTitle: string;
  statusPending: string;
  statusApproved: string;
  statusUnderReview: string;
  statusRejected: string;
  statusSuspended: string;
  secLocal: string;
  secInternational: string;
  secCustoms: string;
  secDispatch: string;
  secDisputes: string;
  secFulfillment: string;
  secAdminSupport: string;
  tabLoadBoard: string;
  tabOrders: string;
  tabStats: string;
  tabCalculator: string;
  tabIntlShipments: string;
  tabCustomsDocs: string;
  tabUploadDocs: string;
  tabDispatchRooms: string;
  tabDisputesDelays: string;
  tabConversations: string;
  tabPayments: string;
  tabProfile: string;
  tabAdminMessaging: string;
  // Admin rooms
  adminFinanceRoom: string;
  adminSystemRoom: string;
  adminFieldOpsRoom: string;
  adminOperationsRoom: string;
  // Factory / supplier local rooms
  factoryControlRoom: string;
  supplierControlRoom: string;
  // Buyer / RFQ
  rfqCreateTitle: string;
  buyerPortal: string;
  back: string;
}

const ar: HubShellStrings = {
  loadingDashboard: 'جارٍ تحميل لوحة التحكم…',
  logisticsRoomTitle: 'لوحة تحكم المكتب اللوجستي',
  logisticsRoomSubtitle: 'Logistics Partner Dashboard · إدارة الشحنات والتوصيل',
  logisticsPartnerBadge: '🚚 شريك لوجستي',
  logisticsPortalTitle: 'بوابة الشريك اللوجستي',
  statusPending: 'قيد المراجعة والاعتماد',
  statusApproved: 'معتمد',
  statusUnderReview: 'قيد المراجعة',
  statusRejected: 'مرفوض',
  statusSuspended: 'موقوف',
  secLocal: 'الشحن المحلي والتوزيع',
  secInternational: 'الشحن الدولي',
  secCustoms: 'الموانئ والتخليص الجمركي',
  secDispatch: 'غرف التنسيق الميداني',
  secDisputes: 'إدارة التأخير والنزاعات التشغيلية',
  secFulfillment: 'خدمات من الباب للباب',
  secAdminSupport: 'التواصل مع الإدارة',
  tabLoadBoard: '🛒 سوق الطلبات المتاحة (Load Board)',
  tabOrders: '📦 الطلبات والشحنات',
  tabStats: '📊 الأداء والإحصائيات',
  tabCalculator: '🧮 حاسبة التكاليف',
  tabIntlShipments: '🌍 إدارة الشحنات الدولية (بحري وجوي)',
  tabCustomsDocs: '📋 وثائق التخليص',
  tabUploadDocs: '📁 رفع المستندات',
  tabDispatchRooms: '🚚 غرف التنسيق الميداني',
  tabDisputesDelays: '⚖️ التأخير والنزاعات',
  tabConversations: '💬 المراسلات',
  tabPayments: '💰 المدفوعات',
  tabProfile: '👤 الملف الشخصي',
  tabAdminMessaging: '💬 مراسلة الإدارة العامة / الدعم التشغيلي',
  adminFinanceRoom: 'غرفة المالية والخزينة',
  adminSystemRoom: 'غرفة النظام والبنية التحتية',
  adminFieldOpsRoom: 'غرفة العمليات الميدانية',
  adminOperationsRoom: 'غرفة العمليات',
  factoryControlRoom: 'غرفة تحكم المصنع',
  supplierControlRoom: 'غرفة تحكم المورد',
  rfqCreateTitle: 'إنشاء طلب عرض سعر',
  buyerPortal: 'بوابة المشتري',
  back: 'رجوع',
};

const en: HubShellStrings = {
  loadingDashboard: 'Loading your dashboard…',
  logisticsRoomTitle: 'Logistics Office Control Room',
  logisticsRoomSubtitle: 'Logistics Partner Dashboard · Shipment & delivery management',
  logisticsPartnerBadge: '🚚 Logistics Partner',
  logisticsPortalTitle: 'Logistics Partner Portal',
  statusPending: 'Pending review & approval',
  statusApproved: 'Approved',
  statusUnderReview: 'Under review',
  statusRejected: 'Rejected',
  statusSuspended: 'Suspended',
  secLocal: 'Local Shipping & Distribution',
  secInternational: 'International Shipping',
  secCustoms: 'Ports & Customs Clearance',
  secDispatch: 'Field Coordination Rooms',
  secDisputes: 'Delay & Operational Dispute Management',
  secFulfillment: 'Door-to-Door Services',
  secAdminSupport: 'Contact Administration',
  tabLoadBoard: '🛒 Available Orders Market (Load Board)',
  tabOrders: '📦 Orders & Shipments',
  tabStats: '📊 Performance & Statistics',
  tabCalculator: '🧮 Cost Calculator',
  tabIntlShipments: '🌍 International Shipments (Sea & Air)',
  tabCustomsDocs: '📋 Clearance Documents',
  tabUploadDocs: '📁 Upload Documents',
  tabDispatchRooms: '🚚 Field Coordination Rooms',
  tabDisputesDelays: '⚖️ Delays & Disputes',
  tabConversations: '💬 Messages',
  tabPayments: '💰 Payments',
  tabProfile: '👤 Profile',
  tabAdminMessaging: '💬 Message Admin / Operations Support',
  adminFinanceRoom: 'Finance & Treasury Room',
  adminSystemRoom: 'System & Infrastructure Room',
  adminFieldOpsRoom: 'Field Operations Room',
  adminOperationsRoom: 'Operations Room',
  factoryControlRoom: 'Factory Control Room',
  supplierControlRoom: 'Supplier Control Room',
  rfqCreateTitle: 'Create Request for Quotation',
  buyerPortal: 'Buyer Portal',
  back: 'Back',
};

const zh: HubShellStrings = {
  loadingDashboard: '正在加载控制面板…',
  logisticsRoomTitle: '物流办公室控制室',
  logisticsRoomSubtitle: '物流合作伙伴面板 · 货运与配送管理',
  logisticsPartnerBadge: '🚚 物流合作伙伴',
  logisticsPortalTitle: '物流合作伙伴门户',
  statusPending: '待审核与批准',
  statusApproved: '已批准',
  statusUnderReview: '审核中',
  statusRejected: '已拒绝',
  statusSuspended: '已暂停',
  secLocal: '本地运输与配送',
  secInternational: '国际运输',
  secCustoms: '港口与清关',
  secDispatch: '现场协调室',
  secDisputes: '延误与运营纠纷管理',
  secFulfillment: '门到门服务',
  secAdminSupport: '联系管理部门',
  tabLoadBoard: '🛒 可用订单市场（货源板）',
  tabOrders: '📦 订单与货运',
  tabStats: '📊 绩效与统计',
  tabCalculator: '🧮 成本计算器',
  tabIntlShipments: '🌍 国际货运管理（海运与空运）',
  tabCustomsDocs: '📋 清关文件',
  tabUploadDocs: '📁 上传文件',
  tabDispatchRooms: '🚚 现场协调室',
  tabDisputesDelays: '⚖️ 延误与纠纷',
  tabConversations: '💬 消息',
  tabPayments: '💰 付款',
  tabProfile: '👤 个人资料',
  tabAdminMessaging: '💬 联系管理员 / 运营支持',
  adminFinanceRoom: '财务与资金室',
  adminSystemRoom: '系统与基础设施室',
  adminFieldOpsRoom: '现场运营室',
  adminOperationsRoom: '运营室',
  factoryControlRoom: '工厂控制室',
  supplierControlRoom: '供应商控制室',
  rfqCreateTitle: '创建询价请求',
  buyerPortal: '买家门户',
  back: '返回',
};

const tr: HubShellStrings = {
  loadingDashboard: 'Kontrol paneliniz yükleniyor…',
  logisticsRoomTitle: 'Lojistik Ofisi Kontrol Odası',
  logisticsRoomSubtitle: 'Lojistik Ortak Paneli · Sevkiyat ve teslimat yönetimi',
  logisticsPartnerBadge: '🚚 Lojistik Ortağı',
  logisticsPortalTitle: 'Lojistik Ortak Portalı',
  statusPending: 'İnceleme ve onay bekliyor',
  statusApproved: 'Onaylandı',
  statusUnderReview: 'İnceleniyor',
  statusRejected: 'Reddedildi',
  statusSuspended: 'Askıya alındı',
  secLocal: 'Yerel Nakliye ve Dağıtım',
  secInternational: 'Uluslararası Nakliye',
  secCustoms: 'Limanlar ve Gümrük Müşavirliği',
  secDispatch: 'Saha Koordinasyon Odaları',
  secDisputes: 'Gecikme ve Operasyonel Uyuşmazlık Yönetimi',
  secFulfillment: 'Kapıdan Kapıya Hizmetler',
  secAdminSupport: 'Yönetimle İletişim',
  tabLoadBoard: '🛒 Mevcut Siparişler Pazarı (Yük Panosu)',
  tabOrders: '📦 Siparişler ve Sevkiyatlar',
  tabStats: '📊 Performans ve İstatistikler',
  tabCalculator: '🧮 Maliyet Hesaplayıcı',
  tabIntlShipments: '🌍 Uluslararası Sevkiyatlar (Deniz ve Hava)',
  tabCustomsDocs: '📋 Gümrük Belgeleri',
  tabUploadDocs: '📁 Belge Yükle',
  tabDispatchRooms: '🚚 Saha Koordinasyon Odaları',
  tabDisputesDelays: '⚖️ Gecikmeler ve Uyuşmazlıklar',
  tabConversations: '💬 Mesajlar',
  tabPayments: '💰 Ödemeler',
  tabProfile: '👤 Profil',
  tabAdminMessaging: '💬 Yönetime Mesaj / Operasyon Desteği',
  adminFinanceRoom: 'Finans ve Hazine Odası',
  adminSystemRoom: 'Sistem ve Altyapı Odası',
  adminFieldOpsRoom: 'Saha Operasyonları Odası',
  adminOperationsRoom: 'Operasyon Odası',
  factoryControlRoom: 'Fabrika Kontrol Odası',
  supplierControlRoom: 'Tedarikçi Kontrol Odası',
  rfqCreateTitle: 'Teklif Talebi Oluştur',
  buyerPortal: 'Alıcı Portalı',
  back: 'Geri',
};

const DICTIONARY: Record<Language, HubShellStrings> = { ar, en, zh, tr };

export function getHubShellStrings(language: Language): HubShellStrings {
  return DICTIONARY[language] ?? DICTIONARY.en;
}
