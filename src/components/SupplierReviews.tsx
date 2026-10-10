'use client';

import React, { useState, useEffect, useCallback } from 'react';
import Icon from '@/components/ui/AppIcon';
import { createClient } from '@/lib/supabase/client';
import { useAuth } from '@/contexts/AuthContext';

interface Review {
  id: string;
  reviewer_id: string;
  rating: number;
  title: string;
  body: string;
  order_type: string;
  is_verified_purchase: boolean;
  helpful_count: number;
  created_at: string;
  reviewer_name?: string;
}

interface SupplierReviewsProps {
  supplierId: string;
  supplierName: string;
}

function StarRating({ value, onChange, size = 20 }: { value: number; onChange?: (v: number) => void; size?: number }) {
  const [hovered, setHovered] = useState(0);
  return (
    <div className="flex items-center gap-0.5">
      {[1, 2, 3, 4, 5].map((s) => (
        <button
          key={s}
          type="button"
          onClick={() => onChange?.(s)}
          onMouseEnter={() => onChange && setHovered(s)}
          onMouseLeave={() => onChange && setHovered(0)}
          className={onChange ? 'cursor-pointer' : 'cursor-default'}
          aria-label={`${s} star`}
        >
          <Icon
            name="StarIcon"
            size={size}
            variant="solid"
            className={s <= (hovered || value) ? 'text-amber-400' : 'text-muted'}
          />
        </button>
      ))}
    </div>
  );
}

export default function SupplierReviews({ supplierId, supplierName }: SupplierReviewsProps) {
  const { user } = useAuth();
  const [reviews, setReviews] = useState<Review[]>([]);
  const [loading, setLoading] = useState(true);
  const [showForm, setShowForm] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [submitted, setSubmitted] = useState(false);
  const [userReviewExists, setUserReviewExists] = useState(false);
  const [avgRating, setAvgRating] = useState(0);
  const [form, setForm] = useState({ rating: 0, title: '', body: '', order_type: '' });
  const [formError, setFormError] = useState('');

  const supabase = createClient();

  const fetchReviews = useCallback(async () => {
    setLoading(true);
    try {
      const { data } = await supabase
        .from('supplier_reviews')
        .select('*, user_profiles(full_name)')
        .eq('supplier_id', supplierId)
        .order('created_at', { ascending: false });

      if (data) {
        const mapped = data.map((r: any) => ({
          ...r,
          reviewer_name: r.user_profiles?.full_name || 'Anonymous',
        }));
        setReviews(mapped);
        const avg = mapped.length ? mapped.reduce((s: number, r: Review) => s + r.rating, 0) / mapped.length : 0;
        setAvgRating(avg);
        if (user) setUserReviewExists(mapped.some((r: Review) => r.reviewer_id === user.id));
      }
    } catch {
      // silently fail
    } finally {
      setLoading(false);
    }
  }, [supplierId, user]);

  useEffect(() => {
    fetchReviews();
  }, [fetchReviews]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setFormError('');
    if (!user) { setFormError('Please sign in to leave a review.'); return; }
    if (form.rating === 0) { setFormError('Please select a star rating.'); return; }
    if (!form.body.trim()) { setFormError('Please write a review.'); return; }

    setSubmitting(true);
    try {
      const { error } = await supabase.from('supplier_reviews').insert({
        supplier_id: supplierId,
        reviewer_id: user.id,
        rating: form.rating,
        title: form.title,
        body: form.body,
        order_type: form.order_type,
        is_verified_purchase: false,
      });
      if (error) {
        if (error.code === '23505') {
          setFormError('You have already reviewed this supplier.');
        } else {
          setFormError('Failed to submit review. Please try again.');
        }
      } else {
        setSubmitted(true);
        setShowForm(false);
        setForm({ rating: 0, title: '', body: '', order_type: '' });
        await fetchReviews();
      }
    } catch {
      setFormError('An unexpected error occurred.');
    } finally {
      setSubmitting(false);
    }
  };

  const ratingBreakdown = [5, 4, 3, 2, 1].map((star) => ({
    star,
    count: reviews.filter((r) => r.rating === star).length,
    pct: reviews.length ? (reviews.filter((r) => r.rating === star).length / reviews.length) * 100 : 0,
  }));

  return (
    <div className="mt-8">
      {/* Header */}
      <div className="flex items-center justify-between mb-5">
        <h2 className="text-lg font-extrabold text-foreground">
          Reviews &amp; Ratings
          <span className="ml-2 text-sm font-semibold text-muted-foreground">({reviews.length})</span>
        </h2>
        {user && !userReviewExists && !submitted && (
          <button
            onClick={() => setShowForm(!showForm)}
            className="flex items-center gap-1.5 px-4 py-2 bg-primary text-primary-foreground text-xs font-bold rounded-xl hover:opacity-90 transition-opacity"
          >
            <Icon name="PencilSquareIcon" size={14} />
            Write a Review
          </button>
        )}
        {!user && (
          <a href="/login?redirect=/suppliers" className="text-xs text-primary font-semibold hover:underline">
            Sign in to review
          </a>
        )}
      </div>

      {/* Summary */}
      {reviews.length > 0 && (
        <div className="bg-muted/40 border border-border rounded-2xl p-5 mb-6 flex flex-col sm:flex-row gap-6">
          <div className="flex flex-col items-center justify-center sm:w-32 shrink-0">
            <span className="text-4xl font-extrabold text-foreground">{avgRating.toFixed(1)}</span>
            <StarRating value={Math.round(avgRating)} size={16} />
            <span className="text-xs text-muted-foreground mt-1">{reviews.length} reviews</span>
          </div>
          <div className="flex-1 space-y-1.5">
            {ratingBreakdown.map(({ star, count, pct }) => (
              <div key={star} className="flex items-center gap-2">
                <span className="text-xs text-muted-foreground w-4 text-right">{star}</span>
                <Icon name="StarIcon" size={12} variant="solid" className="text-amber-400 shrink-0" />
                <div className="flex-1 h-2 bg-muted rounded-full overflow-hidden">
                  <div
                    className="h-full bg-amber-400 rounded-full transition-all duration-500"
                    style={{ width: `${pct}%` }}
                  />
                </div>
                <span className="text-xs text-muted-foreground w-4">{count}</span>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Write Review Form */}
      {showForm && (
        <div className="bg-card border border-primary/30 rounded-2xl p-5 mb-6">
          <h3 className="text-sm font-bold text-foreground mb-4">
            Review {supplierName}
          </h3>
          <form onSubmit={handleSubmit} className="space-y-4">
            <div>
              <label className="block text-xs font-semibold text-foreground mb-2">Overall Rating *</label>
              <StarRating value={form.rating} onChange={(v) => setForm({ ...form, rating: v })} size={24} />
            </div>
            <div>
              <label className="block text-xs font-semibold text-foreground mb-1.5">Review Title</label>
              <input
                type="text"
                value={form.title}
                onChange={(e) => setForm({ ...form, title: e.target.value })}
                placeholder="Summarize your experience"
                className="w-full h-10 px-3 text-sm bg-background border border-border rounded-lg text-foreground placeholder:text-muted-foreground focus:outline-none focus:border-primary focus:ring-1 focus:ring-primary/30"
              />
            </div>
            <div>
              <label className="block text-xs font-semibold text-foreground mb-1.5">Your Review *</label>
              <textarea
                value={form.body}
                onChange={(e) => setForm({ ...form, body: e.target.value })}
                placeholder="Share your experience with this supplier — quality, communication, delivery..."
                rows={4}
                className="w-full px-3 py-2.5 text-sm bg-background border border-border rounded-lg text-foreground placeholder:text-muted-foreground focus:outline-none focus:border-primary focus:ring-1 focus:ring-primary/30 resize-none"
              />
            </div>
            <div>
              <label className="block text-xs font-semibold text-foreground mb-1.5">Order Type</label>
              <select
                value={form.order_type}
                onChange={(e) => setForm({ ...form, order_type: e.target.value })}
                className="w-full h-10 px-3 text-sm bg-background border border-border rounded-lg text-foreground focus:outline-none focus:border-primary appearance-none"
              >
                <option value="">Select order type</option>
                <option value="Bulk Order">Bulk Order</option>
                <option value="Sample Order">Sample Order</option>
                <option value="RFQ">RFQ</option>
                <option value="Direct Purchase">Direct Purchase</option>
              </select>
            </div>
            {formError && (
              <p className="text-xs text-red-500 font-medium">{formError}</p>
            )}
            <div className="flex gap-3">
              <button
                type="submit"
                disabled={submitting}
                className="flex-1 py-2.5 bg-primary text-primary-foreground text-sm font-bold rounded-xl hover:opacity-90 transition-opacity disabled:opacity-60 flex items-center justify-center gap-2"
              >
                {submitting ? (
                  <div className="w-4 h-4 border-2 border-primary-foreground border-t-transparent rounded-full animate-spin" />
                ) : (
                  <Icon name="PaperAirplaneIcon" size={14} />
                )}
                Submit Review
              </button>
              <button
                type="button"
                onClick={() => { setShowForm(false); setFormError(''); }}
                className="px-4 py-2.5 border border-border text-foreground text-sm font-semibold rounded-xl hover:bg-muted transition-colors"
              >
                Cancel
              </button>
            </div>
          </form>
        </div>
      )}

      {submitted && (
        <div className="flex items-center gap-3 p-4 bg-green-50 border border-green-200 rounded-xl mb-5">
          <Icon name="CheckBadgeIcon" size={18} className="text-green-600 shrink-0" />
          <p className="text-sm text-green-700 font-medium">Your review has been submitted successfully!</p>
        </div>
      )}

      {/* Reviews list */}
      {loading ? (
        <div className="flex items-center justify-center py-10">
          <div className="w-6 h-6 border-2 border-primary border-t-transparent rounded-full animate-spin" />
        </div>
      ) : reviews.length === 0 ? (
        <div className="text-center py-10">
          <div className="w-12 h-12 rounded-xl bg-muted flex items-center justify-center mx-auto mb-3">
            <Icon name="StarIcon" size={24} className="text-muted-foreground" />
          </div>
          <p className="text-sm font-semibold text-foreground mb-1">No reviews yet</p>
          <p className="text-xs text-muted-foreground">Be the first to review this supplier.</p>
        </div>
      ) : (
        <div className="space-y-4">
          {reviews.map((review) => (
            <div key={review.id} className="bg-card border border-border rounded-2xl p-5">
              <div className="flex items-start justify-between gap-3 mb-3">
                <div className="flex items-center gap-3">
                  <div className="w-9 h-9 rounded-full bg-primary/10 flex items-center justify-center text-primary font-bold text-sm shrink-0">
                    {(review.reviewer_name || 'A').charAt(0).toUpperCase()}
                  </div>
                  <div>
                    <p className="text-sm font-semibold text-foreground">{review.reviewer_name}</p>
                    <div className="flex items-center gap-2 mt-0.5">
                      <StarRating value={review.rating} size={12} />
                      {review.is_verified_purchase && (
                        <span className="text-[10px] text-green-600 font-semibold flex items-center gap-0.5">
                          <Icon name="CheckBadgeIcon" size={10} />
                          Verified
                        </span>
                      )}
                    </div>
                  </div>
                </div>
                <div className="text-right shrink-0">
                  <p className="text-xs text-muted-foreground">
                    {new Date(review.created_at).toLocaleDateString('en-US', { year: 'numeric', month: 'short', day: 'numeric' })}
                  </p>
                  {review.order_type && (
                    <span className="text-[10px] bg-muted text-muted-foreground px-1.5 py-0.5 rounded mt-0.5 inline-block">
                      {review.order_type}
                    </span>
                  )}
                </div>
              </div>
              {review.title && (
                <p className="text-sm font-bold text-foreground mb-1">{review.title}</p>
              )}
              <p className="text-sm text-muted-foreground leading-relaxed">{review.body}</p>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
