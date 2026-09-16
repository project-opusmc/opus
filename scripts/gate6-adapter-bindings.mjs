import { readFileSync } from "node:fs";
import { dirname, join, resolve } from "node:path";
import { fileURLToPath } from "node:url";

import { validateTargetProfile } from "./gate6-lifecycle-core.mjs";

export const gate6AdapterBindingsSchema =
  "opus.m3.gate6.adapter-bindings.v1";
export const genericClientAdapterId = "generic-client";

const scriptDir = dirname(fileURLToPath(import.meta.url));
const opusRoot = resolve(scriptDir, "..");
export const gate6AdapterBindingsPath = join(
  opusRoot,
  "config",
  "gate6",
  "adapter-bindings.json",
);

function isRecord(value) {
  return value !== null && typeof value === "object" && !Array.isArray(value);
}

function isNonEmptyString(value) {
  return typeof value === "string" && value.trim().length > 0;
}

function readJson(pathname) {
  return JSON.parse(readFileSync(pathname, "utf8"));
}

export function loadGate6AdapterBindings(pathname = gate6AdapterBindingsPath) {
  const bindings = readJson(pathname);
  if (
    !isRecord(bindings) ||
    bindings.schema_version !== gate6AdapterBindingsSchema ||
    !isRecord(bindings.bindings)
  ) {
    throw new Error("Gate 6 adapter bindings have an invalid schema");
  }
  for (const [profile, binding] of Object.entries(bindings.bindings)) {
    if (
      profile.trim().length === 0 ||
      !isRecord(binding) ||
      binding.adapter !== genericClientAdapterId ||
      !isNonEmptyString(binding.transport_backend)
    ) {
      throw new Error(`Gate 6 adapter binding is invalid for profile ${profile}`);
    }
  }
  return bindings;
}

export function resolveGate6TargetAdapter(profile, bindings = loadGate6AdapterBindings()) {
  const profileValidation = validateTargetProfile(profile);
  if (!profileValidation.valid) {
    throw new Error(
      `cannot bind invalid Gate 6 target profile: ${profileValidation.errors.join("; ")}`,
    );
  }
  const binding = bindings.bindings[profile.id];
  if (!isRecord(binding)) {
    throw new Error(`no Generic Client adapter binding exists for profile ${profile.id}`);
  }
  return {
    profile: profile.id,
    adapter: binding.adapter,
    transport_mode: binding.transport_mode,
    transport_backend: binding.transport_backend,
    live_evidence: binding.live_evidence,
  };
}
