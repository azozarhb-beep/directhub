import type { SupabaseClient } from '@supabase/supabase-js';

/**
 * Fetch a user_profiles row, progressively dropping columns that don't exist
 * yet on older/partially-migrated databases (e.g. city, cover_url, description).
 */
export async function fetchUserProfileRow(
  supabase: SupabaseClient,
  userId: string,
  preferredSelect: string
): Promise<{ data: Record<string, any> | null; error: Error | null }> {
  const attempts: string[] = [preferredSelect];

  // Known optional / recently-added columns that live DBs may be missing
  const optional = [
    'city',
    'cover_url',
    'cover_photo_url',
    'description',
    'seller_category',
    'bio',
  ];

  let current = preferredSelect;
  for (const col of optional) {
    if (!current.split(',').map((s) => s.trim()).includes(col)) continue;
    current = current
      .split(',')
      .map((s) => s.trim())
      .filter((s) => s !== col)
      .join(', ');
    if (!attempts.includes(current)) attempts.push(current);
  }

  // Absolute minimum that exists since the original auth migration
  const minimal = 'id, full_name, company_name, country, phone, avatar_url';
  if (!attempts.includes(minimal)) attempts.push(minimal);

  let lastError: Error | null = null;

  for (const select of attempts) {
    const { data, error } = await supabase
      .from('user_profiles')
      .select(select)
      .eq('id', userId)
      .single();

    if (!error && data) {
      return { data: data as Record<string, any>, error: null };
    }

    lastError = error ? new Error(error.message) : lastError;

    // If PostgREST names a missing column, drop it and retry immediately
    const missing = error?.message?.match(/column user_profiles\.(\w+) does not exist/i)?.[1];
    if (missing) {
      const stripped = select
        .split(',')
        .map((s) => s.trim())
        .filter((s) => s !== missing)
        .join(', ');
      if (stripped && !attempts.includes(stripped)) {
        attempts.push(stripped);
      }
    }
  }

  return { data: null, error: lastError };
}

/** Strip unknown columns from an update payload based on a PostgREST error. */
export function stripMissingProfileColumns(
  payload: Record<string, unknown>,
  errorMessage: string
): Record<string, unknown> | null {
  const missing = errorMessage.match(/column user_profiles\.(\w+) does not exist/i)?.[1]
    || errorMessage.match(/Could not find the '(\w+)' column/i)?.[1];
  if (!missing || !(missing in payload)) return null;
  const next = { ...payload };
  delete next[missing];
  return next;
}
