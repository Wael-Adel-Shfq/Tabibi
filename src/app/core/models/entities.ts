export type FacilityType = 'lab' | 'pharmacy' | 'medical_center';
export type SubmissionStatus = 'pending' | 'approved' | 'rejected';
export type AdPlacement = 'home_top' | 'home_middle' | 'doctors_list' | 'facilities_list';
export type UserRole = 'user' | 'admin';

export const FACILITY_TYPES: readonly FacilityType[] = ['lab', 'pharmacy', 'medical_center'];
export const AD_PLACEMENTS: readonly AdPlacement[] = [
  'home_top',
  'home_middle',
  'doctors_list',
  'facilities_list',
];

/** Anything with a bilingual name; English may be missing. */
export interface Named {
  name_ar: string;
  name_en: string | null;
}

export interface NamedRef extends Named {
  id: string;
}

/** Shape shared by governorates, areas and specialties. */
export interface Lookup extends NamedRef {
  is_active: boolean;
  sort_order: number;
  created_at: string;
}

export type Governorate = Lookup;
export type Specialty = Lookup;

export interface Area extends Lookup {
  governorate_id: string;
  governorate?: NamedRef | null;
}

export interface Located {
  map_url: string | null;
  latitude: number | null;
  longitude: number | null;
}

export interface Doctor extends Located {
  id: string;
  full_name: string;
  specialty_id: string;
  clinic_phone: string | null;
  governorate_id: string;
  area_id: string;
  address: string;
  is_active: boolean;
  created_at: string;
  updated_at: string;
  specialty?: NamedRef | null;
  governorate?: NamedRef | null;
  area?: NamedRef | null;
}

export interface DoctorSubmission extends Located {
  id: string;
  full_name: string;
  specialty_id: string | null;
  specialty_other: string | null;
  clinic_phone: string | null;
  governorate_id: string;
  area_id: string;
  address: string;
  submitter_name: string | null;
  submitter_contact: string | null;
  status: SubmissionStatus;
  reviewed_by: string | null;
  reviewed_at: string | null;
  approved_doctor_id: string | null;
  admin_note: string | null;
  created_at: string;
  specialty?: NamedRef | null;
  governorate?: NamedRef | null;
  area?: NamedRef | null;
}

export interface DuplicateDoctor {
  id: string;
  full_name: string;
  specialty_name_ar: string;
  specialty_name_en: string;
  clinic_phone: string | null;
  address: string;
  area_name_ar: string;
  is_active: boolean;
  name_similarity: number;
  phone_match: boolean;
}

export interface Facility extends Located {
  id: string;
  name: string;
  type: FacilityType;
  governorate_id: string;
  area_id: string;
  address: string;
  phone: string | null;
  is_active: boolean;
  created_at: string;
  updated_at: string;
  governorate?: NamedRef | null;
  area?: NamedRef | null;
}

export interface Advertisement {
  id: string;
  title: string;
  advertiser_name: string;
  image_path: string;
  governorate_id: string | null;
  area_id: string | null;
  address: string | null;
  map_url: string | null;
  phone: string | null;
  placement: AdPlacement;
  display_order: number;
  is_active: boolean;
  starts_at: string | null;
  ends_at: string | null;
  created_at: string;
  updated_at: string;
  governorate?: NamedRef | null;
  area?: NamedRef | null;
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
