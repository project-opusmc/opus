import assert from "node:assert/strict";
import { spawnSync } from "node:child_process";
import {
  mkdirSync,
  mkdtempSync,
  readFileSync,
  rmSync,
  writeFileSync,
} from "node:fs";
import { tmpdir } from "node:os";
import { dirname, join, resolve } from "node:path";
import { fileURLToPath } from "node:url";

import {
  Gate6Status,
  evaluateGate6Session,
} from "../scripts/gate6-lifecycle-core.mjs";
import {
  GenericTransportCapability,
  GenericTransportPreparation,
  createCooperativeGenericClientAdapter,
  executeTargetAdapter,
  importTransportReadinessEvidence,
  normalizeGenericClientSession,
} from "../scripts/gate6-generic-client-adapter.mjs";
import {
  genericClientAdapterId,
  resolveGate6TargetAdapter,
} from "../scripts/gate6-adapter-bindings.mjs";
import { loadGeneralGate6Profiles } from "../scripts/gate6-general-composition.mjs";

const testDir = dirname(fileURLToPath(import.meta.url));
const opusRoot = resolve(testDir, "..");
const fixtureRoot = join(testDir, "fixtures", "gate6", "generic-adapter");
const profilePath = join(
  opusRoot,
  "config",
  "gate6",
  "profiles",
  "badlion.json",
);
const ingestionCli = join(
  opusRoot,
  "scripts",
  "ingest-gate6-generic-transport-evidence.mjs",
);
const normalizationCli = join(
  opusRoot,
  "scripts",
  "normalize-gate6-generic-observations.mjs",
);
const evaluationCli = join(opusRoot, "scripts", "evaluate-gate6.mjs");

function readJson(pathname) {
  return JSON.parse(readFileSync(pathname, "utf8"));
}

function writeJson(pathname, value) {
  writeFileSync(pathname, `${JSON.stringify(value, null, 2)}\n`, "utf8");
}

function runNode(pathname, arguments_) {
  const result = spawnSync(process.execPath, [pathname, ...arguments_], {
    encoding: "utf8",
  });
  if (result.error) {
    throw result.error;
  }
  return result;
}

function firstNonPassName(session) {
  return evaluateGate6Session(session).first_non_pass_stage?.name ?? null;
}

function planForProfile(plan, profile) {
  const copied = structuredClone(plan);
  copied.target_descriptor = structuredClone(profile);
  copied.target_instance = {
    ...copied.target_instance,
    identity: `${profile.id}-cooperative-target`,
    architecture: "arm64",
    runtime: "cooperative-fixture",
  };
  copied.bootstrap_artifact = {
    ...copied.bootstrap_artifact,
    artifact: `/test-fixtures/${profile.id}/libopus-bootstrap.dylib`,
  };
  return copied;
}

function executePlan(plan, runId) {
  return executeTargetAdapter(createCooperativeGenericClientAdapter(plan), {
    run_id: runId,
    iterations: plan.iterations,
    test_fixture: true,
  });
}

export function runGenericClientAdapterChecks() {
  const fullPlan = readJson(
    join(fixtureRoot, "cooperative-full-lifecycle.json"),
  );
  const fullObservations = executePlan(fullPlan, "generic-cooperative-pass");
  const fullSession = normalizeGenericClientSession(fullObservations);
  const fullEvaluation = evaluateGate6Session(fullSession);
  assert.equal(
    fullEvaluation.status,
    Gate6Status.PASS,
    "the cooperative Generic Client adapter must produce a valid PASS session",
  );
  assert.equal(
    fullEvaluation.first_non_pass_stage,
    null,
    "a complete cooperative lifecycle must not report a failing boundary",
  );
  assert.equal(
    fullSession.bootstrap_artifact.status,
    Gate6Status.PASS,
    "the normalized fixture must represent BootstrapArtifactVerified explicitly",
  );

  const attemptedOverride = structuredClone(fullObservations);
  attemptedOverride.result = Gate6Status.FAIL;
  assert.equal(
    normalizeGenericClientSession(attemptedOverride).result,
    Gate6Status.PASS,
    "the adapter observation cannot directly override the derived session result",
  );

  const failures = [
    {
      name: "transport unavailable",
      operation: "prepare_transport",
      observation: {
        capability: GenericTransportCapability.UNAVAILABLE,
        preparation: GenericTransportPreparation.FAILED,
        code: "TRANSPORT_UNAVAILABLE",
      },
      stage: "TransportReady",
    },
    {
      name: "artifact mismatch",
      operation: "verify_bootstrap_artifact",
      observation: {
        status: Gate6Status.FAIL,
        code: "BootstrapArtifactIdentityMismatch",
      },
      stage: "BootstrapArtifactVerified",
    },
    {
      name: "load failure",
      operation: "load_bootstrap",
      observation: {
        status: Gate6Status.FAIL,
        code: "BootstrapLoadFailed",
      },
      stage: "BootstrapLoaded",
    },
    {
      name: "handshake mismatch",
      operation: "verify_handshake",
      observation: {
        status: Gate6Status.FAIL,
        code: "BootstrapHandshakeInvalid",
      },
      stage: "HandshakeOk",
    },
    {
      name: "cleanup failure",
      operation: "cleanup",
      observation: {
        status: Gate6Status.FAIL,
        code: "BootstrapCleanupFailed",
      },
      stage: "CleanupOk",
    },
    {
      name: "unhealthy target",
      operation: "check_target_health",
      observation: {
        status: Gate6Status.FAIL,
        code: "TargetUnhealthy",
      },
      stage: "TargetHealthy",
    },
  ];

  for (const failure of failures) {
    const plan = structuredClone(fullPlan);
    plan.operations[failure.operation] = failure.observation;
    const session = normalizeGenericClientSession(
      executePlan(plan, `generic-${failure.operation}`),
    );
    const evaluation = evaluateGate6Session(session);
    assert.equal(
      evaluation.status,
      Gate6Status.FAIL,
      `${failure.name} must produce a FAIL session`,
    );
    assert.equal(
      firstNonPassName(session),
      failure.stage,
      `${failure.name} must retain its exact first failing stage`,
    );
  }

  const profiles = loadGeneralGate6Profiles();
  const binding = resolveGate6TargetAdapter(profiles.badlion);
  assert.equal(
    binding.adapter,
    genericClientAdapterId,
    "the Badlion profile must bind to the Generic Client adapter outside the core",
  );
  assert.throws(
    () => resolveGate6TargetAdapter(profiles.lunar),
    /no Generic Client adapter binding exists/,
    "Lunar must remain unbound by this Badlion-only task",
  );

  const transportReadinessFixture = readJson(
    join(fixtureRoot, "transport-readiness-blocked.json"),
  );
  const importedObservations = importTransportReadinessEvidence({
    profile: profiles.badlion,
    evidenceManifest: transportReadinessFixture,
    sourceManifestPath: "/test-fixtures/transport-readiness-blocked.json",
    runId: "imported-transport-readiness",
  });
  assert.equal(
    importedObservations.target.status,
    Gate6Status.PASS,
    "transport-readiness evidence must retain TargetResolved PASS",
  );
  assert.equal(
    importedObservations.transport.capability,
    GenericTransportCapability.AVAILABLE,
    "transport capability must remain distinct from the lifecycle stage",
  );
  assert.equal(
    importedObservations.transport.status,
    Gate6Status.BLOCKED,
    "the retained transport capability must not manufacture TransportReady PASS",
  );
  const importedSession = normalizeGenericClientSession(importedObservations);
  assert.equal(
    importedSession.result,
    Gate6Status.BLOCKED,
    "the imported transport-readiness session must remain BLOCKED",
  );
  assert.equal(
    firstNonPassName(importedSession),
    "TransportReady",
    "the imported session must retain TransportReady as its first blocker",
  );
  assert.equal(
    importedSession.load.status,
    Gate6Status.NOT_TESTED,
    "later stages must not be manufactured after a transport blocker",
  );
  assert.throws(
    () =>
      importTransportReadinessEvidence({
        profile: profiles.badlion,
        evidenceManifest: {
          ...transportReadinessFixture,
          intended_profile: "lunar",
        },
        sourceManifestPath: "/test-fixtures/wrong-profile.json",
      }),
    /intended_profile.*badlion/,
    "retained evidence must bind exactly to the selected target profile",
  );

  const cliRoot = mkdtempSync(join(tmpdir(), "opus-gate6-generic-adapter-"));
  try {
    const evidenceDir = join(cliRoot, "retained-evidence");
    const manifestPath = join(evidenceDir, "manifest.json");
    const observationsPath = join(cliRoot, "observations.json");
    const sessionPath = join(cliRoot, "blocked-session.json");
    const evaluationPath = join(cliRoot, "evaluation.json");
    mkdirSync(evidenceDir, { recursive: true });
    writeJson(manifestPath, transportReadinessFixture);

    const ingestion = runNode(ingestionCli, [
      "--profile",
      profilePath,
      "--evidence-dir",
      evidenceDir,
      "--output",
      observationsPath,
    ]);
    assert.equal(
      ingestion.status,
      0,
      `Generic Client evidence ingestion failed: ${ingestion.stderr}`,
    );
    const cliObservations = readJson(observationsPath);
    assert.equal(
      cliObservations.transport.status,
      Gate6Status.BLOCKED,
      "the ingestion CLI must retain the blocked transport stage",
    );

    const normalization = runNode(normalizationCli, [
      "--observations",
      observationsPath,
      "--output",
      sessionPath,
    ]);
    assert.equal(
      normalization.status,
      0,
      `Generic Client observation normalization failed: ${normalization.stderr}`,
    );
    const cliSession = readJson(sessionPath);
    assert.equal(
      cliSession.result,
      Gate6Status.BLOCKED,
      "the generic session producer must derive BLOCKED from observations",
    );

    const evaluation = runNode(evaluationCli, [
      "--badlion-session",
      sessionPath,
      "--output",
      evaluationPath,
    ]);
    assert.equal(
      evaluation.status,
      0,
      `common Gate 6 evaluator failed: ${evaluation.stderr}`,
    );
    const evaluationOutput = readJson(evaluationPath);
    assert.equal(
      evaluationOutput.targets.badlion,
      Gate6Status.BLOCKED,
      "the common evaluator must retain Badlion as BLOCKED",
    );
    assert.equal(
      evaluationOutput.targets.lunar,
      Gate6Status.NOT_TESTED,
      "the common evaluator must not alter Lunar",
    );
    assert.equal(
      evaluationOutput.session_outcomes.badlion.first_non_pass_stage.name,
      "TransportReady",
      "the common evaluator must report the first blocked lifecycle stage",
    );
    assert.equal(
      evaluationOutput.gate7_ready,
      false,
      "a blocked Generic Client session must keep Gate 7 locked",
    );
  } finally {
    rmSync(cliRoot, { recursive: true, force: true });
  }
}

if (
  process.argv[1] !== undefined &&
  resolve(process.argv[1]) === fileURLToPath(import.meta.url)
) {
  runGenericClientAdapterChecks();
  console.log(
    "OPUS General Gate 6 Generic Client adapter checks passed: cooperative lifecycle, failure boundaries, profile binding, normalized observations, and retained transport evidence verified.",
  );
}
