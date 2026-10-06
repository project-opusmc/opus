import { isAbsolute } from "node:path";

import { Gate6Status } from "./gate6-lifecycle-core.mjs";

export const targetTransportBackendBindingSchema =
  "opus.m3.gate6.target-transport-backend-binding.v1";

export const TargetTransportBackendCode = Object.freeze({
  SUCCESS: "SUCCESS",
  FAILED: "FAILED",
  NOT_SUPPORTED: "NOT_SUPPORTED",
  TARGET_CHANGED: "TARGET_CHANGED",
  ARTIFACT_MISMATCH: "ARTIFACT_MISMATCH",
  TARGET_UNHEALTHY: "TARGET_UNHEALTHY",
  ARCHITECTURE_MISMATCH: "ARCHITECTURE_MISMATCH",
  RUNTIME_UNRESOLVED: "RUNTIME_UNRESOLVED",
  TARGET_IDENTITY_UNRESOLVED: "TARGET_IDENTITY_UNRESOLVED",
  RUN_CONTEXT_MISMATCH: "RUN_CONTEXT_MISMATCH",
});

export const targetTransportBackendOperations = Object.freeze([
  "prepare",
  "verifyArtifact",
  "load",
  "resolveEntrypoint",
  "start",
  "verifyHandshake",
  "stop",
  "cleanup",
  "checkHealth",
]);

const stageStatusValues = new Set(Object.values(Gate6Status));
const backendCodeValues = new Set(Object.values(TargetTransportBackendCode));
const transportCapabilityValues = new Set([
  "AVAILABLE",
  "UNAVAILABLE",
  "UNKNOWN",
]);
const transportPreparationValues = new Set([
  "NOT_STARTED",
  "READY",
  "FAILED",
  "BLOCKED",
]);

function isRecord(value) {
  return value !== null && typeof value === "object" && !Array.isArray(value);
}

function isNonEmptyString(value) {
  return typeof value === "string" && value.trim().length > 0;
}

function isConcreteString(value) {
  return (
    isNonEmptyString(value) &&
    !["unresolved", "unknown"].includes(value.trim().toLowerCase())
  );
}

function isImmutableTargetIdentity(value) {
  return (
    isConcreteString(value) &&
    !/^pid:\d+$/.test(value.trim())
  );
}

function isSha256(value) {
  return typeof value === "string" && /^[0-9a-f]{64}$/.test(value);
}

function copyValue(value) {
  return value === undefined ? undefined : structuredClone(value);
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

function deriveTransportStageStatus(capability, preparation) {
  if (preparation === "NOT_STARTED") {
    return Gate6Status.NOT_TESTED;
  }
  if (preparation === "FAILED") {
    return Gate6Status.FAIL;
  }
  if (preparation === "BLOCKED") {
    return Gate6Status.BLOCKED;
  }
  if (capability === "AVAILABLE") {
    return Gate6Status.PASS;
  }
  if (capability === "UNAVAILABLE") {
    return Gate6Status.FAIL;
  }
  return Gate6Status.BLOCKED;
}

function codeStatus(code) {
  return code === TargetTransportBackendCode.NOT_SUPPORTED
    ? Gate6Status.BLOCKED
    : Gate6Status.FAIL;
}

function codeMessage(code, operation) {
  return `${operation} returned ${code}`;
}

function validateArtifactIdentity(artifact, label, errors) {
  if (!isRecord(artifact)) {
    errors.push(`${label} must be an object`);
    return;
  }
  if (!isNonEmptyString(artifact.artifact) || !isAbsolute(artifact.artifact)) {
    errors.push(`${label}.artifact must be an absolute path`);
  }
  if (!isSha256(artifact.sha256)) {
    errors.push(`${label}.sha256 must be a lowercase SHA-256`);
  }
  if (!isNonEmptyString(artifact.version)) {
    errors.push(`${label}.version must be a non-empty string`);
  }
}

export function validateTargetTransportBackendBinding(binding) {
  const errors = [];
  if (!isRecord(binding)) {
    return { valid: false, errors: ["transport backend binding must be an object"] };
  }
  if (binding.schema_version !== targetTransportBackendBindingSchema) {
    errors.push(
      `transport backend binding.schema_version must be ${targetTransportBackendBindingSchema}`,
    );
  }
  for (const field of [
    "profile",
    "process_identity",
    "instance_identity",
    "architecture",
    "runtime",
    "backend_identity",
    "provider_identity",
    "run_id",
  ]) {
    if (!isNonEmptyString(binding[field])) {
      errors.push(`transport backend binding.${field} must be a non-empty string`);
    }
  }
  if (
    !isNonEmptyString(binding.target_identity) ||
    /^pid:\d+$/.test(binding.target_identity.trim())
  ) {
    errors.push(
      "transport backend binding.target_identity must not be a PID-only identity",
    );
  }
  validateArtifactIdentity(
    binding.bootstrap_artifact,
    "transport backend binding.bootstrap_artifact",
    errors,
  );
  return { valid: errors.length === 0, errors };
}

function operationEvidence(binding, operation, providerEvidence, revalidation) {
  return {
    backend_identity: binding.backend_identity,
    provider_identity: binding.provider_identity,
    profile: binding.profile,
    run_id: binding.run_id,
    target: {
      identity: binding.target_identity,
      process_identity: binding.process_identity,
      instance_identity: binding.instance_identity,
      architecture: binding.architecture,
      runtime: binding.runtime,
    },
    operation,
    revalidation: revalidation === undefined ? null : copyValue(revalidation),
    provider: isRecord(providerEvidence) ? copyValue(providerEvidence) : {},
  };
}

function stageFailure(binding, operation, code, message, evidence, revalidation) {
  return {
    status: codeStatus(code),
    code,
    message: message ?? codeMessage(code, operation),
    evidence: operationEvidence(
      binding,
      operation,
      evidence,
      revalidation,
    ),
  };
}

function prepareFailure(binding, code, message, evidence, revalidation) {
  const blocked = code === TargetTransportBackendCode.NOT_SUPPORTED;
  return {
    capability: "UNKNOWN",
    preparation: blocked ? "BLOCKED" : "FAILED",
    status: blocked ? Gate6Status.BLOCKED : Gate6Status.FAIL,
    code,
    message: message ?? codeMessage(code, "prepare"),
    evidence: operationEvidence(
      binding,
      "prepare",
      evidence,
      revalidation,
    ),
  };
}

function requireTypedProviderResult(value, operation) {
  if (!isRecord(value)) {
    return {
      valid: false,
      code: TargetTransportBackendCode.FAILED,
      message: `${operation} provider result must be an object`,
      evidence: {},
    };
  }
  if (!backendCodeValues.has(value.code)) {
    return {
      valid: false,
      code: TargetTransportBackendCode.FAILED,
      message: `${operation} provider result has an unrecognized code`,
      evidence: isRecord(value.evidence) ? value.evidence : {},
    };
  }
  if (!isNonEmptyString(value.message)) {
    return {
      valid: false,
      code: TargetTransportBackendCode.FAILED,
      message: `${operation} provider result must include a message`,
      evidence: isRecord(value.evidence) ? value.evidence : {},
    };
  }
  if (!isRecord(value.evidence)) {
    return {
      valid: false,
      code: TargetTransportBackendCode.FAILED,
      message: `${operation} provider result must include evidence`,
      evidence: {},
    };
  }
  return { valid: true };
}

function normalizeRevalidation(value, operation) {
  const typed = requireTypedProviderResult(value, operation);
  if (!typed.valid) {
    return typed;
  }
  if (value.code !== TargetTransportBackendCode.SUCCESS) {
    return {
      valid: false,
      code: value.code,
      message: value.message,
      evidence: value.evidence,
    };
  }
  for (const field of [
    "process_identity",
    "instance_identity",
    "architecture",
    "runtime",
  ]) {
    if (!isNonEmptyString(value[field])) {
      return {
        valid: false,
        code: TargetTransportBackendCode.FAILED,
        message: `${operation} success is missing ${field}`,
        evidence: value.evidence,
      };
    }
  }
  return {
    valid: true,
    observation: copyValue(value),
  };
}

function normalizeStageResult(binding, operation, value, revalidation) {
  const typed = requireTypedProviderResult(value, operation);
  if (!typed.valid) {
    return stageFailure(
      binding,
      operation,
      typed.code,
      typed.message,
      typed.evidence,
      revalidation,
    );
  }
  if (value.code !== TargetTransportBackendCode.SUCCESS) {
    return stageFailure(
      binding,
      operation,
      value.code,
      value.message,
      value.evidence,
      revalidation,
    );
  }
  if (value.status !== Gate6Status.PASS) {
    return stageFailure(
      binding,
      operation,
      TargetTransportBackendCode.FAILED,
      `${operation} SUCCESS must carry status PASS`,
      value.evidence,
      revalidation,
    );
  }
  return {
    ...copyValue(value),
    status: Gate6Status.PASS,
    evidence: operationEvidence(
      binding,
      operation,
      value.evidence,
      revalidation,
    ),
  };
}

function normalizePrepareResult(binding, value, revalidation) {
  const typed = requireTypedProviderResult(value, "prepare");
  if (!typed.valid) {
    return prepareFailure(
      binding,
      typed.code,
      typed.message,
      typed.evidence,
      revalidation,
    );
  }
  if (value.code !== TargetTransportBackendCode.SUCCESS) {
    if (value.code === TargetTransportBackendCode.NOT_SUPPORTED) {
      const capability = transportCapabilityValues.has(value.capability)
        ? value.capability
        : "UNKNOWN";
      return {
        capability,
        preparation: "BLOCKED",
        status: Gate6Status.BLOCKED,
        code: value.code,
        message: value.message,
        evidence: operationEvidence(
          binding,
          "prepare",
          value.evidence,
          revalidation,
        ),
      };
    }
    return prepareFailure(
      binding,
      value.code,
      value.message,
      value.evidence,
      revalidation,
    );
  }
  if (
    !transportCapabilityValues.has(value.capability) ||
    !transportPreparationValues.has(value.preparation)
  ) {
    return prepareFailure(
      binding,
      TargetTransportBackendCode.FAILED,
      "prepare SUCCESS must include a recognized capability and preparation",
      value.evidence,
      revalidation,
    );
  }
  const status = deriveTransportStageStatus(value.capability, value.preparation);
  if (status !== Gate6Status.PASS) {
    return prepareFailure(
      binding,
      TargetTransportBackendCode.FAILED,
      "prepare SUCCESS must result in TransportReady PASS",
      value.evidence,
      revalidation,
    );
  }
  return {
    ...copyValue(value),
    status,
    evidence: operationEvidence(
      binding,
      "prepare",
      value.evidence,
      revalidation,
    ),
  };
}

function contextFailure(binding, context) {
  if (!isRecord(context)) {
    return {
      code: TargetTransportBackendCode.RUN_CONTEXT_MISMATCH,
      message: "adapter did not supply a run context",
      evidence: {},
    };
  }
  if (context.run_id !== binding.run_id) {
    return {
      code: TargetTransportBackendCode.RUN_CONTEXT_MISMATCH,
      message: "adapter run ID does not match the transport backend binding",
      evidence: { observed_run_id: context.run_id ?? null },
    };
  }
  if (
    !isRecord(context.target) ||
    context.target.profile !== binding.profile ||
    context.target.identity !== binding.target_identity
  ) {
    return {
      code: TargetTransportBackendCode.TARGET_CHANGED,
      message: "adapter target identity does not match the transport backend binding",
      evidence: {},
    };
  }
  if (
    context.target.architecture !== binding.architecture ||
    context.target.runtime !== binding.runtime
  ) {
    return {
      code: TargetTransportBackendCode.TARGET_CHANGED,
      message: "adapter target runtime identity does not match the transport backend binding",
      evidence: {},
    };
  }
  if (
    !isRecord(context.target.metadata) ||
    context.target.metadata.process_identity !== binding.process_identity ||
    context.target.metadata.instance_identity !== binding.instance_identity
  ) {
    return {
      code: TargetTransportBackendCode.TARGET_CHANGED,
      message: "adapter target process-instance identity does not match the transport backend binding",
      evidence: {},
    };
  }
  if (!sameArtifactIdentity(context.bootstrap_artifact, binding.bootstrap_artifact)) {
    return {
      code: TargetTransportBackendCode.ARTIFACT_MISMATCH,
      message: "adapter bootstrap identity does not match the transport backend binding",
      evidence: {},
    };
  }
  return null;
}

function concretePassFailure(binding) {
  if (!isImmutableTargetIdentity(binding.target_identity)) {
    return {
      code: TargetTransportBackendCode.TARGET_IDENTITY_UNRESOLVED,
      message: "a passing backend operation requires a concrete non-PID-only target identity",
      evidence: {},
    };
  }
  if (!isConcreteString(binding.architecture)) {
    return {
      code: TargetTransportBackendCode.ARCHITECTURE_MISMATCH,
      message: "a passing backend operation requires a concrete target architecture",
      evidence: {},
    };
  }
  if (!isConcreteString(binding.runtime)) {
    return {
      code: TargetTransportBackendCode.RUNTIME_UNRESOLVED,
      message: "a passing backend operation requires a concrete target runtime",
      evidence: {},
    };
  }
  return null;
}

export class TargetTransportBackend {
  constructor({ binding, provider, evidenceSink = null }) {
    const validation = validateTargetTransportBackendBinding(binding);
    if (!validation.valid) {
      throw new Error(
        `invalid target transport backend binding: ${validation.errors.join("; ")}`,
      );
    }
    if (!isRecord(provider)) {
      throw new Error("target transport backend provider must be an object");
    }
    this.binding = copyValue(binding);
    this.provider = provider;
    this.evidenceSink = evidenceSink;
    this.invalidated = false;
  }

  describeBinding() {
    return copyValue(this.binding);
  }

  isInvalidated() {
    return this.invalidated;
  }

  assertAdapterBinding({
    targetDescriptor,
    targetInstance,
    bootstrapArtifact,
  }) {
    if (
      !isRecord(targetDescriptor) ||
      targetDescriptor.id !== this.binding.profile
    ) {
      throw new Error("transport backend profile does not match the target descriptor");
    }
    if (
      !isRecord(targetInstance) ||
      targetInstance.identity !== this.binding.target_identity ||
      targetInstance.architecture !== this.binding.architecture ||
      targetInstance.runtime !== this.binding.runtime
    ) {
      throw new Error(
        "transport backend target descriptor does not match the bound process instance",
      );
    }
    if (
      !isRecord(targetInstance.metadata) ||
      targetInstance.metadata.process_identity !== this.binding.process_identity ||
      targetInstance.metadata.instance_identity !== this.binding.instance_identity
    ) {
      throw new Error(
        "transport backend requires process and instance identities in target metadata",
      );
    }
    if (!sameArtifactIdentity(bootstrapArtifact, this.binding.bootstrap_artifact)) {
      throw new Error(
        "transport backend bootstrap artifact does not match the bound artifact identity",
      );
    }
  }

  record(operation, observation) {
    if (
      this.evidenceSink !== null &&
      typeof this.evidenceSink.record === "function"
    ) {
      this.evidenceSink.record({
        operation,
        binding: this.describeBinding(),
        observation: copyValue(observation),
      });
    }
  }

  invokeProvider(operation, context) {
    const handler = this.provider[operation];
    if (typeof handler !== "function") {
      return {
        code: TargetTransportBackendCode.NOT_SUPPORTED,
        message: `${operation} is not implemented by ${this.binding.provider_identity}`,
        evidence: {},
      };
    }
    try {
      return handler.call(this.provider, context);
    } catch (error) {
      return {
        code: TargetTransportBackendCode.FAILED,
        message: `${operation} provider threw: ${error.message}`,
        evidence: {},
      };
    }
  }

  guard(context, operation) {
    if (this.invalidated) {
      return {
        valid: false,
        code: TargetTransportBackendCode.TARGET_CHANGED,
        message: "transport backend was invalidated after a target identity change",
        evidence: {},
      };
    }
    const contextError = contextFailure(this.binding, context);
    if (contextError !== null) {
      if (contextError.code === TargetTransportBackendCode.TARGET_CHANGED) {
        this.invalidated = true;
      }
      return { valid: false, ...contextError };
    }
    const revalidation = normalizeRevalidation(
      this.invokeProvider("revalidateTarget", context),
      `${operation}.revalidateTarget`,
    );
    if (!revalidation.valid) {
      if (revalidation.code === TargetTransportBackendCode.TARGET_CHANGED) {
        this.invalidated = true;
      }
      return revalidation;
    }
    const observed = revalidation.observation;
    if (
      observed.process_identity !== this.binding.process_identity ||
      observed.instance_identity !== this.binding.instance_identity
    ) {
      this.invalidated = true;
      return {
        valid: false,
        code: TargetTransportBackendCode.TARGET_CHANGED,
        message: "provider revalidation observed a different process instance",
        evidence: observed.evidence,
      };
    }
    if (observed.architecture !== this.binding.architecture) {
      return {
        valid: false,
        code: TargetTransportBackendCode.ARCHITECTURE_MISMATCH,
        message: "provider revalidation observed a different target architecture",
        evidence: observed.evidence,
      };
    }
    if (observed.runtime !== this.binding.runtime) {
      this.invalidated = true;
      return {
        valid: false,
        code: TargetTransportBackendCode.TARGET_CHANGED,
        message: "provider revalidation observed a different target runtime",
        evidence: observed.evidence,
      };
    }
    return {
      valid: true,
      revalidation: observed,
    };
  }

  prepare(context) {
    const guard = this.guard(context, "prepare");
    let observation;
    if (!guard.valid) {
      observation = prepareFailure(
        this.binding,
        guard.code,
        guard.message,
        guard.evidence,
      );
    } else {
      observation = normalizePrepareResult(
        this.binding,
        this.invokeProvider("prepare", context),
        guard.revalidation,
      );
      if (observation.status === Gate6Status.PASS) {
        const failure = concretePassFailure(this.binding);
        if (failure !== null) {
          observation = prepareFailure(
            this.binding,
            failure.code,
            failure.message,
            failure.evidence,
            guard.revalidation,
          );
        }
      }
    }
    this.record("prepare", observation);
    return observation;
  }

  invokeStage(operation, context) {
    const guard = this.guard(context, operation);
    let observation;
    if (!guard.valid) {
      observation = stageFailure(
        this.binding,
        operation,
        guard.code,
        guard.message,
        guard.evidence,
      );
    } else {
      observation = normalizeStageResult(
        this.binding,
        operation,
        this.invokeProvider(operation, context),
        guard.revalidation,
      );
      if (observation.status === Gate6Status.PASS) {
        const failure = concretePassFailure(this.binding);
        if (failure !== null) {
          observation = stageFailure(
            this.binding,
            operation,
            failure.code,
            failure.message,
            failure.evidence,
            guard.revalidation,
          );
        }
      }
    }
    this.record(operation, observation);
    return observation;
  }

  verifyArtifact(context) {
    let observation = this.invokeStage("verifyArtifact", context);
    if (
      observation.status === Gate6Status.PASS &&
      !sameArtifactIdentity(observation.artifact, this.binding.bootstrap_artifact)
    ) {
      observation = stageFailure(
        this.binding,
        "verifyArtifact",
        TargetTransportBackendCode.ARTIFACT_MISMATCH,
        "provider artifact identity does not match the bound bootstrap artifact",
        {},
        observation.evidence?.revalidation,
      );
      this.record("verifyArtifact", observation);
    }
    return observation;
  }

  load(context) {
    return this.invokeStage("load", context);
  }

  resolveEntrypoint(context) {
    return this.invokeStage("resolveEntrypoint", context);
  }

  start(context) {
    return this.invokeStage("start", context);
  }

  verifyHandshake(context) {
    return this.invokeStage("verifyHandshake", context);
  }

  stop(context) {
    return this.invokeStage("stop", context);
  }

  cleanup(context) {
    return this.invokeStage("cleanup", context);
  }

  checkHealth(context) {
    return this.invokeStage("checkHealth", context);
  }
}

export function createCooperativeTargetTransportProvider(plan) {
  if (!isRecord(plan) || !isRecord(plan.operations)) {
    throw new Error(
      "cooperative target transport provider plan must contain operations",
    );
  }
  const operationKey = Object.freeze({
    revalidateTarget: "revalidate_target",
    prepare: "prepare",
    verifyArtifact: "verify_artifact",
    load: "load",
    resolveEntrypoint: "resolve_entrypoint",
    start: "start",
    verifyHandshake: "verify_handshake",
    stop: "stop",
    cleanup: "cleanup",
    checkHealth: "check_health",
  });
  const provider = {
    identity: isNonEmptyString(plan.provider_identity)
      ? plan.provider_identity
      : "cooperative-target-transport-provider",
  };
  for (const [method, key] of Object.entries(operationKey)) {
    provider[method] = () => copyValue(plan.operations[key]);
  }
  return Object.freeze(provider);
}
