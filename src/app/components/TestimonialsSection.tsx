'use client';

import React, { useEffect, useState } from 'react';
import Icon from '@/components/ui/AppIcon';
import { createClient } from '@/lib/supabase/client';

interface Review {
  id: string;
  reviewer_name: string;
  reviewer_company: string;
  reviewer_country: string;
  rating: number;
  comment: string;
  created_at: string;
}

const TestimonialsSection: React.FC = () => {
  const [reviews, setReviews] = useState<Review[]>([]);
  const [loading, setLoading] = useState(true);
  const [idx, setIdx] = useState(0);
  const supabase = createClient();

  useEffect(() => {
    const fetchReviews = async () => {
      try {
        const { data } = await supabase
          .from('product_reviews')
          .select('id, rating, body, created_at, user_profiles!product_reviews_reviewer_id_fkey(full_name, company_name, country)')
          .gte('rating', 4)
          .order('created_at', { ascending: false })
          .limit(5);

        if (data && data.length > 0) {
          const mapped: Review[] = data.map((r: any) => ({
            id: r.id,
            reviewer_name: r.user_profiles?.full_name || 'مستخدم موثّق',
            reviewer_company: r.user_profiles?.company_name || '',
            reviewer_country: r.user_profiles?.country || '',
            rating: r.rating,
            comment: r.body || '',
            created_at: r.created_at,
          }));
          setReviews(mapped);
        }
      } catch {
        // no reviews
      } finally {
        setLoading(false);
      }
    };
    fetchReviews();
  }, []);

  if (loading) return null;

  if (reviews.length === 0) {
    return (
      <section className="bg-background py-16 border-b border-border">
        <div className="max-w-5xl mx-auto px-4 md:px-6 text-center">
          <span className="text-xs font-bold uppercase tracking-widest text-muted-foreground block mb-3 border-b border-border w-fit mx-auto pb-2">
            04 — Trader Stories · قصص التجار
          </span>
          <h2 className="text-section-title font-extrabold text-foreground mb-4">
            Real Results.<br />
            <span className="text-muted-foreground font-light italic">Real Traders.</span>
          </h2>
          <p className="text-sm text-muted-foreground">لا توجد تقييمات حالياً — كن أول من يشارك تجربته.</p>
        </div>
      </section>
    );
  }

  const current = reviews[idx];

  return (
    <section className="bg-background py-16 border-b border-border">
      <div className="max-w-5xl mx-auto px-4 md:px-6">
        <div className="text-center mb-12">
          <span className="text-xs font-bold uppercase tracking-widest text-muted-foreground block mb-3 border-b border-border w-fit mx-auto pb-2">
            04 — Trader Stories · قصص التجار
          </span>
          <h2 className="text-section-title font-extrabold text-foreground">
            Real Results.<br />
            <span className="text-muted-foreground font-light italic">Real Traders.</span>
          </h2>
        </div>

        <div className="max-w-2xl mx-auto">
          {/* Stars */}
          <div className="flex items-center gap-1 mb-5 justify-center">
            {[1,2,3,4,5].map(s => (
              <Icon key={s} name="StarIcon" size={18} variant="solid" className={s <= current.rating ? 'text-yellow-400' : 'text-muted'} />
            ))}
          </div>

          {/* Quote */}
          <blockquote className="text-xl md:text-2xl font-extrabold leading-snug tracking-tight text-foreground mb-6 text-center">
            {current.comment}
          </blockquote>

          <div className="text-center mb-8">
            <p className="text-sm font-bold text-foreground">{current.reviewer_name}</p>
            {current.reviewer_company && (
              <p className="text-xs text-muted-foreground font-medium">{current.reviewer_company}{current.reviewer_country ? ` · ${current.reviewer_country}` : ''}</p>
            )}
          </div>

          {/* Controls */}
          {reviews.length > 1 && (
            <div className="flex items-center justify-center gap-4">
              <button
                onClick={() => setIdx((idx - 1 + reviews.length) % reviews.length)}
                className="w-10 h-10 border border-border flex items-center justify-center hover:bg-muted transition-colors text-muted-foreground hover:text-foreground rounded-xl"
                aria-label="Previous testimonial">
                <Icon name="ChevronLeftIcon" size={18} />
              </button>
              <div className="flex gap-2">
                {reviews.map((_, i) => (
                  <button
                    key={i}
                    onClick={() => setIdx(i)}
                    className={`w-2 h-2 rounded-full transition-all ${i === idx ? 'bg-primary w-6' : 'bg-border'}`}
                    aria-label={`Go to testimonial ${i + 1}`} />
                ))}
              </div>
              <button
                onClick={() => setIdx((idx + 1) % reviews.length)}
                className="w-10 h-10 border border-border flex items-center justify-center hover:bg-muted transition-colors text-muted-foreground hover:text-foreground rounded-xl"
                aria-label="Next testimonial">
                <Icon name="ChevronRightIcon" size={18} />
              </button>
            </div>
          )}
        </div>
      </div>
    </section>
  );
};

export default TestimonialsSection;