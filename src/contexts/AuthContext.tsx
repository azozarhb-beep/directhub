'use client';

import { createContext, useContext, useEffect, useState, useCallback, useRef } from 'react';
import { createClient } from '@/lib/supabase/client';
import LoginModal from '@/components/LoginModal';
import { clearRoleCookies, syncRoleCookies } from '@/lib/roleCookies';

const AuthContext = createContext<any>({});

export const useAuth = () => {
  const context = useContext(AuthContext);
  if (!context) {
    throw new Error('useAuth must be used within AuthProvider');
  }
  return context;
};

export const AuthProvider = ({ children }: { children: React.ReactNode }) => {
  const [user, setUser] = useState<any>(null);
  const [session, setSession] = useState<any>(null);
  const [loading, setLoading] = useState(true);

  // Login-on-demand modal state
  const [loginModalOpen, setLoginModalOpen] = useState(false);
  const [loginModalReason, setLoginModalReason] = useState<string | undefined>(undefined);
  const [loginModalCallback, setLoginModalCallback] = useState<(() => void) | null>(null);

  // Store supabase client in a ref so it never changes between renders.
  // This prevents useEffect from re-running and creating multiple
  // onAuthStateChange subscriptions — which is the root cause of
  // refresh_token_already_used errors.
  const supabaseRef = useRef(createClient());
  const supabase = supabaseRef.current;

  /** Load profile hints into cookies so middleware can isolate rooms without a DB hit. */
  const syncRoleCookiesFromProfile = useCallback(async (authUser: any | null) => {
    if (!authUser?.id) {
      clearRoleCookies();
      return;
    }
    const meta = authUser.user_metadata || {};
    const app = authUser.app_metadata || {};
    let role =
      (meta.role as string | undefined) ||
      (app.role as string | undefined) ||
      null;
    let accountType =
      (meta.account_type as string | undefined) ||
      (app.account_type as string | undefined) ||
      null;
    let sellerCategory =
      (meta.seller_category as string | undefined) ||
      (app.seller_category as string | undefined) ||
      null;

    try {
      const { data: profile } = await supabase
        .from('user_profiles')
        .select('role, account_type, seller_category')
        .eq('id', authUser.id)
        .maybeSingle();
      if (profile) {
        role = profile.role || role;
        accountType = profile.account_type || accountType;
        sellerCategory = profile.seller_category || sellerCategory;
      }
    } catch {
      // Profile fetch failed — still sync whatever JWT metadata we have
    }

    syncRoleCookies({
      role,
      account_type: accountType,
      seller_category: sellerCategory,
    });
  }, [supabase]);

  useEffect(() => {
    let mounted = true;
    // Track whether onAuthStateChange has already fired with the initial session.
    // If it fires first we skip the getSession fallback entirely — this prevents
    // two concurrent paths both trying to use/refresh the same token.
    let initialEventFired = false;

    const {
      data: { subscription }
    } = supabase.auth.onAuthStateChange((event, session) => {
      if (!mounted) return;

      initialEventFired = true;

      if (event === 'SIGNED_OUT') {
        clearRoleCookies();
        setSession(null);
        setUser(null);
        setLoading(false);
        return;
      }

      // TOKEN_REFRESHED fires after a successful token rotation.
      // session is always non-null here — update state with the new tokens.
      // Do NOT treat a null session during TOKEN_REFRESHED as a sign-out;
      // that was the root cause of the refresh_token_already_used loop.
      if (event === 'TOKEN_REFRESHED') {
        if (session) {
          setSession(session);
          setUser(session.user ?? null);
          void syncRoleCookiesFromProfile(session.user ?? null);
        }
        setLoading(false);
        return;
      }

      // INITIAL_SESSION fires when a persisted session is restored from
      // localStorage/cookies on page load — this is what keeps users logged
      // in across browser restarts and next-day returns.
      setSession(session);
      setUser(session?.user ?? null);
      void syncRoleCookiesFromProfile(session?.user ?? null);
      setLoading(false);
    });

    // Fallback: if onAuthStateChange hasn't fired within 800 ms (e.g. no stored
    // session), seed state from getSession() which does NOT trigger a network
    // token refresh when there is no session.
    // IMPORTANT: We only call getSession() if the auth event has NOT fired yet.
    // Calling getSession() while onAuthStateChange is also running causes two
    // concurrent code paths to attempt token refresh with the same refresh token,
    // producing the refresh_token_already_used error.
    const fallbackTimer = setTimeout(() => {
      if (!mounted || initialEventFired) return;
      supabase.auth.getSession().then(({ data }) => {
        if (!mounted || initialEventFired) return;
        setSession(data.session ?? null);
        setUser(data.session?.user ?? null);
        void syncRoleCookiesFromProfile(data.session?.user ?? null);
        setLoading(false);
      }).catch(() => {
        if (mounted && !initialEventFired) setLoading(false);
      });
    }, 800);

    return () => {
      mounted = false;
      clearTimeout(fallbackTimer);
      subscription.unsubscribe();
    };
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []); // Empty deps — supabase is stable via ref, subscription must only be created once

  /**
   * requireAuth — call this instead of redirecting to /login.
   * If the user is already logged in, `onAuthenticated` is called immediately.
   * If not, the login modal opens; `onAuthenticated` is called after successful login.
   *
   * @param onAuthenticated  callback to run once the user is authenticated
   * @param reason           optional Arabic/English text shown in the modal header
   */
  const requireAuth = useCallback((onAuthenticated?: () => void, reason?: string) => {
    if (user) {
      onAuthenticated?.();
      return;
    }
    setLoginModalReason(reason);
    // Store callback in a ref-like pattern using a function wrapper to avoid
    // React treating it as a state updater function
    setLoginModalCallback(() => onAuthenticated ?? null);
    setLoginModalOpen(true);
  }, [user]);

  const closeLoginModal = useCallback(() => {
    setLoginModalOpen(false);
    setLoginModalReason(undefined);
    setLoginModalCallback(null);
  }, []);

  const signUp = async (email: string, password: string, metadata: any = {}) => {
    const { data, error } = await supabase.auth.signUp({
      email,
      password,
      options: {
        data: {
          full_name: metadata?.fullName || metadata?.full_name || '',
          company_name: metadata?.company_name || '',
          phone: metadata?.phone || '',
          country: metadata?.country || '',
          role: metadata?.role || 'buyer',
          account_role: metadata?.account_role || '',
          dashboard_path: metadata?.dashboard_path || '',
          avatar_url: metadata?.avatarUrl || '',
        },
        emailRedirectTo: `${process.env.NEXT_PUBLIC_SITE_URL || ''}/auth/callback`,
      }
    });
    if (error) throw error;
    return data;
  };

  const signIn = async (email: string, password: string) => {
    const { data, error } = await supabase.auth.signInWithPassword({
      email,
      password
    });
    if (error) throw error;
    return data;
  };

  const signOut = async () => {
    clearRoleCookies();
    const { error } = await supabase.auth.signOut();
    if (error) throw error;
  };

  const resetPassword = async (email: string) => {
    const { error } = await supabase.auth.resetPasswordForEmail(email, {
      redirectTo: `${process.env.NEXT_PUBLIC_SITE_URL || ''}/auth/callback?type=recovery`,
    });
    if (error) throw error;
  };

  const getCurrentUser = async () => {
    const { data: { user }, error } = await supabase.auth.getUser();
    if (error) throw error;
    return user;
  };

  const isEmailVerified = () => {
    return user?.email_confirmed_at !== null;
  };

  const getUserProfile = async () => {
    if (!user) return null;
    const { data, error } = await supabase
      .from('user_profiles')
      .select('*')
      .eq('id', user.id)
      .single();
    if (error) throw error;
    return data;
  };

  const value = {
    user,
    session,
    loading,
    signUp,
    signIn,
    signOut,
    resetPassword,
    getCurrentUser,
    isEmailVerified,
    getUserProfile,
    requireAuth,
  };

  return (
    <AuthContext.Provider value={value}>
      {children}
      <LoginModal
        isOpen={loginModalOpen}
        onClose={closeLoginModal}
        onSuccess={() => {
          loginModalCallback?.();
          closeLoginModal();
        }}
        reason={loginModalReason}
      />
    </AuthContext.Provider>
  );
};
