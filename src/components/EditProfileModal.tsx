'use client';

import React, { useState, useRef, useCallback } from 'react';
import AppImage from '@/components/ui/AppImage';
import Icon from '@/components/ui/AppIcon';
import { createClient } from '@/lib/supabase/client';
import { useLanguage } from '@/contexts/LanguageContext';
import { stripMissingProfileColumns } from '@/lib/fetchUserProfile';

const COUNTRY_DIAL_CODES: Record<string, string> = {
  'Qatar': '+974', 'Saudi Arabia': '+966', 'United Arab Emirates': '+971',
  'Kuwait': '+965', 'Bahrain': '+973', 'Oman': '+968', 'Jordan': '+962',
  'Egypt': '+20', 'Iraq': '+964', 'Lebanon': '+961', 'Syria': '+963',
  'Yemen': '+967', 'Libya': '+218', 'Tunisia': '+216', 'Algeria': '+213',
  'Morocco': '+212', 'Sudan': '+249', 'Turkey': '+90', 'Iran': '+98',
  'Pakistan': '+92', 'India': '+91', 'China': '+86', 'United States': '+1',
  'United Kingdom': '+44', 'Germany': '+49', 'France': '+33', 'Italy': '+39',
  'Spain': '+34', 'Russia': '+7', 'Brazil': '+55', 'Australia': '+61',
  'Canada': '+1', 'Japan': '+81', 'South Korea': '+82', 'Indonesia': '+62',
  'Malaysia': '+60', 'Singapore': '+65', 'Thailand': '+66', 'Vietnam': '+84',
  'Philippines': '+63', 'Bangladesh': '+880', 'Nigeria': '+234',
  'South Africa': '+27', 'Kenya': '+254', 'Ethiopia': '+251', 'Ghana': '+233',
  'Tanzania': '+255', 'Uganda': '+256', 'Mexico': '+52', 'Argentina': '+54',
  'Colombia': '+57', 'Chile': '+56', 'Peru': '+51', 'Netherlands': '+31',
  'Belgium': '+32', 'Sweden': '+46', 'Norway': '+47', 'Denmark': '+45',
  'Finland': '+358', 'Poland': '+48', 'Ukraine': '+380', 'Romania': '+40',
  'Greece': '+30', 'Portugal': '+351', 'Czech Republic': '+420',
  'Hungary': '+36', 'Austria': '+43', 'Switzerland': '+41', 'Israel': '+972',
  'Afghanistan': '+93', 'Sri Lanka': '+94', 'Nepal': '+977', 'Myanmar': '+95',
  'Cambodia': '+855', 'New Zealand': '+64',
};

const COUNTRY_LIST = Object.keys(COUNTRY_DIAL_CODES).sort();

// Dynamic city lists per country
const COUNTRY_CITIES: Record<string, string[]> = {
  'Yemen': ['صنعاء', 'عدن', 'تعز', 'الحديدة', 'إب', 'ذمار', 'المكلا', 'حضرموت', 'سيئون', 'صعدة', 'عمران', 'البيضاء', 'مأرب', 'شبوة', 'أبين', 'لحج', 'الضالع', 'ريمة', 'المهرة', 'حجة'],
  'Saudi Arabia': ['الرياض', 'جدة', 'مكة المكرمة', 'المدينة المنورة', 'الدمام', 'الخبر', 'الطائف', 'تبوك', 'بريدة', 'خميس مشيط', 'أبها', 'نجران', 'جيزان', 'حائل', 'الجبيل', 'ينبع', 'الأحساء', 'القطيف', 'عرعر', 'سكاكا'],
  'Iraq': ['بغداد', 'البصرة', 'الموصل', 'أربيل', 'كركوك', 'النجف', 'كربلاء', 'الحلة', 'الناصرية', 'العمارة', 'الكوت', 'الرمادي', 'تكريت', 'الفلوجة', 'السليمانية', 'دهوك', 'سامراء', 'بعقوبة', 'الديوانية', 'الكوفة'],
  'Egypt': ['القاهرة', 'الإسكندرية', 'الجيزة', 'شبرا الخيمة', 'بورسعيد', 'السويس', 'المنصورة', 'الإسماعيلية', 'الفيوم', 'الزقازيق', 'أسيوط', 'طنطا', 'المنيا', 'سوهاج', 'قنا', 'الأقصر', 'أسوان', 'دمياط', 'بني سويف', 'شرم الشيخ'],
};

function getDialCode(country: string): string {
  if (!country) return '';
  const trimmed = country.trim();
  if (COUNTRY_DIAL_CODES[trimmed]) return COUNTRY_DIAL_CODES[trimmed];
  const lower = trimmed.toLowerCase();
  const found = Object.entries(COUNTRY_DIAL_CODES).find(([k]) => k.toLowerCase() === lower);
  if (found) return found[1];
  const partial = Object.entries(COUNTRY_DIAL_CODES).find(([k]) => k.toLowerCase().includes(lower) || lower.includes(k.toLowerCase()));
  return partial ? partial[1] : '';
}

export interface EditProfileData {
  id: string;
  full_name: string;
  company_name: string | null;
  country: string | null;
  city: string | null;
  phone: string | null;
  avatar_url: string | null;
  cover_url: string | null;
  email?: string;
}

interface EditProfileModalProps {
  profile: EditProfileData;
  userEmail?: string;
  onClose: () => void;
  onSuccess: (updated: EditProfileData) => void;
}

const EditProfileModal: React.FC<EditProfileModalProps> = ({ profile, userEmail, onClose, onSuccess }) => {
  const { t, dir, isRTL } = useLanguage();
  const ui = t.editProfile;
  const supabase = createClient();

  const initialDialCode = getDialCode(profile.country || '');
  const storedPhone = profile.phone || '';

  /**
   * Strip any known dial code prefix from a raw phone string.
   * Handles formats: "+967712345678", "+967 712345678", "00967712345678", "967712345678" (when code is "967")
   */
  function stripDialCodeFromPhone(raw: string, code: string): string {
    if (!raw) return '';
    const trimmed = raw.trim();

    // Format 1: starts with the full dial code (e.g. "+967")
    if (code && trimmed.startsWith(code)) {
      return trimmed.slice(code.length).trim();
    }

    // Format 2: starts with "00" + digits of the code (e.g. "00967" for "+967")
    if (code && code.startsWith('+')) {
      const digits = code.slice(1); // "967"
      const ooPrefix = '00' + digits;
      if (trimmed.startsWith(ooPrefix)) {
        return trimmed.slice(ooPrefix.length).trim();
      }
    }

    // Format 3: generic +XXX prefix matching any known dial code
    const plusMatch = trimmed.match(/^(\+\d{1,4})\s*/);
    if (plusMatch) {
      const possibleCode = plusMatch[1];
      if (Object.values(COUNTRY_DIAL_CODES).includes(possibleCode)) {
        return trimmed.slice(plusMatch[0].length).trim();
      }
    }

    // Format 4: generic 00XXX prefix matching any known dial code
    const ooMatch = trimmed.match(/^(00\d{1,4})\s*/);
    if (ooMatch) {
      const possiblePlus = '+' + ooMatch[1].slice(2);
      if (Object.values(COUNTRY_DIAL_CODES).includes(possiblePlus)) {
        return trimmed.slice(ooMatch[0].length).trim();
      }
    }

    return trimmed;
  }

  const initialLocal = stripDialCodeFromPhone(storedPhone, initialDialCode);

  const [form, setForm] = useState({
    full_name: profile.full_name || '',
    company_name: profile.company_name || '',
    country: profile.country || '',
    city: profile.city || '',
    phone_local: initialLocal,
  });

  const [dialCode, setDialCode] = useState(initialDialCode);
  const [showCountryDropdown, setShowCountryDropdown] = useState(false);
  const [showCityDropdown, setShowCityDropdown] = useState(false);
  const [countrySearch, setCountrySearch] = useState('');
  const [citySearch, setCitySearch] = useState('');
  const [avatarPreview, setAvatarPreview] = useState<string | null>(profile.avatar_url || null);
  const [coverPreview, setCoverPreview] = useState<string | null>(profile.cover_url || null);
  const [avatarFile, setAvatarFile] = useState<File | null>(null);
  const [coverFile, setCoverFile] = useState<File | null>(null);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [uploadingAvatar, setUploadingAvatar] = useState(false);
  const [uploadingCover, setUploadingCover] = useState(false);

  const avatarInputRef = useRef<HTMLInputElement>(null);
  const coverInputRef = useRef<HTMLInputElement>(null);

  const filteredCountries = COUNTRY_LIST.filter(c =>
    c.toLowerCase().includes(countrySearch.toLowerCase())
  );

  const handleCountrySelect = (country: string) => {
    setForm((p) => ({ ...p, country, city: '' })); // reset city when country changes
    setDialCode(getDialCode(country));
    setShowCountryDropdown(false);
    setCountrySearch('');
  };

  const handleCountryInputChange = (val: string) => {
    setForm((p) => ({ ...p, country: val, city: '' }));
    setDialCode(getDialCode(val));
    setCountrySearch(val);
    setShowCountryDropdown(true);
  };

  const handleImageSelect = useCallback((
    e: React.ChangeEvent<HTMLInputElement>,
    type: 'avatar' | 'cover'
  ) => {
    const file = e.target.files?.[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onload = (ev) => {
      const result = ev.target?.result as string;
      if (type === 'avatar') { setAvatarPreview(result); setAvatarFile(file); }
      else { setCoverPreview(result); setCoverFile(file); }
    };
    reader.readAsDataURL(file);
    e.target.value = '';
  }, []);

  const uploadImage = async (file: File, userId: string, kind: 'avatar' | 'cover'): Promise<string> => {
    const ext = file.name.split('.').pop()?.toLowerCase() || 'jpg';
    // Path must start with auth.uid() so storage UPDATE/DELETE RLS matches folder[1]
    const path = `${userId}/${kind}-${Date.now()}.${ext}`;
    const { error: uploadError } = await supabase.storage
      .from('chat-media')
      .upload(path, file, { upsert: false, contentType: file.type });
    if (uploadError) throw uploadError;
    const { data } = supabase.storage.from('chat-media').getPublicUrl(path);
    return data.publicUrl;
  };

  const handleSave = async () => {
    if (!form.full_name.trim()) {
      setError(ui.fullNameRequired);
      return;
    }
    setSaving(true);
    setError(null);
    try {
      let newAvatarUrl = profile.avatar_url;
      let newCoverUrl = profile.cover_url;

      if (avatarFile) {
        setUploadingAvatar(true);
        newAvatarUrl = await uploadImage(avatarFile, profile.id, 'avatar');
        setUploadingAvatar(false);
      }
      if (coverFile) {
        setUploadingCover(true);
        newCoverUrl = await uploadImage(coverFile, profile.id, 'cover');
        setUploadingCover(false);
      }

      // Build phone: always store as "{dialCode} {localNumber}" — never duplicate
      const localTrimmed = form.phone_local.trim();
      let fullPhone = '';
      if (localTrimmed) {
        // Strip any dial code the user may have typed manually (all formats)
        const cleanLocal = stripDialCodeFromPhone(localTrimmed, dialCode);
        fullPhone = dialCode ? `${dialCode} ${cleanLocal}` : cleanLocal;
      }

      const updates: Record<string, unknown> = {
        full_name: form.full_name.trim(),
        company_name: form.company_name.trim() || null,
        country: form.country.trim() || null,
        city: form.city.trim() || null,
        phone: fullPhone || null,
        avatar_url: newAvatarUrl,
        cover_photo_url: newCoverUrl,
        cover_url: newCoverUrl,
      };

      let dbError: { message: string } | null = null;
      let payload: Record<string, unknown> | null = updates;
      for (let i = 0; i < 6 && payload; i++) {
        const result = await supabase
          .from('user_profiles')
          .update(payload)
          .eq('id', profile.id);
        dbError = result.error;
        if (!dbError) break;
        payload = stripMissingProfileColumns(payload, dbError.message || '');
      }

      if (dbError) throw dbError;
      onSuccess({ ...profile, ...updates } as EditProfileData);
    } catch (err: any) {
      setUploadingAvatar(false);
      setUploadingCover(false);
      setError(err.message || ui.saveFailed);
    } finally {
      setSaving(false);
    }
  };

  return (
    <div
      className="fixed inset-0 z-50 flex flex-col bg-background"
      dir={dir}
    >
      {/* ── Header ── */}
      <div className="flex items-center justify-between px-5 py-4 border-b border-border shrink-0 bg-card shadow-sm">
        <div className="flex items-center gap-3">
          <button
            onClick={onClose}
            className="w-9 h-9 flex items-center justify-center rounded-xl hover:bg-muted transition-colors"
            aria-label="Close"
          >
            <Icon name={isRTL ? 'ArrowRightIcon' : 'ArrowLeftIcon'} size={18} className="text-foreground" />
          </button>
          <div>
            <h2 className="text-base font-extrabold text-foreground leading-tight">
              {ui.title}
            </h2>
            <p className="text-[11px] text-muted-foreground">
              {ui.subtitle}
            </p>
          </div>
        </div>
        <button
          onClick={handleSave}
          disabled={saving || !form.full_name.trim()}
          className="px-5 py-2 bg-primary text-primary-foreground text-sm font-extrabold rounded-xl hover:opacity-90 transition-opacity disabled:opacity-50 flex items-center gap-2 shadow-md shadow-primary/20"
        >
          {saving ? (
            <div className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin" />
          ) : (
            <Icon name="CheckIcon" size={15} />
          )}
          {saving ? ui.saving : ui.save}
        </button>
      </div>

      {/* ── Scrollable body ── */}
      <div className="overflow-y-auto flex-1 pb-8">

        {/* Cover photo */}
        <div className="relative h-40 bg-gradient-to-br from-primary/20 via-orange-100 to-amber-50 overflow-hidden">
          {coverPreview && (
            <AppImage src={coverPreview} alt="Cover" fill className="object-cover" />
          )}
          <div className="absolute inset-0 bg-black/10" />
          <button
            type="button"
            onClick={() => coverInputRef.current?.click()}
            className="absolute bottom-3 end-3 flex items-center gap-1.5 px-3 py-1.5 bg-black/50 hover:bg-black/70 text-white text-xs font-bold rounded-xl transition-colors backdrop-blur-sm"
          >
            <Icon name="CameraIcon" size={13} />
            {uploadingCover ? ui.uploading : ui.changeCover}
          </button>
          <input ref={coverInputRef} type="file" accept="image/jpeg,image/png,image/webp" className="hidden" onChange={(e) => handleImageSelect(e, 'cover')} />
        </div>

        <div className="px-4 md:px-6 max-w-2xl mx-auto">

          {/* Avatar */}
          <div className="relative -mt-12 mb-6 w-fit">
            <div className="w-24 h-24 rounded-2xl overflow-hidden border-4 border-background bg-muted flex items-center justify-center shadow-lg">
              {avatarPreview ? (
                <AppImage src={avatarPreview} alt="Profile" width={96} height={96} className="object-cover w-full h-full" />
              ) : (
                <span className="text-3xl font-extrabold text-primary">
                  {form.full_name.charAt(0).toUpperCase() || '?'}
                </span>
              )}
            </div>
            <button
              type="button"
              onClick={() => avatarInputRef.current?.click()}
              className="absolute -bottom-1 -end-1 w-8 h-8 bg-primary text-primary-foreground rounded-full flex items-center justify-center shadow-md hover:opacity-90 transition-opacity border-2 border-background"
              aria-label={ui.changePhoto}
            >
              {uploadingAvatar
                ? <div className="w-3.5 h-3.5 border-2 border-white border-t-transparent rounded-full animate-spin" />
                : <Icon name="CameraIcon" size={14} />
              }
            </button>
            <input ref={avatarInputRef} type="file" accept="image/jpeg,image/png,image/webp" className="hidden" onChange={(e) => handleImageSelect(e, 'avatar')} />
          </div>

          {/* Error */}
          {error && (
            <div className="mb-5 flex items-center gap-2 px-4 py-3 bg-red-50 border border-red-200 text-red-700 rounded-xl text-sm font-medium">
              <Icon name="ExclamationCircleIcon" size={16} />
              {error}
            </div>
          )}

          {/* ── Section: Personal Info ── */}
          <div className="mb-5">
            <div className="flex items-center gap-2 mb-3">
              <div className="w-7 h-7 rounded-lg bg-blue-100 flex items-center justify-center shrink-0">
                <Icon name="UserCircleIcon" size={15} className="text-blue-600" />
              </div>
              <h3 className="text-sm font-extrabold text-foreground">
                {ui.personalInfo}
              </h3>
            </div>
            <div className="bg-card border border-border rounded-2xl overflow-hidden divide-y divide-border">
              {/* Full Name */}
              <div className="px-4 py-3">
                <label className="block text-[11px] font-bold text-muted-foreground mb-1.5 uppercase tracking-wide">
                  {ui.fullName} <span className="text-red-500">*</span>
                </label>
                <input
                  type="text"
                  value={form.full_name}
                  onChange={(e) => setForm((p) => ({ ...p, full_name: e.target.value }))}
                  className="w-full text-sm font-semibold text-foreground bg-transparent focus:outline-none placeholder:text-muted-foreground/50"
                  placeholder={ui.fullNamePlaceholder}
                />
              </div>
              {/* Email (read-only) */}
              <div className="px-4 py-3">
                <label className="block text-[11px] font-bold text-muted-foreground mb-1.5 uppercase tracking-wide">
                  {ui.email}
                </label>
                <div className="flex items-center gap-2">
                  <input
                    type="email"
                    defaultValue={userEmail || ''}
                    disabled
                    className="flex-1 text-sm font-semibold text-muted-foreground bg-transparent focus:outline-none cursor-not-allowed"
                  />
                  <span className="flex items-center gap-1 text-[10px] font-bold text-muted-foreground bg-muted px-2 py-0.5 rounded-full shrink-0">
                    <Icon name="LockClosedIcon" size={10} />
                    {ui.fixed}
                  </span>
                </div>
              </div>
            </div>
          </div>

          {/* ── Section: Company ── */}
          <div className="mb-5">
            <div className="flex items-center gap-2 mb-3">
              <div className="w-7 h-7 rounded-lg bg-orange-100 flex items-center justify-center shrink-0">
                <Icon name="BuildingOfficeIcon" size={15} className="text-orange-600" />
              </div>
              <h3 className="text-sm font-extrabold text-foreground">
                {ui.companyInfo}
              </h3>
            </div>
            <div className="bg-card border border-border rounded-2xl overflow-hidden">
              <div className="px-4 py-3">
                <label className="block text-[11px] font-bold text-muted-foreground mb-1.5 uppercase tracking-wide">
                  {ui.companyName}
                </label>
                <input
                  type="text"
                  value={form.company_name}
                  onChange={(e) => setForm((p) => ({ ...p, company_name: e.target.value }))}
                  className="w-full text-sm font-semibold text-foreground bg-transparent focus:outline-none placeholder:text-muted-foreground/50"
                  placeholder={ui.companyPlaceholder}
                />
              </div>
            </div>
          </div>

          {/* ── Section: Location & Contact ── */}
          <div className="mb-5">
            <div className="flex items-center gap-2 mb-3">
              <div className="w-7 h-7 rounded-lg bg-green-100 flex items-center justify-center shrink-0">
                <Icon name="MapPinIcon" size={15} className="text-green-600" />
              </div>
              <h3 className="text-sm font-extrabold text-foreground">
                {ui.locationContact}
              </h3>
            </div>
            <div className="bg-card border border-border rounded-2xl overflow-hidden divide-y divide-border">
              {/* Country with dropdown */}
              <div className="px-4 py-3 relative">
                <label className="block text-[11px] font-bold text-muted-foreground mb-1.5 uppercase tracking-wide">
                  {ui.country}
                </label>
                <div className="flex items-center gap-2">
                  <Icon name="GlobeAltIcon" size={15} className="text-muted-foreground shrink-0" />
                  <input
                    type="text"
                    value={form.country}
                    onChange={(e) => handleCountryInputChange(e.target.value)}
                    onFocus={() => { setShowCountryDropdown(true); setCountrySearch(form.country); }}
                    onBlur={() => setTimeout(() => setShowCountryDropdown(false), 200)}
                    className="flex-1 text-sm font-semibold text-foreground bg-transparent focus:outline-none placeholder:text-muted-foreground/50"
                    placeholder={ui.selectCountry}
                    autoComplete="off"
                  />
                  {dialCode && (
                    <span className="text-xs font-extrabold text-primary bg-primary/10 px-2 py-0.5 rounded-full shrink-0">
                      {dialCode}
                    </span>
                  )}
                </div>
                {/* Country dropdown */}
                {showCountryDropdown && filteredCountries.length > 0 && (
                  <div className="absolute start-0 end-0 top-full mt-1 z-50 bg-card border border-border rounded-xl shadow-xl overflow-hidden max-h-48 overflow-y-auto">
                    {filteredCountries.slice(0, 20).map((country) => (
                      <button
                        key={country}
                        type="button"
                        onMouseDown={() => handleCountrySelect(country)}
                        className="w-full flex items-center justify-between px-4 py-2.5 hover:bg-muted transition-colors text-sm font-medium text-foreground text-start"
                      >
                        <span>{country}</span>
                        <span className="text-xs font-bold text-muted-foreground">{COUNTRY_DIAL_CODES[country]}</span>
                      </button>
                    ))}
                  </div>
                )}
              </div>

              {/* Phone — directly below country */}
              <div className="px-4 py-3">
                <label className="block text-[11px] font-bold text-muted-foreground mb-1.5 uppercase tracking-wide">
                  {ui.phone}
                </label>
                <div className="flex items-center gap-2">
                  <div className="flex items-center gap-1.5 shrink-0">
                    <Icon name="PhoneIcon" size={14} className="text-muted-foreground" />
                    <span className={`text-sm font-extrabold min-w-[44px] ${dialCode ? 'text-primary' : 'text-muted-foreground'}`}>
                      {dialCode || '—'}
                    </span>
                    <div className="w-px h-4 bg-border" />
                  </div>
                  <input
                    type="tel"
                    value={form.phone_local}
                    onChange={(e) => setForm((p) => ({ ...p, phone_local: e.target.value }))}
                    placeholder={dialCode ? ui.localNumber : ui.enterCountryFirst}
                    className="flex-1 text-sm font-semibold text-foreground bg-transparent focus:outline-none placeholder:text-muted-foreground/50"
                    dir="ltr"
                  />
                </div>
                {dialCode && (
                  <p className="text-[10px] text-muted-foreground mt-1.5 flex items-center gap-1">
                    <Icon name="InformationCircleIcon" size={10} />
                    {ui.dialCodeAuto.replace('{code}', dialCode)}
                  </p>
                )}
              </div>

              {/* City — dynamic dropdown based on selected country */}
              <div className="px-4 py-3 relative">
                <label className="block text-[11px] font-bold text-muted-foreground mb-1.5 uppercase tracking-wide">
                  {ui.city}
                </label>
                {COUNTRY_CITIES[form.country] ? (
                  <div className="relative">
                    <div className="flex items-center gap-2">
                      <Icon name="BuildingStorefrontIcon" size={14} className="text-muted-foreground shrink-0" />
                      <input
                        type="text"
                        value={form.city}
                        onChange={(e) => { setForm((p) => ({ ...p, city: e.target.value })); setCitySearch(e.target.value); setShowCityDropdown(true); }}
                        onFocus={() => { setShowCityDropdown(true); setCitySearch(''); }}
                        onBlur={() => setTimeout(() => setShowCityDropdown(false), 200)}
                        className="flex-1 text-sm font-semibold text-foreground bg-transparent focus:outline-none placeholder:text-muted-foreground/50"
                        placeholder={ui.cityPlaceholder || 'اختر المدينة...'}
                        autoComplete="off"
                      />
                      <Icon name="ChevronDownIcon" size={13} className="text-muted-foreground shrink-0" />
                    </div>
                    {showCityDropdown && (
                      <div className="absolute start-0 end-0 top-full mt-1 z-50 bg-card border border-border rounded-xl shadow-xl overflow-hidden max-h-48 overflow-y-auto">
                        {(COUNTRY_CITIES[form.country] || [])
                          .filter(c => !citySearch || c.toLowerCase().includes(citySearch.toLowerCase()))
                          .map((city) => (
                            <button
                              key={city}
                              type="button"
                              onMouseDown={() => { setForm((p) => ({ ...p, city })); setShowCityDropdown(false); setCitySearch(''); }}
                              className="w-full flex items-center px-4 py-2.5 hover:bg-muted transition-colors text-sm font-medium text-foreground text-start"
                            >
                              {city}
                            </button>
                          ))}
                      </div>
                    )}
                  </div>
                ) : (
                  <div className="flex items-center gap-2">
                    <Icon name="BuildingStorefrontIcon" size={14} className="text-muted-foreground shrink-0" />
                    <input
                      type="text"
                      value={form.city}
                      onChange={(e) => setForm((p) => ({ ...p, city: e.target.value }))}
                      className="flex-1 text-sm font-semibold text-foreground bg-transparent focus:outline-none placeholder:text-muted-foreground/50"
                      placeholder={ui.cityPlaceholder}
                    />
                  </div>
                )}
              </div>
            </div>
          </div>

        </div>
      </div>

      {/* ── Footer ── */}
      <div
        className="px-4 md:px-6 py-4 border-t border-border flex gap-3 shrink-0 bg-card max-w-2xl mx-auto w-full"
        style={{ paddingBottom: 'max(1rem, env(safe-area-inset-bottom))' }}
      >
        <button
          onClick={onClose}
          disabled={saving}
          className="flex-1 py-3 border border-border text-sm font-bold rounded-xl hover:bg-muted transition-colors text-foreground disabled:opacity-50"
        >
          {ui.cancel}
        </button>
        <button
          onClick={handleSave}
          disabled={saving || !form.full_name.trim()}
          className="flex-[2] py-3 bg-primary text-primary-foreground text-sm font-extrabold rounded-xl hover:opacity-90 transition-opacity disabled:opacity-50 flex items-center justify-center gap-2 shadow-md shadow-primary/30"
        >
          {saving ? (
            <>
              <div className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin" />
              {ui.saving}
            </>
          ) : (
            <>
              <Icon name="CheckIcon" size={16} />
              {ui.saveChanges}
            </>
          )}
        </button>
      </div>
    </div>
  );
};

export default EditProfileModal;
