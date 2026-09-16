import assert from "node:assert/strict";
import { spawnSync } from "node:child_process";
import {
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
} from "../scripts/gate6-lifecycle-core.mjs";
import {
  GenericClientAdapter,
  executeTargetAdapter,
  normalizeGenericClientSession,
} from "../scripts/gate6-generic-client-adapter.mjs";
import {
  genericClientAdapterId,
  resolveGate6TargetAdapter,
} from "../scripts/gate6-adapter-bindings.mjs";
import {
  BadlionNativeControlPlaneTransportProvider,
  badlionNativeTransportProviderId,
} from "../scripts/gate6-badlion-native-transport-provider.mjs";
import {
  TargetTransportBackend,
  TargetTransportBackendCode,
  createCooperativeTargetTransportProvider,
  validateTargetTransportBackendBinding,
} from "../scripts/gate6-target-transport-backend.mjs";
import {
  resolveTargetTransportBackend,
} from "../scripts/gate6-target-transport-backend-bindings.mjs";
import { loadGeneralGate6Profiles } from "../scripts/gate6-general-composition.mjs";

const testDir = dirname(fileURLToPath(import.meta.url));
const opusRoot = resolve(testDir, "..");
const fixturePath = join(
  testDir,
  "fixtures",
  "gate6",
  "target-transport-backend",
  "cooperative-full-lifecycle.json",
);
const profilePath = join(
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

function stageName(session) {
  return evaluateGate6Session(session).first_non_pass_stage?.name ?? null;
}

function passingTargetOperations() {
  return {
    resolve_target: () => ({
      status: Gate6Status.PASS,
      code: TargetTransportBackendCode.SUCCESS,
      message: "cooperative target resolved",
      evidence: { source: "cooperative-resolver" },
    }),
    validate_target: () => ({
      status: Gate6Status.PASS,
      code: TargetTransportBackendCode.SUCCESS,
      message: "cooperative target validated",
      evidence: { source: "cooperative-validator" },
    }),
  };
}

function createBackend(plan, provider = null) {
  return new TargetTransportBackend({
    binding: plan.backend_binding,
    provider: provider ?? new BadlionNativeControlPlaneTransportProvider({
      controlPlane: createCooperativeTargetTransportProvider({
        provider_identity: plan.backend_binding.provider_identity,
        operations: plan.provider_operations,
      }),
    }),
  });
}

function executePlan(
  plan,
  {
    testFixture = true,
    provider = null,
    runId = plan.backend_binding.run_id,
  } = {},
) {
  const backend = createBackend(plan, provider);
  const adapter = new GenericClientAdapter({
    targetDescriptor: plan.target_descriptor,
    targetInstance: plan.target_instance,
    bootstrapArtifact: plan.bootstrap_artifact,
    operations: passingTargetOperations(),
    transportBackend: backend,
  });
  const observations = executeTargetAdapter(adapter, {
    run_id: runId,
    iterations: plan.iterations,
    test_fixture: testFixture,
  });
  return {
    backend,
    observations,
    session: normalizeGenericClientSession(observations),
  };
}

function failedOperation(message, code = TargetTransportBackendCode.FAILED) {
  return {
    status: Gate6Status.FAIL,
    code,
    message,
    evidence: { source: "cooperative-failure" },
  };
}

function failedPrepare(message) {
  return {
    capability: "UNAVAILABLE",
    preparation: "FAILED",
    code: TargetTransportBackendCode.FAILED,
    message,
    evidence: { source: "cooperative-prepare-failure" },
  };
}

function assertLaterStagesNotTested(session, firstFailureStage) {
  const firstFailureIndex = gate6LifecycleStages.findIndex(
    ({ name }) => name === firstFailureStage,
  );
  assert.notEqual(
    firstFailureIndex,
    -1,
    `unknown lifecycle stage ${firstFailureStage}`,
  );
  for (const { key, name } of gate6LifecycleStages.slice(
    firstFailureIndex + 1,
  )) {
    assert.equal(
      session[key]?.status,
      Gate6Status.NOT_TESTED,
      `${name} must remain NOT_TESTED after ${firstFailureStage}`,
    );
  }
}

function runReadinessCli(arguments_) {
  const result = spawnSync(process.execPath, [readinessCli, ...arguments_], {
    encoding: "utf8",
  });
  if (result.error) {
    throw result.error;
  }
  return result;
}

export function runTargetTransportBackendChecks() {
  const fixture = readJson(fixturePath);
  assert.equal(
    validateTargetTransportBackendBinding(fixture.backend_binding).valid,
    true,
    "the cooperative backend fixture must retain a complete target binding",
  );

  const full = executePlan(structuredClone(fixture));
  const fullEvaluation = evaluateGate6Session(full.session);
  assert.equal(
    fullEvaluation.status,
    Gate6Status.PASS,
    "a cooperative provider must produce a valid backend-backed PASS session",
  );
  assert.equal(
    fullEvaluation.first_non_pass_stage,
    null,
    "a cooperative provider must complete every lifecycle stage",
  );
  assert.equal(
    full.observations.adapter.transport_backend.backend_identity,
    fixture.backend_binding.backend_identity,
    "GenericClientAdapter must retain the backend binding in its observation stream",
  );
  assert.equal(
    full.session.provenance.target_transport_backend.instance_identity,
    fixture.backend_binding.instance_identity,
    "normalized evidence must retain the target instance binding",
  );

  assert.throws(
    () =>
      new GenericClientAdapter({
        targetDescriptor: fixture.target_descriptor,
        targetInstance: fixture.target_instance,
        bootstrapArtifact: fixture.bootstrap_artifact,
        transportBackend: createBackend(structuredClone(fixture)),
        operations: {
          ...passingTargetOperations(),
          load_bootstrap: () => ({
            status: Gate6Status.PASS,
          }),
        },
      }),
    /cannot override backend lifecycle operations/,
    "a backend-bound adapter must not bypass the provider with direct stage operations",
  );

  const failures = [
    {
      name: "run context mismatch",
      runId: "different-run-context",
      stage: "TransportReady",
      code: TargetTransportBackendCode.RUN_CONTEXT_MISMATCH,
    },
    {
      name: "target changes after resolve",
      mutate(plan) {
        plan.provider_operations.revalidate_target.instance_identity =
          "start:changed";
      },
      stage: "TransportReady",
      code: TargetTransportBackendCode.TARGET_CHANGED,
      invalidated: true,
    },
    {
      name: "architecture mismatch",
      mutate(plan) {
        plan.provider_operations.revalidate_target.architecture = "x86_64";
      },
      stage: "TransportReady",
      code: TargetTransportBackendCode.ARCHITECTURE_MISMATCH,
    },
    {
      name: "runtime unresolved for attempted PASS",
      mutate(plan) {
        plan.target_instance.runtime = "unresolved";
        plan.backend_binding.runtime = "unresolved";
        plan.provider_operations.revalidate_target.runtime = "unresolved";
      },
      stage: "TransportReady",
      code: TargetTransportBackendCode.RUNTIME_UNRESOLVED,
    },
    {
      name: "artifact hash mismatch",
      mutate(plan) {
        plan.provider_operations.verify_artifact.artifact.sha256 = "d".repeat(64);
      },
      stage: "BootstrapArtifactVerified",
      code: TargetTransportBackendCode.ARTIFACT_MISMATCH,
    },
    {
      name: "prepare failure",
      mutate(plan) {
        plan.provider_operations.prepare = failedPrepare(
          "cooperative transport preparation failed",
        );
      },
      stage: "TransportReady",
      code: TargetTransportBackendCode.FAILED,
    },
    {
      name: "load failure",
      mutate(plan) {
        plan.provider_operations.load = failedOperation("cooperative load failed");
      },
      stage: "BootstrapLoaded",
      code: TargetTransportBackendCode.FAILED,
    },
    {
      name: "entrypoint failure",
      mutate(plan) {
        plan.provider_operations.resolve_entrypoint = failedOperation(
          "cooperative entrypoint resolution failed",
        );
      },
      stage: "EntrypointReady",
      code: TargetTransportBackendCode.FAILED,
    },
    {
      name: "start failure",
      mutate(plan) {
        plan.provider_operations.start = failedOperation(
          "cooperative bootstrap start failed",
        );
      },
      stage: "BootstrapStarted",
      code: TargetTransportBackendCode.FAILED,
    },
    {
      name: "handshake failure",
      mutate(plan) {
        plan.provider_operations.verify_handshake = failedOperation(
          "cooperative handshake failed",
        );
      },
      stage: "HandshakeOk",
      code: TargetTransportBackendCode.FAILED,
    },
    {
      name: "stop failure",
      mutate(plan) {
        plan.provider_operations.stop = failedOperation("cooperative stop failed");
      },
      stage: "BootstrapStopped",
      code: TargetTransportBackendCode.FAILED,
    },
    {
      name: "cleanup failure",
      mutate(plan) {
        plan.provider_operations.cleanup = failedOperation(
          "cooperative cleanup failed",
        );
      },
      stage: "CleanupOk",
      code: TargetTransportBackendCode.FAILED,
    },
    {
      name: "target unhealthy",
      mutate(plan) {
        plan.provider_operations.check_health = failedOperation(
          "cooperative target unhealthy",
          TargetTransportBackendCode.TARGET_UNHEALTHY,
        );
      },
      stage: "TargetHealthy",
      code: TargetTransportBackendCode.TARGET_UNHEALTHY,
    },
  ];

  for (const failure of failures) {
    const plan = structuredClone(fixture);
    failure.mutate?.(plan);
    const result = executePlan(plan, {
      runId: failure.runId,
    });
    assert.equal(
      result.session.result,
      Gate6Status.FAIL,
      `${failure.name} must produce a failed normalized session`,
    );
    assert.equal(
      stageName(result.session),
      failure.stage,
      `${failure.name} must stop at its exact lifecycle boundary`,
    );
    assertLaterStagesNotTested(result.session, failure.stage);
    const stage = Object.values(result.observations).find(
      (value) => value?.code === failure.code,
    );
    assert.notEqual(
      stage,
      undefined,
      `${failure.name} must retain its typed backend failure code`,
    );
    if (failure.invalidated === true) {
      assert.equal(
        result.backend.isInvalidated(),
        true,
        "a target identity change must invalidate the backend run",
      );
    }
  }

  const unresolvedPass = structuredClone(full.session);
  unresolvedPass.target.runtime = "unresolved";
  const unresolvedEvaluation = evaluateGate6Session(unresolvedPass);
  assert.equal(
    unresolvedEvaluation.status,
    Gate6Status.FAIL,
    "the common evaluator must reject unresolved runtime fields in a PASS session",
  );
  assert.match(
    unresolvedEvaluation.errors.join("; "),
    /concrete target runtime/,
    "the unresolved-runtime rejection must be explicit",
  );

  const noControlPlane = executePlan(structuredClone(fixture), {
    provider: new BadlionNativeControlPlaneTransportProvider(),
  });
  assert.equal(
    noControlPlane.session.result,
    Gate6Status.BLOCKED,
    "the default Badlion provider must remain blocked without a live control plane",
  );
  assert.equal(
    stageName(noControlPlane.session),
    "TransportReady",
    "the default Badlion provider must stop before bootstrap delivery",
  );
  assert.equal(
    noControlPlane.observations.transport.code,
    TargetTransportBackendCode.NOT_SUPPORTED,
    "the default provider must return a typed NOT_SUPPORTED result",
  );
  assert.equal(
    noControlPlane.observations.transport.evidence.provider
      .live_execution_performed,
    false,
    "the default provider must record that no live operation occurred",
  );

  const profiles = loadGeneralGate6Profiles();
  const adapterBinding = resolveGate6TargetAdapter(profiles.badlion);
  const backendBinding = resolveTargetTransportBackend(profiles.badlion);
  assert.equal(
    adapterBinding.adapter,
    genericClientAdapterId,
    "Badlion must remain bound to GenericClientAdapter outside the core",
  );
  assert.equal(
    adapterBinding.transport_backend,
    backendBinding.backend_identity,
    "Badlion adapter and transport backend bindings must agree",
  );
  assert.equal(
    backendBinding.provider_identity,
    badlionNativeTransportProviderId,
    "Badlion must bind to the production provider identity outside the core",
  );
  assert.equal(
    backendBinding.readiness.transport_prepare,
    "not_implemented",
    "readiness must not claim a current live transport preparation implementation",
  );
  assert.throws(
    () => resolveTargetTransportBackend(profiles.lunar),
    /no target transport backend binding exists/,
    "Lunar must remain untouched and unbound",
  );

  const readinessRoot = mkdtempSync(join(tmpdir(), "opus-gate6-readiness-"));
  try {
    const readinessPath = join(readinessRoot, "badlion-readiness.json");
    const assessment = runReadinessCli([
      "--profile",
      profilePath,
      "--output",
      readinessPath,
    ]);
    assert.equal(
      assessment.status,
      0,
      `target transport readiness assessment failed: ${assessment.stderr}`,
    );
    const readiness = readJson(readinessPath);
    assert.equal(
      readiness.assessment_kind,
      "implementation-readiness-only",
      "readiness output must not claim a Gate 6 result",
    );
    assert.equal(readiness.profile, "badlion");
    assert.equal(readiness.adapter, genericClientAdapterId);
    assert.equal(
      readiness.transport_backend,
      backendBinding.backend_identity,
    );
    assert.equal(readiness.transport_prepare, "not_implemented");
    assert.equal(readiness.live_execution_performed, false);
  } finally {
    rmSync(readinessRoot, { recursive: true, force: true });
  }
}

if (
  process.argv[1] !== undefined &&
  resolve(process.argv[1]) === fileURLToPath(import.meta.url)
) {
  runTargetTransportBackendChecks();
  console.log(
    "OPUS General Gate 6 target transport backend checks passed: backend binding, provider delegation, instance revalidation, concrete live-PASS identity, failure boundaries, and readiness assessment verified.",
  );
}
