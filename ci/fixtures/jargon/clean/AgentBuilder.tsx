import { createAgent } from "../api/orchestrator";
// Identifiers are never renamed; the guard must not flag them.
type AdapterType = "hermes_local";
const registryKey: AdapterType = "hermes_local";
const yamlPath = "/paperclip/.hermes/config.yaml";

export function AgentBuilder() {
  return (
    <form onSubmit={() => createAgent({ registryKey, yamlPath })}>
      <h1>New agent</h1>
      <p>Give your agent a name and tell it what to do.</p>
      <label htmlFor="name">What should we call it?</label>
      <input id="name" placeholder="Research assistant" />
      <label htmlFor="brief">Instructions</label>
      <textarea id="brief" placeholder="Describe the job in plain words" />
      <button type="submit">Save and start</button>
    </form>
  );
}
