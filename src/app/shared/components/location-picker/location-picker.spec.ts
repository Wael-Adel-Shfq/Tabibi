import { signal } from '@angular/core';
import { TestBed } from '@angular/core/testing';
import { provideTranslateService } from '@ngx-translate/core';
import { LanguageService } from '../../../core/i18n/language.service';
import type { Location, LocationKind } from '../../../core/models/entities';
import { LocationsService } from '../../../features/locations/locations.service';
import { LocationPicker } from './location-picker';

function place(id: string, kind: LocationKind, path: string[], name: string, nameEn: string | null = null): Location {
  return {
    id,
    kind,
    path,
    parent_id: path.length > 1 ? path[path.length - 2] : null,
    name_ar: name,
    name_en: nameEn,
    is_active: true,
    sort_order: 0,
  } as Location;
}

const cairo = place('cairo', 'governorate', ['cairo'], 'القاهرة', 'Cairo');
const minya = place('minya', 'governorate', ['minya'], 'المنيا', 'Minya');
const nasr = place('nasr', 'district', ['cairo', 'east', 'nasr'], 'مدينة نصر');
const mallawi = place('mallawi', 'center', ['minya', 'mallawi'], 'ملوي');
const tuna = place('tuna', 'area', ['minya', 'mallawi', 'tuna'], 'تونا الجبل');

const locationsStub = {
  version: signal(0),
  children: (id: string | null) => Promise.resolve(id === null ? [cairo, minya] : id === 'minya' ? [mallawi] : id === 'mallawi' ? [tuna] : []),
  childrenSkippingRegions: (id: string | null) => locationsStub.children(id),
  placesUnder: (id: string) => Promise.resolve(id === 'cairo' ? [nasr] : []),
  allPlaces: () => Promise.resolve([nasr, mallawi, tuna]),
};

async function settle(fixture: { whenStable(): Promise<unknown>; detectChanges(): void }): Promise<void> {
  for (let i = 0; i < 4; i++) {
    await new Promise((resolve) => setTimeout(resolve));
    fixture.detectChanges();
    await fixture.whenStable();
  }
}

describe('LocationPicker with directPlaces', () => {
  beforeEach(() => {
    TestBed.configureTestingModule({
      imports: [LocationPicker],
      providers: [
        provideTranslateService(),
        { provide: LocationsService, useValue: locationsStub },
        { provide: LanguageService, useValue: { name: (item: Location | null) => item?.name_ar ?? '' } },
      ],
    });
  });

  async function create() {
    const fixture = TestBed.createComponent(LocationPicker);
    fixture.componentRef.setInput('idPrefix', 'p');
    fixture.componentRef.setInput('skipRegions', true);
    fixture.componentRef.setInput('twoLevel', true);
    fixture.componentRef.setInput('directPlaces', true);
    await settle(fixture);
    // `levels` is protected; read it the way the template does.
    const levels = () => (fixture.componentInstance as unknown as { levels(): { direct?: boolean; choices: { value: string; label: string }[] }[] }).levels();
    const select = (index: number, value: string) =>
      (fixture.componentInstance as unknown as { onSelect(level: unknown, value: string): void }).onSelect(levels()[index], value);
    return { fixture, levels, select };
  }

  it('lists every place, with where it is, before a governorate is chosen', async () => {
    const { levels } = await create();
    expect(levels().length).toBe(2);
    expect(levels()[1].direct).toBe(true);
    expect(levels()[1].choices.map((choice) => choice.label)).toEqual([
      'مدينة نصر — القاهرة',
      'ملوي — المنيا',
      'تونا الجبل — ملوي، المنيا',
    ]);
  });

  it('fills in the governorate and the levels between from the picked place', async () => {
    const { fixture, levels, select } = await create();
    select(1, 'tuna');
    await settle(fixture);
    expect(fixture.componentInstance.path()).toEqual(['minya', 'mallawi', 'tuna']);
    expect(levels().some((level) => level.direct)).toBe(false);
  });

  it('keeps Cairo in two levels when a Cairo district is picked directly', async () => {
    const { fixture, levels, select } = await create();
    select(1, 'nasr');
    await settle(fixture);
    expect(fixture.componentInstance.path()).toEqual(['cairo', 'east', 'nasr']);
    expect(levels().length).toBe(2);
  });
});
