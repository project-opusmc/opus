import { mkdirSync, readFileSync, statSync, writeFileSync } from "node:fs";
import { dirname, resolve } from "node:path";

import {
  genericClientAdapterObservationSchema,
  importTransportReadinessEvidence,
} from "./gate6-generic-client-adapter.mjs";
import {
  genericClientAdapterId,
  resolveGate6TargetAdapter,
} from "./gate6-adapter-bindings.mjs";
import { validateTargetProfile } from "./gate6-lifecycle-core.mjs";

function usage() {
  console.error(
    "Usage: node scripts/ingest-gate6-generic-transport-evidence.mjs " +
      "--profile <absolute-profile.json> --evidence-dir <absolute-dir> " +
      "--output <absolute-observations.json>",
  );
}

function parseOptions(argv) {
  const options = {};
  for (let index = 0; index < argv.length; index += 2) {
    const name = argv[index];
    const value = argv[index + 1];
    if (
      !["--profile", "--evidence-dir", "--output"].includes(name) ||
      value === undefined ||
      Object.hasOwn(options, name)
    ) {
      return null;
    }
    options[name] = value;
  }
  return Object.keys(options).length === 3 ? options : null;
}

function requireAbsolute(pathname, label) {
  const absolute = resolve(pathname);
  if (absolute !== pathname) {
    throw new Error(`${label} must be absolute`);
  }
  return absolute;
}

function readJson(pathname, label) {
  try {
    return JSON.parse(readFileSync(pathname, "utf8"));
  } catch (error) {
    throw new Error(`could not read ${label}: ${error.message}`);
  }
}

function ingest() {
  const options = parseOptions(process.argv.slice(2));
  if (options === null) {
    usage();
    process.exitCode = 2;
    return;
  }

  const profilePath = requireAbsolute(options["--profile"], "--profile");
  const evidenceDir = requireAbsolute(options["--evidence-dir"], "--evidence-dir");
  const outputPath = requireAbsolute(options["--output"], "--output");
  if (!statSync(evidenceDir).isDirectory()) {
    throw new Error("--evidence-dir must identify a directory");
  }
  const profile = readJson(profilePath, "target profile");
  const profileValidation = validateTargetProfile(profile);
  if (!profileValidation.valid) {
    throw new Error(`invalid target profile: ${profileValidation.errors.join("; ")}`);
  }
  const binding = resolveGate6TargetAdapter(profile);
  if (binding.adapter !== genericClientAdapterId) {
    throw new Error(`profile ${profile.id} is not bound to the Generic Client adapter`);
  }

  const manifestPath = resolve(evidenceDir, "manifest.json");
  const observations = importTransportReadinessEvidence({
    profile,
    evidenceManifest: readJson(manifestPath, "transport-readiness manifest"),
    sourceManifestPath: manifestPath,
    runId: null,
  });
  if (observations.schema_version !== genericClientAdapterObservationSchema) {
    throw new Error("Generic Client adapter did not produce the expected observations");
  }

  mkdirSync(dirname(outputPath), { recursive: true, mode: 0o700 });
  writeFileSync(outputPath, `${JSON.stringify(observations, null, 2)}\n`, {
    encoding: "utf8",
    mode: 0o600,
  });
  console.log(
    `OPUS Gate 6 Generic Client evidence ingested: profile=${profile.id} transport=${observations.transport.status} output=${outputPath}`,
  );
}

try {
  ingest();
} catch (error) {
  console.error(`OPUS Gate 6 Generic Client evidence ingestion failed: ${error.message}`);
  process.exitCode = 1;
}
