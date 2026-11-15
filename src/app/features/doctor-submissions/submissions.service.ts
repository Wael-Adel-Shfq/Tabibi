import { inject, Service } from '@angular/core';
import { FunctionsHttpError } from '@supabase/supabase-js';
import {
  DoctorSubmission,
  DuplicateDoctor,
  Page,
  PAGE_SIZE,
  SubmissionStatus,
} from '../../core/models/entities';
import { SupabaseService } from '../../core/supabase/supabase.service';
import { unwrap, unwrapPage } from '../../core/supabase/unwrap';

const SUBMISSION_SELECT = '*, specialty:specialties(id, name_ar, name_en), location_chain';

/** Payload accepted by the `submit-doctor` Edge Function. */
export interface SubmissionPayload {
  full_name: string;
  specialty_id: string | null;
  specialty_other: string | null;
  clinic_phone: string | null;
  location_id: string;
  location_other: string | null;
  address: string;
  map_url: string | null;
  submitter_name: string | null;
  submitter_contact: string | null;
  /** Honeypot: always empty for real visitors. */
  website: string;
}

export type SubmitOutcome = 'ok' | 'rate_limited' | 'invalid' | 'error';

/** Reasons the database can refuse an approval. */
export type ApprovalProblem =
  | 'possible_duplicate'
  | 'specialty_required'
  | 'submission_not_pending'
  | 'location_required'
  | 'location_too_broad';

@Service()
export class SubmissionsService {
  private readonly supabase = inject(SupabaseService).client;

  /**
   * Sends a public suggestion. Visitors cannot insert into the table
   * directly; the Edge Function validates, rate-limits and stores it as
   * pending.
   */
  async submit(payload: SubmissionPayload): Promise<SubmitOutcome> {
    const { error } = await this.supabase.functions.invoke('submit-doctor', { body: payload });
    if (!error) return 'ok';
    if (error instanceof FunctionsHttpError) {
      const status = (error.context as Response | undefined)?.status;
      if (status === 429) return 'rate_limited';
      if (status === 400) return 'invalid';
    }
    return 'error';
  }

  // --- Admin operations ---

  async list(status: SubmissionStatus | 'all', page = 0): Promise<Page<DoctorSubmission>> {
    const from = page * PAGE_SIZE;
    let request = this.supabase
      .from('doctor_submissions')
      .select(SUBMISSION_SELECT, { count: 'exact' });
    if (status !== 'all') request = request.eq('status', status);
    const result = await request
      .order('created_at', { ascending: false })
      .range(from, from + PAGE_SIZE - 1);
    return unwrapPage<DoctorSubmission>(result);
  }

  async duplicates(submissionId: string): Promise<DuplicateDoctor[]> {
    const result = await this.supabase.rpc('find_duplicate_doctors', {
      p_submission_id: submissionId,
    });
    return unwrap<DuplicateDoctor[]>(result) ?? [];
  }

  /**
   * Approves a submission. Returns null on success, or the reason the
   * database refused so the reviewer can resolve it.
   */
  async approve(
    submissionId: string,
    specialtyId: string | null,
    allowDuplicate: boolean,
    locationId: string | null = null,
  ): Promise<ApprovalProblem | null> {
    const { error } = await this.supabase.rpc('approve_submission', {
      p_submission_id: submissionId,
      p_specialty_id: specialtyId,
      p_allow_duplicate: allowDuplicate,
      p_location_id: locationId,
    });
    if (!error) return null;
    const known: ApprovalProblem[] = [
      'possible_duplicate',
      'specialty_required',
      'submission_not_pending',
      'location_required',
      'location_too_broad',
    ];
    const problem = known.find((reason) => error.message.includes(reason));
    if (problem) return problem;
    throw error;
  }

  async reject(submissionId: string, note: string | null): Promise<void> {
    unwrap(
      await this.supabase.rpc('reject_submission', {
        p_submission_id: submissionId,
        p_note: note,
      }),
    );
  }

  async remove(submissionId: string): Promise<void> {
    unwrap(await this.supabase.from('doctor_submissions').delete().eq('id', submissionId));
  }
}
