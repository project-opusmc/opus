import { isAbsolute } from "node:path";

import {
  Gate6Status,
  combineGate6Statuses,
  createNotTestedSession,
  evaluateGate6Session,
  gate6SessionSchema,
  requiredStabilityLadder,
  validateTargetProfile,
} from "./gate6-lifecycle-core.mjs";
import {
  TargetTransportBackend,
  validateTargetTransportBackendBinding,
} from "./gate6-target-transport-backend.mjs";

export const genericClientAdapterObservationSchema =
  "opus.m3.gate6.generic-client-adapter-observations.v1";

export const GenericTransportCapability = Object.freeze({
  AVAILABLE: "AVAILABLE",
  UNAVAILABLE: "UNAVAILABLE",
  UNKNOWN: "UNKNOWN",
});

export const GenericTransportPreparation = Object.freeze({
  NOT_STARTED: "NOT_STARTED",
  READY: "READY",
  FAILED: "FAILED",
  BLOCKED: "BLOCKED",
});

export const genericClientAdapterOperations = Object.freeze([
  "resolve_target",
  "validate_target",
  "prepare_transport",
  "verify_bootstrap_artifact",
  "load_bootstrap",
  "resolve_entrypoint",
  "start_bootstrap",
  "verify_handshake",
  "stop_bootstrap",
  "cleanup",
  "check_target_health",
]);

const lifecycleOperationStages = Object.freeze([
  {
    operation: "verify_bootstrap_artifact",
    field: "bootstrap_artifact",
  },
  {
    operation: "load_bootstrap",
    field: "load",
  },
  {
    operation: "resolve_entrypoint",
    field: "entrypoint",
  },
  {
    operation: "start_bootstrap",
    field: "start",
  },
  {
    operation: "verify_handshake",
    field: "handshake",
  },
  {
    operation: "stop_bootstrap",
    field: "stop",
  },
  {
    operation: "cleanup",
    field: "cleanup",
  },
  {
    operation: "check_target_health",
    field: "target_health",
  },
]);

const backendOperationMethods = Object.freeze({
  prepare_transport: "prepare",
  verify_bootstrap_artifact: "verifyArtifact",
  load_bootstrap: "load",
  resolve_entrypoint: "resolveEntrypoint",
  start_bootstrap: "start",
  verify_handshake: "verifyHandshake",
  stop_bootstrap: "stop",
  cleanup: "cleanup",
  check_target_health: "checkHealth",
});

const stageStatusValues = new Set(Object.values(Gate6Status));
const transportCapabilityValues = new Set(
  Object.values(GenericTransportCapability),
);
const transportPreparationValues = new Set(
  Object.values(GenericTransportPreparation),
);

function isRecord(value) {
  return value !== null && typeof value === "object" && !Array.isArray(value);
}

function isNonEmptyString(value) {
  return typeof value === "string" && value.trim().length > 0;
}

function isSha256(value) {
  return typeof value === "string" && /^[0-9a-f]{64}$/.test(value);
}

function sameArtifactIdentity(left, right) {
  return (
    isRecord(left) &&
    isRecord(right) &&
    left.artifact === right.artifact &&
    left.sha256 === right.sha256 &&
    left.version === right.version
  );
}

function copyValue(value) {
  return value === undefined ? undefined : structuredClone(value);
}

function notTestedObservation() {
  return { status: Gate6Status.NOT_TESTED };
}

function blockedNotSupported(operation) {
  return {
    status: Gate6Status.BLOCKED,
    code: "NOT_SUPPORTED",
    message: `${operation} has no implemented target backend`,
  };
}

function normalizeStageObservation(value, operation) {
  if (!isRecord(value) || !stageStatusValues.has(value.status)) {
    throw new Error(
      `${operation} must return an observation with a Gate 6 stage status`,
    );
  }
  return copyValue(value);
}

function deriveTransportStageStatus(capability, preparation) {
  if (preparation === GenericTransportPreparation.NOT_STARTED) {
    return Gate6Status.NOT_TESTED;
  }
  if (preparation === GenericTransportPreparation.FAILED) {
    return Gate6Status.FAIL;
  }
  if (preparation === GenericTransportPreparation.BLOCKED) {
    return Gate6Status.BLOCKED;
  }
  if (capability === GenericTransportCapability.AVAILABLE) {
    return Gate6Status.PASS;
  }
  if (capability === GenericTransportCapability.UNAVAILABLE) {
    return Gate6Status.FAIL;
  }
  return Gate6Status.BLOCKED;
}

function normalizeTransportObservation(value) {
  if (!isRecord(value)) {
    throw new Error(
      "prepare_transport must return capability and preparation observations",
    );
  }
  const capability = value.capability;
  const preparation = value.preparation;
  if (!transportCapabilityValues.has(capability)) {
    throw new Error(
      "prepare_transport.capability must be AVAILABLE, UNAVAILABLE, or UNKNOWN",
    );
  }
  if (!transportPreparationValues.has(preparation)) {
    throw new Error(
      "prepare_transport.preparation must be NOT_STARTED, READY, FAILED, or BLOCKED",
    );
  }
  return {
    ...copyValue(value),
    capability,
    preparation,
    status: deriveTransportStageStatus(capability, preparation),
  };
}

function validateBootstrapArtifact(artifact) {
  if (!isRecord(artifact)) {
    throw new Error(
      "a passing verify_bootstrap_artifact observation requires artifact identity",
    );
  }
  if (!isNonEmptyString(artifact.artifact) || !isAbsolute(artifact.artifact)) {
    throw new Error(
      "a passing bootstrap artifact requires an absolute artifact path",
    );
  }
  if (!isSha256(artifact.sha256)) {
    throw new Error(
      "a passing bootstrap artifact requires a lowercase SHA-256",
    );
  }
  if (!isNonEmptyString(artifact.version)) {
    throw new Error("a passing bootstrap artifact requires a version");
  }
}

function normalizeIterations(value) {
  const iterations = value ?? {
    requested: 0,
    completed: 0,
    stability_ladder: [...requiredStabilityLadder],
    completed_stages: [],
  };
  if (!isRecord(iterations)) {
    throw new Error("adapter iterations must be an object");
  }
  for (const field of ["requested", "completed"]) {
    if (!Number.isInteger(iterations[field]) || iterations[field] < 0) {
      throw new Error(`adapter iterations.${field} must be a non-negative integer`);
    }
  }
  if (
    !Array.isArray(iterations.stability_ladder) ||
    !Array.isArray(iterations.completed_stages)
  ) {
    throw new Error(
      "adapter iterations must retain stability_ladder and completed_stages arrays",
    );
  }
  return copyValue(iterations);
}

function targetSnapshot(targetDescriptor, targetInstance) {
  const descriptorValidation = validateTargetProfile(targetDescriptor);
  if (!descriptorValidation.valid) {
    throw new Error(
      `invalid target descriptor: ${descriptorValidation.errors.join("; ")}`,
    );
  }
  if (!isRecord(targetInstance)) {
    throw new Error("target instance must be an object");
  }
  const architecture =
    targetInstance.architecture ?? targetDescriptor.architecture;
  const runtime = targetInstance.runtime ?? targetDescriptor.runtime;
  if (!isNonEmptyString(architecture) || !isNonEmptyString(runtime)) {
    throw new Error("target instance architecture and runtime must be non-empty");
  }
  return {
    profile: targetDescriptor.id,
    identity: targetInstance.identity ?? null,
    architecture,
    runtime,
    metadata: {
      ...targetDescriptor.metadata,
      ...(isRecord(targetInstance.metadata) ? targetInstance.metadata : {}),
    },
  };
}

function notTestedAfter(target, transport, bootstrap) {
  return {
    target,
    transport,
    bootstrap,
    bootstrap_artifact: notTestedObservation(),
    load: notTestedObservation(),
    entrypoint: notTestedObservation(),
    start: { ...notTestedObservation(), nonce: null },
    handshake: {
      ...notTestedObservation(),
      expected_nonce: null,
      observed_nonce: null,
    },
    stop: notTestedObservation(),
    cleanup: notTestedObservation(),
    target_health: notTestedObservation(),
  };
}

function firstNonPassStatus(...observations) {
  return observations.find(
    (observation) => observation.status !== Gate6Status.PASS,
  )?.status ?? Gate6Status.PASS;
}

export class TargetAdapter {
  resolveTarget() {
    return blockedNotSupported("resolve_target");
  }

  validateTarget() {
    return blockedNotSupported("validate_target");
  }

  prepareTransport() {
    return {
      capability: GenericTransportCapability.UNKNOWN,
      preparation: GenericTransportPreparation.BLOCKED,
      code: "NOT_SUPPORTED",
      message: "prepare_transport has no implemented target backend",
    };
  }

  verifyBootstrapArtifact() {
    return blockedNotSupported("verify_bootstrap_artifact");
  }

  loadBootstrap() {
    return blockedNotSupported("load_bootstrap");
  }

  resolveEntrypoint() {
    return blockedNotSupported("resolve_entrypoint");
  }

  startBootstrap() {
    return blockedNotSupported("start_bootstrap");
  }

  verifyHandshake() {
    return blockedNotSupported("verify_handshake");
  }

  stopBootstrap() {
    return blockedNotSupported("stop_bootstrap");
  }

  cleanup() {
    return blockedNotSupported("cleanup");
  }

  checkTargetHealth() {
    return blockedNotSupported("check_target_health");
  }
}

export class GenericClientAdapter extends TargetAdapter {
  constructor({
    targetDescriptor,
    targetInstance,
    bootstrapArtifact = null,
    operations = {},
    transportBackend = null,
    evidenceSink = null,
  }) {
    super();
    this.targetDescriptor = copyValue(targetDescriptor);
    this.targetInstance = copyValue(targetInstance);
    this.bootstrapArtifact = copyValue(bootstrapArtifact);
    this.operations = { ...operations };
    if (
      transportBackend !== null &&
      !(transportBackend instanceof TargetTransportBackend)
    ) {
      throw new Error(
        "transportBackend must implement TargetTransportBackend",
      );
    }
    if (
      transportBackend !== null &&
      Object.keys(backendOperationMethods).some((operation) =>
        Object.hasOwn(this.operations, operation)
      )
    ) {
      throw new Error(
        "a Generic Client adapter with a transport backend cannot override backend lifecycle operations",
      );
    }
    this.transportBackend = transportBackend;
    this.evidenceSink = evidenceSink;
    targetSnapshot(this.targetDescriptor, this.targetInstance);
    if (this.transportBackend !== null) {
      this.transportBackend.assertAdapterBinding({
        targetDescriptor: this.targetDescriptor,
        targetInstance: this.targetInstance,
        bootstrapArtifact: this.bootstrapArtifact,
      });
    }
  }

  invoke(operation, context, fallback) {
    const handler = this.operations[operation];
    const backendMethod = backendOperationMethods[operation];
    const value = handler !== undefined
      ? handler(context)
      : this.transportBackend !== null && backendMethod !== undefined
        ? this.transportBackend[backendMethod](context)
        : fallback();
    if (this.evidenceSink !== null && typeof this.evidenceSink.record === "function") {
      this.evidenceSink.record({
        operation,
        observation: copyValue(value),
      });
    }
    return value;
  }

  resolveTarget(context) {
    return normalizeStageObservation(
      this.invoke(
        "resolve_target",
        context,
        () => super.resolveTarget(context),
      ),
      "resolve_target",
    );
  }

  validateTarget(context) {
    return normalizeStageObservation(
      this.invoke(
        "validate_target",
        context,
        () => super.validateTarget(context),
      ),
      "validate_target",
    );
  }

  prepareTransport(context) {
    return normalizeTransportObservation(
      this.invoke(
        "prepare_transport",
        context,
        () => super.prepareTransport(context),
      ),
    );
  }

  verifyBootstrapArtifact(context) {
    return normalizeStageObservation(
      this.invoke(
        "verify_bootstrap_artifact",
        context,
        () => super.verifyBootstrapArtifact(context),
      ),
      "verify_bootstrap_artifact",
    );
  }

  loadBootstrap(context) {
    return normalizeStageObservation(
      this.invoke(
        "load_bootstrap",
        context,
        () => super.loadBootstrap(context),
      ),
      "load_bootstrap",
    );
  }

  resolveEntrypoint(context) {
    return normalizeStageObservation(
      this.invoke(
        "resolve_entrypoint",
        context,
        () => super.resolveEntrypoint(context),
      ),
      "resolve_entrypoint",
    );
  }

  startBootstrap(context) {
    return normalizeStageObservation(
      this.invoke(
        "start_bootstrap",
        context,
        () => super.startBootstrap(context),
      ),
      "start_bootstrap",
    );
  }

  verifyHandshake(context) {
    return normalizeStageObservation(
      this.invoke(
        "verify_handshake",
        context,
        () => super.verifyHandshake(context),
      ),
      "verify_handshake",
    );
  }

  stopBootstrap(context) {
    return normalizeStageObservation(
      this.invoke(
        "stop_bootstrap",
        context,
        () => super.stopBootstrap(context),
      ),
      "stop_bootstrap",
    );
  }

  cleanup(context) {
    return normalizeStageObservation(
      this.invoke(
        "cleanup",
        context,
        () => super.cleanup(context),
      ),
      "cleanup",
    );
  }

  checkTargetHealth(context) {
    return normalizeStageObservation(
      this.invoke(
        "check_target_health",
        context,
        () => super.checkTargetHealth(context),
      ),
      "check_target_health",
    );
  }
}

export function executeTargetAdapter(adapter, runContext = {}) {
  if (!(adapter instanceof TargetAdapter)) {
    throw new Error("adapter must implement TargetAdapter");
  }
  const target = targetSnapshot(adapter.targetDescriptor, adapter.targetInstance);
  const context = Object.freeze({
    run_id: runContext.run_id ?? null,
    target: copyValue(target),
    bootstrap_artifact: copyValue(adapter.bootstrapArtifact),
    context: copyValue(runContext.context ?? {}),
  });
  const resolve = adapter.resolveTarget(context);
  let validate = notTestedObservation();
  let targetStatus = resolve.status;
  if (resolve.status === Gate6Status.PASS) {
    validate = adapter.validateTarget(context);
    targetStatus = validate.status;
  }
  if (
    targetStatus === Gate6Status.PASS &&
    !isNonEmptyString(target.identity)
  ) {
    throw new Error("a resolved target must retain an instance identity");
  }
  const resolvedTarget = {
    ...target,
    status: firstNonPassStatus(resolve, validate),
    resolve,
    validate,
  };
  const base = {
    schema_version: genericClientAdapterObservationSchema,
    run_id: context.run_id,
    adapter: {
      kind: "generic-client",
      contract: "TargetAdapter",
      transport_backend: adapter instanceof GenericClientAdapter &&
          adapter.transportBackend !== null
        ? adapter.transportBackend.describeBinding()
        : null,
    },
    target: resolvedTarget,
    iterations: normalizeIterations(runContext.iterations),
    provenance: {
      kind: "generic-client-adapter-observations",
      test_fixture: runContext.test_fixture === true,
      ...(isRecord(runContext.provenance) ? copyValue(runContext.provenance) : {}),
    },
  };

  if (resolvedTarget.status !== Gate6Status.PASS) {
    return {
      ...base,
      ...notTestedAfter(
        resolvedTarget,
        {
          capability: GenericTransportCapability.UNKNOWN,
          preparation: GenericTransportPreparation.NOT_STARTED,
          status: Gate6Status.NOT_TESTED,
        },
        null,
      ),
    };
  }

  const transport = adapter.prepareTransport(context);
  if (transport.status !== Gate6Status.PASS) {
    return {
      ...base,
      ...notTestedAfter(resolvedTarget, transport, null),
    };
  }

  const bootstrapArtifact = adapter.verifyBootstrapArtifact(context);
  if (bootstrapArtifact.status === Gate6Status.PASS) {
    validateBootstrapArtifact(adapter.bootstrapArtifact);
  }
  const observations = {
    ...base,
    target: resolvedTarget,
    transport,
    bootstrap: copyValue(adapter.bootstrapArtifact),
    bootstrap_artifact: bootstrapArtifact,
  };
  if (bootstrapArtifact.status !== Gate6Status.PASS) {
    return {
      ...observations,
      load: notTestedObservation(),
      entrypoint: notTestedObservation(),
      start: { ...notTestedObservation(), nonce: null },
      handshake: {
        ...notTestedObservation(),
        expected_nonce: null,
        observed_nonce: null,
      },
      stop: notTestedObservation(),
      cleanup: notTestedObservation(),
      target_health: notTestedObservation(),
    };
  }

  for (const { operation, field } of lifecycleOperationStages.slice(1)) {
    const method = {
      load_bootstrap: "loadBootstrap",
      resolve_entrypoint: "resolveEntrypoint",
      start_bootstrap: "startBootstrap",
      verify_handshake: "verifyHandshake",
      stop_bootstrap: "stopBootstrap",
      cleanup: "cleanup",
      check_target_health: "checkTargetHealth",
    }[operation];
    const stage = adapter[method](context);
    observations[field] = stage;
    if (stage.status !== Gate6Status.PASS) {
      const remaining = lifecycleOperationStages.slice(
        lifecycleOperationStages.findIndex((item) => item.operation === operation) + 1,
      );
      for (const next of remaining) {
        observations[next.field] = next.field === "start"
          ? { ...notTestedObservation(), nonce: null }
          : next.field === "handshake"
            ? {
              ...notTestedObservation(),
              expected_nonce: null,
              observed_nonce: null,
            }
            : notTestedObservation();
      }
      return observations;
    }
  }
  return observations;
}

function stageCopy(observations, field) {
  if (!isRecord(observations[field])) {
    throw new Error(`adapter observations are missing ${field}`);
  }
  return copyValue(observations[field]);
}

function validateLiveGenericTransportBinding(session, observations) {
  if (observations.provenance?.test_fixture === true) {
    return;
  }
  const binding = observations.adapter?.transport_backend;
  const validation = validateTargetTransportBackendBinding(binding);
  if (!validation.valid) {
    throw new Error(
      `a non-fixture Generic Client PASS requires a valid target transport backend binding: ${validation.errors.join("; ")}`,
    );
  }
  if (
    binding.profile !== session.target.profile ||
    binding.target_identity !== session.target.identity ||
    binding.architecture !== session.target.architecture ||
    binding.runtime !== session.target.runtime ||
    !sameArtifactIdentity(binding.bootstrap_artifact, session.bootstrap)
  ) {
    throw new Error(
      "a non-fixture Generic Client PASS must retain the backend-bound target and bootstrap identities",
    );
  }
}

export function normalizeGenericClientSession(observations) {
  if (
    !isRecord(observations) ||
    observations.schema_version !== genericClientAdapterObservationSchema
  ) {
    throw new Error("generic adapter observations use an unrecognized schema");
  }
  if (!isRecord(observations.target)) {
    throw new Error("generic adapter observations require a target");
  }
  const profile = {
    schema_version: "opus.m3.gate6.target-profile.v1",
    id: observations.target.profile,
    kind: "generic-client",
    architecture: observations.target.architecture,
    runtime: observations.target.runtime,
    metadata: observations.target.metadata,
  };
  const profileValidation = validateTargetProfile(profile);
  if (!profileValidation.valid) {
    throw new Error(
      `generic adapter observations have an invalid target: ${profileValidation.errors.join("; ")}`,
    );
  }

  const session = createNotTestedSession(profile);
  session.run_id = observations.run_id ?? null;
  session.target = {
    profile: observations.target.profile,
    identity: observations.target.identity ?? null,
    architecture: observations.target.architecture,
    runtime: observations.target.runtime,
    metadata: copyValue(observations.target.metadata),
    status: stageCopy(observations, "target").status,
  };
  session.bootstrap = observations.bootstrap === null
    ? null
    : copyValue(observations.bootstrap);
  session.transport = stageCopy(observations, "transport");
  session.bootstrap_artifact = stageCopy(observations, "bootstrap_artifact");
  session.load = stageCopy(observations, "load");
  session.entrypoint = stageCopy(observations, "entrypoint");
  session.start = {
    ...stageCopy(observations, "start"),
    nonce: observations.start?.nonce ?? null,
  };
  session.handshake = {
    ...stageCopy(observations, "handshake"),
    expected_nonce: observations.handshake?.expected_nonce ?? null,
    observed_nonce: observations.handshake?.observed_nonce ?? null,
  };
  session.stop = stageCopy(observations, "stop");
  session.cleanup = stageCopy(observations, "cleanup");
  session.target_health = stageCopy(observations, "target_health");
  session.iterations = normalizeIterations(observations.iterations);
  session.result = combineGate6Statuses([
    session.target.status,
    session.transport.status,
    session.bootstrap_artifact.status,
    session.load.status,
    session.entrypoint.status,
    session.start.status,
    session.handshake.status,
    session.stop.status,
    session.cleanup.status,
    session.target_health.status,
  ]);
  session.provenance = {
    kind: "normalized-generic-client-adapter-observations",
    source_observation_schema: genericClientAdapterObservationSchema,
    ...(isRecord(observations.provenance)
      ? copyValue(observations.provenance)
      : {}),
    ...(isRecord(observations.adapter?.transport_backend)
      ? {
        target_transport_backend: copyValue(
          observations.adapter.transport_backend,
        ),
      }
      : {}),
  };

  const evaluation = evaluateGate6Session(session);
  if (!evaluation.valid) {
    throw new Error(
      `generic adapter observations cannot normalize to a Gate 6 session: ${evaluation.errors.join("; ")}`,
    );
  }
  if (session.result === Gate6Status.PASS) {
    validateLiveGenericTransportBinding(session, observations);
  }
  return session;
}

export function importTransportReadinessEvidence({
  profile,
  evidenceManifest,
  sourceManifestPath = null,
  runId = null,
}) {
  const profileValidation = validateTargetProfile(profile);
  if (!profileValidation.valid || profile.kind !== "generic-client") {
    throw new Error("transport-readiness evidence requires a generic-client profile");
  }
  if (!isRecord(evidenceManifest)) {
    throw new Error("transport-readiness evidence manifest must be an object");
  }
  if (evidenceManifest.intended_profile !== profile.id) {
    throw new Error(
      `transport-readiness evidence intended_profile must equal ${profile.id}`,
    );
  }
  const target = evidenceManifest.target;
  const probe = evidenceManifest.native_task_port_probe;
  const lifecycle = evidenceManifest.lifecycle;
  if (
    !isRecord(target) ||
    target.target_resolved !== Gate6Status.PASS ||
    !Number.isInteger(target.pid) ||
    target.pid <= 0 ||
    !isNonEmptyString(target.architecture)
  ) {
    throw new Error(
      "transport-readiness evidence does not retain a resolved target identity",
    );
  }
  if (
    !isRecord(probe) ||
    probe.result !== "CAPABILITY_AVAILABLE" ||
    !isRecord(lifecycle) ||
    lifecycle.transport_ready !== Gate6Status.BLOCKED
  ) {
    throw new Error(
      "transport-readiness evidence does not retain the available/blocked distinction",
    );
  }

  const adapter = new GenericClientAdapter({
    targetDescriptor: profile,
    targetInstance: {
      identity: `pid:${target.pid}`,
      architecture: target.architecture,
      runtime: profile.runtime,
      metadata: {
        imported_transport_readiness: true,
        client_hint: target.identity ?? "unclassified",
      },
    },
    operations: {
      resolve_target: () => ({
        status: Gate6Status.PASS,
        evidence: "retained target-resolution observation",
      }),
      validate_target: () => ({
        status: Gate6Status.PASS,
        evidence: "retained target instance identity",
      }),
      prepare_transport: () => ({
        capability: GenericTransportCapability.AVAILABLE,
        preparation: GenericTransportPreparation.BLOCKED,
        code: "NOT_SUPPORTED",
        evidence: "retained task-port capability does not include a Gate 6 target transport",
      }),
    },
  });
  return executeTargetAdapter(adapter, {
    run_id: runId,
    provenance: {
      kind: "imported-transport-readiness-evidence",
      source_manifest: sourceManifestPath,
      source_record_kind: evidenceManifest.record_kind ?? null,
      intended_profile: evidenceManifest.intended_profile,
      bootstrap_preflight: copyValue(
        evidenceManifest.bootstrap_preflight ?? null,
      ),
    },
  });
}

export function createCooperativeGenericClientAdapter(plan) {
  if (!isRecord(plan)) {
    throw new Error("cooperative adapter plan must be an object");
  }
  return new GenericClientAdapter({
    targetDescriptor: plan.target_descriptor,
    targetInstance: plan.target_instance,
    bootstrapArtifact: plan.bootstrap_artifact ?? null,
    operations: Object.fromEntries(
      genericClientAdapterOperations.map((operation) => [
        operation,
        () => copyValue(plan.operations?.[operation]),
      ]),
    ),
  });
}
