import { createServerClient } from '@supabase/ssr';
import { NextResponse } from 'next/server';
import { type NextRequest } from 'next/server';
import { AUTH_NEXT_COOKIE, sanitizeReturnPath } from '@/lib/authReturnPath';
import {
  resolvePlatformRole,
  getHomeRoomForRole,
  canUseReturnPath,
  type RoleProfileHints,
} from '@/lib/roomIsolation';

function clearNextCookie(response: NextResponse) {
  response.cookies.set(AUTH_NEXT_COOKIE, '', {
    path: '/',
    maxAge: 0,
  });
  return response;
}

function resolvePostLoginPath(
  request: NextRequest,
  hints: RoleProfileHints,
): string {
  const platformRole = resolvePlatformRole(hints);
  const fromCookie = sanitizeReturnPath(request.cookies.get(AUTH_NEXT_COOKIE)?.value);
  // Prefer explicit return path (e.g. /messaging) when the role may use it.
  if (fromCookie && canUseReturnPath(fromCookie, platformRole)) return fromCookie;
  return getHomeRoomForRole(platformRole);
}

async function triggerWelcomeEmail(user: any, siteUrl: string) {
  try {
    const fullName =
      user.user_metadata?.full_name ||
      user.user_metadata?.name ||
      user.email?.split('@')[0] ||
      '';
    await fetch(`${siteUrl}/api/email/welcome-internal`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ email: user.email, full_name: fullName, user_id: user.id }),
    });
  } catch {
    // Non-blocking — never fail auth flow due to email error
  }
}

export async function GET(request: NextRequest) {
  const { searchParams, origin } = new URL(request.url);
  const code = searchParams.get('code');

  // CRITICAL: Always use NEXT_PUBLIC_SITE_URL for redirects.
  // Using `origin` here would redirect back to the Supabase preview domain
  // (e.g. stesoekzawrhizsbaiqo.supabase.co) instead of direct-hub.net,
  // causing the "creating preview" hang screen after Google OAuth.
  const siteUrl = process.env.NEXT_PUBLIC_SITE_URL || origin;

  if (code) {
    // PKCE fix: use createServerClient with request/response cookies directly.
    // next/headers cookies cannot write back session cookies in Route Handlers
    // during exchangeCodeForSession, causing HTTP 400 on OAuth callback.
    const response = NextResponse.redirect(`${siteUrl}/login`);

    const supabase = createServerClient(
      process.env.NEXT_PUBLIC_SUPABASE_URL!,
      process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
      {
        cookies: {
          getAll() {
            return request.cookies.getAll();
          },
          setAll(cookiesToSet) {
            cookiesToSet.forEach(({ name, value, options }) =>
              response.cookies.set(name, value, options)
            );
          },
        },
      }
    );

    const { data, error } = await supabase.auth.exchangeCodeForSession(code);

    if (!error && data?.user) {
      // Check if user has selected a role
      const { data: profile } = await supabase
        .from('user_profiles')
        .select('role_selected, role, account_type, seller_category')
        .eq('id', data.user.id)
        .single();

      if (!profile?.role_selected) {
        // New social user — send welcome email then redirect to role selection
        await triggerWelcomeEmail(data.user, siteUrl);
        const newUserResponse = NextResponse.redirect(`${siteUrl}/auth/role-selection`);
        response.cookies.getAll().forEach(({ name, value }) => {
          newUserResponse.cookies.set(name, value);
        });
        return clearNextCookie(newUserResponse);
      }

      const destination = resolvePostLoginPath(request, {
        role: profile?.role,
        account_type: profile?.account_type,
        seller_category: profile?.seller_category,
        metadataRole:
          data.user.user_metadata?.role || data.user.app_metadata?.role || null,
      });
      const roleResponse = NextResponse.redirect(`${siteUrl}${destination}`);
      response.cookies.getAll().forEach(({ name, value }) => {
        roleResponse.cookies.set(name, value);
      });
      return clearNextCookie(roleResponse);
    }
  }

  const fail = NextResponse.redirect(`${siteUrl}/login`);
  return clearNextCookie(fail);
}
