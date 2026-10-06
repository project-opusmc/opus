import { readFileSync } from "node:fs";
import { dirname, join, resolve } from "node:path";
import { fileURLToPath } from "node:url";

import { validateTargetProfile } from "./gate6-lifecycle-core.mjs";

export const targetTransportBackendBindingsSchema =
  "opus.m3.gate6.target-transport-backend-bindings.v1";

const readinessKeys = Object.freeze([
  "target_resolution",
  "transport_prepare",
  "artifact_verification",
  "load",
  "entrypoint",
  "start",
  "handshake",
  "stop",
  "cleanup",
  "health",
]);
const readinessValues = new Set(["implemented", "not_implemented"]);
const cooperativeOperationKeys = Object.freeze([
  "revalidate_target",
  "prepare",
  "verify_artifact",
  "load",
  "resolve_entrypoint",
  "start",
  "verify_handshake",
  "stop",
  "cleanup",
  "check_health",
]);

const scriptDir = dirname(fileURLToPath(import.meta.url));
const opusRoot = resolve(scriptDir, "..");
export const targetTransportBackendBindingsPath = join(
  opusRoot,
  "config",
  "gate6",
  "target-transport-backend-bindings.json",
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

function validateBinding(profile, binding) {
  if (!isNonEmptyString(profile) || !isRecord(binding)) {
    return false;
  }
  for (const field of [
    "backend_identity",
    "provider_identity",
    "control_plane",
  ]) {
    if (!isNonEmptyString(binding[field])) {
      return false;
    }
  }
  if (
    !isRecord(binding.readiness) ||
    readinessKeys.some(
      (key) => !readinessValues.has(binding.readiness[key]),
    ) ||
    binding.live_execution_performed !== false
  ) {
    return false;
  }
  if (binding.cooperative_control_plane !== undefined) {
    const cooperative = binding.cooperative_control_plane;
    if (
      !isRecord(cooperative) ||
      !isNonEmptyString(cooperative.identity) ||
      cooperative.scope !== "opus-owned-cooperative-only" ||
      cooperative.provider_interface !== binding.provider_identity ||
      !isRecord(cooperative.operations) ||
      cooperativeOperationKeys.some(
        (key) => cooperative.operations[key] !== "implemented",
      )
    ) {
      return false;
    }
  }
  return true;
}

export function loadTargetTransportBackendBindings(
  pathname = targetTransportBackendBindingsPath,
) {
  const bindings = readJson(pathname);
  if (
    !isRecord(bindings) ||
    bindings.schema_version !== targetTransportBackendBindingsSchema ||
    !isRecord(bindings.bindings)
  ) {
    throw new Error("target transport backend bindings have an invalid schema");
  }
  for (const [profile, binding] of Object.entries(bindings.bindings)) {
    if (!validateBinding(profile, binding)) {
      throw new Error(
        `target transport backend binding is invalid for profile ${profile}`,
      );
    }
  }
  return bindings;
}

export function resolveTargetTransportBackend(
  profile,
  bindings = loadTargetTransportBackendBindings(),
) {
  const profileValidation = validateTargetProfile(profile);
  if (!profileValidation.valid) {
    throw new Error(
      `cannot resolve a backend for an invalid target profile: ${profileValidation.errors.join("; ")}`,
    );
  }
  const binding = bindings.bindings[profile.id];
  if (!isRecord(binding)) {
    throw new Error(
      `no target transport backend binding exists for profile ${profile.id}`,
    );
  }
  return {
    profile: profile.id,
    backend_identity: binding.backend_identity,
    provider_identity: binding.provider_identity,
    control_plane: binding.control_plane,
    cooperative_control_plane: binding.cooperative_control_plane === undefined
      ? null
      : structuredClone(binding.cooperative_control_plane),
    readiness: structuredClone(binding.readiness),
    live_execution_performed: binding.live_execution_performed,
  };
}
