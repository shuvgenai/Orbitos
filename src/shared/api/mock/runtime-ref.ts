/**
 * An opaque reference minted when a teammate is provisioned.
 *
 * It carries no operator or upstream wording, because provisioning happens in the Org Admin
 * app at launch and this module is therefore in every bundle. The operator-visible profile
 * and adapter names are composed from it in src/shared/seeds/fleet-runtime.ts, which only
 * the fleet entry imports.
 */
export const mintRuntimeRef = (): string => `agt_${Math.random().toString(36).slice(2, 8)}`;
