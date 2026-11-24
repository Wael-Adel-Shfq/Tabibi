export type FacilityType = 'lab' | 'pharmacy' | 'medical_center';
export type SubmissionStatus = 'pending' | 'approved' | 'rejected';
export type SlotPlacement = 'home_top' | 'home_middle' | 'doctors_list' | 'facilities_list';
export type PopupPlacement = 'popup_home' | 'popup_doctors' | 'popup_facilities';
export type AdPlacement = SlotPlacement | PopupPlacement;
export type UserRole = 'user' | 'admin';

export const FACILITY_TYPES: readonly FacilityType[] = ['lab', 'pharmacy', 'medical_center'];
export const AD_PLACEMENTS: readonly AdPlacement[] = [
  'home_top',
  'home_middle',
  'doctors_list',
  'facilities_list',
  'popup_home',
  'popup_doctors',
  'popup_facilities',
];

export function isPopupPlacement(placement: string): placement is PopupPlacement {
  return placement.startsWith('popup_');
}

/** Anything with a bilingual name; English may be missing. */
export interface Named {
  name_ar: string;
  name_en: string | null;
}

export interface NamedRef extends Named {
  id: string;
}

/** Shape shared by lookup rows (specialties, locations). */
export interface Lookup extends NamedRef {
  is_active: boolean;
  sort_order: number;
  created_at: string;
}

export type Specialty = Lookup;

// ---------------------------------------------------------------------------
// Location tree
// ---------------------------------------------------------------------------

export type LocationKind = 'governorate' | 'region' | 'district' | 'center' | 'city' | 'area';

/** Kinds allowed directly under each kind ('root' = top level). Mirrors the database rule. */
export const CHILD_KINDS: Readonly<Record<LocationKind | 'root', readonly LocationKind[]>> = {
  root: ['governorate'],
  governorate: ['region', 'district', 'center', 'city'],
  region: ['district', 'city'],
  center: ['city', 'area'],
  district: ['area'],
  city: ['area'],
  area: [],
};

/** Too broad to place a doctor, facility or suggestion at. */
export function isTooBroad(kind: LocationKind | null | undefined): boolean {
  return kind === 'governorate' || kind === 'region';
}

/** A node of the location tree. */
export interface Location extends Lookup {
  parent_id: string | null;
  kind: LocationKind;
  /** Ancestor ids from the governorate down to this location (inclusive). */
  path: string[];
}

/** One step of a record's location chain, as returned by the `location_chain` computed column. */
export interface ChainItem extends NamedRef {
  kind: LocationKind;
}

/**
 * The chain as visitors see it: regions only organise Cairo for the admin, so
 * the public pages leave them out ("القاهرة · مدينة نصر").
 */
export function withoutRegions(chain: readonly ChainItem[] | null | undefined): ChainItem[] {
  return (chain ?? []).filter((step) => step.kind !== 'region');
}

/** Location fields shared by doctors, facilities, submissions and advertisements. */
export interface Placed {
  location_id: string | null;
  location_path: string[];
  location_chain?: ChainItem[];
}

// ---------------------------------------------------------------------------
// Directory records
// ---------------------------------------------------------------------------

export interface Located {
  map_url: string | null;
  latitude: number | null;
  longitude: number | null;
}

export interface Doctor extends Located, Placed {
  id: string;
  full_name: string;
  specialty_id: string;
  clinic_phone: string | null;
  location_id: string;
  address: string;
  /** Optional photo in the `listing-images` bucket (max 1 MB). */
  image_path: string | null;
  is_active: boolean;
  created_at: string;
  updated_at: string;
  specialty?: NamedRef | null;
}

export interface DoctorSubmission extends Located, Placed {
  id: string;
  full_name: string;
  specialty_id: string | null;
  specialty_other: string | null;
  clinic_phone: string | null;
  location_id: string;
  address: string;
  /** A place the visitor could not find, proposed under `location_id`. */
  location_other: string | null;
  submitter_name: string | null;
  submitter_contact: string | null;
  status: SubmissionStatus;
  reviewed_by: string | null;
  reviewed_at: string | null;
  approved_doctor_id: string | null;
  admin_note: string | null;
  created_at: string;
  specialty?: NamedRef | null;
}

export interface DuplicateDoctor {
  id: string;
  full_name: string;
  specialty_name_ar: string;
  specialty_name_en: string;
  clinic_phone: string | null;
  address: string;
  location_chain: ChainItem[];
  is_active: boolean;
  name_similarity: number;
  phone_match: boolean;
}

export interface Facility extends Located, Placed {
  id: string;
  name: string;
  type: FacilityType;
  location_id: string;
  address: string;
  phone: string | null;
  /** Optional photo in the `listing-images` bucket (max 1 MB). */
  image_path: string | null;
  is_active: boolean;
  created_at: string;
  updated_at: string;
}

export interface Advertisement extends Placed {
  id: string;
  title: string;
  advertiser_name: string;
  image_path: string;
  address: string | null;
  map_url: string | null;
  phone: string | null;
  placement: AdPlacement;
  display_order: number;
  is_active: boolean;
  starts_at: string | null;
  ends_at: string | null;
  /** Popup placements only: seconds after the page opens before it appears. */
  popup_delay_seconds: number;
  /** Popup placements only: seconds before it closes itself; null = until closed. */
  popup_duration_seconds: number | null;
  /** Popup placements only: hours before the same visitor sees it again (0 = every visit). */
  popup_repeat_hours: number;
  created_at: string;
  updated_at: string;
}

export interface DashboardStats {
  doctors: number;
  labs: number;
  pharmacies: number;
  medical_centers: number;
  pending_submissions: number;
  active_advertisements: number;
}

export interface Page<T> {
  items: T[];
  total: number;
}

export const PAGE_SIZE = 20;
