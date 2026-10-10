'use client';

import React, { useState, useRef, useEffect, useCallback } from 'react';
import { useRouter } from 'next/navigation';
import Icon from '@/components/ui/AppIcon';
import { getChatCompletion } from '@/lib/ai/chatCompletion';
import toast from 'react-hot-toast';

interface VisualSearchModalProps {
  isOpen: boolean;
  onClose: () => void;
}

interface SupplierMatch {
  name: string;
  country: string;
  category: string;
  matchScore: number;
  description: string;
  specialization: string;
}

interface AnalysisResult {
  materialName: string;
  materialType: string;
  description: string;
  suggestedCategories: string[];
  supplierMatches: SupplierMatch[];
  searchKeywords: string[];
}

type CaptureMode = 'select' | 'camera' | 'gallery';

export default function VisualSearchModal({ isOpen, onClose }: VisualSearchModalProps) {
  const router = useRouter();
  const [captureMode, setCaptureMode] = useState<CaptureMode>('select');
  const [capturedImage, setCapturedImage] = useState<string | null>(null);
  const [capturedFile, setCapturedFile] = useState<File | null>(null);
  const [isAnalyzing, setIsAnalyzing] = useState(false);
  const [analysisResult, setAnalysisResult] = useState<AnalysisResult | null>(null);
  const [cameraStream, setCameraStream] = useState<MediaStream | null>(null);
  const [cameraReady, setCameraReady] = useState(false);

  const videoRef = useRef<HTMLVideoElement>(null);
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  // Stop camera stream on close or mode change
  const stopCamera = useCallback(() => {
    if (cameraStream) {
      cameraStream.getTracks().forEach(track => track.stop());
      setCameraStream(null);
      setCameraReady(false);
    }
  }, [cameraStream]);

  useEffect(() => {
    if (!isOpen) {
      stopCamera();
      setCaptureMode('select');
      setCapturedImage(null);
      setCapturedFile(null);
      setAnalysisResult(null);
      setIsAnalyzing(false);
    }
  }, [isOpen, stopCamera]);

  const startCamera = async () => {
    try {
      const stream = await navigator.mediaDevices.getUserMedia({
        video: { facingMode: 'environment', width: { ideal: 1280 }, height: { ideal: 720 } }
      });
      setCameraStream(stream);
      setCaptureMode('camera');
      // Attach stream to video element after state update
      setTimeout(() => {
        if (videoRef.current) {
          videoRef.current.srcObject = stream;
          videoRef.current.onloadedmetadata = () => {
            videoRef.current?.play();
            setCameraReady(true);
          };
        }
      }, 100);
    } catch {
      toast.error('لا يمكن الوصول إلى الكاميرا. يرجى السماح بالوصول أو استخدام رفع الصورة.');
    }
  };

  const capturePhoto = () => {
    if (!videoRef.current || !canvasRef.current) return;
    const video = videoRef.current;
    const canvas = canvasRef.current;
    canvas.width = video.videoWidth;
    canvas.height = video.videoHeight;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;
    ctx.drawImage(video, 0, 0);
    const dataUrl = canvas.toDataURL('image/jpeg', 0.7);
    setCapturedImage(dataUrl);
    stopCamera();
    setCaptureMode('select');
  };

  const handleFileSelect = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    if (!file.type.startsWith('image/')) {
      toast.error('يرجى اختيار ملف صورة صالح (JPEG, PNG, WebP)');
      return;
    }
    if (file.size > 10 * 1024 * 1024) {
      toast.error('حجم الصورة كبير جداً. الحد الأقصى 10 ميجابايت.');
      return;
    }
    setCapturedFile(file);
    const reader = new FileReader();
    reader.onload = (ev) => {
      const originalDataUrl = ev.target?.result as string;
      // Compress image before storing
      const img = new Image();
      img.onload = () => {
        const maxDim = 800;
        let w = img.width;
        let h = img.height;
        if (w > maxDim || h > maxDim) {
          if (w > h) { h = Math.round((h * maxDim) / w); w = maxDim; }
          else { w = Math.round((w * maxDim) / h); h = maxDim; }
        }
        const compressCanvas = document.createElement('canvas');
        compressCanvas.width = w;
        compressCanvas.height = h;
        const ctx = compressCanvas.getContext('2d');
        if (ctx) {
          ctx.drawImage(img, 0, 0, w, h);
          setCapturedImage(compressCanvas.toDataURL('image/jpeg', 0.7));
        } else {
          setCapturedImage(originalDataUrl);
        }
      };
      img.onerror = () => setCapturedImage(originalDataUrl);
      img.src = originalDataUrl;
    };
    reader.readAsDataURL(file);
    setCaptureMode('select');
  };

  const analyzeImage = async () => {
    if (!capturedImage) return;
    setIsAnalyzing(true);
    setAnalysisResult(null);

    try {
      const response = await getChatCompletion(
        'GEMINI',
        'gemini/gemini-3.5-flash-lite',
        [
          {
            role: 'system',
            content: `أنت خبير في مطابقة المواد الخام والتغليف مع الموردين الدوليين على منصة DirectHub B2B.
عند تحليل صورة مادة خام أو لفة تغليف، قدم تحليلاً دقيقاً بتنسيق JSON فقط.
يجب أن يكون الرد JSON صالحاً فقط بدون أي نص إضافي.`
          },
          {
            role: 'user',
            content: [
              {
                type: 'text',
                text: `حلل هذه الصورة وحدد المادة الخام أو مادة التغليف، ثم اقترح الموردين الدوليين المناسبين.
أعد الرد بتنسيق JSON التالي فقط:
{
  "materialName": "اسم المادة بالعربية",
  "materialType": "نوع المادة (مثل: معادن، بلاستيك، ورق، نسيج، كيماويات، إلخ)",
  "description": "وصف مختصر للمادة وخصائصها",
  "suggestedCategories": ["فئة1", "فئة2", "فئة3"],
  "supplierMatches": [
    {
      "name": "اسم المورد/المصنع",
      "country": "الدولة",
      "category": "التخصص",
      "matchScore": 95,
      "description": "وصف مختصر",
      "specialization": "التخصص الدقيق"
    }
  ],
  "searchKeywords": ["كلمة1", "كلمة2", "كلمة3", "كلمة4"]
}
اقترح 4-6 موردين دوليين واقعيين متخصصين في هذه المادة من دول مختلفة (الصين، تركيا، الهند، ألمانيا، كوريا الجنوبية، إلخ).`
              },
              {
                type: 'image_url',
                image_url: { url: capturedImage }
              }
            ] as any
          }
        ],
        { temperature: 0.3, max_tokens: 2000 }
      );

      const content = response?.choices?.[0]?.message?.content || '';
      // Extract JSON from response
      const jsonMatch = content.match(/\{[\s\S]*\}/);
      if (!jsonMatch) throw new Error('تعذر تحليل الصورة. يرجى المحاولة مرة أخرى.');

      const parsed: AnalysisResult = JSON.parse(jsonMatch[0]);
      setAnalysisResult(parsed);
    } catch (err: any) {
      toast.error(err?.message || 'حدث خطأ أثناء تحليل الصورة. يرجى المحاولة مرة أخرى.');
    } finally {
      setIsAnalyzing(false);
    }
  };

  const handleSearchSuppliers = (keyword: string) => {
    onClose();
    router.push(`/search?q=${encodeURIComponent(keyword)}`);
  };

  const handleSearchCategory = (category: string) => {
    onClose();
    router.push(`/suppliers?category=${encodeURIComponent(category)}`);
  };

  const resetSearch = () => {
    setCapturedImage(null);
    setCapturedFile(null);
    setAnalysisResult(null);
    setCaptureMode('select');
    stopCamera();
  };

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-[100] flex items-center justify-center p-4">
      {/* Backdrop */}
      <div
        className="absolute inset-0 bg-black/60 backdrop-blur-sm"
        onClick={onClose}
      />

      {/* Modal */}
      <div className="relative w-full max-w-2xl max-h-[90vh] overflow-y-auto bg-card border border-border rounded-2xl shadow-2xl">
        {/* Header */}
        <div className="sticky top-0 bg-card border-b border-border px-6 py-4 flex items-center justify-between rounded-t-2xl z-10">
          <div className="flex items-center gap-3">
            <div className="w-9 h-9 rounded-xl bg-primary/10 flex items-center justify-center">
              <Icon name="CameraIcon" size={18} className="text-primary" />
            </div>
            <div>
              <h2 className="text-base font-bold text-foreground">البحث البصري بالكاميرا</h2>
              <p className="text-xs text-muted-foreground">صوّر المادة للعثور على الموردين الدوليين</p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="w-8 h-8 flex items-center justify-center rounded-lg hover:bg-muted text-muted-foreground hover:text-foreground transition-colors"
          >
            <Icon name="XMarkIcon" size={18} />
          </button>
        </div>

        <div className="p-6 space-y-5">
          {/* Step 1: Capture */}
          {!capturedImage && captureMode !== 'camera' && (
            <div className="space-y-4">
              <p className="text-sm text-muted-foreground text-center">
                التقط صورة لأي مادة خام أو لفة تغليف للحصول على مطابقة فورية مع الموردين الدوليين
              </p>

              <div className="grid grid-cols-2 gap-3">
                {/* Camera Button */}
                <button
                  onClick={startCamera}
                  className="flex flex-col items-center gap-3 p-6 border-2 border-dashed border-border rounded-xl hover:border-primary hover:bg-primary/5 transition-all group"
                >
                  <div className="w-14 h-14 rounded-2xl bg-primary/10 flex items-center justify-center group-hover:bg-primary/20 transition-colors">
                    <Icon name="CameraIcon" size={28} className="text-primary" />
                  </div>
                  <div className="text-center">
                    <p className="text-sm font-semibold text-foreground">التقاط صورة</p>
                    <p className="text-xs text-muted-foreground mt-0.5">استخدام الكاميرا مباشرة</p>
                  </div>
                </button>

                {/* Gallery Button */}
                <button
                  onClick={() => fileInputRef.current?.click()}
                  className="flex flex-col items-center gap-3 p-6 border-2 border-dashed border-border rounded-xl hover:border-primary hover:bg-primary/5 transition-all group"
                >
                  <div className="w-14 h-14 rounded-2xl bg-blue-500/10 flex items-center justify-center group-hover:bg-blue-500/20 transition-colors">
                    <Icon name="PhotoIcon" size={28} className="text-blue-500" />
                  </div>
                  <div className="text-center">
                    <p className="text-sm font-semibold text-foreground">رفع من الجهاز</p>
                    <p className="text-xs text-muted-foreground mt-0.5">اختر من المعرض أو الملفات</p>
                  </div>
                </button>
              </div>

              <input
                ref={fileInputRef}
                type="file"
                accept="image/jpeg,image/png,image/webp,image/jpg"
                onChange={handleFileSelect}
                className="hidden"
              />

              {/* AI Badge */}
              <div className="flex items-center justify-center gap-2 py-2">
                <div className="flex items-center gap-1.5 px-3 py-1.5 bg-gradient-to-r from-purple-500/10 to-blue-500/10 border border-purple-200/50 rounded-full">
                  <Icon name="SparklesIcon" size={12} className="text-purple-500" />
                  <span className="text-xs font-medium text-purple-600">مدعوم بـ Gemini Vision AI</span>
                </div>
              </div>
            </div>
          )}

          {/* Camera View */}
          {captureMode === 'camera' && (
            <div className="space-y-4">
              <div className="relative rounded-xl overflow-hidden bg-black aspect-video">
                <video
                  ref={videoRef}
                  autoPlay
                  playsInline
                  muted
                  className="w-full h-full object-cover"
                />
                {!cameraReady && (
                  <div className="absolute inset-0 flex items-center justify-center">
                    <div className="flex flex-col items-center gap-2 text-white">
                      <div className="w-8 h-8 border-2 border-white border-t-transparent rounded-full animate-spin" />
                      <span className="text-sm">جارٍ تشغيل الكاميرا...</span>
                    </div>
                  </div>
                )}
                {/* Viewfinder overlay */}
                {cameraReady && (
                  <div className="absolute inset-0 pointer-events-none">
                    <div className="absolute inset-8 border-2 border-white/40 rounded-xl" />
                    <div className="absolute top-8 left-8 w-6 h-6 border-t-2 border-l-2 border-white rounded-tl-lg" />
                    <div className="absolute top-8 right-8 w-6 h-6 border-t-2 border-r-2 border-white rounded-tr-lg" />
                    <div className="absolute bottom-8 left-8 w-6 h-6 border-b-2 border-l-2 border-white rounded-bl-lg" />
                    <div className="absolute bottom-8 right-8 w-6 h-6 border-b-2 border-r-2 border-white rounded-br-lg" />
                    <div className="absolute bottom-4 left-0 right-0 text-center">
                      <span className="text-white/70 text-xs bg-black/40 px-3 py-1 rounded-full">وجّه الكاميرا نحو المادة</span>
                    </div>
                  </div>
                )}
              </div>
              <canvas ref={canvasRef} className="hidden" />

              <div className="flex gap-3">
                <button
                  onClick={() => { stopCamera(); setCaptureMode('select'); }}
                  className="flex-1 py-2.5 border border-border rounded-xl text-sm font-medium text-muted-foreground hover:bg-muted transition-colors"
                >
                  إلغاء
                </button>
                <button
                  onClick={capturePhoto}
                  disabled={!cameraReady}
                  className="flex-1 py-2.5 bg-primary text-primary-foreground rounded-xl text-sm font-semibold disabled:opacity-50 hover:opacity-90 transition-opacity flex items-center justify-center gap-2"
                >
                  <Icon name="CameraIcon" size={16} />
                  التقاط الصورة
                </button>
              </div>
            </div>
          )}

          {/* Captured Image Preview */}
          {capturedImage && !analysisResult && (
            <div className="space-y-4">
              <div className="relative rounded-xl overflow-hidden border border-border">
                <img
                  src={capturedImage}
                  alt="الصورة الملتقطة للمادة"
                  className="w-full max-h-64 object-contain bg-muted"
                />
                <button
                  onClick={resetSearch}
                  className="absolute top-2 right-2 w-7 h-7 bg-black/50 text-white rounded-full flex items-center justify-center hover:bg-black/70 transition-colors"
                >
                  <Icon name="XMarkIcon" size={14} />
                </button>
              </div>

              <div className="flex gap-3">
                <button
                  onClick={resetSearch}
                  className="flex-1 py-2.5 border border-border rounded-xl text-sm font-medium text-muted-foreground hover:bg-muted transition-colors"
                >
                  التقاط صورة أخرى
                </button>
                <button
                  onClick={analyzeImage}
                  disabled={isAnalyzing}
                  className="flex-1 py-2.5 bg-primary text-primary-foreground rounded-xl text-sm font-semibold disabled:opacity-70 hover:opacity-90 transition-opacity flex items-center justify-center gap-2"
                >
                  {isAnalyzing ? (
                    <>
                      <div className="w-4 h-4 border-2 border-primary-foreground border-t-transparent rounded-full animate-spin" />
                      جارٍ التحليل...
                    </>
                  ) : (
                    <>
                      <Icon name="SparklesIcon" size={16} />
                      تحليل وبحث عن موردين
                    </>
                  )}
                </button>
              </div>

              {isAnalyzing && (
                <div className="bg-primary/5 border border-primary/20 rounded-xl p-4 text-center space-y-2">
                  <div className="flex items-center justify-center gap-2">
                    <div className="w-5 h-5 border-2 border-primary border-t-transparent rounded-full animate-spin" />
                    <span className="text-sm font-medium text-primary">Gemini Vision AI يحلل الصورة...</span>
                  </div>
                  <p className="text-xs text-muted-foreground">يتم التعرف على المادة ومطابقتها مع الموردين الدوليين</p>
                </div>
              )}
            </div>
          )}

          {/* Analysis Results */}
          {analysisResult && (
            <div className="space-y-5">
              {/* Material Identified */}
              <div className="bg-gradient-to-br from-primary/5 to-blue-500/5 border border-primary/20 rounded-xl p-4">
                <div className="flex items-start gap-3">
                  <div className="w-10 h-10 rounded-xl bg-primary/10 flex items-center justify-center shrink-0">
                    <Icon name="CubeIcon" size={20} className="text-primary" />
                  </div>
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2 flex-wrap">
                      <h3 className="text-base font-bold text-foreground">{analysisResult.materialName}</h3>
                      <span className="px-2 py-0.5 bg-primary/10 text-primary text-xs font-semibold rounded-full">
                        {analysisResult.materialType}
                      </span>
                    </div>
                    <p className="text-sm text-muted-foreground mt-1">{analysisResult.description}</p>
                  </div>
                </div>
              </div>

              {/* Captured Image Thumbnail */}
              <div className="flex items-center gap-3">
                <img
                  src={capturedImage!}
                  alt="الصورة المحللة"
                  className="w-16 h-16 rounded-lg object-cover border border-border"
                />
                <div className="flex-1">
                  <p className="text-xs text-muted-foreground">تم التعرف على المادة بنجاح</p>
                  <button
                    onClick={resetSearch}
                    className="text-xs text-primary hover:underline mt-0.5"
                  >
                    بحث عن مادة أخرى
                  </button>
                </div>
              </div>

              {/* Supplier Matches */}
              {analysisResult.supplierMatches && analysisResult.supplierMatches.length > 0 && (
                <div>
                  <h4 className="text-sm font-bold text-foreground mb-3 flex items-center gap-2">
                    <Icon name="BuildingStorefrontIcon" size={16} className="text-primary" />
                    الموردون الدوليون المقترحون
                    <span className="text-xs font-normal text-muted-foreground">({analysisResult.supplierMatches.length} مورد)</span>
                  </h4>
                  <div className="space-y-2">
                    {analysisResult.supplierMatches.map((supplier, idx) => (
                      <div
                        key={idx}
                        className="flex items-center gap-3 p-3 border border-border rounded-xl hover:border-primary/40 hover:bg-primary/5 transition-all cursor-pointer group"
                        onClick={() => handleSearchSuppliers(supplier.name)}
                      >
                        <div className="w-9 h-9 rounded-lg bg-muted flex items-center justify-center shrink-0 text-sm font-bold text-muted-foreground">
                          {supplier.country.slice(0, 2).toUpperCase()}
                        </div>
                        <div className="flex-1 min-w-0">
                          <div className="flex items-center gap-2">
                            <p className="text-sm font-semibold text-foreground truncate">{supplier.name}</p>
                            <span className="shrink-0 text-xs text-muted-foreground">{supplier.country}</span>
                          </div>
                          <p className="text-xs text-muted-foreground truncate">{supplier.specialization}</p>
                        </div>
                        <div className="flex items-center gap-1.5 shrink-0">
                          <div className="flex items-center gap-1">
                            <div className="w-1.5 h-1.5 rounded-full bg-green-500" />
                            <span className="text-xs font-bold text-green-600">{supplier.matchScore}%</span>
                          </div>
                          <Icon name="ChevronRightIcon" size={14} className="text-muted-foreground group-hover:text-primary transition-colors" />
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              )}

              {/* Search Keywords */}
              {analysisResult.searchKeywords && analysisResult.searchKeywords.length > 0 && (
                <div>
                  <h4 className="text-sm font-bold text-foreground mb-2 flex items-center gap-2">
                    <Icon name="MagnifyingGlassIcon" size={16} className="text-primary" />
                    البحث في المنصة
                  </h4>
                  <div className="flex flex-wrap gap-2">
                    {analysisResult.searchKeywords.map((kw, idx) => (
                      <button
                        key={idx}
                        onClick={() => handleSearchSuppliers(kw)}
                        className="px-3 py-1.5 bg-muted hover:bg-primary hover:text-primary-foreground text-sm text-foreground rounded-lg transition-colors border border-border hover:border-primary"
                      >
                        {kw}
                      </button>
                    ))}
                  </div>
                </div>
              )}

              {/* Categories */}
              {analysisResult.suggestedCategories && analysisResult.suggestedCategories.length > 0 && (
                <div>
                  <h4 className="text-sm font-bold text-foreground mb-2 flex items-center gap-2">
                    <Icon name="Squares2X2Icon" size={16} className="text-primary" />
                    الفئات المقترحة
                  </h4>
                  <div className="flex flex-wrap gap-2">
                    {analysisResult.suggestedCategories.map((cat, idx) => (
                      <button
                        key={idx}
                        onClick={() => handleSearchCategory(cat)}
                        className="px-3 py-1.5 bg-blue-500/10 hover:bg-blue-500 hover:text-white text-sm text-blue-600 rounded-lg transition-colors border border-blue-200/50 hover:border-blue-500"
                      >
                        {cat}
                      </button>
                    ))}
                  </div>
                </div>
              )}

              {/* CTA */}
              <div className="flex gap-3 pt-2">
                <button
                  onClick={() => handleSearchSuppliers(analysisResult.materialName)}
                  className="flex-1 py-3 bg-primary text-primary-foreground rounded-xl text-sm font-semibold hover:opacity-90 transition-opacity flex items-center justify-center gap-2"
                >
                  <Icon name="MagnifyingGlassIcon" size={16} />
                  عرض جميع الموردين
                </button>
                <button
                  onClick={resetSearch}
                  className="py-3 px-4 border border-border rounded-xl text-sm font-medium text-muted-foreground hover:bg-muted transition-colors"
                >
                  <Icon name="ArrowPathIcon" size={16} />
                </button>
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
