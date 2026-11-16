// Identifiers are never renamed. This file must not trip the brand check.
import { hire } from "@paperclipai/hermes-paperclip-adapter";
export const ADAPTER_TYPE = "hermes_local";
export const THEME_KEY = "paperclip.theme";
export const HERMES_HOME = "/paperclip/.hermes";

// SCREAMING_SNAKE and lowercase OrbitCrew identifier forms must not trip the check.
export const ORBITCREW_PSQL = process.env.ORBITCREW_PSQL;
export const API_BASE = process.env.VITE_ORBITCREW_API_URL;
export const SCHEMA = "orbitcrew";
