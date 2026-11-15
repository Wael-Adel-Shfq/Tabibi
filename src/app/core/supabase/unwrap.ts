import type { Page } from '../models/entities';

interface QueryResult<T> {
  data: T | null;
  error: { message: string; code?: string } | null;
  count?: number | null;
}

/** Error raised by data services; `code` is the Postgres / PostgREST code when known. */
export class DataError extends Error {
  constructor(
    message: string,
    readonly code?: string,
  ) {
    super(message);
    this.name = 'DataError';
  }
}

/** Turns a Supabase `{ data, error }` result into a value or a thrown DataError. */
export function unwrap<T>(result: QueryResult<T>): T {
  if (result.error) throw new DataError(result.error.message, result.error.code);
  return result.data as T;
}

/** Same as `unwrap`, for list queries that also request an exact count. */
export function unwrapPage<T>(result: QueryResult<unknown[]>): Page<T> {
  const items = (unwrap(result) ?? []) as T[];
  return { items, total: result.count ?? items.length };
}

/** Escapes LIKE wildcards so user input is matched literally. */
export function likePattern(term: string): string {
  const escaped = term.replace(/[\\%_]/g, (char) => '\\' + char);
  return '%' + escaped + '%';
}

/** Trims a form value and maps an empty string to null for nullable columns. */
export function orNull(value: string | null | undefined): string | null {
  const trimmed = (value ?? '').trim();
  return trimmed === '' ? null : trimmed;
}
