import { Component, effect, inject, input, signal } from '@angular/core';
import { TranslatePipe } from '@ngx-translate/core';
import type { AdPlacement, Advertisement } from '../../../core/models/entities';
import { AdsService } from '../../../features/advertisements/ads.service';
import { DirectoryFilterStore } from '../../../features/locations/location-filter.store';
import { mapHref, telHref } from '../../utils/links';

interface AdView {
  ad: Advertisement;
  image: string;
  href: string | null;
}

/**
 * Shows the active advertisements of one placement. Renders nothing when
 * there are none, so pages never show an empty advertising box.
 */
@Component({
  selector: 'app-ad-slot',
  imports: [TranslatePipe],
  templateUrl: './ad-slot.html',
  styleUrl: './ad-slot.css',
})
export class AdSlot {
  private readonly ads = inject(AdsService);
  private readonly filter = inject(DirectoryFilterStore);

  readonly placement = input.required<AdPlacement>();

  protected readonly items = signal<AdView[]>([]);

  constructor() {
    effect((onCleanup) => {
      const placement = this.placement();
      const locationPath = this.filter.locationPath();
      let cancelled = false;
      onCleanup(() => (cancelled = true));

      this.ads
        .listForPlacement(placement, locationPath)
        .then((ads) => {
          if (cancelled) return;
          this.items.set(
            ads.map((ad) => ({
              ad,
              image: this.ads.imageUrl(ad.image_path),
              href:
                mapHref({ map_url: ad.map_url, latitude: null, longitude: null }) ??
                telHref(ad.phone),
            })),
          );
        })
        // Advertisements are optional content: a failure hides the slot.
        .catch(() => {
          if (!cancelled) this.items.set([]);
        });
    });
  }
}
