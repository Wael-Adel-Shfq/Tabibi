import { mapHref, telHref } from './links';

describe('telHref', () => {
  it('keeps digits and a leading plus', () => {
    expect(telHref('+20 (2) 1234-5678')).toBe('tel:+20212345678');
  });

  it('returns null for missing or too-short numbers', () => {
    expect(telHref(null)).toBeNull();
    expect(telHref('12')).toBeNull();
  });
});

describe('mapHref', () => {
  it('prefers a stored http(s) url', () => {
    expect(mapHref({ map_url: 'https://maps.app.goo.gl/x', latitude: 30, longitude: 31 })).toBe(
      'https://maps.app.goo.gl/x',
    );
  });

  it('rejects non-http urls and falls back to coordinates', () => {
    expect(mapHref({ map_url: 'javascript:alert(1)', latitude: 30.05, longitude: 31.25 })).toBe(
      'https://www.google.com/maps/search/?api=1&query=30.05,31.25',
    );
  });

  it('returns null when there is no location', () => {
    expect(mapHref({ map_url: null, latitude: null, longitude: null })).toBeNull();
  });
});
