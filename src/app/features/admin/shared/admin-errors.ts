import { DataError } from '../../../core/supabase/unwrap';

/** Translation key that explains a failed admin write in plain language. */
export function adminErrorKey(error: unknown): string {
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
