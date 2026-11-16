export function AdvancedPanel() {
  return (
    <section>
      <h2>Advanced</h2>
      <label>Adapter</label>
      <input defaultValue="hermes_local" />
      <label>Model</label>
      <input defaultValue="claude-sonnet-5-5" />
    </section>
  );
}
