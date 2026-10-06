import { mkdirSync, readFileSync, writeFileSync } from "node:fs";
import { dirname, resolve } from "node:path";

import {
  genericClientAdapterId,
  resolveGate6TargetAdapter,
} from "./gate6-adapter-bindings.mjs";
import { validateTargetProfile } from "./gate6-lifecycle-core.mjs";
import {
  resolveTargetTransportBackend,
} from "./gate6-target-transport-backend-bindings.mjs";

const readinessSchema = "opus.m3.gate6.target-transport-readiness.v1";

function usage() {
  console.error(
    "Usage: node scripts/assess-gate6-target-transport-readiness.mjs " +
      "--profile <absolute-profile.json> --output <absolute-readiness.json>",
  );
}

function parseOptions(argv) {
  const options = {};
  for (let index = 0; index < argv.length; index += 2) {
    const name = argv[index];
    const value = argv[index + 1];
    if (
      !["--profile", "--output"].includes(name) ||
      value === undefined ||
      Object.hasOwn(options, name)
    ) {
      return null;
    }
    options[name] = value;
  }
  return Object.keys(options).length === 2 ? options : null;
}

function requireAbsolute(pathname, label) {
  const absolute = resolve(pathname);
  if (absolute !== pathname) {
    throw new Error(`${label} must be absolute`);
  }
  return absolute;
}

function assess() {
  const options = parseOptions(process.argv.slice(2));
  if (options === null) {
    usage();
    process.exitCode = 2;
    return;
  }
  const profilePath = requireAbsolute(options["--profile"], "--profile");
  const outputPath = requireAbsolute(options["--output"], "--output");
  const profile = JSON.parse(readFileSync(profilePath, "utf8"));
  const validation = validateTargetProfile(profile);
  if (!validation.valid) {
    throw new Error(`invalid target profile: ${validation.errors.join("; ")}`);
  }
  const adapter = resolveGate6TargetAdapter(profile);
  if (adapter.adapter !== genericClientAdapterId) {
    throw new Error(
      `profile ${profile.id} is not bound to the Generic Client adapter`,
    );
  }
  const backend = resolveTargetTransportBackend(profile);
  if (adapter.transport_backend !== backend.backend_identity) {
    throw new Error(
      "adapter and target transport backend bindings do not identify the same backend",
    );
  }
  const readiness = {
    schema_version: readinessSchema,
    assessment_kind: "implementation-readiness-only",
    profile: profile.id,
    adapter: adapter.adapter,
    transport_backend: backend.backend_identity,
    transport_provider: backend.provider_identity,
    cooperative_control_plane: backend.cooperative_control_plane,
    target_resolution: backend.readiness.target_resolution,
    transport_prepare: backend.readiness.transport_prepare,
    artifact_verification: backend.readiness.artifact_verification,
    load: backend.readiness.load,
    entrypoint: backend.readiness.entrypoint,
    start: backend.readiness.start,
    handshake: backend.readiness.handshake,
    stop: backend.readiness.stop,
    cleanup: backend.readiness.cleanup,
    health: backend.readiness.health,
    live_execution_performed: false,
  };
  mkdirSync(dirname(outputPath), { recursive: true, mode: 0o700 });
  writeFileSync(outputPath, `${JSON.stringify(readiness, null, 2)}\n`, {
    encoding: "utf8",
    mode: 0o600,
  });
  process.stdout.write(`${JSON.stringify(readiness, null, 2)}\n`);
}

try {
  assess();
} catch (error) {
  console.error(`OPUS Gate 6 target transport readiness assessment failed: ${error.message}`);
  process.exitCode = 1;
}
