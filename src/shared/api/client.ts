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
import type { FleetOffice, ProvisionInput } from '@/shared/schemas/fleet';

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
  listOffices(): Promise<FleetOffice[]>;
  getFleetOffice(id: string): Promise<FleetOffice | undefined>;
  provisionOffice(input: ProvisionInput): Promise<Result>;

  /* ---- session ---- */
  getSession(): Promise<Session>;
  signInAs(userId: string | null): Promise<Result>;

  /* ---- dev only; a real client may refuse all three ---- */
  loadDemo(): Promise<Result>;
  resetFresh(): Promise<Result>;
  setSimulation(on: boolean): Promise<Result>;
}
