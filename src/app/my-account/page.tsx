import React from 'react';
import Header from '@/components/Header';
import Footer from '@/components/Footer';
import BottomNav from '@/components/BottomNav';
import AccountDashboard from '@/app/my-account/components/AccountDashboard';
import { Metadata } from 'next';

export const metadata: Metadata = {
  title: 'My Account — DirectHub',
  description: 'Manage your DirectHub account, view orders, manage products, and update your verified trader or manufacturer profile.',
  alternates: { canonical: '/my-account' },
};

export default function MyAccountPage() {
  return (
    <div className="min-h-screen bg-background">
      <Header />
      <main>
        <AccountDashboard />
      </main>
      <Footer />
      <BottomNav />
    </div>
  );
}