import type { Advertisement } from '../../core/models/entities';

const KEY_PREFIX = 'tabibi.popupSeen.';
const HOUR_MS = 60 * 60 * 1000;

/**
 * Remembers on this device when each popup ad was last shown, so an ad with
 * `popup_repeat_hours` is not shown again too soon. Storage can be missing
 * (private mode, native webview reset); then popups simply show again.
 */
export class PopupFrequency {
  constructor(private readonly storage: Storage | null) {}

  canShow(ad: Advertisement, now: number): boolean {
    if (ad.popup_repeat_hours <= 0) return true;
    const last = this.read(ad.id);
    return last === null || now - last >= ad.popup_repeat_hours * HOUR_MS;
  }

  markShown(ad: Advertisement, now: number): void {
    try {
      this.storage?.setItem(KEY_PREFIX + ad.id, String(now));
    } catch {
      // Ignore: not remembering only means the popup may show again.
    }
  }

  private read(id: string): number | null {
    try {
      const value = Number(this.storage?.getItem(KEY_PREFIX + id));
      return Number.isFinite(value) && value > 0 ? value : null;
    } catch {
      return null;
    }
  }
}
