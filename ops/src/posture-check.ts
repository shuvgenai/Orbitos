// Reads the instance template and prints the FLT-7 engine findings. Exits 1 on any finding, so CI
// and the provisioning script can both gate on it (SEC-6).
//
// This is the file-readable half of the posture report. The runtime half, which needs a running
// container, is E3-T7: an empty `hermes -p <profile> cron list` on both profiles, and Paperclip's
// heartbeat turned off. Neither is expressible in the template.
import { readFileSync } from 'node:fs';
import { parse } from 'yaml';
import { checkEnginePosture, type PostureInput } from './posture.ts';

const root = new URL('../../template/', import.meta.url);
const read = (path: string) => readFileSync(new URL(path, root), 'utf8');

const compose = parse(read('compose.yml'), { merge: true }) as {
  services?: Record<
    string,
    { environment?: Record<string, string>; read_only?: boolean; volumes?: string[]; ports?: string[] }
  >;
};
const engine = compose.services?.paperclip;
if (!engine) {
  console.error('posture: the template has no paperclip service');
  process.exit(1);
}

const input: PostureInput = {
  engine: {
    environment: engine.environment ?? {},
    readOnlyRootFs: engine.read_only === true,
    volumeTargets: (engine.volumes ?? []).map((v) => v.split(':')[1] ?? ''),
    ports: engine.ports ?? [],
  },
  profiles: {
    orbi: parse(read('engine/hermes/orbi.config.yaml')),
    scout: parse(read('engine/hermes/scout.config.yaml')),
  },
  adapters: JSON.parse(read('engine/paperclip-adapters.json')),
};

const findings = checkEnginePosture(input);
for (const finding of findings) console.error(`${finding.code}: ${finding.detail}`);
console.log(findings.length === 0 ? 'posture: engine section passes' : `posture: ${findings.length} finding(s)`);
process.exit(findings.length === 0 ? 0 : 1);
