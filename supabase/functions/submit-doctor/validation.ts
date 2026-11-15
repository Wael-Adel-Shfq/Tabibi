// Pure validation for public doctor suggestions. No I/O, so it can be unit
// tested and reasoned about on its own.

export interface SubmissionInput {
  full_name: string;
  specialty_id: string | null;
  specialty_other: string | null;
  clinic_phone: string | null;
  governorate_id: string;
  area_id: string;
  address: string;
  map_url: string | null;
  submitter_name: string | null;
  submitter_contact: string | null;
}

export type ValidationResult =
  | { ok: true; value: SubmissionInput }
  | { ok: false; errors: Record<string, string> };

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
const PHONE = /^[0-9+ ()-]{5,20}$/;
// Control characters and angle brackets have no place in directory text.
const FORBIDDEN = /[\u0000-\u001f\u007f<>]/;

function text(value: unknown): string | null {
  if (typeof value !== 'string') return null;
  const trimmed = value.trim().replace(/\s+/g, ' ');
  return trimmed.length > 0 ? trimmed : null;
}

export function validateSubmission(body: unknown): ValidationResult {
  if (typeof body !== 'object' || body === null || Array.isArray(body)) {
    return { ok: false, errors: { body: 'invalid' } };
  }
  const raw = body as Record<string, unknown>;
  const errors: Record<string, string> = {};

  const requiredText = (key: string, min: number, max: number): string => {
    const value = text(raw[key]);
    if (value === null) errors[key] = 'required';
    else if (value.length < min || value.length > max || FORBIDDEN.test(value)) errors[key] = 'invalid';
    return value ?? '';
  };

  const optionalText = (key: string, min: number, max: number): string | null => {
    const value = text(raw[key]);
    if (value !== null && (value.length < min || value.length > max || FORBIDDEN.test(value))) {
      errors[key] = 'invalid';
    }
    return value;
  };

  const requiredUuid = (key: string): string => {
    const value = text(raw[key]);
    if (value === null) errors[key] = 'required';
    else if (!UUID.test(value)) errors[key] = 'invalid';
    return value ?? '';
  };

  const full_name = requiredText('full_name', 2, 150);
  const governorate_id = requiredUuid('governorate_id');
  const area_id = requiredUuid('area_id');
  const address = requiredText('address', 3, 300);

  const specialty_id = text(raw['specialty_id']);
  if (specialty_id !== null && !UUID.test(specialty_id)) errors['specialty_id'] = 'invalid';
  const specialty_other = specialty_id === null ? optionalText('specialty_other', 2, 80) : null;
  if (specialty_id === null && specialty_other === null) errors['specialty_id'] = 'required';

  const clinic_phone = text(raw['clinic_phone']);
  if (clinic_phone !== null && !PHONE.test(clinic_phone)) errors['clinic_phone'] = 'invalid';

  const map_url = text(raw['map_url']);
  if (map_url !== null && !isHttpUrl(map_url)) errors['map_url'] = 'invalid';

  const submitter_name = optionalText('submitter_name', 1, 100);
  const submitter_contact = optionalText('submitter_contact', 1, 150);

  if (Object.keys(errors).length > 0) return { ok: false, errors };

  return {
    ok: true,
    value: {
      full_name,
      specialty_id,
      specialty_other,
      clinic_phone,
      governorate_id,
      area_id,
      address,
      map_url,
      submitter_name,
      submitter_contact,
    },
  };
}

function isHttpUrl(value: string): boolean {
  if (value.length > 500) return false;
  try {
    const url = new URL(value);
    return url.protocol === 'http:' || url.protocol === 'https:';
  } catch {
    return false;
  }
}
