// FLT-7 posture report, engine section. Pure: callers read the files and pass the values in, so the
// same function checks the repo template in CI and a provisioned instance during ops.
// SEC-6: drift found here blocks an instance from being marked healthy.
//
// This covers only what is readable from files. Two FLT-7 rules need a running container and belong
// to the runtime check in E3-T7, because they are not expressible in the template:
//   - `hermes -p <profile> cron list` must be empty. Hermes has no config key that disables
//     scheduling; cron.enabled is not a recognized key.
//   - Both agents must have runtimeConfig.heartbeat.enabled false and wakeOnDemand true. The
//     default is already off, so this guards against someone turning it on: a timer wake has no
//     issue, so it shares one synthetic session per agent, which is the cross-lead context D6 and
//     D7 forbid.

export type PostureCode =
  | 'engine_holds_forbidden_secret'
  | 'engine_wrong_db_login'
  | 'engine_root_fs_writable'
  | 'engine_missing_data_volume'
  | 'engine_port_public'
  | 'toolset_not_allowed'
  | 'memory_not_disabled'
  | 'skill_writes_allowed'
  | 'profile_not_selected'
  | 'adapter_not_pinned'
  | 'turn_cap_too_high';

export type PostureFinding = { code: PostureCode; detail: string };

const AGENTS = ['orbi', 'scout'] as const;
export type Agent = (typeof AGENTS)[number];

export type PostureInput = {
  engine: {
    environment: Record<string, string>;
    readOnlyRootFs: boolean;
    volumeTargets: string[];
    ports: string[];
  };
  profiles: Record<Agent, unknown>;
  adapters: Record<Agent, unknown>;
};

// Hermes' CONFIGURABLE_TOOLSETS registry, copied from /opt/hermes/hermes_cli/tools_config.py in the
// pinned image. The allowlist is expressed by subtraction, so anything missing from this list is
// ENABLED on both agents: an upgrade that adds a toolset must add it here in the same change.
//
// The hermes-paperclip-adapter README lists only nine names, three of which the registry does not
// have (mcp, creative, productivity). Trusting it left 21 real toolsets enabled, including
// delegation, which SEC-2a forbids by name, and cronjob, which COST-2 forbids. Read the registry,
// not the README.
export const ALL_TOOLSETS = [
  'web',
  'browser',
  'terminal',
  'file',
  'code_execution',
  'vision',
  'video',
  'image_gen',
  'video_gen',
  'x_search',
  'tts',
  'stt',
  'skills',
  'todo',
  'kanban',
  'memory',
  'context_engine',
  'session_search',
  'connections',
  'clarify',
  'delegation',
  'cronjob',
  'homeassistant',
  'spotify',
  'discord',
  'discord_admin',
  'yuanbao',
  'computer_use',
] as const;

// Neither agent may hold a Hermes toolset. Orbi's issue tools come from Paperclip, and Scout lost
// `web` with CEO v2 D10 (founder 2026-10-01): the toolset bundles web_search with web_extract, so
// "search only" is not configurable, and a search query leaks as readily as a fetch.
const ALLOWED_TOOLSETS: Record<Agent, readonly string[]> = { orbi: [], scout: [] };
const TURN_CAPS: Record<Agent, number> = { orbi: 20, scout: 30 }; // COST-3

// Both upstream images keep their own data roots: /paperclip is Paperclip's HOME and PAPERCLIP_HOME,
// /opt/data is Hermes' HERMES_HOME. Without a volume on each, a read-only root stops the container.
const REQUIRED_VOLUMES = ['/paperclip', '/opt/data'];

function isForbiddenSecret(key: string): boolean {
  return key.startsWith('GMAIL_') || key.startsWith('RESEND_') || key === 'TOKEN_ENCRYPTION_KEY';
}

function asRecord(value: unknown): Record<string, unknown> {
  return typeof value === 'object' && value !== null ? (value as Record<string, unknown>) : {};
}

export function checkEnginePosture(input: PostureInput): PostureFinding[] {
  const findings: PostureFinding[] = [];
  const add = (code: PostureCode, detail: string) => findings.push({ code, detail });

  for (const key of Object.keys(input.engine.environment)) {
    if (isForbiddenSecret(key)) {
      add('engine_holds_forbidden_secret', `the engine container must not hold ${key} (SEC-2a)`);
    }
  }

  const url = input.engine.environment.DATABASE_URL ?? '';
  if (!url.includes('paperclip_app') || !url.endsWith('/paperclip')) {
    add('engine_wrong_db_login', 'the engine must use the paperclip_app login on the paperclip database (SEC-2a)');
  }

  if (!input.engine.readOnlyRootFs) {
    add('engine_root_fs_writable', 'the engine root filesystem must be read-only except its data volumes (SEC-2a)');
  }

  for (const target of REQUIRED_VOLUMES) {
    if (!input.engine.volumeTargets.includes(target)) {
      add('engine_missing_data_volume', `${target} must be a volume or the engine cannot start (SEC-2a)`);
    }
  }

  for (const port of input.engine.ports) {
    if (!port.startsWith('127.0.0.1:')) {
      add('engine_port_public', `engine port ${port} must bind 127.0.0.1 and be reached over the tailnet (SEC-1, DEP-5)`);
    }
  }

  for (const agent of AGENTS) {
    const profile = asRecord(input.profiles[agent]);

    // Hermes defaults memory_enabled and user_profile_enabled to true, so an absent key is on.
    const memory = asRecord(profile.memory);
    if (memory.memory_enabled !== false || memory.user_profile_enabled !== false) {
      add('memory_not_disabled', `${agent} must set memory.memory_enabled and memory.user_profile_enabled to false (D6)`);
    }

    const skills = asRecord(profile.skills);
    const autoLoad = skills.auto_load;
    if (skills.write_approval !== true || !Array.isArray(autoLoad) || autoLoad.length !== 0) {
      add('skill_writes_allowed', `${agent} must set skills.write_approval true and skills.auto_load empty (CEO R7)`);
    }

    const disabled = asRecord(profile.agent).disabled_toolsets;
    const disabledList = Array.isArray(disabled) ? (disabled as string[]) : [];
    for (const toolset of ALL_TOOLSETS) {
      if (!ALLOWED_TOOLSETS[agent].includes(toolset) && !disabledList.includes(toolset)) {
        add('toolset_not_allowed', `${agent} must disable the ${toolset} toolset (SEC-2a)`);
      }
    }

    const adapter = asRecord(input.adapters[agent]);
    if (adapter.adapter !== 'hermes_local') {
      add('adapter_not_pinned', `${agent} must run on hermes_local until the upstream fix lands (D3, TODOS.md)`);
    }

    // The adapter has no profile field, so -p in extraArgs is the only thing pointing each agent at
    // its own config. Without it both agents share /opt/data/config.yaml and the allowlist above is
    // not in force at all, which is the one failure this whole check exists to catch.
    const extraArgs = adapter.extraArgs;
    const selectsProfile =
      Array.isArray(extraArgs) &&
      extraArgs.some((a, i) => (a === '-p' || a === '--profile') && extraArgs[i + 1] === agent);
    if (!selectsProfile) {
      add('profile_not_selected', `${agent} must pass -p ${agent} in extraArgs, or its profile config is never loaded (D4)`);
    }

    const cap = adapter.maxTurnsPerRun;
    if (typeof cap !== 'number' || cap > TURN_CAPS[agent]) {
      add('turn_cap_too_high', `${agent} must cap turns at ${TURN_CAPS[agent]} per run (COST-3)`);
    }
  }

  return findings;
}
