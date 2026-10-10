'use client';

import { useEffect, useRef, useState, Suspense } from 'react';
import { usePathname, useSearchParams } from 'next/navigation';

function NavigationProgressInner() {
  const pathname = usePathname();
  const searchParams = useSearchParams();
  const [progress, setProgress] = useState(0);
  const [visible, setVisible] = useState(false);
  const timerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const rafRef = useRef<number | null>(null);

  useEffect(() => {
    // On route change: flash a fast progress bar
    setVisible(true);
    setProgress(0);

    // Quickly jump to 80% then complete
    let p = 0;
    const step = () => {
      p = p < 70 ? p + 12 : p < 90 ? p + 3 : p;
      setProgress(p);
      if (p < 90) {
        rafRef.current = requestAnimationFrame(step);
      }
    };
    rafRef.current = requestAnimationFrame(step);

    // Complete after a short delay
    timerRef.current = setTimeout(() => {
      setProgress(100);
      setTimeout(() => setVisible(false), 200);
    }, 120);

    return () => {
      if (timerRef.current) clearTimeout(timerRef.current);
      if (rafRef.current) cancelAnimationFrame(rafRef.current);
    };
  }, [pathname, searchParams]);

  if (!visible) return null;

  return (
    <div
      className="fixed top-0 left-0 right-0 z-[9999] h-[2px] pointer-events-none"
      aria-hidden="true"
    >
      <div
        className="h-full bg-primary"
        style={{
          width: `${progress}%`,
          transition: progress === 100 ? 'width 0.1s ease-out' : 'width 0.08s linear',
        }}
      />
    </div>
  );
}

function NavigationProgressFallback() {
  return null;
}

export default function NavigationProgress() {
  const [mounted, setMounted] = useState(false);

  useEffect(() => {
    setMounted(true);
  }, []);

  if (!mounted) return null;

  return (
    <Suspense fallback={<NavigationProgressFallback />}>
      <NavigationProgressInner />
    </Suspense>
  );
}
