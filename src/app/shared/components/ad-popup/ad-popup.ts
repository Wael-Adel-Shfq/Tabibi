import { DOCUMENT } from '@angular/common';
import { Component, computed, DestroyRef, inject, input, signal } from '@angular/core';
import { NavigationStart, Router } from '@angular/router';
import { IonIcon, IonModal } from '@ionic/angular';
import { TranslatePipe } from '@ngx-translate/core';
import { addIcons } from 'ionicons';
import { closeOutline } from 'ionicons/icons';
import type { Advertisement, Located, PopupPlacement } from '../../../core/models/entities';
import { AdsService } from '../../../features/advertisements/ads.service';
import { PopupFrequency } from '../../../features/advertisements/popup-frequency';
import { DirectoryFilterStore } from '../../../features/locations/location-filter.store';
import { ContactActions } from '../contact-actions/contact-actions';

const TICK_MS = 200;

/** The page each popup placement belongs to; a popup never shows on another page. */
const PAGE_OF: Record<PopupPlacement, string> = {
  popup_home: '/home',
  popup_doctors: '/doctors',
  popup_facilities: '/facilities',
};

/**
 * Popup advertisement card for one page. After the ad's delay it opens over
 * the page with a close button; if the ad has a duration it closes itself,
 * with a countdown that pauses while the visitor hovers over or focuses it.
 * Each visitor sees a given ad at most once per its repeat window.
 */
@Component({
  selector: 'app-ad-popup',
  imports: [IonModal, IonIcon, TranslatePipe, ContactActions],
  templateUrl: './ad-popup.html',
  styleUrl: './ad-popup.css',
})
export class AdPopup {
  private readonly ads = inject(AdsService);
  private readonly filter = inject(DirectoryFilterStore);
  private readonly router = inject(Router);
  private readonly frequency = new PopupFrequency(storageOf(inject(DOCUMENT)));

  readonly placement = input.required<PopupPlacement>();

  protected readonly ad = signal<Advertisement | null>(null);
  protected readonly open = signal(false);
  protected readonly image = computed(() => {
    const ad = this.ad();
    return ad ? this.ads.imageUrl(ad.image_path) : '';
  });
  protected readonly place = computed<Located>(() => ({
    map_url: this.ad()?.map_url ?? null,
    latitude: null,
    longitude: null,
  }));

  private readonly remainingMs = signal(0);
  private readonly totalMs = signal(0);
  protected readonly paused = signal(false);
  protected readonly hasTimer = computed(() => this.totalMs() > 0);
  protected readonly secondsLeft = computed(() => Math.ceil(this.remainingMs() / 1000));
  /** Share of the display time left, 0–100, for the countdown bar. */
  protected readonly percentLeft = computed(() =>
    this.totalMs() > 0 ? Math.round((this.remainingMs() / this.totalMs()) * 100) : 0,
  );

  private delayTimer: ReturnType<typeof setTimeout> | undefined;
  private tickTimer: ReturnType<typeof setInterval> | undefined;

  constructor() {
    addIcons({ closeOutline });

    const navigation = this.router.events.subscribe((event) => {
      if (event instanceof NavigationStart) this.cancel();
    });
    inject(DestroyRef).onDestroy(() => {
      navigation.unsubscribe();
      this.cancel();
    });

    // Wait for the placement input before loading.
    queueMicrotask(() => void this.schedule());
  }

  protected close(): void {
    this.stopTicking();
    this.open.set(false);
  }

  protected setPaused(paused: boolean): void {
    this.paused.set(paused);
  }

  private async schedule(): Promise<void> {
    let candidates: Advertisement[];
    try {
      candidates = await this.ads.listForPlacement(this.placement(), this.filter.locationPath());
    } catch {
      return; // Advertisements are optional content.
    }
    const ad = candidates.find((candidate) => this.frequency.canShow(candidate, Date.now()));
    if (!ad) return;

    this.delayTimer = setTimeout(() => this.show(ad), ad.popup_delay_seconds * 1000);
  }

  private show(ad: Advertisement): void {
    // The visitor may have moved to another page during the delay.
    if (!this.router.url.startsWith(PAGE_OF[this.placement()])) return;

    this.ad.set(ad);
    this.open.set(true);
    this.frequency.markShown(ad, Date.now());

    const duration = (ad.popup_duration_seconds ?? 0) * 1000;
    this.totalMs.set(duration);
    this.remainingMs.set(duration);
    if (duration > 0) {
      this.tickTimer = setInterval(() => {
        if (this.paused()) return;
        const left = this.remainingMs() - TICK_MS;
        this.remainingMs.set(Math.max(0, left));
        if (left <= 0) this.close();
      }, TICK_MS);
    }
  }

  private cancel(): void {
    clearTimeout(this.delayTimer);
    this.close();
  }

  private stopTicking(): void {
    clearInterval(this.tickTimer);
    this.tickTimer = undefined;
  }
}

function storageOf(document: Document): Storage | null {
  try {
    return document.defaultView?.localStorage ?? null;
  } catch {
    return null;
  }
}
