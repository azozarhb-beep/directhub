import { createServerClient } from '@supabase/ssr';
import { NextResponse } from 'next/server';
import { type NextRequest } from 'next/server';
import { AUTH_NEXT_COOKIE, sanitizeReturnPath } from '@/lib/authReturnPath';
import {
  resolvePlatformRole,
  getHomeRoomForRole,
  canUseReturnPath,
} from '@/lib/roomIsolation';

function clearNextCookie(response: NextResponse) {
  response.cookies.set(AUTH_NEXT_COOKIE, '', {
    path: '/',
    maxAge: 0,
  });
  return response;
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
  const nextParam = sanitizeReturnPath(searchParams.get('next'));
  const nextCookie = sanitizeReturnPath(request.cookies.get(AUTH_NEXT_COOKIE)?.value);
  const type = searchParams.get('type');

  // Use NEXT_PUBLIC_SITE_URL as the base for redirects to ensure consistency
  // with the registered OAuth redirect URIs in Google Cloud Console.
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

    if (!error) {
      // Password recovery flow — redirect to the reset password page
      if (type === 'recovery') {
        const recoveryResponse = NextResponse.redirect(`${siteUrl}/auth/reset-password`);
        // Copy session cookies to the new response
        response.cookies.getAll().forEach(({ name, value }) => {
          recoveryResponse.cookies.set(name, value);
        });
        return clearNextCookie(recoveryResponse);
      }

      // Social login flow — check if user needs role selection
      if (data?.user) {
        const { data: profile } = await supabase
          .from('user_profiles')
          .select('role_selected, role, account_type, seller_category')
          .eq('id', data.user.id)
          .single();

        if (!profile?.role_selected) {
          // New user — send welcome email before redirecting to role selection
          await triggerWelcomeEmail(data.user, siteUrl);
          const newUserResponse = NextResponse.redirect(`${siteUrl}/auth/role-selection`);
          response.cookies.getAll().forEach(({ name, value }) => {
            newUserResponse.cookies.set(name, value);
          });
          return clearNextCookie(newUserResponse);
        }

        const platformRole = resolvePlatformRole({
          role: profile?.role,
          account_type: profile?.account_type,
          seller_category: profile?.seller_category,
          metadataRole:
            data.user.user_metadata?.role || data.user.app_metadata?.role || null,
        });
        const homeRoom = getHomeRoomForRole(platformRole);

        // Prefer explicit return path (cookie or ?next=) so messaging login returns there.
        // Reject return paths that point at another role's exclusive room.
        const preferred = nextCookie || nextParam;
        const destination =
          preferred && canUseReturnPath(preferred, platformRole)
            ? `${siteUrl}${preferred}`
            : `${siteUrl}${homeRoom}`;

        const roleResponse = NextResponse.redirect(destination);
        response.cookies.getAll().forEach(({ name, value }) => {
          roleResponse.cookies.set(name, value);
        });
        return clearNextCookie(roleResponse);
      }

      const fallback = nextCookie || nextParam || '/my-account';
      const fallbackResponse = NextResponse.redirect(`${siteUrl}${fallback}`);
      response.cookies.getAll().forEach(({ name, value }) => {
        fallbackResponse.cookies.set(name, value);
      });
      return clearNextCookie(fallbackResponse);
    }
  }

  return clearNextCookie(NextResponse.redirect(`${siteUrl}/login`));
}
