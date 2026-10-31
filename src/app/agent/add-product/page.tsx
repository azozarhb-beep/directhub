'use client';

import React, { useState, useEffect } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import Link from 'next/link';
import { useAuth } from '@/contexts/AuthContext';
import { createClient } from '@/lib/supabase/client';
import toast from 'react-hot-toast';
import Header from '@/components/Header';
import BottomNav from '@/components/BottomNav';
import Icon from '@/components/ui/AppIcon';
import { useLanguage } from '@/contexts/LanguageContext';
import {
  PRODUCT_UNIT_OPTIONS,
  CUSTOM_UNIT_VALUE,
  CUSTOM_UNIT_LABEL,
  CUSTOM_UNIT_PLACEHOLDER,
  CUSTOM_UNIT_REQUIRED_ERROR,
  resolveProductUnit,
} from '@/lib/productUnits';

interface AgentFactory {
  id: string;
  company_name: string;
  city: string;
  country: string;
  factory_type?: string | null;
}

interface PriceTierRow {
  min_qty: string;
  max_qty: string;
  price: string;
}

interface ImageItem {
  id: string;
  file: File;
  preview: string;
}

const MAX_IMAGES = 4;
const MAX_IMAGE_BYTES = 10 * 1024 * 1024;
const MAX_VIDEO_BYTES = 30 * 1024 * 1024;
const IMAGE_TYPES = ['image/jpeg', 'image/jpg', 'image/png', 'image/webp'];
const VIDEO_TYPES = ['video/mp4', 'video/webm'];
const MEDIA_BUCKET = 'product-media';
const DRAFT_KEY = 'form-draft-new-product';
const VIDEO_DB_NAME = 'form-draft-new-product-db';
const VIDEO_STORE = 'files';
const VIDEO_ERR_TOAST = 'حجم الفيديو يتجاوز 30 ميجابايت. يرجى تصوير مقطع أقصر أو تقليل الجودة.';

interface StoredImage {
  id: string;
  name: string;
  type: string;
  dataUrl: string;
}

interface ProductDraft {
  factoryId: string;
  form: Record<string, string | boolean>;
  tiers: { min_qty: string; max_qty: string; price: string }[];
  videoUrlInput: string;
  images: StoredImage[];
  hasVideo: boolean;
  videoName?: string;
  videoType?: string;
}

const fileToDataUrl = (file: File): Promise<string> =>
  new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(String(reader.result || ''));
    reader.onerror = () => reject(reader.error);
    reader.readAsDataURL(file);
  });

const dataUrlToFile = async (dataUrl: string, name: string, type: string): Promise<File> => {
  const res = await fetch(dataUrl);
  const blob = await res.blob();
  return new File([blob], name, { type: type || blob.type });
};

const openVideoDb = (): Promise<IDBDatabase> =>
  new Promise((resolve, reject) => {
    const req = indexedDB.open(VIDEO_DB_NAME, 1);
    req.onupgradeneeded = () => {
      if (!req.result.objectStoreNames.contains(VIDEO_STORE)) req.result.createObjectStore(VIDEO_STORE);
    };
    req.onsuccess = () => resolve(req.result);
    req.onerror = () => reject(req.error);
  });

const saveDraftVideo = async (file: File | null) => {
  try {
    const db = await openVideoDb();
    await new Promise<void>((resolve, reject) => {
      const tx = db.transaction(VIDEO_STORE, 'readwrite');
      if (file) tx.objectStore(VIDEO_STORE).put(file, 'video');
      else tx.objectStore(VIDEO_STORE).delete('video');
      tx.oncomplete = () => resolve();
      tx.onerror = () => reject(tx.error);
    });
    db.close();
  } catch {
    /* storage unavailable – ignore */
  }
};

const loadDraftVideo = async (): Promise<File | null> => {
  try {
    const db = await openVideoDb();
    const file = await new Promise<File | null>((resolve, reject) => {
      const req = db.transaction(VIDEO_STORE, 'readonly').objectStore(VIDEO_STORE).get('video');
      req.onsuccess = () => resolve((req.result as File) || null);
      req.onerror = () => reject(req.error);
    });
    db.close();
    return file;
  } catch {
    return null;
  }
};

const INITIAL_FORM = {
  name_ar: '',
  name_en: '',
  description_ar: '',
  description_en: '',
  category: '',
  is_b2b_only: true,
  target_market: 'B2B' as 'B2B' | 'B2C' | 'BOTH',
  wholesale_price: '',
  retail_price: '',
  currency: 'SAR',
  moq: '1',
  unit: 'piece',
  custom_unit: '',
  specifications: '',
  gross_weight_kg: '',
  carton_volume_cbm: '',
  shipping_terms: 'CALCULATED_SHIPPING',
  shipping_port: '',
};

function AddProductPageInner() {
  const { t, dir } = useLanguage();
  const ap = t.agentAddProduct;

  const router = useRouter();
  const searchParams = useSearchParams();
  const factoryId = searchParams?.get('factoryId') || '';
  const { user, loading: authLoading } = useAuth();
  const supabase = createClient();

  const [factory, setFactory] = useState<AgentFactory | null>(null);
  const [loading, setLoading] = useState(false);
  const [fetchingFactory, setFetchingFactory] = useState(true);
  const [error, setError] = useState('');
  const [success, setSuccess] = useState(false);

  const [form, setForm] = useState(INITIAL_FORM);
  const [tiers, setTiers] = useState<PriceTierRow[]>([]);
  const [imageItems, setImageItems] = useState<ImageItem[]>([]);
  const [videoFile, setVideoFile] = useState<File | null>(null);
  const [videoPreview, setVideoPreview] = useState('');
  const [videoUrlInput, setVideoUrlInput] = useState('');
  const [dragOver, setDragOver] = useState(false);
  const [videoThumb, setVideoThumb] = useState('');
  const [videoProgress, setVideoProgress] = useState(0);
  const [videoUploading, setVideoUploading] = useState(false);
  const [draftReady, setDraftReady] = useState(false);

  // Restore draft (survives mobile browser reloads after returning from the camera app)
  useEffect(() => {
    if (!factoryId) return;
    let cancelled = false;
    (async () => {
      try {
        const raw = localStorage.getItem(DRAFT_KEY);
        if (raw) {
          const draft: ProductDraft = JSON.parse(raw);
          if (draft && draft.factoryId === factoryId) {
            setForm(prev => ({ ...prev, ...draft.form }));
            setTiers(Array.isArray(draft.tiers) ? draft.tiers : []);
            setVideoUrlInput(draft.videoUrlInput || '');
            const restoredImages: ImageItem[] = [];
            for (const img of draft.images || []) {
              const file = await dataUrlToFile(img.dataUrl, img.name, img.type);
              restoredImages.push({ id: img.id, file, preview: URL.createObjectURL(file) });
            }
            if (cancelled) return;
            if (restoredImages.length) setImageItems(restoredImages);
            if (draft.hasVideo) {
              const vf = await loadDraftVideo();
              if (vf && !cancelled) {
                const file = vf instanceof File ? vf : new File([vf], draft.videoName || 'video.mp4', { type: draft.videoType || 'video/mp4' });
                setVideoFile(file);
                setVideoPreview(URL.createObjectURL(file));
              }
            }
          }
        }
      } catch {
        /* corrupted draft – ignore */
      } finally {
        if (!cancelled) setDraftReady(true);
      }
    })();
    return () => { cancelled = true; };
  }, [factoryId]);

  // Persist draft on every change
  useEffect(() => {
    if (!draftReady || !factoryId || success) return;
    const timer = setTimeout(async () => {
      try {
        const images: StoredImage[] = await Promise.all(
          imageItems.map(async i => ({ id: i.id, name: i.file.name, type: i.file.type, dataUrl: await fileToDataUrl(i.file) }))
        );
        const draft: ProductDraft = {
          factoryId,
          form,
          tiers,
          videoUrlInput,
          images,
          hasVideo: !!videoFile,
          videoName: videoFile?.name,
          videoType: videoFile?.type,
        };
        localStorage.setItem(DRAFT_KEY, JSON.stringify(draft));
      } catch {
        // Quota exceeded (large images) – keep text fields at least
        try {
          localStorage.setItem(
            DRAFT_KEY,
            JSON.stringify({ factoryId, form, tiers, videoUrlInput, images: [], hasVideo: !!videoFile, videoName: videoFile?.name, videoType: videoFile?.type })
          );
        } catch { /* ignore */ }
      }
    }, 400);
    return () => clearTimeout(timer);
  }, [draftReady, factoryId, success, form, tiers, videoUrlInput, imageItems, videoFile]);

  const clearDraft = () => {
    try { localStorage.removeItem(DRAFT_KEY); } catch { /* ignore */ }
    saveDraftVideo(null);
  };

  // Generate a thumbnail from the first frame of the selected video
  useEffect(() => {
    if (!videoPreview) { setVideoThumb(''); return; }
    let cancelled = false;
    const v = document.createElement('video');
    v.muted = true;
    v.playsInline = true;
    v.preload = 'metadata';
    v.src = videoPreview;
    const capture = () => {
      try {
        const canvas = document.createElement('canvas');
        canvas.width = v.videoWidth || 320;
        canvas.height = v.videoHeight || 180;
        canvas.getContext('2d')?.drawImage(v, 0, 0, canvas.width, canvas.height);
        if (!cancelled) setVideoThumb(canvas.toDataURL('image/jpeg', 0.7));
      } catch { /* ignore */ }
    };
    v.onloadeddata = () => { try { v.currentTime = Math.min(0.5, v.duration || 0.5); } catch { capture(); } };
    v.onseeked = capture;
    return () => { cancelled = true; v.removeAttribute('src'); v.load(); };
  }, [videoPreview]);

  // Auth guard
  useEffect(() => {
    if (!authLoading && !user) router.push('/login');
    if (!authLoading && user) {
      const role = user?.user_metadata?.role;
      if (role !== 'field_agent' && role !== 'admin') router.push('/my-account');
    }
  }, [user, authLoading, router]);

  // Fetch factory
  useEffect(() => {
    if (!user || !factoryId) { setFetchingFactory(false); return; }
    supabase
      .from('agent_factory_registrations')
      .select('id, company_name, city, country, factory_type')
      .eq('id', factoryId)
      .eq('agent_id', user.id)
      .single()
      .then(({ data, error }) => {
        if (data) setFactory(data);
        setFetchingFactory(false);
      });
  }, [user, factoryId, supabase]);

  useEffect(() => {
    return () => {
      if (videoPreview) URL.revokeObjectURL(videoPreview);
    };
  }, [videoPreview]);

  const update = (field: string, value: string | boolean) => {
    setForm(prev => ({ ...prev, [field]: value }));
    setError('');
  };

  const addTier = () => setTiers(prev => [...prev, { min_qty: '', max_qty: '', price: '' }]);
  const removeTier = (idx: number) => setTiers(prev => prev.filter((_, i) => i !== idx));
  const updateTier = (idx: number, field: keyof PriceTierRow, value: string) => {
    setTiers(prev => prev.map((row, i) => (i === idx ? { ...row, [field]: value } : row)));
    setError('');
  };

  const addImageFiles = (files: FileList | File[] | null) => {
    if (!files) return;
    const incoming = Array.from(files);
    const accepted: ImageItem[] = [];
    let remaining = MAX_IMAGES - imageItems.length;
    for (const file of incoming) {
      if (!IMAGE_TYPES.includes(file.type)) { setError(ap.mediaErrImageType); continue; }
      if (file.size > MAX_IMAGE_BYTES) { setError(ap.mediaErrImageSize); continue; }
      if (remaining <= 0) { setError(ap.mediaErrMaxImages); break; }
      accepted.push({
        id: `${Date.now()}-${Math.random().toString(36).slice(2, 8)}`,
        file,
        preview: URL.createObjectURL(file),
      });
      remaining -= 1;
    }
    if (accepted.length) setImageItems(prev => [...prev, ...accepted]);
  };

  const removeImage = (id: string) => {
    setImageItems(prev => {
      const target = prev.find(i => i.id === id);
      if (target) URL.revokeObjectURL(target.preview);
      return prev.filter(i => i.id !== id);
    });
  };

  const handleVideoPick = (file: File | null) => {
    if (!file) return;
    if (file.size > MAX_VIDEO_BYTES) {
      toast.error(VIDEO_ERR_TOAST);
      return;
    }
    if (!VIDEO_TYPES.includes(file.type)) { setError(ap.mediaErrVideoType); return; }
    if (videoPreview) URL.revokeObjectURL(videoPreview);
    setVideoFile(file);
    setVideoPreview(URL.createObjectURL(file));
    setVideoUrlInput('');
    setVideoProgress(0);
    setError('');
    saveDraftVideo(file);
  };

  const removeVideo = () => {
    if (videoPreview) URL.revokeObjectURL(videoPreview);
    setVideoFile(null);
    setVideoPreview('');
    setVideoProgress(0);
    saveDraftVideo(null);
  };

  const uploadVideoWithProgress = async (file: File): Promise<string> => {
    const ext = (file.name.split('.').pop() || 'mp4').toLowerCase();
    const path = `${user?.id}/videos/${Date.now()}-${Math.random().toString(36).slice(2, 8)}.${ext}`;
    const { data: sessionData } = await supabase.auth.getSession();
    const token = sessionData?.session?.access_token;
    const baseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!;
    const anonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!;
    setVideoUploading(true);
    setVideoProgress(0);
    try {
      await new Promise<void>((resolve, reject) => {
        const xhr = new XMLHttpRequest();
        xhr.open('POST', `${baseUrl}/storage/v1/object/${MEDIA_BUCKET}/${path}`);
        xhr.setRequestHeader('Authorization', `Bearer ${token || anonKey}`);
        xhr.setRequestHeader('apikey', anonKey);
        xhr.setRequestHeader('x-upsert', 'false');
        xhr.setRequestHeader('Content-Type', file.type || 'video/mp4');
        xhr.upload.onprogress = ev => {
          if (ev.lengthComputable) setVideoProgress(Math.round((ev.loaded / ev.total) * 100));
        };
        xhr.onload = () => {
          if (xhr.status >= 200 && xhr.status < 300) { setVideoProgress(100); resolve(); }
          else reject(new Error(xhr.responseText || `HTTP ${xhr.status}`));
        };
        xhr.onerror = () => reject(new Error('Network error'));
        xhr.send(file);
      });
    } finally {
      setVideoUploading(false);
    }
    const { data } = supabase.storage.from(MEDIA_BUCKET).getPublicUrl(path);
    return data.publicUrl;
  };

  const uploadToBucket = async (file: File, folder: string): Promise<string> => {
    const ext = (file.name.split('.').pop() || 'bin').toLowerCase();
    const path = `${user?.id}/${folder}/${Date.now()}-${Math.random().toString(36).slice(2, 8)}.${ext}`;
    const { error: upErr } = await supabase.storage
      .from(MEDIA_BUCKET)
      .upload(path, file, { contentType: file.type, upsert: false });
    if (upErr) throw upErr;
    const { data } = supabase.storage.from(MEDIA_BUCKET).getPublicUrl(path);
    return data.publicUrl;
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!user || !factory) return;
    if (!form.name_ar.trim()) { setError(ap.errorNameRequired); return; }
    if (!form.wholesale_price || isNaN(Number(form.wholesale_price)) || Number(form.wholesale_price) <= 0) { setError(ap.errorWholesale); return; }
    if (form.target_market !== 'B2B' && (!form.retail_price || isNaN(Number(form.retail_price)) || Number(form.retail_price) <= 0)) { setError(ap.errorRetail); return; }
    if (!form.moq || isNaN(Number(form.moq))) { setError(ap.errorMoq); return; }
    if (form.unit === CUSTOM_UNIT_VALUE && !form.custom_unit.trim()) { setError(CUSTOM_UNIT_REQUIRED_ERROR); return; }

    const cleanedTiers = tiers
      .filter(r => r.min_qty || r.max_qty || r.price)
      .map(r => ({
        min_qty: Number(r.min_qty),
        max_qty: r.max_qty ? Number(r.max_qty) : null,
        price: Number(r.price),
      }));
    const tiersInvalid = cleanedTiers.some(
      r => !Number.isFinite(r.min_qty) || r.min_qty <= 0 || !Number.isFinite(r.price) || r.price <= 0 ||
        (r.max_qty !== null && (!Number.isFinite(r.max_qty) || r.max_qty < r.min_qty))
    );
    if (tiersInvalid) { setError(ap.errorTier); return; }

    setLoading(true);
    setError('');
    try {
      let specs: Record<string, string> = {};
      if (form.specifications.trim()) {
        form.specifications.split('\n').forEach(line => {
          const parts = line.split(':');
          const key = parts[0];
          const rest = parts.slice(1);
          if (key && rest.length) specs[key.trim()] = rest.join(':').trim();
        });
      }

      let imageUrls: string[] = [];
      let videoUrl: string | null = null;
      try {
        imageUrls = await Promise.all(imageItems.map(i => uploadToBucket(i.file, 'images')));
        if (videoFile) {
          videoUrl = await uploadVideoWithProgress(videoFile);
        } else if (videoUrlInput.trim()) {
          videoUrl = videoUrlInput.trim();
        }
      } catch (mediaErr: any) {
        throw new Error(`${ap.mediaErrUpload}: ${mediaErr?.message || ''}`);
      }

      const { data: insertedRow, error: insertError } = await supabase
        .from('agent_products')
        .insert({
          agent_id: user.id,
          attributed_agent_id: user.id,
          factory_id: factory.id,
          name_ar: form.name_ar.trim(),
          name_en: form.name_en.trim(),
          description_ar: form.description_ar.trim(),
          description_en: form.description_en.trim(),
          category: form.category.trim(),
          price: Number(form.wholesale_price),
          wholesale_price: Number(form.wholesale_price),
          retail_price: form.target_market === 'B2B' ? null : Number(form.retail_price),
          is_b2b_only: form.target_market === 'B2B',
          target_market: form.target_market,
          price_tiers: cleanedTiers,
          currency: form.currency,
          moq: Number(form.moq),
          unit: resolveProductUnit(form.unit, form.custom_unit),
          specifications: specs,
          images: imageUrls,
          video_url: videoUrl,
          shipping_terms: form.shipping_terms,
          shipping_port: form.shipping_terms === 'DELIVERY_INCLUDED' ? null : (form.shipping_port.trim() || null),
          is_active: false,
          is_published: false,
          stock_quantity: Math.max(100, Number(form.moq) * 10),
        })
        .select('id')
        .single();
      if (insertError) throw insertError;

      // Apply platform auto-approval (initial_auto_launch_batch): publishes the
      // product as active with initial stock when enabled.
      if (insertedRow?.id) {
        await supabase.rpc('publish_agent_product', {
          p_product_id: insertedRow.id,
          p_initial_stock: Math.max(100, Number(form.moq) * 10),
        });
      }
      clearDraft();
      setSuccess(true);
    } catch (err: any) {
      setError(err.message || ap.errorGeneric);
    } finally {
      setLoading(false);
    }
  };

  if (fetchingFactory) {
    return (
      <div className="min-h-screen bg-background flex items-center justify-center">
        <div className="w-8 h-8 border-4 border-primary border-t-transparent rounded-full animate-spin" />
      </div>
    );
  }

  if (!factoryId || !factory) {
    return (
      <div className="min-h-screen bg-background" dir={dir}>
        <Header />
        <main className="max-w-lg mx-auto px-4 py-16 text-center">
          <Icon name="ExclamationCircleIcon" size={48} className="text-red-400 mx-auto mb-4" />
          <h2 className="text-xl font-bold text-foreground mb-2">{ap.factoryNotFound}</h2>
          <p className="text-muted-foreground mb-5">{ap.factoryNotFoundDesc}</p>
          <Link href="/agent/dashboard" className="inline-flex items-center gap-2 px-5 py-2.5 bg-primary text-white rounded-xl font-semibold">
            <Icon name="ArrowRightIcon" size={15} />
            {ap.backToDashboard}
          </Link>
        </main>
        <BottomNav />
      </div>
    );
  }

  if (success) {
    return (
      <div className="min-h-screen bg-background" dir={dir}>
        <Header />
        <main className="max-w-lg mx-auto px-4 py-16 text-center">
          <div className="w-20 h-20 bg-emerald-100 rounded-full flex items-center justify-center mx-auto mb-5">
            <Icon name="CheckCircleIcon" size={40} className="text-emerald-600" />
          </div>
          <h2 className="text-2xl font-bold text-foreground mb-2">{ap.successTitle}</h2>
          <p className="text-muted-foreground mb-3">{(factory.factory_type === 'local_supplier' ? ap.successDescSupplier : ap.successDesc).replace('{name}', factory.company_name)}</p>
          <p className="text-xs text-amber-800 bg-amber-50 border border-amber-200 rounded-xl p-3 mb-6">{ap.successPendingReview}</p>
          <div className="flex flex-col gap-3">
            <button
              type="button"
              onClick={() => {
                setSuccess(false);
                setError('');
                setForm(INITIAL_FORM);
                setTiers([]);
                imageItems.forEach(i => URL.revokeObjectURL(i.preview));
                setImageItems([]);
                removeVideo();
                setVideoUrlInput('');
                setVideoThumb('');
                setVideoUploading(false);
                setVideoProgress(0);
                clearDraft();
                if (typeof window !== 'undefined') window.scrollTo({ top: 0 });
              }}
              className="flex items-center justify-center gap-2 px-6 py-3 bg-primary text-white rounded-xl font-semibold hover:bg-primary/90 transition-colors"
            >
              <Icon name="PlusIcon" size={16} />
              {ap.addAnother}
            </button>
            <button
              type="button"
              onClick={() => {
                clearDraft();
                router.push('/agent/dashboard');
                setTimeout(() => {
                  if (typeof window !== 'undefined' && window.location.pathname.startsWith('/agent/add-product')) {
                    window.location.href = '/agent/dashboard';
                  }
                }, 600);
              }}
              className="flex items-center justify-center gap-2 px-6 py-3 border border-border rounded-xl font-semibold text-muted-foreground hover:bg-muted transition-colors"
            >
              <Icon name="ArrowRightIcon" size={16} />
              {ap.backToDashboard}
            </button>
          </div>
        </main>
        <BottomNav />
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-background" dir={dir}>
      <Header />
      <main className="max-w-2xl mx-auto px-4 py-6 mobile-safe-bottom">

        {/* Header */}
        <div className="flex items-center gap-3 mb-6">
          <Link href="/agent/dashboard" className="w-9 h-9 rounded-xl border border-border flex items-center justify-center hover:bg-muted transition-colors">
            <Icon name="ArrowRightIcon" size={16} className="text-muted-foreground" />
          </Link>
          <div>
            <h1 className="text-xl font-bold text-foreground">{ap.title}</h1>
            <p className="text-xs text-muted-foreground flex items-center gap-1">
              <Icon name="BuildingOffice2Icon" size={11} />
              {factory.company_name} · {factory.city}
            </p>
          </div>
        </div>

        {error && (
          <div className="mb-4 flex items-center gap-2 px-4 py-3 bg-red-50 border border-red-200 text-red-700 rounded-xl text-sm">
            <Icon name="ExclamationCircleIcon" size={16} />
            {error}
          </div>
        )}

        <form onSubmit={handleSubmit} className="bg-card border border-border rounded-2xl p-5 space-y-4">

          {/* Names */}
          <div>
            <label className="block text-sm font-medium text-foreground mb-1.5">{ap.nameAr} <span className="text-red-500">*</span></label>
            <input
              type="text"
              value={form.name_ar}
              onChange={e => update('name_ar', e.target.value)}
              placeholder={ap.nameArPlaceholder}
              className="w-full px-3 py-2.5 bg-background border border-border rounded-xl text-sm text-foreground placeholder:text-muted-foreground focus:outline-none focus:border-primary"
            />
          </div>

          <div>
            <label className="block text-sm font-medium text-foreground mb-1.5">{ap.nameEn}</label>
            <input
              type="text"
              value={form.name_en}
              onChange={e => update('name_en', e.target.value)}
              placeholder="e.g. Plastic Garden Chair"
              className="w-full px-3 py-2.5 bg-background border border-border rounded-xl text-sm text-foreground placeholder:text-muted-foreground focus:outline-none focus:border-primary"
              dir="ltr"
            />
          </div>

          {/* Category */}
          <div>
            <label className="block text-sm font-medium text-foreground mb-1.5">{ap.category}</label>
            <input
              type="text"
              value={form.category}
              onChange={e => update('category', e.target.value)}
              placeholder={ap.categoryPlaceholder}
              className="w-full px-3 py-2.5 bg-background border border-border rounded-xl text-sm text-foreground placeholder:text-muted-foreground focus:outline-none focus:border-primary"
            />
          </div>

          {/* B2B / B2C Pricing */}
          <div className="space-y-3 p-4 bg-muted/40 border border-border rounded-xl">
            <label className="block text-sm font-medium text-foreground">نوع البيع (Target Market)</label>
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-2">
              {([
                { value: 'B2B', label: 'جملة وشركات فقط (B2B Only)' },
                { value: 'B2C', label: 'تجزئة وأفراد فقط (B2C Only)' },
                { value: 'BOTH', label: 'متاح للاثنين (B2B & B2C)' },
              ] as const).map((opt) => (
                <button
                  key={opt.value}
                  type="button"
                  onClick={() => setForm(f => ({ ...f, target_market: opt.value, is_b2b_only: opt.value === 'B2B' }))}
                  className={`text-start px-3 py-2.5 rounded-xl border text-sm transition-colors ${
                    form.target_market === opt.value ? 'border-primary bg-primary/10 text-foreground' : 'border-border bg-background text-muted-foreground'
                  }`}
                >
                  <span className="block font-semibold">{opt.label}</span>
                </button>
              ))}
            </div>

            <div className="flex flex-col w-full gap-3">
              <div className="w-full">
                <label className="block text-sm font-medium text-foreground mb-1.5">{ap.wholesalePrice} <span className="text-red-500">*</span></label>
                <div className="flex flex-col sm:flex-row w-full gap-2">
                  <input
                    type="number"
                    value={form.wholesale_price}
                    onChange={e => update('wholesale_price', e.target.value)}
                    placeholder="0.00"
                    min="0"
                    step="0.01"
                    className="w-full sm:flex-1 min-w-0 px-3 py-2.5 bg-background border border-border rounded-xl text-sm text-foreground placeholder:text-muted-foreground focus:outline-none focus:border-primary"
                    dir="ltr"
                  />
                  <select
                    value={form.currency}
                    onChange={e => update('currency', e.target.value)}
                    className="w-full sm:w-24 px-2 py-2.5 bg-background border border-border rounded-xl text-sm text-foreground focus:outline-none focus:border-primary"
                  >
                    {['SAR', 'USD', 'EUR', 'AED', 'CNY', 'YER'].map(c => <option key={c} value={c}>{c}</option>)}
                  </select>
                </div>
              </div>
              {form.target_market !== 'B2B' && (
                <div className="w-full">
                  <label className="block text-sm font-medium text-foreground mb-1.5">{ap.retailPrice} <span className="text-red-500">*</span></label>
                  <input
                    type="number"
                    value={form.retail_price}
                    onChange={e => update('retail_price', e.target.value)}
                    placeholder="0.00"
                    min="0"
                    step="0.01"
                    className="w-full px-3 py-2.5 bg-background border border-border rounded-xl text-sm text-foreground placeholder:text-muted-foreground focus:outline-none focus:border-primary"
                    dir="ltr"
                  />
                </div>
              )}
            </div>

            <div className="w-full">
              <label className="block text-sm font-medium text-foreground mb-1.5">{ap.moq} <span className="text-red-500">*</span></label>
              <div className="flex flex-col sm:flex-row w-full gap-2">
                <input
                  type="number"
                  value={form.moq}
                  onChange={e => update('moq', e.target.value)}
                  placeholder="1"
                  min="1"
                  className="w-full sm:flex-1 min-w-0 px-3 py-2.5 bg-background border border-border rounded-xl text-sm text-foreground placeholder:text-muted-foreground focus:outline-none focus:border-primary"
                  dir="ltr"
                />
                <select
                  value={form.unit}
                  onChange={e => update('unit', e.target.value)}
                  className="w-full sm:w-56 px-2 py-2.5 bg-background border border-border rounded-xl text-sm text-foreground focus:outline-none focus:border-primary"
                >
                  {PRODUCT_UNIT_OPTIONS.map(u => <option key={u.value} value={u.value}>{u.label}</option>)}
                </select>
              </div>
              {form.unit === CUSTOM_UNIT_VALUE && (
                <div className="mt-3">
                  <label className="block text-sm font-medium text-foreground mb-1.5">{CUSTOM_UNIT_LABEL}</label>
                  <input
                    type="text"
                    value={form.custom_unit}
                    onChange={e => update('custom_unit', e.target.value)}
                    placeholder={CUSTOM_UNIT_PLACEHOLDER}
                    className="w-full px-3 py-2.5 bg-background border border-border rounded-xl text-sm text-foreground placeholder:text-muted-foreground focus:outline-none focus:border-primary"
                  />
                </div>
              )}
            </div>

            <div>
              <div className="flex items-center justify-between mb-1">
                <label className="block text-sm font-medium text-foreground">{ap.priceTiers}</label>
                <button
                  type="button"
                  onClick={addTier}
                  className="inline-flex items-center gap-1 text-xs font-semibold text-primary hover:underline"
                >
                  <Icon name="PlusIcon" size={12} />
                  {ap.addTier}
                </button>
              </div>
              <p className="text-xs text-muted-foreground mb-2">{ap.priceTiersHint}</p>
              <div className="space-y-2">
                {tiers.map((row, idx) => (
                  <div key={idx} className="grid grid-cols-[1fr_1fr_1fr_auto] gap-2 items-end">
                    <div>
                      <span className="block text-[11px] text-muted-foreground mb-1">{ap.tierMinQty}</span>
                      <input
                        type="number"
                        min="1"
                        value={row.min_qty}
                        onChange={e => updateTier(idx, 'min_qty', e.target.value)}
                        className="w-full px-2 py-2 bg-background border border-border rounded-lg text-sm text-foreground focus:outline-none focus:border-primary"
                        dir="ltr"
                      />
                    </div>
                    <div>
                      <span className="block text-[11px] text-muted-foreground mb-1">{ap.tierMaxQty}</span>
                      <input
                        type="number"
                        min="1"
                        value={row.max_qty}
                        placeholder={ap.tierMaxOpen}
                        onChange={e => updateTier(idx, 'max_qty', e.target.value)}
                        className="w-full px-2 py-2 bg-background border border-border rounded-lg text-sm text-foreground placeholder:text-muted-foreground focus:outline-none focus:border-primary"
                        dir="ltr"
                      />
                    </div>
                    <div>
                      <span className="block text-[11px] text-muted-foreground mb-1">{ap.tierPrice}</span>
                      <input
                        type="number"
                        min="0"
                        step="0.01"
                        value={row.price}
                        onChange={e => updateTier(idx, 'price', e.target.value)}
                        className="w-full px-2 py-2 bg-background border border-border rounded-lg text-sm text-foreground focus:outline-none focus:border-primary"
                        dir="ltr"
                      />
                    </div>
                    <button
                      type="button"
                      onClick={() => removeTier(idx)}
                      aria-label={ap.removeTier}
                      className="w-9 h-9 flex items-center justify-center rounded-lg border border-border text-red-500 hover:bg-red-50 transition-colors"
                    >
                      <Icon name="TrashIcon" size={14} />
                    </button>
                  </div>
                ))}
              </div>
            </div>
          </div>

          {/* Descriptions */}
          <div>
            <label className="block text-sm font-medium text-foreground mb-1.5">{ap.descAr}</label>
            <textarea
              value={form.description_ar}
              onChange={e => update('description_ar', e.target.value)}
              rows={3}
              placeholder={ap.descArPlaceholder}
              className="w-full px-3 py-2.5 bg-background border border-border rounded-xl text-sm text-foreground placeholder:text-muted-foreground focus:outline-none focus:border-primary resize-none"
            />
          </div>

          <div>
            <label className="block text-sm font-medium text-foreground mb-1.5">{ap.descEn}</label>
            <textarea
              value={form.description_en}
              onChange={e => update('description_en', e.target.value)}
              rows={2}
              placeholder="Product description in English..."
              className="w-full px-3 py-2.5 bg-background border border-border rounded-xl text-sm text-foreground placeholder:text-muted-foreground focus:outline-none focus:border-primary resize-none"
              dir="ltr"
            />
          </div>

          {/* Shipping Terms */}
          <div className="space-y-3 p-4 bg-muted/40 border border-border rounded-xl">
            <div>
              <label className="block text-sm font-medium text-foreground mb-1.5">{ap.shippingTerms}</label>
              <select
                value={form.shipping_terms}
                onChange={e => update('shipping_terms', e.target.value)}
                className="w-full px-3 py-2.5 bg-background border border-border rounded-xl text-sm text-foreground focus:outline-none focus:border-primary"
              >
                <option value="DELIVERY_INCLUDED">{ap.shippingTermsDeliveryIncluded}</option>
                <option value="EX_FACTORY">{ap.shippingTermsExFactory}</option>
                <option value="CALCULATED_SHIPPING">{ap.shippingTermsCalculated}</option>
              </select>
            </div>
            {form.shipping_terms !== 'DELIVERY_INCLUDED' && (
              <div>
                <label className="block text-sm font-medium text-foreground mb-1.5">{ap.shippingPort}</label>
                <input
                  type="text"
                  value={form.shipping_port}
                  onChange={e => update('shipping_port', e.target.value)}
                  placeholder={ap.shippingPortPlaceholder}
                  className="w-full px-3 py-2.5 bg-background border border-border rounded-xl text-sm text-foreground placeholder:text-muted-foreground focus:outline-none focus:border-primary"
                />
              </div>
            )}
          </div>

          {/* Specifications */}
          <div>
            <label className="block text-sm font-medium text-foreground mb-1.5">{ap.specs}</label>
            <p className="text-xs text-muted-foreground mb-2">{ap.specsHint}</p>
            <textarea
              value={form.specifications}
              onChange={e => update('specifications', e.target.value)}
              rows={4}
              placeholder={ap.specsPlaceholder}
              className="w-full px-3 py-2.5 bg-background border border-border rounded-xl text-sm text-foreground placeholder:text-muted-foreground focus:outline-none focus:border-primary resize-none font-mono"
            />
          </div>

          {/* Product Media */}
          <div className="space-y-4 p-4 bg-muted/40 border border-border rounded-xl">
            <h2 className="text-sm font-bold text-foreground flex items-center gap-2">
              <Icon name="PhotoIcon" size={16} className="text-primary" />
              {ap.mediaTitle}
            </h2>

            {/* Images */}
            <div>
              <div className="flex items-center justify-between mb-1.5">
                <label className="block text-sm font-medium text-foreground">{ap.mediaImages}</label>
                <span className="text-xs text-muted-foreground" dir="ltr">{imageItems.length}/{MAX_IMAGES}</span>
              </div>

              {imageItems.length < MAX_IMAGES && (
                <label
                  onDragOver={e => { e.preventDefault(); setDragOver(true); }}
                  onDragLeave={() => setDragOver(false)}
                  onDrop={e => { e.preventDefault(); setDragOver(false); addImageFiles(e.dataTransfer.files); }}
                  className={`flex flex-col items-center justify-center gap-1 w-full px-3 py-5 border-2 border-dashed rounded-xl cursor-pointer text-center transition-colors ${
                    dragOver ? 'border-primary bg-primary/5' : 'border-border bg-background hover:bg-muted'
                  }`}
                >
                  <Icon name="ArrowUpTrayIcon" size={20} className="text-muted-foreground" />
                  <span className="text-xs text-muted-foreground">{ap.mediaImagesHint}</span>
                  <input
                    type="file"
                    accept="image/jpeg,image/png,image/webp"
                    multiple
                    className="hidden"
                    onChange={e => { addImageFiles(e.target.files); e.target.value = ''; }}
                  />
                </label>
              )}

              {imageItems.length > 0 && (
                <div className="grid grid-cols-2 sm:grid-cols-4 gap-2 mt-3">
                  {imageItems.map((item, idx) => (
                    <div key={item.id} className="relative aspect-square rounded-xl overflow-hidden border border-border bg-background">
                      {/* eslint-disable-next-line @next/next/no-img-element */}
                      <img src={item.preview} alt={`${ap.mediaImages} ${idx + 1}`} className="w-full h-full object-cover" />
                      {idx === 0 && (
                        <span className="absolute bottom-1 start-1 px-1.5 py-0.5 rounded-md bg-primary text-white text-[10px] font-semibold">
                          {ap.mediaCover}
                        </span>
                      )}
                      <button
                        type="button"
                        onClick={() => removeImage(item.id)}
                        aria-label={ap.mediaRemove}
                        className="absolute top-1 end-1 w-6 h-6 flex items-center justify-center rounded-full bg-black/60 text-white hover:bg-red-600 transition-colors"
                      >
                        <Icon name="XMarkIcon" size={14} />
                      </button>
                    </div>
                  ))}
                </div>
              )}
            </div>

            {/* Video */}
            <div>
              <label className="block text-sm font-medium text-foreground mb-1.5">{ap.mediaVideo}</label>
              <p className="text-xs text-muted-foreground mb-2">{ap.mediaVideoHint}</p>

              {!videoFile && (
                <label className="flex items-center justify-center gap-2 w-full px-3 py-4 border-2 border-dashed border-border bg-background rounded-xl cursor-pointer hover:bg-muted transition-colors">
                  <Icon name="VideoCameraIcon" size={18} className="text-muted-foreground" />
                  <span className="text-xs text-muted-foreground">{ap.mediaVideoPick}</span>
                  <input
                    type="file"
                    accept="video/mp4,video/webm"
                    className="hidden"
                    onChange={e => { handleVideoPick(e.target.files?.[0] || null); e.target.value = ''; }}
                  />
                </label>
              )}

              {videoFile && videoPreview && (
                <div className="space-y-2">
                  <div className="relative rounded-xl overflow-hidden border border-border bg-black">
                    <video src={videoPreview} poster={videoThumb || undefined} controls playsInline className="w-full max-h-64" />
                    <button
                      type="button"
                      onClick={removeVideo}
                      disabled={videoUploading}
                      aria-label={ap.mediaRemove}
                      className="absolute top-2 end-2 w-7 h-7 flex items-center justify-center rounded-full bg-black/60 text-white hover:bg-red-600 transition-colors disabled:opacity-50"
                    >
                      <Icon name="XMarkIcon" size={14} />
                    </button>
                  </div>
                  <div className="flex items-center gap-3 p-2 bg-background border border-border rounded-xl">
                    {videoThumb ? (
                      // eslint-disable-next-line @next/next/no-img-element
                      <img src={videoThumb} alt="Video thumbnail" className="w-14 h-14 rounded-lg object-cover bg-black shrink-0" />
                    ) : (
                      <div className="w-14 h-14 rounded-lg bg-muted flex items-center justify-center shrink-0">
                        <Icon name="VideoCameraIcon" size={20} className="text-muted-foreground" />
                      </div>
                    )}
                    <div className="flex-1 min-w-0">
                      <p className="text-xs font-medium text-foreground truncate" dir="ltr">{videoFile.name}</p>
                      <p className="text-[11px] text-muted-foreground" dir="ltr">{(videoFile.size / (1024 * 1024)).toFixed(1)} MB</p>
                      <div className="mt-1.5 h-1.5 w-full bg-muted rounded-full overflow-hidden">
                        <div
                          className={`h-full rounded-full transition-all ${videoProgress === 100 ? 'bg-emerald-500' : 'bg-primary'}`}
                          style={{ width: `${videoUploading || videoProgress > 0 ? videoProgress : 0}%` }}
                        />
                      </div>
                      <p className="text-[11px] text-muted-foreground mt-1" dir="ltr">
                        {videoUploading
                          ? `Uploading... ${videoProgress}%`
                          : videoProgress === 100
                            ? 'Uploaded 100%' :'✓ جاهز للرفع'}
                      </p>
                    </div>
                  </div>
                </div>
              )}

              {!videoFile && (
                <div className="mt-3">
                  <label className="block text-xs font-medium text-muted-foreground mb-1">{ap.mediaVideoUrl}</label>
                  <input
                    type="url"
                    value={videoUrlInput}
                    onChange={e => setVideoUrlInput(e.target.value)}
                    placeholder={ap.mediaVideoUrlPlaceholder}
                    className="w-full px-3 py-2.5 bg-background border border-border rounded-xl text-sm text-foreground placeholder:text-muted-foreground focus:outline-none focus:border-primary"
                    dir="ltr"
                  />
                  {videoUrlInput.trim() && /^https?:\/\//i.test(videoUrlInput.trim()) && /\.(mp4|webm)(\?.*)?$/i.test(videoUrlInput.trim()) && (
                    <video src={videoUrlInput.trim()} controls playsInline className="w-full max-h-64 mt-2 rounded-xl border border-border bg-black" />
                  )}
                </div>
              )}
            </div>
          </div>

          <button
            type="submit"
            disabled={loading}
            className="w-full px-4 py-3 bg-primary text-white rounded-xl text-sm font-semibold hover:bg-primary/90 transition-colors disabled:opacity-50 flex items-center justify-center gap-2 mt-2"
          >
            {loading ? (
              <>
                <div className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin" />
                {imageItems.length > 0 || videoFile ? ap.mediaUploading : ap.saving}
              </>
            ) : (
              <>
                <Icon name="CheckIcon" size={16} />
                {ap.submit}
              </>
            )}
          </button>
        </form>
      </main>
      <BottomNav />
    </div>
  );
}

export default function AddProductPage() {
  return (
    <React.Suspense fallback={<div className="min-h-screen bg-background flex items-center justify-center"><div className="w-8 h-8 border-4 border-primary border-t-transparent rounded-full animate-spin" /></div>}>
      <AddProductPageInner />
    </React.Suspense>
  );
}
