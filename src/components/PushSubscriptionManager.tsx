'use client';

import { useEffect, useRef } from 'react';
import { useAuth } from '@/contexts/AuthContext';

/**
 * PushSubscriptionManager
 *
 * Runs silently in the background for every logged-in user.
 * 1. Waits for the Service Worker to be ready.
 * 2. Checks if the browser already has a push subscription.
 * 3. If not (or if the existing subscription has no auth keys), creates one
 *    using the VAPID public key.
 * 4. ALWAYS POSTs the subscription to /api/push/subscribe so it is stored in
 *    push_subscriptions table — even if the browser already had a subscription.
 *    The server-side upsert handles deduplication safely.
 *
 * This component renders nothing — it is purely a side-effect runner.
 */
export default function PushSubscriptionManager() {
  const { user } = useAuth();
  const subscribedRef = useRef<string | null>(null);

  useEffect(() => {
    // Only run for logged-in users
    if (!user?.id) return;
    // Only run once per user session (track by user id to re-run on user change)
    if (subscribedRef.current === user.id) return;

    const vapidPublicKey = process.env.NEXT_PUBLIC_VAPID_PUBLIC_KEY;
    if (!vapidPublicKey) return;

    // Must be in a browser that supports push
    if (
      typeof window === 'undefined' || !('serviceWorker' in navigator) ||
      !('PushManager' in window) ||
      !('Notification' in window)
    ) {
      return;
    }

    async function registerPushSubscription() {
      try {
        // Check current permission — do NOT prompt if denied
        const permission = Notification.permission;
        if (permission === 'denied') return;

        // Wait for the SW to be ready (it is registered in layout.tsx)
        const registration = await navigator.serviceWorker.ready;

        // Check if there is already a valid subscription
        let subscription = await registration.pushManager.getSubscription();

        // If subscription exists but is missing keys, unsubscribe and re-subscribe
        if (subscription) {
          const keys = subscription.toJSON().keys;
          if (!keys?.p256dh || !keys?.auth) {
            await subscription.unsubscribe();
            subscription = null;
          }
        }

        // Create a new subscription if needed
        if (!subscription) {
          // Request permission only if not yet granted
          let perm = Notification.permission;
          if (perm === 'default') {
            perm = await Notification.requestPermission();
          }
          if (perm !== 'granted') return;

          // Convert VAPID public key from base64url to Uint8Array
          const applicationServerKey = urlBase64ToUint8Array(vapidPublicKey!);

          subscription = await registration.pushManager.subscribe({
            userVisibleOnly: true,
            applicationServerKey,
          });
        }

        // ALWAYS save subscription to the database — even if it already existed
        // in the browser. The server upserts by endpoint so this is idempotent.
        // This ensures tokens are stored even if a previous save attempt failed,
        // the user logged in on a new session, or the DB row was lost.
        const subJson = subscription.toJSON();
        const p256dh = subJson.keys?.p256dh || '';
        const auth = subJson.keys?.auth || '';

        if (!p256dh || !auth) return; // No valid keys — cannot save

        const response = await fetch('/api/push/subscribe', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            subscription: {
              endpoint: subscription.endpoint,
              keys: { p256dh, auth },
            },
            userId: user?.id,
          }),
        });

        if (response.ok) {
          // Mark as done for this user so we don't spam the API on every render
          subscribedRef.current = user?.id ?? null;
        }
      } catch {
        // Silently fail — push is optional
      }
    }

    registerPushSubscription();
  }, [user?.id]);

  return null;
}

/**
 * Convert a base64url-encoded VAPID public key to a Uint8Array
 * as required by pushManager.subscribe({ applicationServerKey }).
 */
function urlBase64ToUint8Array(base64String: string): Uint8Array {
  const padding = '='.repeat((4 - (base64String.length % 4)) % 4);
  const base64 = (base64String + padding).replace(/-/g, '+').replace(/_/g, '/');
  const rawData = atob(base64);
  const outputArray = new Uint8Array(rawData.length);
  for (let i = 0; i < rawData.length; ++i) {
    outputArray[i] = rawData.charCodeAt(i);
  }
  return outputArray;
}
