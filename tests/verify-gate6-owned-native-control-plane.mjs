import assert from "node:assert/strict";
import { spawnSync } from "node:child_process";
import {
  existsSync,
  mkdtempSync,
  readFileSync,
  rmSync,
} from "node:fs";
import { tmpdir } from "node:os";
import { dirname, join, resolve } from "node:path";
import { fileURLToPath } from "node:url";

import {
  Gate6Status,
  evaluateGate6Session,
  gate6LifecycleStages,
  requiredStabilityLadder,
} from "../scripts/gate6-lifecycle-core.mjs";
import {
  BadlionNativeControlPlaneTransportProvider,
  badlionNativeTransportProviderId,
} from "../scripts/gate6-badlion-native-transport-provider.mjs";
import {
  createOwnedNativeBootstrapControlPlaneRun,
  OwnedNativeBootstrapControlPlane,
  ownedNativeBootstrapControlPlaneId,
} from "../scripts/gate6-owned-native-bootstrap-control-plane.mjs";
import {
  TargetTransportBackendCode,
} from "../scripts/gate6-target-transport-backend.mjs";

const testDir = dirname(fileURLToPath(import.meta.url));
const opusRoot = resolve(testDir, "..");
const arm64NativeOutput = join(
  opusRoot,
  "output",
  "injector-native-transport",
  "arm64",
);
const hostPath = join(arm64NativeOutput, "opus-bootstrap-host");
const bootstrapPath = join(arm64NativeOutput, "libopus-bootstrap.dylib");
const badlionProfilePath = join(
  opusRoot,
  "config",
  "gate6",
  "profiles",
  "badlion.json",
);
const readinessCli = join(
  opusRoot,
  "scripts",
  "assess-gate6-target-transport-readiness.mjs",
);

function readJson(pathname) {
  return JSON.parse(readFileSync(pathname, "utf8"));
}

function runNode(pathname, arguments_) {
  const result = spawnSync(process.execPath, [pathname, ...arguments_], {
    encoding: "utf8",
  });
  if (result.error !== undefined) {
    throw result.error;
  }
  return result;
}

function assertArm64MachO(pathname, label) {
  assert.equal(existsSync(pathname), true, `${label} must exist`);
  const inspection = spawnSync("lipo", ["-archs", pathname], {
    encoding: "utf8",
  });
  assert.equal(
    inspection.status,
    0,
    `${label} architecture inspection failed: ${inspection.stderr}`,
  );
  assert.match(
    inspection.stdout,
    /\barm64\b/,
    `${label} must contain the owned arm64 slice`,
  );
}

function eventAtFinalIteration(run, expectedEvent) {
  return run.events.find(
    (event) =>
      event.iteration === run.stage &&
      event.iterations_requested === run.stage &&
      event.event === expectedEvent &&
      event.outcome === "Success",
  );
}

function assertFullLifecycle(session) {
  assert.equal(session.result, Gate6Status.PASS);
  for (const { key, name } of gate6LifecycleStages) {
    assert.equal(
      session[key]?.status,
      Gate6Status.PASS,
      `${name} must retain a PASS observation`,
    );
  }
  assert.deepEqual(session.iterations.stability_ladder, requiredStabilityLadder);
  assert.deepEqual(session.iterations.completed_stages, requiredStabilityLadder);
  assert.equal(
    session.iterations.requested,
    requiredStabilityLadder.at(-1),
  );
  assert.equal(
    session.iterations.completed,
    requiredStabilityLadder.at(-1),
  );
}

export function runOwnedNativeBootstrapControlPlaneChecks() {
  assertArm64MachO(hostPath, "owned native bootstrap host");
  assertArm64MachO(bootstrapPath, "owned native bootstrap artifact");

  const temporaryRoot = mkdtempSync(
    join(tmpdir(), "opus-gate6-owned-native-control-plane-test-"),
  );
  const evidenceDir = join(temporaryRoot, "evidence");

  try {
    const result = createOwnedNativeBootstrapControlPlaneRun({
      evidenceDir,
      runId: "owned-native-bootstrap-control-plane-test",
      hostPath,
      bootstrapPath,
    });

    const evaluation = evaluateGate6Session(result.session);
    assert.equal(
      evaluation.status,
      Gate6Status.PASS,
      `owned native control plane session failed: ${evaluation.errors.join("; ")}`,
    );
    assert.equal(evaluation.first_non_pass_stage, null);
    assert.equal(result.session.target.profile, "opus-owned-cooperative");
    assert.equal(
      result.session.provenance.external_target_execution,
      false,
      "the cooperative run must explicitly exclude external target execution",
    );
    assert.equal(
      result.session.target.metadata.external_target_execution,
      false,
      "the target evidence must explicitly exclude external target execution",
    );
    assertFullLifecycle(result.session);

    assert.equal(
      result.controlPlane.identity,
      ownedNativeBootstrapControlPlaneId,
    );
    assert.equal(
      result.provider instanceof BadlionNativeControlPlaneTransportProvider,
      true,
      "the concrete cooperative control plane must be exercised through the same provider class",
    );
    assert.equal(result.provider.identity, badlionNativeTransportProviderId);
    assert.equal(
      result.backend.describeBinding().provider_identity,
      badlionNativeTransportProviderId,
      "the backend binding must retain the shared provider identity",
    );
    assert.equal(
      result.backend.describeBinding().backend_identity,
      ownedNativeBootstrapControlPlaneId,
      "the backend binding must retain the concrete cooperative control plane identity",
    );

    const transaction = readJson(
      join(evidenceDir, "native-lifecycle-transaction.json"),
    );
    assert.deepEqual(transaction.requested_ladder, requiredStabilityLadder);
    assert.deepEqual(transaction.attempted_stages, requiredStabilityLadder);
    assert.equal(transaction.runs.length, requiredStabilityLadder.length);
    for (const run of transaction.runs) {
      assert.equal(run.exit_status, 0, `native host stage ${run.stage} must exit 0`);
      assert.equal(run.signal, null);
      assert.equal(run.error, null);
      assert.equal(run.failure, null);
      for (const eventName of [
        "BootstrapModuleLoaded",
        "BootstrapEntrypointReady",
        "BootstrapStarted",
        "BootstrapHandshakeOk",
        "BootstrapStopped",
        "BootstrapCleanedUp",
      ]) {
        assert.notEqual(
          eventAtFinalIteration(run, eventName),
          undefined,
          `native host stage ${run.stage} must retain ${eventName}`,
        );
      }
      const handshake = eventAtFinalIteration(run, "BootstrapHandshakeOk");
      assert.equal(
        handshake.expected_handshake,
        handshake.observed_handshake,
        `native host stage ${run.stage} must retain a matching handshake`,
      );
      const cleanup = eventAtFinalIteration(run, "BootstrapCleanedUp");
      assert.equal(
        cleanup.cleanup_complete,
        true,
        `native host stage ${run.stage} must retain completed cleanup`,
      );
    }

    const eventsPath = join(evidenceDir, "native-lifecycle-events.jsonl");
    const events = readFileSync(eventsPath, "utf8")
      .split("\n")
      .filter((line) => line.length > 0)
      .map((line) => JSON.parse(line));
    assert.equal(events.length > 0, true, "raw native events must be retained");

    const providerRecords = readJson(
      join(evidenceDir, "provider-observations.json"),
    );
    const revalidations = providerRecords.filter(
      (record) => record.operation === "revalidateTarget",
    );
    assert.equal(
      revalidations.length,
      9,
      "the backend must revalidate before every state-changing lifecycle transition",
    );
    assert.equal(
      result.controlPlane.revalidationCount,
      11,
      "target resolution, validation, and every backend transition must revalidate the bound target",
    );
    for (const operation of [
      "prepare",
      "verifyArtifact",
      "load",
      "resolveEntrypoint",
      "start",
      "verifyHandshake",
      "stop",
      "cleanup",
      "checkHealth",
    ]) {
      assert.equal(
        providerRecords.some(
          (record) =>
            record.operation === operation &&
            record.observation?.code === "SUCCESS",
        ),
        true,
        `${operation} must retain a successful shared-provider observation`,
      );
    }

    const identityCheckEvidenceDir = join(
      temporaryRoot,
      "identity-and-artifact-checks",
    );
    const identityCheckControlPlane = new OwnedNativeBootstrapControlPlane({
      binding: result.backendBinding,
      hostPath,
      evidenceDir: identityCheckEvidenceDir,
      expectedHostSha256: result.targetInstance.metadata.host_sha256,
    });
    const boundContext = {
      run_id: result.backendBinding.run_id,
      target: result.targetInstance,
      bootstrap_artifact: result.bootstrapArtifact,
    };
    const wrongRunContext = identityCheckControlPlane.revalidateTarget({
      ...boundContext,
      run_id: "wrong-owned-native-bootstrap-run",
    });
    assert.equal(
      wrongRunContext.code,
      TargetTransportBackendCode.RUN_CONTEXT_MISMATCH,
      "the concrete control plane must reject an unbound run context",
    );
    const preparation = identityCheckControlPlane.prepare();
    assert.equal(preparation.status, Gate6Status.PASS);
    const artifactMismatch = identityCheckControlPlane.verifyArtifact({
      ...boundContext,
      bootstrap_artifact: {
        ...result.bootstrapArtifact,
        sha256: "0".repeat(64),
      },
    });
    assert.equal(
      artifactMismatch.status,
      Gate6Status.FAIL,
      "the concrete control plane must stop artifact verification on a drifted identity",
    );
    assert.equal(
      artifactMismatch.code,
      TargetTransportBackendCode.ARTIFACT_MISMATCH,
      "the concrete control plane must classify bootstrap identity drift precisely",
    );

    const readinessPath = join(temporaryRoot, "badlion-readiness.json");
    const readinessResult = runNode(readinessCli, [
      "--profile",
      badlionProfilePath,
      "--output",
      readinessPath,
    ]);
    assert.equal(
      readinessResult.status,
      0,
      `Badlion readiness assessment failed: ${readinessResult.stderr}`,
    );
    const readiness = readJson(readinessPath);
    assert.equal(readiness.assessment_kind, "implementation-readiness-only");
    assert.equal(readiness.profile, "badlion");
    assert.equal(readiness.live_execution_performed, false);
    assert.equal(
      readiness.cooperative_control_plane.identity,
      ownedNativeBootstrapControlPlaneId,
    );
    assert.equal(
      readiness.cooperative_control_plane.scope,
      "opus-owned-cooperative-only",
    );
    assert.equal(
      readiness.cooperative_control_plane.provider_interface,
      badlionNativeTransportProviderId,
    );
    for (const [operation, status] of Object.entries(
      readiness.cooperative_control_plane.operations,
    )) {
      assert.equal(
        status,
        "implemented",
        `the cooperative control plane must implement ${operation}`,
      );
    }
    for (const [operation, status] of Object.entries({
      transport_prepare: readiness.transport_prepare,
      load: readiness.load,
      entrypoint: readiness.entrypoint,
      start: readiness.start,
      handshake: readiness.handshake,
      stop: readiness.stop,
      cleanup: readiness.cleanup,
      health: readiness.health,
    })) {
      assert.equal(
        status,
        "not_implemented",
        `Badlion live ${operation} must remain not implemented`,
      );
    }
  } finally {
    rmSync(temporaryRoot, { recursive: true, force: true });
  }
}

if (
  process.argv[1] !== undefined &&
  resolve(process.argv[1]) === fileURLToPath(import.meta.url)
) {
  runOwnedNativeBootstrapControlPlaneChecks();
  console.log(
    "OPUS General Gate 6 owned native control-plane checks passed: concrete native lifecycle, retained witnesses, shared provider interface, revalidation, and Badlion non-execution readiness verified.",
  );
}
