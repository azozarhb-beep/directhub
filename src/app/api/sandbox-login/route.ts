import { NextRequest, NextResponse } from 'next/server';
import { createClient as createServiceClient } from '@supabase/supabase-js';
import { createClient } from '@/lib/supabase/server';

type SandboxAccount = {
  email: string;
  password: string;
  redirect: string;
  full_name: string;
  role: string;
  company_name: string;
  phone: string;
  country: string;
  account_type: string;
  seller_category: string | null;
};

// Must match the seeded accounts in:
//   supabase/migrations/20260920141000_sandbox_dummy_accounts.sql
//   supabase/migrations/20260920150000_fix_sandbox_auth_users.sql
//   supabase/migrations/20260930140000_sandbox_three_new_role_accounts.sql
const SANDBOX_ACCOUNTS: Record<string, SandboxAccount> = {
  buyer: {
    email: 'sandbox.buyer@directhub.net',
    password: 'SandboxBuyer2026!',
    redirect: '/buyer-dashboard',
    full_name: 'Ahmed Al-Rashidi — Sandbox Buyer',
    role: 'buyer',
    company_name: 'Al-Rashidi Trading Co.',
    phone: '+967771100001',
    country: 'Yemen',
    account_type: 'buyer',
    seller_category: null,
  },
  supplier: {
    email: 'sandbox.supplier@directhub.net',
    password: 'SandboxSupplier2026!',
    redirect: '/supplier/local-dashboard',
    full_name: 'Khalid Al-Yamani — Sandbox Supplier',
    role: 'manufacturer',
    company_name: 'Al-Yamani General Trading',
    phone: '+967771100002',
    country: 'Yemen',
    account_type: 'local_supplier',
    seller_category: 'local_supplier',
  },
  factory: {
    email: 'sandbox.factory@directhub.net',
    password: 'SandboxFactory2026!',
    redirect: '/manufacturer/dashboard',
    full_name: 'Omar Al-Hadhrami — Sandbox Factory',
    role: 'manufacturer',
    company_name: 'Al-Hadhrami Packaging Industries',
    phone: '+967771100003',
    country: 'Yemen',
    account_type: 'factory',
    seller_category: 'local_factory',
  },
  agent: {
    email: 'sandbox.agent@directhub.net',
    password: 'SandboxAgent2026!',
    redirect: '/agent/dashboard',
    full_name: 'Nasser Al-Subaie — Sandbox Agent',
    role: 'field_agent',
    company_name: 'DirectHub Field Representative',
    phone: '+967771100004',
    country: 'Yemen',
    account_type: 'field_agent',
    seller_category: null,
  },
  logistics: {
    email: 'sandbox.logistics@directhub.net',
    password: 'SandboxLogistics2026!',
    redirect: '/logistics/dashboard',
    full_name: 'Saleh Al-Amri — Sandbox Logistics',
    role: 'logistics_partner',
    company_name: 'Al-Amri Express Logistics',
    phone: '+967771100005',
    country: 'Yemen',
    account_type: 'logistics_partner',
    seller_category: null,
  },
  international_factory: {
    email: 'sandbox.intlfactory@directhub.net',
    password: 'SandboxIntlFactory2026!',
    redirect: '/manufacturer/international-dashboard',
    full_name: 'Wei Chen — Sandbox International Factory',
    role: 'manufacturer',
    company_name: 'Guangzhou Pacific Manufacturing Co.',
    phone: '+8613800000006',
    country: 'China',
    account_type: 'factory',
    seller_category: 'international_factory',
  },
  logistics_office: {
    email: 'sandbox.logisticsoffice@directhub.net',
    password: 'SandboxLogisticsOffice2026!',
    redirect: '/logistics/dashboard',
    full_name: 'Fahad Al-Nuaimi — Sandbox Logistics Office',
    role: 'logistics_partner',
    company_name: 'Gulf Gate Logistics Office',
    phone: '+971500000007',
    country: 'UAE',
    account_type: 'logistics_partner',
    seller_category: null,
  },
  commercial_supplier: {
    email: 'sandbox.commercialsupplier@directhub.net',
    password: 'SandboxCommercialSupplier2026!',
    redirect: '/supplier/local-dashboard',
    full_name: 'Layla Al-Harbi — Sandbox Commercial Supplier',
    role: 'manufacturer',
    company_name: 'Al-Harbi Commercial Supply',
    phone: '+967771100008',
    country: 'Yemen',
    account_type: 'local_supplier',
    seller_category: 'local_supplier',
  },
};

function metadataFor(account: SandboxAccount) {
  return {
    full_name: account.full_name,
    role: account.role,
    company_name: account.company_name,
    phone: account.phone,
    country: account.country,
    account_type: account.account_type,
    ...(account.seller_category ? { seller_category: account.seller_category } : {}),
  };
}

function serviceClient() {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!url || !key) return null;
  return createServiceClient(url, key, {
    auth: { autoRefreshToken: false, persistSession: false },
  });
}

/**
 * Creates the sandbox auth user (and profile) if missing, or resets the
 * password if the email already exists. The three newer roles were added to
 * the control-room UI without a matching auth.users seed, which is why their
 * one-click login returned "account not found".
 */
async function ensureSandboxUser(account: SandboxAccount): Promise<string | null> {
  const admin = serviceClient();
  if (!admin) return 'Service role is not configured; cannot provision missing sandbox accounts.';

  const userMetadata = metadataFor(account);
  let userId: string | null = null;

  const created = await admin.auth.admin.createUser({
    email: account.email,
    password: account.password,
    email_confirm: true,
    user_metadata: userMetadata,
    app_metadata: { provider: 'email', providers: ['email'] },
  });

  if (created.data.user?.id) {
    userId = created.data.user.id;
  } else {
    const alreadyExists = /already been registered|already exists|already registered/i.test(
      created.error?.message || ''
    );
    if (!alreadyExists) {
      return created.error?.message || 'Failed to create sandbox auth user.';
    }

    const { data: profile } = await admin
      .from('user_profiles')
      .select('id')
      .eq('email', account.email)
      .maybeSingle();

    userId = profile?.id ?? null;
    if (!userId) {
      const listed = await admin.auth.admin.listUsers({ page: 1, perPage: 1000 });
      userId = listed.data.users.find((u) => u.email === account.email)?.id ?? null;
    }
    if (!userId) {
      return `Sandbox email ${account.email} is registered but its user id could not be resolved.`;
    }

    const updated = await admin.auth.admin.updateUserById(userId, {
      password: account.password,
      email_confirm: true,
      user_metadata: userMetadata,
    });
    if (updated.error) return updated.error.message;
  }

  const profilePayload: Record<string, unknown> = {
    id: userId,
    email: account.email,
    full_name: account.full_name,
    company_name: account.company_name,
    phone: account.phone,
    country: account.country,
    role: account.role,
    is_verified: true,
    is_active: true,
    account_type: account.account_type,
    role_selected: true,
  };
  if (account.seller_category) profilePayload.seller_category = account.seller_category;

  const { error: profileError } = await admin.from('user_profiles').upsert(profilePayload, {
    onConflict: 'id',
  });
  if (profileError) {
    console.warn('[sandbox-login] profile upsert:', profileError.message);
  }

  // Seed logistics_partners record for logistics sandbox accounts
  if (account.role === 'logistics_partner') {
    const { error: lpError } = await admin.from('logistics_partners').upsert({
      user_id: userId,
      company_name: 'Sandbox Logistics Co.',
      partner_type: 'international_shipping_office',
      contact_name: 'Sandbox Agent',
      contact_email: 'sandbox.logistics@directhub.net',
      contact_phone: '+9661234567890',
      country: 'SA',
      city: 'Riyadh',
      address: 'Sandbox Address',
      status: 'approved',
    }, { onConflict: 'user_id' });
    if (lpError) {
      console.warn('[sandbox-login] logistics_partners upsert:', lpError.message);
    }
  }

  return null;
}

export async function POST(req: NextRequest) {
  try {
    const { role } = await req.json();

    if (!role || !SANDBOX_ACCOUNTS[role]) {
      return NextResponse.json({ error: 'Invalid sandbox role' }, { status: 400 });
    }

    const account = SANDBOX_ACCOUNTS[role];
    const supabase = await createClient();

    await supabase.auth.signOut();

    let { data, error } = await supabase.auth.signInWithPassword({
      email: account.email,
      password: account.password,
    });

    if (error) {
      // The three newer roles were never seeded in auth.users. If a service
      // role key is present, provision them on the fly; otherwise the SQL
      // migration has to be applied (same path as the HEIC allowlist).
      if (serviceClient()) {
        const provisionError = await ensureSandboxUser(account);
        if (!provisionError) {
          const retry = await supabase.auth.signInWithPassword({
            email: account.email,
            password: account.password,
          });
          data = retry.data;
          error = retry.error;
        }
      }
    }

    if (error) {
      const isCredentialError =
        error.message?.toLowerCase().includes('invalid') ||
        error.message?.toLowerCase().includes('credentials') ||
        error.message?.toLowerCase().includes('not found') ||
        error.message?.toLowerCase().includes('service role');

      const helpMessage = isCredentialError
        ? `Sandbox account not found or password mismatch for role "${role}". ` +
          `Apply migration 20260930140000_sandbox_three_new_role_accounts.sql, then retry.`
        : error.message;

      return NextResponse.json(
        { error: `Sandbox login failed: ${helpMessage}` },
        { status: 401 }
      );
    }

    const { data: profile } = await supabase
      .from('user_profiles')
      .select('dashboard_path, role, account_type')
      .eq('email', account.email)
      .single();

    const redirectPath = profile?.dashboard_path ?? account.redirect;

    return NextResponse.json({
      success: true,
      redirect: redirectPath,
      role,
      email: account.email,
      user: {
        id: data.user?.id,
        email: data.user?.email,
        role: data.user?.user_metadata?.role,
        full_name: data.user?.user_metadata?.full_name,
        company_name: data.user?.user_metadata?.company_name,
      },
    });
  } catch (err: any) {
    return NextResponse.json(
      { error: err?.message || 'Internal server error' },
      { status: 500 }
    );
  }
}
