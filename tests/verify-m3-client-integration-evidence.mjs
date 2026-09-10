import { mkdtempSync, rmSync, writeFileSync } from "node:fs";
import { spawnSync } from "node:child_process";
import { tmpdir } from "node:os";
import { dirname, join, resolve } from "node:path";
import { fileURLToPath } from "node:url";

const opusRoot = resolve(dirname(fileURLToPath(import.meta.url)), "..");
const verifier = join(
  opusRoot,
  "scripts",
  "verify-m3-client-integration-evidence.mjs",
);

function runVerifier(path) {
  return spawnSync(process.execPath, [verifier, path], { encoding: "utf8" });
}

function requireSuccess(result, label) {
  if (result.status !== 0) {
    throw new Error(`${label} failed:\n${result.stderr || result.stdout}`);
  }
}

function requireFailure(result, expectedMessage, label) {
  if (result.status === 0 || !result.stderr.includes(expectedMessage)) {
    throw new Error(
      `${label} did not fail with "${expectedMessage}":\n${result.stdout}${result.stderr}`,
    );
  }
}

function validEvidence() {
  const cycle = (cycle) => ({
    cycle,
    events: [
      { operation: "health", code: "TargetAlive", state: "waiting" },
      { operation: "load", code: "Ready", state: "running" },
      { operation: "health", code: "TargetAlive", state: "running" },
      { operation: "unload", code: "Stopped", state: "stopped" },
      { operation: "health", code: "TargetAlive", state: "stopped" },
    ],
    targetSurvived: true,
  });
  return {
    schemaVersion: 3,
    scope: "m3-authorized-client-integration",
    capture: {
      observedAt: "2026-09-08T00:00:00Z",
      fixture: false,
      targetPid: 1234,
      gameWindowReady: true,
      gameStatus: "running",
    },
    target: {
      integrationId: "dev.opus.owned-client",
      kind: "opus-owned-client",
      minecraftVersion: "1.8.9",
      targetVersion: "0.1.0",
      architecture: "arm64",
      clientBuildSha256: "a".repeat(64),
      authorization: {
        mode: "opus-owned",
        reference: "OPUS-M3-DEV-001",
        recordSha256: "c".repeat(64),
        approvedTransport: "cooperative-opt-in",
      },
    },
    transport: {
      mode: "cooperative-opt-in",
      targetSelfLoadsAuthorizedRuntime: true,
      modifiesUnrelatedProcess: false,
    },
    runtime: {
      nativeRuntimeVersion: "0.1.0",
      javaRuntimeVersion: "not-built",
      nativeRuntimeSha256: "b".repeat(64),
    },
    handshake: {
      protocolVersion: 1,
      injectorVersion: "0.1.0",
      nativeRuntimeVersion: "0.1.0",
      javaRuntimeVersion: "not-built",
      targetArchitecture: "arm64",
      mappingSchemaVersion: "not-applicable",
      oneConfigAdapterVersion: "not-loaded",
      artifactChecksums: "not-packaged",
    },
    cycles: [cycle(1), cycle(2), cycle(3)],
    stop: {
      operation: "stop",
      code: "TargetStopping",
      state: "stopped",
      descriptorRemoved: true,
      targetSurvivedAfterStop: true,
      gameWindowReadyAfterStop: true,
      gameStatusAfterStop: "running",
    },
  };
}

const temporaryDirectory = mkdtempSync(
  join(tmpdir(), "opus-m3-client-evidence-test-"),
);
const evidencePath = join(temporaryDirectory, "evidence.json");

function writeEvidence(evidence) {
  writeFileSync(evidencePath, `${JSON.stringify(evidence, null, 2)}\n`);
}

try {
  writeEvidence(validEvidence());
  requireSuccess(runVerifier(evidencePath), "valid authorized-client evidence");

  const legacyEvidence = validEvidence();
  legacyEvidence.schemaVersion = 2;
  delete legacyEvidence.capture.targetPid;
  delete legacyEvidence.capture.gameWindowReady;
  delete legacyEvidence.capture.gameStatus;
  delete legacyEvidence.stop.targetSurvivedAfterStop;
  delete legacyEvidence.stop.gameWindowReadyAfterStop;
  delete legacyEvidence.stop.gameStatusAfterStop;
  writeEvidence(legacyEvidence);
  requireSuccess(runVerifier(evidencePath), "legacy v2 authorized-client evidence");

  const fixtureCapture = validEvidence();
  fixtureCapture.capture.fixture = true;
  writeEvidence(fixtureCapture);
  requireFailure(
    runVerifier(evidencePath),
    "capture.fixture must be false",
    "test-fixture capture rejection",
  );

  const missingWindowProof = validEvidence();
  missingWindowProof.capture.gameWindowReady = false;
  writeEvidence(missingWindowProof);
  requireFailure(
    runVerifier(evidencePath),
    "capture.gameWindowReady must be true",
    "missing live game-window proof rejection",
  );

  const targetDidNotSurviveStop = validEvidence();
  targetDidNotSurviveStop.stop.targetSurvivedAfterStop = false;
  writeEvidence(targetDidNotSurviveStop);
  requireFailure(
    runVerifier(evidencePath),
    "stop.targetSurvivedAfterStop must be true",
    "target survival after control stop rejection",
  );

  const harnessTarget = validEvidence();
  harnessTarget.target.kind = "opus-authorized-test-harness";
  writeEvidence(harnessTarget);
  requireFailure(
    runVerifier(evidencePath),
    "the OPUS authorized test harness is not a client integration",
    "test-harness target rejection",
  );

  const mismatchedArchitecture = validEvidence();
  mismatchedArchitecture.handshake.targetArchitecture = "x86_64";
  writeEvidence(mismatchedArchitecture);
  requireFailure(
    runVerifier(evidencePath),
    "handshake.targetArchitecture must match target.architecture",
    "architecture mismatch rejection",
  );

  const missingSurvivalCheck = validEvidence();
  missingSurvivalCheck.cycles[0].events.pop();
  writeEvidence(missingSurvivalCheck);
  requireFailure(
    runVerifier(evidencePath),
    "must contain the complete health/load/unload lifecycle",
    "post-unload survival rejection",
  );

  const unsupportedTransport = validEvidence();
  unsupportedTransport.transport.mode = "unbounded-process-transport";
  writeEvidence(unsupportedTransport);
  requireFailure(
    runVerifier(evidencePath),
    "transport.mode must be cooperative-opt-in",
    "unbounded transport rejection",
  );

  const unsupportedAuthorizationTransport = validEvidence();
  unsupportedAuthorizationTransport.target.authorization.approvedTransport =
    "unbounded-process-transport";
  writeEvidence(unsupportedAuthorizationTransport);
  requireFailure(
    runVerifier(evidencePath),
    "target.authorization.approvedTransport must be cooperative-opt-in",
    "authorization transport rejection",
  );
} finally {
  rmSync(temporaryDirectory, { recursive: true, force: true });
}

console.log("M3 authorized-client evidence contract tests passed.");
