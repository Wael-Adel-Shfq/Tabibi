import type { Located } from '../../core/models/entities';

/** `tel:` link for a phone number, or null when there is nothing dialable. */
export function telHref(phone: string | null | undefined): string | null {
  const digits = (phone ?? '').replace(/[^0-9+]/g, '');
  return digits.length >= 5 ? 'tel:' + digits : null;
}

/**
 * Google Maps link for a record: the stored URL when it is a safe http(s)
 * link, otherwise one built from coordinates, otherwise null.
 */
export function mapHref(place: Located): string | null {
  const url = place.map_url?.trim();
  if (url && /^https?:\/\//i.test(url)) return url;
  if (place.latitude != null && place.longitude != null) {
    return (
      'https://www.google.com/maps/search/?api=1&query=' + place.latitude + ',' + place.longitude
    );
  }
  return null;
}
