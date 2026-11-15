import { DataError } from '../../../core/supabase/unwrap';

/** Rule names raised by database triggers, each with its own message. */
const RULES = ['location_kind_not_allowed', 'location_cycle', 'location_too_broad'] as const;

/** Translation key that explains a failed admin write in plain language. */
export function adminErrorKey(error: unknown): string {
  if (error instanceof Error) {
    const rule = RULES.find((name) => error.message.includes(name));
    if (rule) return 'adminErrors.' + rule;
  }
  const code = error instanceof DataError ? error.code : undefined;
  switch (code) {
    case '23505':
      return 'adminErrors.duplicate';
    case '23503':
      return 'adminErrors.inUse';
    case '23514':
      return 'adminErrors.invalid';
    case '42501':
      return 'adminErrors.notAllowed';
    default:
      return 'common.error';
  }
}
