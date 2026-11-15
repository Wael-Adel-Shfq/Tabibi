import { computed, inject, Service, signal } from '@angular/core';
import type { Session } from '@supabase/supabase-js';
import { SupabaseService } from '../supabase/supabase.service';
import type { UserRole } from '../models/entities';

/**
 * Admin authentication state. The role held here only drives the UI; every
 * privileged operation is checked again by the database.
 */
@Service()
export class AuthService {
  private readonly supabase = inject(SupabaseService).client;

  private readonly sessionState = signal<Session | null>(null);
  private readonly roleState = signal<UserRole | null>(null);
  private readonly initialised: Promise<void>;

  readonly session = this.sessionState.asReadonly();
  readonly email = computed(() => this.sessionState()?.user.email ?? null);
  readonly isAdmin = computed(() => this.roleState() === 'admin');

  constructor() {
    this.initialised = this.supabase.auth.getSession().then(({ data }) => this.apply(data.session));
    this.supabase.auth.onAuthStateChange((event, session) => {
      if (event === 'SIGNED_OUT') {
        this.sessionState.set(null);
        this.roleState.set(null);
      } else if (event === 'TOKEN_REFRESHED') {
        this.sessionState.set(session);
      }
    });
  }

  /** Resolves once the stored session (if any) and its role have been loaded. */
  ready(): Promise<void> {
    return this.initialised;
  }

  /** Signs in and returns whether the account is an administrator. */
  async signIn(email: string, password: string): Promise<boolean> {
    const { data, error } = await this.supabase.auth.signInWithPassword({ email, password });
    if (error) throw error;
    await this.apply(data.session);
    if (!this.isAdmin()) {
      await this.signOut();
      return false;
    }
    return true;
  }

  async signOut(): Promise<void> {
    await this.supabase.auth.signOut();
    this.sessionState.set(null);
    this.roleState.set(null);
  }

  private async apply(session: Session | null): Promise<void> {
    this.sessionState.set(session);
    if (!session) {
      this.roleState.set(null);
      return;
    }
    const { data } = await this.supabase
      .from('profiles')
      .select('role')
      .eq('id', session.user.id)
      .maybeSingle();
    this.roleState.set((data?.['role'] as UserRole | undefined) ?? 'user');
  }
}
