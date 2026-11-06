import {
  accept,
  refuse,
  type ApiClient,
  type Result,
  type Unsubscribe,
} from '@/shared/api/client';
import {
  canRemoveAgent,
  canRemoveDepartment,
  canRemovePerson,
  pickOwner,
  requiredTools,
  validateAgentDraft,
  validateOrg,
} from '@/shared/lib/validate';
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
import { provisionInputSchema, type ProvisionInput } from '@/shared/schemas/provision';
import type { FleetMeta, Invite, InvitePreview } from '@/shared/schemas/invite';
import {
  INVITE_MESSAGE,
  INVITE_TTL_MS,
  inviteState,
  inviteUrl,
  newInviteToken,
  type InviteState,
} from '@/shared/lib/invite';
import {
  CONNECT_SIM_MS,
  DEFAULT_BUDGET,
  DEFAULT_CONNECTION_LIMITS,
  LAUNCH_STEPS,
  LAUNCH_STEP_MS,
  MIN_PROMPT_CHARS,
  ORG_TEMPLATES,
  PROVISION_STEP_MS,
  TICKER_MS,
} from '@/shared/seeds/config';
import { mintRuntimeRef } from './runtime-ref';
import { blank, fresh, receiptFeed, sampleDoing, uid } from '@/shared/seeds/office';
import { toolName } from '@/shared/seeds/tools';
import { MockStore, type Source } from './store';

const nowMs = () => Date.now();

/**
 * Reads hand back a copy, never a live reference into the store.
 *
 * Without this the mock leaks its internals: a caller that held an Agent saw it mutate
 * underneath them, which a network-backed client would never do. It also matters to React
 * -- TanStack Query compares by identity, so a mutated-in-place object looks unchanged and
 * a screen silently stops re-rendering. Cheap at this size, and it keeps the mock honest
 * about being behind the same interface as SupabaseApiClient.
 */
const copy = <T>(v: T): T => structuredClone(v);

export type MockOptions = {
  simulate?: boolean;
  store?: MockStore;
  /**
   * Operator fixtures, supplied only by the fleet entry. Keeping them out of the mock's own
   * imports is what keeps other customers' names out of a customer's bundle (FD-1).
   */
  sampleOffices?: readonly FleetOffice[];
  instanceVersion?: string;
  provisionSteps?: ReadonlyArray<readonly [string, string]>;
  /**
   * Marks this client as the OPERATOR surface, where every office-facing read returns zero
   * rows.
   *
   * It is the mock's stand-in for Prompt 1.5 rule 3 -- "Super Admin gets no policy on
   * `agents`, `requests` or any content table" -- and FD-31 constraint 6. Holding every
   * instance in one document makes that boundary a discipline rather than a wall, so it is
   * enforced here at the seam and asserted in `boundary.test.ts`.
   *
   * Named without the operator's own words on purpose: the mock ships in all three bundles,
   * and `customer-surface.test.ts` greps them.
   */
  fleetSide?: boolean;
  /** Injectable clock, so an expiry test needs no timer tricks. */
  now?: () => number;
};

export class MockApiClient implements ApiClient {
  private store: MockStore;
  private simulate: boolean;
  private timer: ReturnType<typeof setInterval> | null = null;
  private jobActive = false;
  private provision: { i: number; input: ProvisionInput; done: boolean } | null = null;
  private sampleOffices: readonly FleetOffice[];
  private instanceVersion: string;
  private provisionSteps: ReadonlyArray<readonly [string, string]>;
  private fleetSide: boolean;
  private now: () => number;
  /** Returned by every office-facing read when there is no office to read. Never mutated. */
  private readonly nothing: StoreState = blank();

  constructor(opts: MockOptions = {}) {
    this.instanceVersion = opts.instanceVersion ?? '0.0.0';
    this.store = opts.store ?? new MockStore(this.instanceVersion);
    this.simulate = opts.simulate ?? true;
    this.sampleOffices = opts.sampleOffices ?? [];
    this.provisionSteps = opts.provisionSteps ?? [];
    this.fleetSide = opts.fleetSide ?? false;
    this.now = opts.now ?? nowMs;
    this.startTicker();
  }

  /* ------------------------------------------------------------------ plumbing */

  /**
   * THE CURRENT INSTANCE -- what every office-facing operation reads, and the reason none of
   * them takes an office identifier (FD-31 constraint 1).
   *
   * Two cases answer with an empty office rather than throwing: nothing is bound yet, and
   * the operator surface, which reaches no customer content at all.
   */
  private s(): StoreState {
    if (this.fleetSide) return this.nothing;
    return this.store.get() ?? this.nothing;
  }

  private u(fn: (s: StoreState) => void, source: Source = 'user'): void {
    // The operator writes nothing into an office through the office-facing surface. The one
    // way an operator action reaches an office is `store.updateInstance`, used by the fleet
    // operations below, which writes the S-23 audit row into that office's own audit.
    if (this.fleetSide) return;
    this.store.update(fn, source);
  }

  async getState(): Promise<StoreState> {
    return copy(this.s());
  }

  subscribe(listener: (source: Source) => void): Unsubscribe {
    return this.store.subscribe(listener);
  }

  dispose(): void {
    if (this.timer) clearInterval(this.timer);
    this.timer = null;
  }

  /* ---------------------------------------------------------------------- org */

  async getOffice(): Promise<Office> {
    return copy(this.s().org);
  }

  async saveOffice(patch: Partial<Office>): Promise<Result> {
    this.u((s) => Object.assign(s.org, patch));
    return accept(undefined);
  }

  async applyTemplate(templateId: string): Promise<Result> {
    const t = ORG_TEMPLATES.find((x) => x.id === templateId);
    if (!t) return refuse('That template does not exist.');
    this.u((s) => {
      s.org.template = templateId;
      for (const name of t.depts) {
        if (!s.departments.some((d) => d.name.toLowerCase() === name.toLowerCase()))
          s.departments.push({ id: uid('d_'), name });
      }
    });
    return accept(undefined);
  }

  async listDepartments(): Promise<Department[]> {
    return copy(this.s().departments);
  }

  async addDepartment(name: string): Promise<Result<Department>> {
    const n = (name ?? '').trim();
    if (!n) return refuse('Enter a name.');
    if (this.s().departments.some((d) => d.name.toLowerCase() === n.toLowerCase()))
      return refuse('That department already exists.');
    const d: Department = { id: uid('d_'), name: n };
    this.u((s) => s.departments.push(d));
    return accept(copy(d));
  }

  async renameDepartment(id: string, name: string): Promise<Result> {
    const n = (name ?? '').trim();
    if (!n) return refuse('Enter a name.');
    this.u((s) => {
      const d = s.departments.find((x) => x.id === id);
      if (d) d.name = n;
    });
    return accept(undefined);
  }

  async removeDepartment(id: string): Promise<Result> {
    const why = canRemoveDepartment(this.s(), id);
    if (why) return refuse(why);
    this.u((s) => {
      s.departments = s.departments.filter((d) => d.id !== id);
    });
    return accept(undefined);
  }

  async listPeople(): Promise<Person[]> {
    return copy(this.s().people);
  }

  async addPerson(p: Partial<Person> = {}): Promise<Result<Person>> {
    const person: Person = {
      id: uid('p_'),
      name: '',
      email: '',
      title: '',
      deptId: this.s().departments[0]?.id ?? null,
      access: 'user',
      authorities: [],
      ...p,
    };
    this.u((s) => s.people.push(person));
    return accept(copy(person));
  }

  async updatePerson(id: string, patch: Partial<Omit<Person, 'id'>>): Promise<Result> {
    this.u((s) => {
      const p = s.people.find((x) => x.id === id);
      if (p) Object.assign(p, patch);
    });
    return accept(undefined);
  }

  async removePerson(id: string): Promise<Result> {
    const why = canRemovePerson(this.s(), id);
    if (why) return refuse(why);
    this.u((s) => {
      s.people = s.people.filter((p) => p.id !== id);
    });
    return accept(undefined);
  }

  async toggleAuthority(id: string, authority: Authority): Promise<Result> {
    this.u((s) => {
      const p = s.people.find((x) => x.id === id);
      if (!p) return;
      p.authorities = p.authorities.includes(authority)
        ? p.authorities.filter((a) => a !== authority)
        : [...p.authorities, authority];
    });
    return accept(undefined);
  }

  async setAccess(id: string, access: OfficeAccess): Promise<Result> {
    const s0 = this.s();
    const p = s0.people.find((x) => x.id === id);
    if (p?.access === 'admin' && access !== 'admin' && s0.people.filter((x) => x.access === 'admin').length === 1)
      return refuse('Every office keeps at least one Org Admin.');
    return this.updatePerson(id, { access });
  }

  /* ---------------------------------------------------------------- teammates */

  async listAgents(): Promise<Agent[]> {
    return copy(this.s().agents);
  }

  async createAgent(draft: AgentDraft): Promise<Result<Agent>> {
    const problems = validateAgentDraft({ ...draft, id: null }, this.s());
    if (problems.length) return refuse(...problems);
    const now = nowMs();
    const a: Agent = {
      id: uid('a_'),
      roleId: draft.roleId,
      name: draft.name.trim(),
      job: draft.job.trim(),
      type: draft.type,
      deptId: draft.deptId,
      managerId: draft.type === 'coordinator' ? null : draft.managerId,
      ownerId: null,
      status: 'draft',
      pausedBy: null,
      doing: 'Not started',
      prompt: draft.prompt.trim(),
      version: 1,
      versions: [{ v: 1, prompt: draft.prompt.trim(), at: now, by: 'Org Admin' }],
      guardrails: [...this.s().org.guardrails],
      tools: [...draft.tools],
      budget: { ...draft.budget },
      runsToday: 0,
      costToday: 0,
      lastActive: now,
      provisioned: false,
      runtimeRef: null,
      blockedBy: [],
      perf: { daily: [0, 0, 0, 0, 0, 0, 0], success: 100, avgSec: 0, edited: 0, cost7: 0 },
    };
    this.u((s) => {
      if (s.org.launched) provisionAgent(a, s);
      s.agents.push(a);
      this.store.audit('Org Admin', `added agent ${a.name}`);
    });
    return accept(copy(a));
  }

  /**
   * A patch, and only the keys present are touched. DEFECT FIX, docs/plan.md 4-B2: the
   * prototype's single create-or-update assigned a whole body, so omitting roleId or deptId
   * silently nulled them -- and roleId is what the "Right now" lines and the receipts are
   * keyed on, so losing it emptied a user's Activity screen.
   */
  async updateAgent(id: string, patch: AgentPatch): Promise<Result> {
    const s0 = this.s();
    const current = s0.agents.find((a) => a.id === id);
    if (!current) return refuse('That agent no longer exists.');

    const merged: AgentDraft = {
      id,
      type: current.type,
      roleId: current.roleId,
      name: patch.name ?? current.name,
      job: patch.job ?? current.job,
      deptId: patch.deptId !== undefined ? patch.deptId : current.deptId,
      managerId: patch.managerId !== undefined ? patch.managerId : current.managerId,
      prompt: patch.prompt ?? current.prompt,
      tools: patch.tools ?? current.tools,
      budget: patch.budget ?? current.budget,
    };
    const problems = validateAgentDraft(merged, s0);
    if (problems.length) return refuse(...problems);

    this.u((s) => {
      const a = s.agents.find((x) => x.id === id);
      if (!a) return;
      const promptChanged = merged.prompt.trim() !== a.prompt.trim();
      // Only the keys the caller sent. roleId, ownerId, status, perf, versions, guardrails
      // and every other field are not in AgentPatch and cannot be reached from here.
      for (const k of Object.keys(patch) as (keyof AgentPatch)[]) {
        if (patch[k] === undefined) continue;
        if (k === 'name' || k === 'job' || k === 'prompt') {
          (a[k] as string) = String(merged[k]).trim();
        } else if (k === 'tools') {
          a.tools = [...merged.tools];
        } else if (k === 'budget') {
          a.budget = { ...merged.budget };
        } else if (k === 'deptId') {
          a.deptId = merged.deptId;
        } else if (k === 'managerId') {
          a.managerId = a.type === 'coordinator' ? null : merged.managerId;
        }
      }
      if (promptChanged) {
        a.version += 1;
        a.versions.push({ v: a.version, prompt: a.prompt, at: nowMs(), by: 'Org Admin' });
      }
      if (s.org.launched) provisionAgent(a, s);
      this.store.audit('Org Admin', `updated ${a.name}`);
    });
    return accept(undefined);
  }

  async removeAgent(id: string): Promise<Result> {
    const why = canRemoveAgent(this.s(), id);
    if (why) return refuse(why);
    const name = this.s().agents.find((a) => a.id === id)?.name ?? 'agent';
    this.u((s) => {
      s.agents = s.agents.filter((a) => a.id !== id);
      this.store.audit('Org Admin', `removed agent ${name}`);
    });
    return accept(undefined);
  }

  async assign(agentId: string, personId: string | null): Promise<Result> {
    this.u((s) => {
      const a = s.agents.find((x) => x.id === agentId);
      if (!a) return;
      a.ownerId = personId;
      const who = s.people.find((p) => p.id === personId)?.name;
      this.store.audit('Org Admin', who ? `${a.name} assigned to ${who}` : `${a.name} unassigned`);
    });
    return accept(undefined);
  }

  async autoAssign(): Promise<Result> {
    this.u((s) => {
      for (const a of s.agents) {
        if (a.ownerId) continue;
        const p = pickOwner(s, a);
        if (p) a.ownerId = p.id;
      }
      this.store.audit('Org Admin', 'auto-assigned agents by department');
    });
    return accept(undefined);
  }

  async savePrompt(
    id: string,
    prompt: string,
    byName: string,
    guardrails?: string[],
  ): Promise<Result> {
    const text = prompt.trim();
    if (text.length < MIN_PROMPT_CHARS)
      return refuse(`Write at least ${MIN_PROMPT_CHARS} characters of instructions.`);
    this.u((s) => {
      const a = s.agents.find((x) => x.id === id);
      if (!a) return;
      if (text !== a.prompt.trim()) {
        a.version += 1;
        a.prompt = text;
        a.versions.push({ v: a.version, prompt: text, at: nowMs(), by: byName });
      }
      if (guardrails) a.guardrails = [...guardrails];
      this.store.audit(byName, `updated ${a.name} (v${a.version})`);
    });
    return accept(undefined);
  }

  async togglePause(id: string, byName: string): Promise<Result> {
    this.u((s) => {
      const a = s.agents.find((x) => x.id === id);
      if (!a || !a.provisioned) return;
      const wasPaused = a.status === 'paused';
      a.status = wasPaused ? 'idle' : 'paused';
      a.pausedBy = wasPaused ? null : 'user';
      a.doing = wasPaused ? 'Ready. Wakes on the next task' : `Paused by ${byName}`;
      this.store.audit(byName, `${wasPaused ? 'resumed' : 'paused'} ${a.name}`);
    });
    return accept(undefined);
  }

  /* --------------------------------------------------------------- connectors */

  async listConnections(): Promise<Record<string, Connection>> {
    return copy(this.s().connections);
  }

  async connect(key: string, mode: ToolMode): Promise<Result> {
    await sleep(CONNECT_SIM_MS);
    this.u((s) => {
      s.connections[key] = {
        on: true,
        mode,
        at: nowMs(),
        by: 'Org Admin',
        limits: { ...DEFAULT_CONNECTION_LIMITS },
      };
      // DEFECT FIX, docs/plan.md 4-B3: resume only what the TOOL paused. The prototype
      // tested the display sentence with /to be connected/, and disconnect() had already
      // overwritten it, so a person's pause was silently discarded by a tool round-trip.
      for (const a of s.agents) {
        if (!a.provisioned || a.status !== 'paused' || a.pausedBy !== 'tool') continue;
        if (!a.tools.every((t) => s.connections[t]?.on)) continue;
        a.status = 'idle';
        a.pausedBy = null;
        a.blockedBy = [];
        a.doing = 'Ready. Wakes on the next task';
      }
      this.store.audit('Org Admin', `connected ${toolName(key)} (${mode})`);
    });
    return accept(undefined);
  }

  async disconnect(key: string): Promise<Result> {
    this.u((s) => {
      delete s.connections[key];
      for (const a of s.agents) {
        if (!a.provisioned || !a.tools.includes(key)) continue;
        // A person's pause outranks a tool's: it is not overwritten, and the missing tool
        // is still recorded so reconnecting can clear it.
        a.blockedBy = [...new Set([...(a.blockedBy ?? []), key])];
        if (a.pausedBy === 'user') continue;
        a.status = 'paused';
        a.pausedBy = 'tool';
        a.doing = `Waiting for ${toolName(key)} to be connected`;
      }
      this.store.audit('Org Admin', `disconnected ${toolName(key)}`);
    });
    return accept(undefined);
  }

  /* ------------------------------------------------------------------ launch */

  async startLaunch(simulateFailure = false): Promise<Result> {
    this.u((s) => {
      s.org.job = {
        steps: LAUNCH_STEPS.map(([k, label]) => ({ k, label, status: 'pending' as const })),
        simFail: simulateFailure,
        failedOnce: false,
        error: '',
        done: false,
      };
    }, 'job');
    void this.runJob();
    return accept(undefined);
  }

  async retryLaunch(): Promise<Result> {
    this.u((s) => {
      if (!s.org.job) return;
      for (const step of s.org.job.steps)
        if (step.status === 'fail' || step.status === 'run') step.status = 'pending';
      s.org.job.error = '';
    }, 'job');
    void this.runJob();
    return accept(undefined);
  }

  async getLaunchStatus(): Promise<LaunchJob | null> {
    return copy(this.s().org.job);
  }

  private async runJob(): Promise<void> {
    this.jobActive = true;
    for (;;) {
      const job = this.s().org.job;
      if (!job) break;
      const i = job.steps.findIndex((x) => x.status !== 'done');
      if (i < 0) {
        this.finishLaunch();
        break;
      }
      this.u((s) => {
        s.org.job!.steps[i]!.status = 'run';
      }, 'job');
      await sleep(LAUNCH_STEP_MS);
      const j = this.s().org.job;
      if (!j) break;
      if (j.simFail && !j.failedOnce && j.steps[i]!.k === 'profiles') {
        this.u((s) => {
          s.org.job!.steps[i]!.status = 'fail';
          s.org.job!.failedOnce = true;
          s.org.job!.error =
            'Could not create the workspace for one agent. Nothing was lost. Retry resumes from this step.';
        }, 'job');
        this.jobActive = false;
        return;
      }
      this.u((s) => {
        s.org.job!.steps[i]!.status = 'done';
      }, 'job');
    }
  }

  private finishLaunch(): void {
    this.jobActive = false;
    this.u((s) => {
      s.org.launched = true;
      if (s.org.job) s.org.job.done = true;
      for (const a of s.agents) provisionAgent(a, s);
      for (const p of s.people) if (p.access !== 'admin') p.invited = true;
      s.activity = receiptFeed(s.agents);
      this.store.audit('Org Admin', `launched the office with ${s.agents.length} agents`);
    }, 'job');
  }

  isJobActive(): boolean {
    return this.jobActive;
  }

  /* ---------------------------------------------------------------- requests */

  async listRequests(): Promise<AgentRequest[]> {
    return copy(this.s().requests);
  }

  async submitRequest(
    by: string,
    form: Pick<AgentRequest, 'name' | 'purpose' | 'prompt' | 'tools' | 'reason'>,
    revisingId?: string,
  ): Promise<Result> {
    const body = {
      name: form.name.trim(),
      purpose: form.purpose.trim(),
      prompt: form.prompt.trim(),
      reason: form.reason.trim(),
      tools: [...form.tools],
      status: 'pending' as const,
      adminNote: '',
      at: nowMs(),
    };
    this.u((s) => {
      const existing = revisingId ? s.requests.find((r) => r.id === revisingId) : undefined;
      if (existing) Object.assign(existing, body);
      else s.requests.push({ id: uid('rq'), by, ...body });
      const who = s.people.find((p) => p.id === by)?.name ?? 'Someone';
      this.store.audit(who, `asked for a new agent: ${body.name}`);
    });
    return accept(undefined);
  }

  async cancelRequest(id: string): Promise<Result> {
    this.u((s) => {
      s.requests = s.requests.filter((r) => r.id !== id);
    });
    return accept(undefined);
  }

  async decide(id: string, decision: RequestStatus, detail: Decision): Promise<Result> {
    if ((decision === 'changes' || decision === 'rejected') && !detail.note.trim())
      return refuse(
        decision === 'changes'
          ? 'Say what to change so they can fix it.'
          : 'Add a short reason so they know why.',
      );
    if (decision === 'approved' && detail.prompt.trim().length < MIN_PROMPT_CHARS)
      return refuse(`Write at least ${MIN_PROMPT_CHARS} characters of instructions.`);

    this.u((s) => {
      const r = s.requests.find((x) => x.id === id);
      if (!r) return;
      r.status = decision;
      r.adminNote =
        detail.note ||
        (decision === 'approved'
          ? JSON.stringify(detail.guards) !== JSON.stringify(s.org.guardrails)
            ? 'Approved with guardrails added.'
            : 'Approved.'
          : '');

      if (decision === 'approved') {
        const owner = s.people.find((p) => p.id === r.by);
        const coordinator = s.agents.find((a) => a.type === 'coordinator');
        const now = nowMs();
        const a: Agent = {
          id: uid('a_'),
          roleId: null,
          name: r.name,
          job: r.purpose,
          type: 'specialist',
          deptId: owner?.deptId ?? null,
          managerId: coordinator?.id ?? null,
          ownerId: r.by,
          status: 'idle',
          pausedBy: null,
          doing: 'Ready. Wakes on the next task',
          prompt: detail.prompt.trim(),
          version: 1,
          versions: [{ v: 1, prompt: detail.prompt.trim(), at: now, by: 'Org Admin' }],
          guardrails: [...detail.guards],
          tools: [...r.tools],
          budget: { ...DEFAULT_BUDGET },
          runsToday: 0,
          costToday: 0,
          lastActive: now,
          provisioned: false,
          runtimeRef: null,
          blockedBy: [],
          perf: { daily: [0, 0, 0, 0, 0, 0, 0], success: 100, avgSec: 0, edited: 0, cost7: 0 },
        };
        provisionAgent(a, s);
        s.agents.push(a);
      }
      const verb =
        decision === 'approved'
          ? 'approved'
          : decision === 'changes'
            ? 'asked for changes on'
            : 'declined';
      this.store.audit('Org Admin', `${verb} ${r.name}`);
    });
    return accept(undefined);
  }

  /* ------------------------------------------------------- receipts and audit */

  async listReceipts(): Promise<Receipt[]> {
    return copy(this.s().activity);
  }

  async listAudit(): Promise<AuditEntry[]> {
    return copy(this.s().audit);
  }

  /* ------------------------------------------------------------------- fleet */

  /**
   * Every office, from the instances in the document plus the operator's fixtures.
   *
   * COUNTS AND STATUS ONLY (PRD 7.1, 10 preamble, Prompt 1.5 rule 3). `agents` and `cost`
   * are rolled up from an instance -- which is what S-38's nightly numbers send -- and
   * nothing else crosses: no teammate name, no person, no request, no receipt. `adminEmail`,
   * `version` and `health` come from the operator's own metadata, never from a live read of
   * an office's people. Asserted in `boundary.test.ts`.
   */
  async listOffices(): Promise<FleetOffice[]> {
    const doc = this.store.document();
    const rows = Object.entries(doc.instances).map(([id, state]) =>
      this.rowFor(id, state, doc.fleetMeta[id]),
    );
    return [...rows, ...this.sampleOffices.map((o) => copy(o))];
  }

  private rowFor(id: string, state: StoreState, meta: FleetMeta | undefined): FleetOffice {
    return {
      id,
      name: state.org.name,
      domain: state.org.domain,
      status: this.statusOf(state),
      agents: state.agents.length,
      cost: Number(state.agents.reduce((t, a) => t + a.perf.cost7, 0).toFixed(2)),
      version: meta?.version ?? this.instanceVersion,
      health: meta?.health ?? 'ok',
      admin: meta?.adminEmail ?? '',
    };
  }

  /**
   * Derived, never stored, so a row cannot disagree with the office behind it.
   *
   * `awaiting` is an office whose invitation nobody has accepted: it has a document and no
   * Org Admin in it. That is why accepting an invitation moves a row from "Awaiting
   * onboarding" to "Org Admin onboarding" without anything having to set a field.
   */
  private statusOf(state: StoreState): FleetOffice['status'] {
    if (state.org.launched) return 'live';
    return state.people.some((p) => p.access === 'admin') ? 'onboarding' : 'awaiting';
  }

  async getFleetOffice(id: string): Promise<FleetOffice | undefined> {
    return (await this.listOffices()).find((o) => o.id === id);
  }

  /**
   * S-01: set up a new office, and A-04: invite its Org Admin.
   *
   * `byName` is the operator, PASSED IN as data exactly as `togglePause(id, byName)` is. The
   * mock ships in all three bundles, so a literal operator name written here would land in
   * the customer ones and fail `customer-surface.test.ts`.
   *
   * **The office and its invitation are created before the steps run, not after.** The four
   * steps are a progress display over work that is already done, which is the honest shape
   * for a mock: the previous version recorded the row only once the last step finished, so a
   * reload mid-run lost the office entirely and a second tab saw no progress at all. Every
   * interruption now leaves a complete, usable office with a live invitation.
   */
  async provisionOffice(
    input: ProvisionInput,
    byName: string,
  ): Promise<Result<{ officeId: string; token: string; url: string }>> {
    const parsed = provisionInputSchema.safeParse(input);
    if (!parsed.success) return refuse(...parsed.error.issues.map((i) => i.message));
    const clean = {
      name: parsed.data.name.trim(),
      domain: parsed.data.domain.trim().toLowerCase(),
      email: parsed.data.email.trim(),
      adminName: parsed.data.adminName.trim(),
    };

    // One office per domain. Without this a double submit made a second office, and two rows
    // on one domain is not a state the fleet console can explain to anyone.
    const taken = (await this.listOffices()).some((o) => o.domain.toLowerCase() === clean.domain);
    if (taken) return refuse(`An office already uses ${clean.domain}.`);

    const at = this.now();
    const officeId = uid('ws_');
    const token = newInviteToken();

    const state = fresh();
    state.org.name = clean.name;
    state.org.domain = clean.domain;
    // No Org Admin until the invitation is accepted. That absence IS the "Awaiting
    // onboarding" status, and it is what the accept step fills in.
    state.people = [];
    state.audit = [];

    this.store.updateDocument((d) => {
      d.instances[officeId] = state;
      d.fleetMeta[officeId] = {
        version: this.instanceVersion,
        health: 'ok',
        adminEmail: clean.email,
        createdAt: at,
      };
      d.invites.push({
        token,
        officeId,
        email: clean.email,
        name: clean.adminName,
        issuedBy: byName,
        issuedAt: at,
        expiresAt: at + INVITE_TTL_MS,
        usedAt: null,
      });
      // S-23: the operator's action is logged INSIDE the affected office, where that office's
      // owner can read it -- not in a fleet-level log they cannot see.
      this.store.auditIn(state, byName, `Office created for ${clean.name}`);
      this.store.auditIn(
        state,
        byName,
        `Invitation issued to ${clean.email} as Org Admin, expires in 7 days`,
      );
    });

    this.provision = { i: 0, input, done: false };
    for (let i = 0; i < this.provisionSteps.length; i += 1) {
      await sleep(PROVISION_STEP_MS);
      this.provision = { ...this.provision, i: i + 1 };
      this.store.updateDocument(() => {}, 'job');
    }
    this.provision = { ...this.provision, done: true };

    return accept({ officeId, token, url: inviteUrl(this.origin(), token) });
  }

  provisionProgress(): { i: number; done: boolean } | null {
    return this.provision ? { i: this.provision.i, done: this.provision.done } : null;
  }

  /* --------------------------------------------------------------- invitations */

  /**
   * What the accept screen may show before anyone has proved anything: the office being
   * joined, and who it was meant for. Never the office's contents.
   *
   * Takes a TOKEN, not an office id, and that distinction is the point. In production the
   * invitation link is served by that office's own deployment, so the token is what routes --
   * which is why this does not breach FD-31 constraint 1.
   */
  async getInvite(token: string): Promise<Result<InvitePreview>> {
    const doc = this.store.document();
    const invite = doc.invites.find((i) => i.token === token);
    const state = inviteState(invite, this.now());
    if (state !== 'valid' || !invite) return refuse(INVITE_MESSAGE[state === 'valid' ? 'unknown' : state]);
    const office = doc.instances[invite.officeId];
    if (!office) return refuse(INVITE_MESSAGE.unknown);
    return accept({
      officeName: office.org.name,
      name: invite.name,
      email: invite.email,
      expiresAt: invite.expiresAt,
    });
  }

  /**
   * A-04, redeemed: single use, 7-day expiry, and the Org Admin signed in.
   *
   * **THE PASSWORD IS CHECKED FOR SHAPE AND THEN DISCARDED.** Nothing here is enforcement
   * (FD-26): there is no credential store in the browser, a plaintext password in
   * localStorage would be worse than none, and a hash would make this look like the gate it
   * is not. Sign-in continues to compare against `VITE_DEV_PASSWORD` until Prompt 1.5 items
   * 1 to 3 land. docs/auth.md says so in the same words.
   */
  async acceptInvite(token: string, password: string): Promise<Result<{ officeId: string }>> {
    const problems = passwordProblems(password);
    if (problems.length) return refuse(...problems);

    const doc = this.store.document();
    const invite = doc.invites.find((i) => i.token === token);
    const state = inviteState(invite, this.now());
    if (state !== 'valid' || !invite) return refuse(INVITE_MESSAGE[state === 'valid' ? 'unknown' : state]);
    const officeId = invite.officeId;
    if (!doc.instances[officeId]) return refuse(INVITE_MESSAGE.unknown);

    const at = this.now();
    const personId = uid('p_');
    this.store.updateDocument((d) => {
      const target = d.invites.find((i) => i.token === token);
      // Marked spent in the SAME write that creates the person, so there is no window in
      // which the person exists and the invitation is still open.
      if (target) target.usedAt = at;
      const office = d.instances[officeId]!;
      office.people.push({
        id: personId,
        name: invite.name,
        email: invite.email,
        title: 'Org Admin',
        deptId: null,
        access: 'admin',
        authorities: [],
      });
      office.session.userId = personId;
      this.store.auditIn(office, invite.name, 'Accepted the invitation and signed in');
      // The invitee's own office is now the one the customer entries read.
      d.boundOfficeId = officeId;
    });

    return accept({ officeId });
  }

  /**
   * Every invitation issued. OPERATOR AND DEV ONLY -- it is how the fleet console offers
   * "Copy invite link" after the fact, and how the link is reachable on localhost while no
   * mail service exists to carry it (FD-32).
   */
  async listInvites(): Promise<Array<Invite & { url: string; state: InviteState }>> {
    const now = this.now();
    return this.store.document().invites.map((i) =>
      Object.assign(copy(i), {
        url: inviteUrl(this.origin(), i.token),
        state: inviteState(i, now),
      }),
    );
  }

  private origin(): string {
    return typeof window === 'undefined' ? 'http://localhost:5173' : window.location.origin;
  }

  /* ----------------------------------------------------------------- session */

  /**
   * The operator's session is held at the document level, not inside an office: they have no
   * row in one (migration 0010, `super_has_no_org`), so there is no office it could live in.
   *
   * This is also what keeps `fleetSide`'s write block from locking the operator out of their
   * own console. Signing in is not a write into a customer office, and treating it as one was
   * a real regression until `provision-screen.test.ts` caught it.
   */
  async getSession(): Promise<Session> {
    if (this.fleetSide) return copy(this.store.document().operatorSession);
    return copy(this.s().session);
  }

  async signInAs(userId: string | null): Promise<Result> {
    if (this.fleetSide) {
      this.store.updateDocument((d) => {
        d.operatorSession.userId = userId;
      });
      return accept(undefined);
    }
    this.u((s) => {
      s.session.userId = userId;
    });
    return accept(undefined);
  }

  /* --------------------------------------------------------------- dev tools */

  /**
   * Dev tools' two seed buttons. **REFUSED ON THE OPERATOR SURFACE.**
   *
   * They reach `store.reset` directly rather than through `u()`, so blocking office-facing
   * writes did not block them -- and the fleet entry renders the shared Dev tools, with both
   * buttons beside the invitations panel. One click there replaced a real customer's office
   * with the demo seed, under that customer's own id. Reproduced in `boundary.test.ts`
   * before this guard existed.
   *
   * There is no legitimate operator use for either: replacing an office's contents is the
   * office's own business, and the operator holds no policy on it (Prompt 1.5 rule 3).
   */
  async loadDemo(): Promise<Result> {
    if (this.fleetSide) return refuse('An office is not the operator console to reseed.');
    this.store.reset('demo');
    return accept(undefined);
  }

  async resetFresh(): Promise<Result> {
    if (this.fleetSide) return refuse('An office is not the operator console to reseed.');
    this.store.reset('fresh');
    return accept(undefined);
  }

  async setSimulation(on: boolean): Promise<Result> {
    this.simulate = on;
    return accept(undefined);
  }

  /**
   * Point the office-facing operations at a different instance. **DEV ONLY**, and the one
   * place an office identifier appears outside the fleet and invitation surfaces.
   *
   * It is not a production operation and `SupabaseApiClient` will refuse it: in production
   * "which office am I in" is decided by which deployment's URL you opened, not by an API
   * call. It exists so one browser can walk between the offices it has provisioned without
   * clearing storage. `seam.test.ts` lists it as an explicit, visible exemption rather than
   * letting it pass unnoticed.
   */
  async bindOffice(officeId: string): Promise<Result> {
    if (!this.store.document().instances[officeId]) return refuse('That office does not exist.');
    this.store.updateDocument((d) => {
      d.boundOfficeId = officeId;
    });
    return accept(undefined);
  }

  /* ------------------------------------------------------------------ ticker */

  private startTicker(): void {
    if (typeof setInterval === 'undefined') return;
    this.timer = setInterval(() => {
      if (!this.simulate) return;
      if (typeof document !== 'undefined' && document.hidden) return;
      this.tick();
    }, TICKER_MS);
  }

  /**
   * One pass of simulated life.
   *
   * FD-24: it appends a receipt whenever it moves a teammate to `running`. The prototype
   * generated receipts once at launch and never again, so the run counter climbed while the
   * Activity screen stayed frozen -- a broken demo, and the receipt is the product's core
   * promise.
   */
  tick(): void {
    if (!this.s().org.launched) return;
    this.u((s) => {
      const now = nowMs();
      for (const a of s.agents) {
        if (!a.provisioned || a.status === 'paused') continue;
        if (Math.random() >= 0.3) continue;
        const r = Math.random();
        if (r < 0.55) {
          a.status = 'running';
          a.doing = sampleDoing(a);
          a.runsToday += 1;
          a.costToday = Number((a.costToday + 0.02 + Math.random() * 0.05).toFixed(2));
          s.activity.unshift({
            id: `r_${a.id}_${now}_${Math.random().toString(36).slice(2, 6)}`,
            t: now,
            agentId: a.id,
            title: a.doing,
            status: 'done',
            why: `Matched the instructions for ${a.name} and passed every guardrail.`,
            cost: Number((0.02 + Math.random() * 0.05).toFixed(2)),
            dur: Number((1.4 + Math.random() * 3).toFixed(1)),
          });
          s.activity = s.activity.slice(0, 200);
        } else if (r < 0.7 && a.type !== 'coordinator') {
          a.status = 'waiting';
          a.doing = 'Draft ready, waiting for approval';
        } else {
          a.status = 'idle';
          a.doing = 'Waiting for the next task';
        }
        a.lastActive = now;
      }
    }, 'tick');
  }
}

/** PROVENANCE: api.js `provision`. Field names ours, values upstream's (plan 4-F3). */
function provisionAgent(a: Agent, s: StoreState): void {
  a.provisioned = true;
  // Only an opaque reference. The fleet entry composes the profile and adapter names from
  // it; see src/shared/seeds/fleet-runtime.ts for why that split exists.
  a.runtimeRef ??= mintRuntimeRef();
  const missing = a.tools.filter((t) => !s.connections[t]?.on);
  if (missing.length) {
    a.status = 'paused';
    a.pausedBy = 'tool';
    a.blockedBy = missing;
    a.doing = `Waiting for ${missing.map(toolName).join(', ')} to be connected`;
  } else {
    a.status = 'idle';
    a.pausedBy = null;
    a.blockedBy = [];
    a.doing = 'Ready. Wakes on the next task';
  }
}

export const validateOrgState = validateOrg;
export const requiredToolsOf = requiredTools;

const sleep = (ms: number) => new Promise<void>((r) => setTimeout(r, ms));

/** The shortest password the accept screen will take. A shape rule, not a strength policy. */
export const MIN_PASSWORD_CHARS = 8;

/**
 * A SHAPE check, and deliberately nothing more.
 *
 * It is not a strength policy and must not grow into one here: the real rules belong to
 * Supabase Auth (Prompt 1.5 item 1), and a list of rules written in the browser would be
 * the second place they live and the first place they go stale.
 */
export function passwordProblems(password: string): string[] {
  if (!password.trim()) return ['Choose a password.'];
  if (password.length < MIN_PASSWORD_CHARS)
    return [`Use at least ${MIN_PASSWORD_CHARS} characters.`];
  return [];
}
