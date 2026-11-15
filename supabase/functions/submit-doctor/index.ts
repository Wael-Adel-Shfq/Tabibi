// Public endpoint for doctor suggestions.
//
// Visitors have no INSERT privilege on doctor_submissions. This function is
// the only way in: it validates the payload, applies basic abuse protection
// and inserts with the service role key, which exists only in this runtime.
// The status column is never taken from the request; the table default
// ('pending') always applies.

import { createClient } from 'jsr:@supabase/supabase-js@2';
import { validateSubmission } from './validation.ts';

const MAX_BODY_BYTES = 10_000;
const MAX_PER_HOUR = 5;

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Methods': 'POST, OPTIONS',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

function json(status: number, body: unknown): Response {
  return new Response(JSON.stringify(body), {
    status,
    headers: { ...corsHeaders, 'Content-Type': 'application/json' },
  });
}

async function hashIp(ip: string, salt: string): Promise<string> {
  const data = new TextEncoder().encode(`${salt}:${ip}`);
  const digest = await crypto.subtle.digest('SHA-256', data);
  return Array.from(new Uint8Array(digest), (b) => b.toString(16).padStart(2, '0')).join('');
}

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: corsHeaders });
  if (req.method !== 'POST') return json(405, { error: 'method_not_allowed' });

  const rawBody = await req.text();
  if (rawBody.length > MAX_BODY_BYTES) return json(413, { error: 'payload_too_large' });

  let body: unknown;
  try {
    body = JSON.parse(rawBody);
  } catch {
    return json(400, { error: 'invalid_json' });
  }

  // Honeypot: real visitors never see or fill this field. Answer as if the
  // suggestion was accepted so bots get no signal.
  const honeypot = (body as Record<string, unknown> | null)?.['website'];
  if (typeof honeypot === 'string' && honeypot.trim() !== '') {
    return json(201, { ok: true });
  }

  const result = validateSubmission(body);
  if (!result.ok) return json(400, { error: 'validation_failed', fields: result.errors });
  const input = result.value;

  const supabaseUrl = Deno.env.get('SUPABASE_URL');
  const serviceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY');
  if (!supabaseUrl || !serviceKey) return json(500, { error: 'server_misconfigured' });

  const admin = createClient(supabaseUrl, serviceKey, {
    auth: { persistSession: false, autoRefreshToken: false },
  });

  // Rate limit by salted IP hash; the raw address is never stored.
  const ip = (req.headers.get('x-forwarded-for') ?? '').split(',')[0].trim() || 'unknown';
  const salt = Deno.env.get('RATE_LIMIT_SALT') ?? serviceKey;
  const ipHash = await hashIp(ip, salt);
  const windowStart = new Date(Date.now() - 60 * 60 * 1000).toISOString();

  const { count, error: countError } = await admin
    .from('submission_rate_limits')
    .select('id', { count: 'exact', head: true })
    .eq('ip_hash', ipHash)
    .gte('created_at', windowStart);
  if (countError) return json(500, { error: 'server_error' });
  if ((count ?? 0) >= MAX_PER_HOUR) return json(429, { error: 'rate_limited' });

  // The location must be specific enough (district, center, city or area)
  // and it and every ancestor must be active.
  const { data: location, error: locationError } = await admin
    .from('locations')
    .select('id, kind, path')
    .eq('id', input.location_id)
    .maybeSingle();
  if (locationError) return json(500, { error: 'server_error' });
  const invalidLocation = json(400, { error: 'validation_failed', fields: { location_id: 'invalid' } });
  if (!location || location.kind === 'governorate' || location.kind === 'region') return invalidLocation;

  const { count: inactive, error: chainError } = await admin
    .from('locations')
    .select('id', { count: 'exact', head: true })
    .in('id', location.path as string[])
    .eq('is_active', false);
  if (chainError) return json(500, { error: 'server_error' });
  if ((inactive ?? 0) > 0) return invalidLocation;

  if (input.specialty_id) {
    const { data: specialty, error: specialtyError } = await admin
      .from('specialties')
      .select('id')
      .eq('id', input.specialty_id)
      .eq('is_active', true)
      .maybeSingle();
    if (specialtyError) return json(500, { error: 'server_error' });
    if (!specialty) {
      return json(400, { error: 'validation_failed', fields: { specialty_id: 'invalid' } });
    }
  }

  const { error: insertError } = await admin.from('doctor_submissions').insert(input);
  if (insertError) {
    console.error('submit-doctor insert failed', insertError.code);
    return json(500, { error: 'server_error' });
  }

  await admin.from('submission_rate_limits').insert({ ip_hash: ipHash });
  // Opportunistic cleanup keeps the table small without a scheduled job.
  await admin
    .from('submission_rate_limits')
    .delete()
    .lt('created_at', new Date(Date.now() - 24 * 60 * 60 * 1000).toISOString());

  return json(201, { ok: true });
});
