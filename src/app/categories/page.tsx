import React from 'react';
import Header from '@/components/Header';
import BottomNav from '@/components/BottomNav';
import CategoriesBrowser from '@/app/categories/components/CategoriesBrowser';
import { Metadata } from 'next';

export const metadata: Metadata = {
  title: 'All Categories — DirectHub B2B Marketplace',
  description: 'Browse all product categories on DirectHub. From pharmaceuticals to electronics, automotive to construction — find verified suppliers in every category.',
  alternates: { canonical: '/categories' },
};

export default function CategoriesPage() {
  return (
    <div className="min-h-screen bg-background">
      <Header />
      <main>
        <CategoriesBrowser />
      </main>
      <BottomNav />
    </div>
  );
}