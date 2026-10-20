import type { Language } from '@/lib/i18n';

export interface IntlRoomStrings {
  roomTitle: string;
  roomSubtitle: string;
  markets: string;
  intlExportBadge: string;
  headerRoom: string;
  createDealLink: string;
  changeLanguage: string;
  pageTitle: string;
  pageSubtitle: string;
  lastUpdate: string;
  now: string;
  kpiTotalExport: string;
  kpiThisMonth: string;
  kpiInTransit: string;
  kpiActiveShipment: string;
  kpiPendingDocs: string;
  kpiNeedsAction: string;
  kpiHeld: string;
  kpiNeedsReview: string;
  heldReasonLabel: string;
  chartMonthlyExport: string;
  chartVolume: string;
  chartMarketDist: string;
  chartShare: string;
  tabExports: string;
  tabProduction: string;
  tabDocuments: string;
  tabSupplyChain: string;
  tabBuyingSelling: string;
  tabAccounts: string;
  tabMessaging: string;
  tabRfq: string;
  toolsDivider: string;
  tabProducts: string;
  tabInventory: string;
  tabFactoryOrders: string;
  tabEscrowOrders: string;
  tabAnalytics: string;
  tabDisputes: string;
  tabBankAccounts: string;
  tabPaymentSettings: string;
  tabFinance: string;
  tabSalesTeam: string;
  tabArchive: string;
  filterAll: string;
  statusPendingDocs: string;
  statusCustomsReview: string;
  statusInTransit: string;
  statusDelivered: string;
  statusHeld: string;
  containers: string;
  quantity: string;
  hsCode: string;
  shipmentDate: string;
  eta: string;
  exportTarget: string;
  unitsPerDay: string;
  docsNeedAction: (n: number) => string;
  docType: string;
  orderNo: string;
  docStatus: string;
  issuedAt: string;
  expiresAt: string;
  action: string;
  docBillOfLading: string;
  docCertOrigin: string;
  docPackingList: string;
  docCommercialInvoice: string;
  docCustomsDeclaration: string;
  docPhytosanitary: string;
  docDraft: string;
  docSubmitted: string;
  docApproved: string;
  docRejected: string;
  uploadDoc: string;
  reuploadDoc: string;
  view: string;
  supplier: string;
  reliability: string;
  leadTime: string;
  lastShipment: string;
  reliabilityIndex: string;
  scActive: string;
  scDelayed: string;
  scDisrupted: string;
  daysUnit: (n: number) => string;
  saved: string;
  errorGeneric: string;
  accountAdded: string;
  statusUpdated: string;
  verifiedOk: string;
  invalidPin: string;
  replySent: string;
  holdReasonPrefix: string;
  holdReasonMissingCoo: string;
  holdReasonCustomsDelay: string;
  contactCustomsAgent: string;
  customsAgentContacted: string;
  docUploaded: string;
  newShipment: string;
  newShipmentTitle: string;
  fieldBuyer: string;
  fieldProduct: string;
  fieldDestinationCountry: string;
  fieldQuantity: string;
  fieldUnit: string;
  fieldTotalValue: string;
  fieldIncoterm: string;
  fieldContainers: string;
  fieldHsCode: string;
  fieldOriginPort: string;
  fieldDestinationPort: string;
  fieldBlNumber: string;
  fieldShippingLine: string;
  fieldEtd: string;
  fieldEta: string;
  submitShipment: string;
  cancel: string;
  close: string;
  requiredFields: string;
  shipmentCreated: string;
  shipmentDetailsTitle: string;
  portOfOrigin: string;
  destinationPort: string;
  blNumber: string;
  shippingLine: string;
  documentStatus: string;
  buyer: string;
  product: string;
  destination: string;
  totalValue: string;
  incoterm: string;
  noDocuments: string;
  notProvided: string;
  marketEurope: string;
  marketGcc: string;
  marketAsia: string;
  marketMena: string;
  marketOther: string;
}

const ar: IntlRoomStrings = {
  roomTitle: 'غرفة تحكم المصنع الدولي',
  roomSubtitle: 'International Factory Control Room · الأسواق الدولية',
  markets: 'الأسواق الدولية',
  intlExportBadge: '🌐 تصدير دولي',
  headerRoom: 'غرفة التحكم الدولية',
  createDealLink: 'إنشاء رابط صفقة مخصصة',
  changeLanguage: 'تغيير اللغة',
  pageTitle: '🌐 غرفة تحكم المصنع الدولي',
  pageSubtitle: 'إدارة الصادرات، خطوط الإنتاج العالمية، والمستندات الجمركية',
  lastUpdate: 'آخر تحديث',
  now: 'الآن',
  kpiTotalExport: 'إجمالي قيمة الصادرات',
  kpiThisMonth: 'هذا الشهر',
  kpiInTransit: 'شحنات في الطريق',
  kpiActiveShipment: 'شحنة نشطة',
  kpiPendingDocs: 'بانتظار المستندات',
  kpiNeedsAction: 'تحتاج إجراء',
  kpiHeld: 'شحنات محتجزة',
  kpiNeedsReview: 'تحتاج مراجعة',
  heldReasonLabel: 'سبب الاحتجاز: الشحنة محتجزة وبانتظار المراجعة',
  chartMonthlyExport: 'حجم الصادرات الشهري (USD)',
  chartVolume: 'الحجم',
  chartMarketDist: 'توزيع الأسواق',
  chartShare: 'الحصة',
  tabExports: '📦 إدارة الصادرات',
  tabProduction: '🏭 خطوط الإنتاج',
  tabDocuments: '📄 المستندات الجمركية',
  tabSupplyChain: '🔗 سلاسل الإمداد',
  tabBuyingSelling: '🛒 البيع والشراء',
  tabAccounts: '💰 الحسابات والمالية',
  tabMessaging: '💬 المراسلات',
  tabRfq: '📋 إدارة RFQ',
  toolsDivider: '🏭 أدوات إدارة المصنع',
  tabProducts: '🛍️ المنتجات',
  tabInventory: '📦 المخزون',
  tabFactoryOrders: '🏭 طلبات المصنع',
  tabEscrowOrders: '🔒 طلبات الضمان',
  tabAnalytics: '📊 التحليلات',
  tabDisputes: '⚖️ النزاعات',
  tabBankAccounts: '🏦 الحسابات البنكية',
  tabPaymentSettings: '💳 إعدادات الدفع',
  tabFinance: '💵 المالية',
  tabSalesTeam: '👥 فريق المبيعات',
  tabArchive: '🗂️ الأرشيف',
  filterAll: 'الكل',
  statusPendingDocs: 'بانتظار المستندات',
  statusCustomsReview: 'مراجعة جمركية',
  statusInTransit: 'في الطريق',
  statusDelivered: 'تم التسليم',
  statusHeld: 'محتجز',
  containers: 'حاوية',
  quantity: 'كمية',
  hsCode: 'كود HS',
  shipmentDate: 'تاريخ الشحن',
  eta: 'الوصول المتوقع',
  exportTarget: 'هدف التصدير',
  unitsPerDay: 'وحدة/يوم',
  docsNeedAction: (n) => `يوجد ${n} مستندات تحتاج إجراء فوري`,
  docType: 'نوع المستند',
  orderNo: 'رقم الطلب',
  docStatus: 'الحالة',
  issuedAt: 'تاريخ الإصدار',
  expiresAt: 'تاريخ الانتهاء',
  action: 'إجراء',
  docBillOfLading: 'بوليصة الشحن',
  docCertOrigin: 'شهادة المنشأ',
  docPackingList: 'قائمة التعبئة',
  docCommercialInvoice: 'الفاتورة التجارية',
  docCustomsDeclaration: 'إقرار جمركي',
  docPhytosanitary: 'شهادة صحة نباتية',
  docDraft: 'مسودة',
  docSubmitted: 'مُقدَّم',
  docApproved: 'معتمد',
  docRejected: 'مرفوض',
  uploadDoc: 'رفع المستند',
  reuploadDoc: 'إعادة الرفع',
  view: 'عرض',
  supplier: 'المورد',
  reliability: 'موثوقية',
  leadTime: 'مدة التوريد',
  lastShipment: 'آخر شحنة',
  reliabilityIndex: 'مؤشر الموثوقية',
  scActive: '● نشط',
  scDelayed: '⚠ متأخر',
  scDisrupted: '✕ مضطرب',
  daysUnit: (n) => `${n} يوم`,
  saved: 'تم الحفظ بنجاح',
  errorGeneric: 'حدث خطأ',
  accountAdded: 'تم إضافة الحساب بنجاح',
  statusUpdated: 'تم تحديث الحالة',
  verifiedOk: 'تم التحقق بنجاح',
  invalidPin: 'رمز غير صحيح',
  replySent: 'تم إرسال الرد',
  holdReasonPrefix: 'سبب الاحتجاز',
  holdReasonMissingCoo: 'شهادة المنشأ غير مرفقة',
  holdReasonCustomsDelay: 'تأخر في الفحص الجمركي',
  contactCustomsAgent: 'التواصل مع المخلّص الجمركي',
  customsAgentContacted: 'تم إرسال طلب إلى المخلّص الجمركي',
  docUploaded: 'تم رفع المستند بنجاح',
  newShipment: 'إنشاء شحنة جديدة',
  newShipmentTitle: 'إنشاء شحنة تصدير جديدة',
  fieldBuyer: 'اسم المشتري',
  fieldProduct: 'المنتج',
  fieldDestinationCountry: 'دولة الوجهة',
  fieldQuantity: 'الكمية',
  fieldUnit: 'الوحدة',
  fieldTotalValue: 'القيمة الإجمالية (USD)',
  fieldIncoterm: 'شروط الشحن (Incoterm)',
  fieldContainers: 'عدد الحاويات',
  fieldHsCode: 'كود HS',
  fieldOriginPort: 'ميناء الشحن',
  fieldDestinationPort: 'ميناء الوصول',
  fieldBlNumber: 'رقم بوليصة الشحن (B/L)',
  fieldShippingLine: 'خط الملاحة',
  fieldEtd: 'تاريخ الشحن',
  fieldEta: 'الوصول المتوقع',
  submitShipment: 'إنشاء الشحنة',
  cancel: 'إلغاء',
  close: 'إغلاق',
  requiredFields: 'يرجى تعبئة المشتري والمنتج ودولة الوجهة',
  shipmentCreated: 'تم إنشاء الشحنة بنجاح',
  shipmentDetailsTitle: 'تفاصيل الشحنة',
  portOfOrigin: 'ميناء الشحن',
  destinationPort: 'ميناء الوصول',
  blNumber: 'رقم بوليصة الشحن (B/L)',
  shippingLine: 'خط الملاحة',
  documentStatus: 'حالة المستندات',
  buyer: 'المشتري',
  product: 'المنتج',
  destination: 'الوجهة',
  totalValue: 'القيمة الإجمالية',
  incoterm: 'شروط الشحن',
  noDocuments: 'لا توجد مستندات لهذه الشحنة',
  notProvided: 'غير محدد',
  marketEurope: 'أوروبا',
  marketGcc: 'الخليج',
  marketAsia: 'آسيا',
  marketMena: 'الشرق الأوسط وشمال أفريقيا',
  marketOther: 'أخرى',
};

const en: IntlRoomStrings = {
  roomTitle: 'International Factory Control Room',
  roomSubtitle: 'International Factory Control Room · Global Markets',
  markets: 'Global Markets',
  intlExportBadge: '🌐 International Export',
  headerRoom: 'International Control Room',
  createDealLink: 'Create Custom Deal Link',
  changeLanguage: 'Change language',
  pageTitle: '🌐 International Factory Control Room',
  pageSubtitle: 'Manage exports, global production lines, and customs documents',
  lastUpdate: 'Last updated',
  now: 'Just now',
  kpiTotalExport: 'Total Export Value',
  kpiThisMonth: 'This month',
  kpiInTransit: 'Shipments In Transit',
  kpiActiveShipment: 'Active shipments',
  kpiPendingDocs: 'Pending Documents',
  kpiNeedsAction: 'Action required',
  kpiHeld: 'Held Shipments',
  kpiNeedsReview: 'Needs review',
  heldReasonLabel: 'Block reason: shipment is held pending review',
  chartMonthlyExport: 'Monthly Export Volume (USD)',
  chartVolume: 'Volume',
  chartMarketDist: 'Market Distribution',
  chartShare: 'Share',
  tabExports: '📦 Export Management',
  tabProduction: '🏭 Production Lines',
  tabDocuments: '📄 Customs Documents',
  tabSupplyChain: '🔗 Supply Chains',
  tabBuyingSelling: '🛒 Buying & Selling',
  tabAccounts: '💰 Accounts & Finance',
  tabMessaging: '💬 Messaging',
  tabRfq: '📋 RFQ Management',
  toolsDivider: '🏭 Factory Management Tools',
  tabProducts: '🛍️ Products',
  tabInventory: '📦 Inventory',
  tabFactoryOrders: '🏭 Factory Orders',
  tabEscrowOrders: '🔒 Escrow Orders',
  tabAnalytics: '📊 Analytics',
  tabDisputes: '⚖️ Disputes',
  tabBankAccounts: '🏦 Bank Accounts',
  tabPaymentSettings: '💳 Payment Settings',
  tabFinance: '💵 Finance',
  tabSalesTeam: '👥 Sales Team',
  tabArchive: '🗂️ Archive',
  filterAll: 'All',
  statusPendingDocs: 'Pending Documents',
  statusCustomsReview: 'Customs Review',
  statusInTransit: 'In Transit',
  statusDelivered: 'Delivered',
  statusHeld: 'Held',
  containers: 'containers',
  quantity: 'Quantity',
  hsCode: 'HS Code',
  shipmentDate: 'Shipment Date',
  eta: 'Estimated Arrival',
  exportTarget: 'Export target',
  unitsPerDay: 'units/day',
  docsNeedAction: (n) => `${n} documents require immediate action`,
  docType: 'Document Type',
  orderNo: 'Order No.',
  docStatus: 'Status',
  issuedAt: 'Issue Date',
  expiresAt: 'Expiry Date',
  action: 'Action',
  docBillOfLading: 'Bill of Lading',
  docCertOrigin: 'Certificate of Origin',
  docPackingList: 'Packing List',
  docCommercialInvoice: 'Commercial Invoice',
  docCustomsDeclaration: 'Customs Declaration',
  docPhytosanitary: 'Phytosanitary Certificate',
  docDraft: 'Draft',
  docSubmitted: 'Submitted',
  docApproved: 'Approved',
  docRejected: 'Rejected',
  uploadDoc: 'Upload document',
  reuploadDoc: 'Re-upload',
  view: 'View',
  supplier: 'Supplier',
  reliability: 'Reliability',
  leadTime: 'Lead Time',
  lastShipment: 'Last Shipment',
  reliabilityIndex: 'Reliability Index',
  scActive: '● Active',
  scDelayed: '⚠ Delayed',
  scDisrupted: '✕ Disrupted',
  daysUnit: (n) => `${n} days`,
  saved: 'Saved successfully',
  errorGeneric: 'An error occurred',
  accountAdded: 'Account added successfully',
  statusUpdated: 'Status updated',
  verifiedOk: 'Verified successfully',
  invalidPin: 'Invalid code',
  replySent: 'Reply sent',
  holdReasonPrefix: 'Hold reason',
  holdReasonMissingCoo: 'Missing Certificate of Origin',
  holdReasonCustomsDelay: 'Customs Inspection Delay',
  contactCustomsAgent: 'Contact Customs Agent',
  customsAgentContacted: 'Request sent to the customs agent',
  docUploaded: 'Document uploaded successfully',
  newShipment: 'New Shipment',
  newShipmentTitle: 'Create New Export Shipment',
  fieldBuyer: 'Buyer name',
  fieldProduct: 'Product',
  fieldDestinationCountry: 'Destination country',
  fieldQuantity: 'Quantity',
  fieldUnit: 'Unit',
  fieldTotalValue: 'Total value (USD)',
  fieldIncoterm: 'Incoterm',
  fieldContainers: 'Containers',
  fieldHsCode: 'HS Code',
  fieldOriginPort: 'Port of Origin',
  fieldDestinationPort: 'Destination Port',
  fieldBlNumber: 'B/L Number',
  fieldShippingLine: 'Shipping Line',
  fieldEtd: 'Shipment date',
  fieldEta: 'Estimated arrival',
  submitShipment: 'Create Shipment',
  cancel: 'Cancel',
  close: 'Close',
  requiredFields: 'Please fill in buyer, product and destination country',
  shipmentCreated: 'Shipment created successfully',
  shipmentDetailsTitle: 'Shipment Details',
  portOfOrigin: 'Port of Origin',
  destinationPort: 'Destination Port',
  blNumber: 'B/L Number',
  shippingLine: 'Shipping Line',
  documentStatus: 'Document Status',
  buyer: 'Buyer',
  product: 'Product',
  destination: 'Destination',
  totalValue: 'Total Value',
  incoterm: 'Incoterm',
  noDocuments: 'No documents for this shipment',
  notProvided: 'Not specified',
  marketEurope: 'Europe',
  marketGcc: 'GCC',
  marketAsia: 'Asia',
  marketMena: 'MENA',
  marketOther: 'Other',
};

const zh: IntlRoomStrings = {
  roomTitle: '全球工厂控制室',
  roomSubtitle: '国际工厂控制室 · 全球市场',
  markets: '全球市场',
  intlExportBadge: '🌐 国际出口',
  headerRoom: '国际控制室',
  createDealLink: '创建专属交易链接',
  changeLanguage: '切换语言',
  pageTitle: '🌐 全球工厂控制室',
  pageSubtitle: '管理出口、全球生产线和海关单据',
  lastUpdate: '最后更新',
  now: '刚刚',
  kpiTotalExport: '出口总额',
  kpiThisMonth: '本月',
  kpiInTransit: '在途货物',
  kpiActiveShipment: '进行中的货运',
  kpiPendingDocs: '待处理单据',
  kpiNeedsAction: '需要处理',
  kpiHeld: '扣留货物',
  kpiNeedsReview: '需要审核',
  heldReasonLabel: '扣留原因：货物被扣留，等待审核',
  chartMonthlyExport: '月度出口量 (USD)',
  chartVolume: '出口量',
  chartMarketDist: '市场分布',
  chartShare: '占比',
  tabExports: '📦 出口管理',
  tabProduction: '🏭 生产线',
  tabDocuments: '📄 海关单据',
  tabSupplyChain: '🔗 供应链',
  tabBuyingSelling: '🛒 买卖',
  tabAccounts: '💰 账户与财务',
  tabMessaging: '💬 消息',
  tabRfq: '📋 询价管理',
  toolsDivider: '🏭 工厂管理工具',
  tabProducts: '🛍️ 产品',
  tabInventory: '📦 库存',
  tabFactoryOrders: '🏭 工厂订单',
  tabEscrowOrders: '🔒 担保订单',
  tabAnalytics: '📊 数据分析',
  tabDisputes: '⚖️ 纠纷',
  tabBankAccounts: '🏦 银行账户',
  tabPaymentSettings: '💳 支付设置',
  tabFinance: '💵 财务',
  tabSalesTeam: '👥 销售团队',
  tabArchive: '🗂️ 归档',
  filterAll: '全部',
  statusPendingDocs: '待处理单据',
  statusCustomsReview: '海关审核',
  statusInTransit: '运输中',
  statusDelivered: '已送达',
  statusHeld: '已扣留',
  containers: '个集装箱',
  quantity: '数量',
  hsCode: 'HS 编码',
  shipmentDate: '发货日期',
  eta: '预计到达',
  exportTarget: '出口目标',
  unitsPerDay: '件/天',
  docsNeedAction: (n) => `有 ${n} 份单据需要立即处理`,
  docType: '单据类型',
  orderNo: '订单号',
  docStatus: '状态',
  issuedAt: '签发日期',
  expiresAt: '到期日期',
  action: '操作',
  docBillOfLading: '提单',
  docCertOrigin: '原产地证书',
  docPackingList: '装箱单',
  docCommercialInvoice: '商业发票',
  docCustomsDeclaration: '报关单',
  docPhytosanitary: '植物检疫证书',
  docDraft: '草稿',
  docSubmitted: '已提交',
  docApproved: '已批准',
  docRejected: '已拒绝',
  uploadDoc: '上传单据',
  reuploadDoc: '重新上传',
  view: '查看',
  supplier: '供应商',
  reliability: '可靠性',
  leadTime: '供货周期',
  lastShipment: '最近发货',
  reliabilityIndex: '可靠性指数',
  scActive: '● 正常',
  scDelayed: '⚠ 延迟',
  scDisrupted: '✕ 中断',
  daysUnit: (n) => `${n} 天`,
  saved: '保存成功',
  errorGeneric: '发生错误',
  accountAdded: '账户添加成功',
  statusUpdated: '状态已更新',
  verifiedOk: '验证成功',
  invalidPin: '验证码无效',
  replySent: '回复已发送',
  holdReasonPrefix: '扣留原因',
  holdReasonMissingCoo: '缺少原产地证书',
  holdReasonCustomsDelay: '海关查验延误',
  contactCustomsAgent: '联系报关代理',
  customsAgentContacted: '已向报关代理发送请求',
  docUploaded: '单据上传成功',
  newShipment: '新建货运',
  newShipmentTitle: '创建新的出口货运',
  fieldBuyer: '买家名称',
  fieldProduct: '产品',
  fieldDestinationCountry: '目的国',
  fieldQuantity: '数量',
  fieldUnit: '单位',
  fieldTotalValue: '总价值 (USD)',
  fieldIncoterm: '贸易术语',
  fieldContainers: '集装箱数量',
  fieldHsCode: 'HS 编码',
  fieldOriginPort: '起运港',
  fieldDestinationPort: '目的港',
  fieldBlNumber: '提单号 (B/L)',
  fieldShippingLine: '船公司',
  fieldEtd: '发货日期',
  fieldEta: '预计到达',
  submitShipment: '创建货运',
  cancel: '取消',
  close: '关闭',
  requiredFields: '请填写买家、产品和目的国',
  shipmentCreated: '货运创建成功',
  shipmentDetailsTitle: '货运详情',
  portOfOrigin: '起运港',
  destinationPort: '目的港',
  blNumber: '提单号 (B/L)',
  shippingLine: '船公司',
  documentStatus: '单据状态',
  buyer: '买家',
  product: '产品',
  destination: '目的地',
  totalValue: '总价值',
  incoterm: '贸易术语',
  noDocuments: '该货运暂无单据',
  notProvided: '未填写',
  marketEurope: '欧洲',
  marketGcc: '海湾地区',
  marketAsia: '亚洲',
  marketMena: '中东北非',
  marketOther: '其他',
};

const tr: IntlRoomStrings = {
  roomTitle: 'Uluslararası Fabrika Kontrol Odası',
  roomSubtitle: 'Uluslararası Fabrika Kontrol Odası · Küresel Pazarlar',
  markets: 'Küresel Pazarlar',
  intlExportBadge: '🌐 Uluslararası İhracat',
  headerRoom: 'Uluslararası Kontrol Odası',
  createDealLink: 'Özel Anlaşma Bağlantısı Oluştur',
  changeLanguage: 'Dili değiştir',
  pageTitle: '🌐 Uluslararası Fabrika Kontrol Odası',
  pageSubtitle: 'İhracat, küresel üretim hatları ve gümrük belgelerini yönetin',
  lastUpdate: 'Son güncelleme',
  now: 'Şimdi',
  kpiTotalExport: 'İhracat Tutarı',
  kpiThisMonth: 'Bu ay',
  kpiInTransit: 'Yoldaki Sevkiyatlar',
  kpiActiveShipment: 'Aktif sevkiyat',
  kpiPendingDocs: 'Bekleyen Belgeler',
  kpiNeedsAction: 'İşlem gerekli',
  kpiHeld: 'Bekletilen Sevkiyatlar',
  kpiNeedsReview: 'İnceleme gerekli',
  heldReasonLabel: 'Bekletme nedeni: sevkiyat inceleme için bekletiliyor',
  chartMonthlyExport: 'Aylık İhracat Hacmi (USD)',
  chartVolume: 'Hacim',
  chartMarketDist: 'Pazar Dağılımı',
  chartShare: 'Pay',
  tabExports: '📦 İhracat Yönetimi',
  tabProduction: '🏭 Üretim Hatları',
  tabDocuments: '📄 Gümrük Belgeleri',
  tabSupplyChain: '🔗 Tedarik Zincirleri',
  tabBuyingSelling: '🛒 Alım ve Satım',
  tabAccounts: '💰 Hesaplar ve Finans',
  tabMessaging: '💬 Mesajlaşma',
  tabRfq: '📋 RFQ Yönetimi',
  toolsDivider: '🏭 Fabrika Yönetim Araçları',
  tabProducts: '🛍️ Ürünler',
  tabInventory: '📦 Envanter',
  tabFactoryOrders: '🏭 Fabrika Siparişleri',
  tabEscrowOrders: '🔒 Emanet Siparişleri',
  tabAnalytics: '📊 Analitik',
  tabDisputes: '⚖️ Uyuşmazlıklar',
  tabBankAccounts: '🏦 Banka Hesapları',
  tabPaymentSettings: '💳 Ödeme Ayarları',
  tabFinance: '💵 Finans',
  tabSalesTeam: '👥 Satış Ekibi',
  tabArchive: '🗂️ Arşiv',
  filterAll: 'Tümü',
  statusPendingDocs: 'Bekleyen Belgeler',
  statusCustomsReview: 'Gümrük İncelemesi',
  statusInTransit: 'Yolda',
  statusDelivered: 'Teslim Edildi',
  statusHeld: 'Bekletiliyor',
  containers: 'konteyner',
  quantity: 'Miktar',
  hsCode: 'HS Kodu',
  shipmentDate: 'Sevkiyat Tarihi',
  eta: 'Tahmini Varış',
  exportTarget: 'İhracat hedefi',
  unitsPerDay: 'adet/gün',
  docsNeedAction: (n) => `${n} belge acil işlem gerektiriyor`,
  docType: 'Belge Türü',
  orderNo: 'Sipariş No',
  docStatus: 'Durum',
  issuedAt: 'Düzenleme Tarihi',
  expiresAt: 'Bitiş Tarihi',
  action: 'İşlem',
  docBillOfLading: 'Konşimento',
  docCertOrigin: 'Menşe Şahadetnamesi',
  docPackingList: 'Çeki Listesi',
  docCommercialInvoice: 'Ticari Fatura',
  docCustomsDeclaration: 'Gümrük Beyannamesi',
  docPhytosanitary: 'Fitosanitary Sertifikası',
  docDraft: 'Taslak',
  docSubmitted: 'Gönderildi',
  docApproved: 'Onaylandı',
  docRejected: 'Reddedildi',
  uploadDoc: 'Belge yükle',
  reuploadDoc: 'Yeniden yükle',
  view: 'Görüntüle',
  supplier: 'Tedarikçi',
  reliability: 'Güvenilirlik',
  leadTime: 'Tedarik Süresi',
  lastShipment: 'Son Sevkiyat',
  reliabilityIndex: 'Güvenilirlik Endeksi',
  scActive: '● Aktif',
  scDelayed: '⚠ Gecikmeli',
  scDisrupted: '✕ Aksıyor',
  daysUnit: (n) => `${n} gün`,
  saved: 'Başarıyla kaydedildi',
  errorGeneric: 'Bir hata oluştu',
  accountAdded: 'Hesap başarıyla eklendi',
  statusUpdated: 'Durum güncellendi',
  verifiedOk: 'Başarıyla doğrulandı',
  invalidPin: 'Geçersiz kod',
  replySent: 'Yanıt gönderildi',
  holdReasonPrefix: 'Bekletme nedeni',
  holdReasonMissingCoo: 'Menşe Şahadetnamesi eksik',
  holdReasonCustomsDelay: 'Gümrük kontrolü gecikmesi',
  contactCustomsAgent: 'Gümrük Müşaviri ile İletişim',
  customsAgentContacted: 'Gümrük müşavirine talep gönderildi',
  docUploaded: 'Belge başarıyla yüklendi',
  newShipment: 'Yeni Sevkiyat',
  newShipmentTitle: 'Yeni İhracat Sevkiyatı Oluştur',
  fieldBuyer: 'Alıcı adı',
  fieldProduct: 'Ürün',
  fieldDestinationCountry: 'Varış ülkesi',
  fieldQuantity: 'Miktar',
  fieldUnit: 'Birim',
  fieldTotalValue: 'Toplam değer (USD)',
  fieldIncoterm: 'Incoterm',
  fieldContainers: 'Konteyner sayısı',
  fieldHsCode: 'HS Kodu',
  fieldOriginPort: 'Çıkış Limanı',
  fieldDestinationPort: 'Varış Limanı',
  fieldBlNumber: 'Konşimento No (B/L)',
  fieldShippingLine: 'Denizyolu Hattı',
  fieldEtd: 'Sevkiyat tarihi',
  fieldEta: 'Tahmini varış',
  submitShipment: 'Sevkiyatı Oluştur',
  cancel: 'İptal',
  close: 'Kapat',
  requiredFields: 'Lütfen alıcı, ürün ve varış ülkesini doldurun',
  shipmentCreated: 'Sevkiyat başarıyla oluşturuldu',
  shipmentDetailsTitle: 'Sevkiyat Detayları',
  portOfOrigin: 'Çıkış Limanı',
  destinationPort: 'Varış Limanı',
  blNumber: 'Konşimento No (B/L)',
  shippingLine: 'Denizyolu Hattı',
  documentStatus: 'Belge Durumu',
  buyer: 'Alıcı',
  product: 'Ürün',
  destination: 'Varış',
  totalValue: 'Toplam Değer',
  incoterm: 'Incoterm',
  noDocuments: 'Bu sevkiyat için belge yok',
  notProvided: 'Belirtilmedi',
  marketEurope: 'Avrupa',
  marketGcc: 'Körfez',
  marketAsia: 'Asya',
  marketMena: 'MENA',
  marketOther: 'Diğer',
};

const DICTIONARY: Record<Language, IntlRoomStrings> = { ar, en, zh, tr };

export function getIntlRoomStrings(language: Language): IntlRoomStrings {
  return DICTIONARY[language] ?? DICTIONARY.en;
}
