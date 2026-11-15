/** Coordinate input rules: a decimal number; both values or neither (checked by the forms). */
export const COORDINATE_PATTERN = /^-?\d{1,3}(\.\d+)?$/;

export function toCoordinate(value: string): number | null {
  const trimmed = value.trim();
  return trimmed === '' ? null : Number(trimmed);
}
