import type {
  Agent,
  AgentDraft,
  AgentPatch,
  AgentRequest,
  AuditEntry,
  Authority,
  Connection,
  Decision,
  Department,
  LaunchJob,
  Office,
  OfficeAccess,
  Person,
  Receipt,
  RequestStatus,
  Session,
  StoreState,
  ToolMode,
} from '@/shared/schemas';
import type { FleetOffice } from '@/shared/schemas/fleet';
import type { ProvisionInput } from '@/shared/schemas/provision';
import type { Invite, InvitePreview } from '@/shared/schemas/invite';
import type { InviteState } from '@/shared/lib/invite';

/**
 * The seam. Prompt 1 item 5 fixes the operation list; FD-2 and Prompt 1.5 make
 * `SupabaseApiClient` a planned second implementation selected by
 * VITE_API_MODE=mock|supabase (errata E-20 — Prompt 7's `http` mode is superseded).
 *
 * Designed for both implementations from the start, so the swap is one file:
 *   - every operation is async, even where the mock answers synchronously;
 *   - nothing in the interface mentions localStorage, a ticker, or a store shape;
 *   - identity arrives as a Session the mock can fake and Supabase can supply;
 *   - failures are a typed result, not a thrown string.
 *
 * CLAUDE.md: "Do not change the interface to suit an implementation."
 */

/** A rule the product refused, in the words a screen can show. Never a status code. */
export type Refusal = { ok: false; problems: string[] };
export type Accepted<T = void> = { ok: true; value: T };
export type Result<T = void> = Accepted<T> | Refusal;

export const accept = <T>(value: T): Accepted<T> => ({ ok: true, value });
export const refuse = (...problems: string[]): Refusal => ({ ok: false, problems });

export type Unsubscribe = () => void;

export interface ApiClient {
  /* ---- the whole document, for screens that need several slices at once ---- */
  getState(): Promise<StoreState>;
  /** Fires on any change, local or from another tab. The source lets a screen ignore ticks. */
  subscribe(listener: (source: 'user' | 'tick' | 'job' | 'remote') => void): Unsubscribe;

  /* ---- org ---- */
  getOffice(): Promise<Office>;
  saveOffice(patch: Partial<Pick<Office, 'name' | 'domain' | 'step' | 'connectLater'>>): Promise<Result>;
  applyTemplate(templateId: string): Promise<Result>;
  listDepartments(): Promise<Department[]>;
  addDepartment(name: string): Promise<Result<Department>>;
  renameDepartment(id: string, name: string): Promise<Result>;
  removeDepartment(id: string): Promise<Result>;
  listPeople(): Promise<Person[]>;
  addPerson(p?: Partial<Person>): Promise<Result<Person>>;
  updatePerson(id: string, patch: Partial<Omit<Person, 'id'>>): Promise<Result>;
  removePerson(id: string): Promise<Result>;
  toggleAuthority(id: string, authority: Authority): Promise<Result>;
  setAccess(id: string, access: OfficeAccess): Promise<Result>;

  /* ---- teammates ---- */
  listAgents(): Promise<Agent[]>;
  /** Create only. Never an update: see `updateAgent`. */
  createAgent(draft: AgentDraft): Promise<Result<Agent>>;
  /**
   * Update only, and a PATCH. The prototype had one create-or-update function that
   * assigned a whole record, so an omitted field was reset to its default — roleId and
   * deptId both observed going null at runtime (docs/plan.md 4-B2).
   */
  updateAgent(id: string, patch: AgentPatch): Promise<Result>;
  removeAgent(id: string): Promise<Result>;
  assign(agentId: string, personId: string | null): Promise<Result>;
  autoAssign(): Promise<Result>;
  savePrompt(id: string, prompt: string, byName: string, guardrails?: string[]): Promise<Result>;
  togglePause(id: string, byName: string): Promise<Result>;

  /* ---- connectors ---- */
  listConnections(): Promise<Record<string, Connection>>;
  connect(key: string, mode: ToolMode): Promise<Result>;
  disconnect(key: string): Promise<Result>;

  /* ---- launch ---- */
  startLaunch(simulateFailure?: boolean): Promise<Result>;
  retryLaunch(): Promise<Result>;
  getLaunchStatus(): Promise<LaunchJob | null>;

  /* ---- requests ---- */
  listRequests(): Promise<AgentRequest[]>;
  submitRequest(
    by: string,
    form: Pick<AgentRequest, 'name' | 'purpose' | 'prompt' | 'tools' | 'reason'>,
    revisingId?: string,
  ): Promise<Result>;
  cancelRequest(id: string): Promise<Result>;
  decide(id: string, decision: RequestStatus, detail: Decision): Promise<Result>;

  /* ---- receipts and the audit ---- */
  listReceipts(): Promise<Receipt[]>;
  listAudit(): Promise<AuditEntry[]>;

  /* ---- fleet (operator surface only) ---- */
  /**
   * THE ONLY OPERATIONS THAT SPAN OFFICES, with the invitations below and the dev-only
   * `bindOffice`.
   *
   * Every office-facing operation above acts on the CURRENT office and takes no office
   * identifier, and that is a hard rule rather than a style choice (FD-31 constraint 1). In
   * production each office is its own deployment with its own database (FD-1, PRD 14.1) and
   * the fleet console sees it only through the nightly numbers rollup (S-38). If an
   * office-facing method ever grows an `officeId`, the mock has taught this frontend
   * something production cannot do. `seam.test.ts` fails if one does.
   */
  listOffices(): Promise<FleetOffice[]>;
  getFleetOffice(id: string): Promise<FleetOffice | undefined>;
  /**
   * S-01 plus A-04: create the office and issue its Org Admin's invitation, atomically.
   *
   * `byName` is the operator, passed in as data so no operator string is compiled into the
   * shared client. Returns the invitation, because **there is no mail service in this stack
   * and nothing here pretends one sent anything** (FD-32): the caller surfaces the link.
   */
  provisionOffice(
    input: ProvisionInput,
    byName: string,
  ): Promise<Result<{ officeId: string; token: string; url: string }>>;

  /* ---- invitations (A-04) ---- */
  /**
   * Keyed by TOKEN, never by office id: in production the link is served by the office's own
   * deployment, so the token is what routes. Both refuse with the words a screen can show --
   * "already been used", "expired" -- and an unknown token reads the same as a tampered one.
   */
  getInvite(token: string): Promise<Result<InvitePreview>>;
  acceptInvite(token: string, password: string): Promise<Result<{ officeId: string }>>;
  /**
   * Operator and dev only: how the console offers "Copy invite link" while no mail service
   * exists.
   *
   * `state` is resolved HERE rather than by the caller, because used-or-expired depends on a
   * clock and a clock read inside a React render is impure. The client owns the clock.
   */
  listInvites(): Promise<Array<Invite & { url: string; state: InviteState }>>;

  /* ---- session ---- */
  getSession(): Promise<Session>;
  signInAs(userId: string | null): Promise<Result>;

  /* ---- dev only; a real client may refuse all four ---- */
  loadDemo(): Promise<Result>;
  resetFresh(): Promise<Result>;
  setSimulation(on: boolean): Promise<Result>;
  /**
   * Point the office-facing operations at another office. **DEV ONLY.**
   *
   * The one place outside the fleet and invitation surfaces where an office identifier
   * appears, and `seam.test.ts` names it as an explicit exemption rather than letting it
   * pass unnoticed. In production this operation does not exist: which office you are in is
   * decided by the deployment whose URL you opened.
   */
  bindOffice(officeId: string): Promise<Result>;
}
