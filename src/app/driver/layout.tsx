import type { Metadata } from 'next';
import React from 'react';

export const metadata: Metadata = {
  title: 'بوابة السائق | DirectHub',
  robots: { index: false, follow: false },
};

export default function DriverLayout({ children }: { children: React.ReactNode }) {
  return <>{children}</>;
}
