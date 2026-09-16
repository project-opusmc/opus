import { spawnSync } from "node:child_process";
import { createHash, randomUUID } from "node:crypto";
import {
  existsSync,
  lstatSync,
  mkdirSync,
  readFileSync,
  realpathSync,
  writeFileSync,
} from "node:fs";
import { dirname, isAbsolute, join, resolve } from "node:path";
import { fileURLToPath } from "node:url";

import {
  Gate6Status,
  evaluateGate6Session,
  gate6TargetProfileSchema,
  requiredStabilityLadder,
  validateTargetProfile,
} from "./gate6-lifecycle-core.mjs";
import {
  GenericClientAdapter,
  executeTargetAdapter,
  normalizeGenericClientSession,
} from "./gate6-generic-client-adapter.mjs";
import {
  TargetTransportBackend,
  TargetTransportBackendCode,
  validateTargetTransportBackendBinding,
} from "./gate6-target-transport-backend.mjs";
import {
  BadlionNativeControlPlaneTransportProvider,
  badlionNativeTransportProviderId,
} from "./gate6-badlion-native-transport-provider.mjs";

export const ownedNativeBootstrapControlPlaneId =
  "owned-native-bootstrap-control-plane";
export const ownedNativeBootstrapControlPlaneSchema =
  "opus.m3.gate6.owned-native-bootstrap-control-plane.v1";

const lifecycleEventSchema = "opus.m3.gate6.lifecycle.v1";
const baseSessionNonce = "0x4f50555347415436";
const defaultBootstrapVersion = "abi-v1";
const lifecycleEventByProviderOperation = Object.freeze({
  load: "BootstrapModuleLoaded",
  resolveEntrypoint: "BootstrapEntrypointReady",
  start: "BootstrapStarted",
  verifyHandshake: "BootstrapHandshakeOk",
  stop: "BootstrapStopped",
  cleanup: "BootstrapCleanedUp",
});

const scriptDir = dirname(fileURLToPath(import.meta.url));
const opusRoot = resolve(scriptDir, "..");
export const ownedNativeBootstrapProfilePath = join(
  opusRoot,
  "config",
  "gate6",
  "profiles",
  "opus-owned-cooperative.json",
);

function isRecord(value) {
  return value !== null && typeof value === "object" && !Array.isArray(value);
}

function isNonEmptyString(value) {
  return typeof value === "string" && value.trim().length > 0;
}

function isConcreteString(value) {
  return (
    isNonEmptyString(value) &&
    !["unknown", "unresolved"].includes(value.trim().toLowerCase())
  );
}

function isSha256(value) {
  return typeof value === "string" && /^[0-9a-f]{64}$/.test(value);
}

function copyValue(value) {
  return value === undefined ? undefined : structuredClone(value);
}

function requireAbsolutePath(pathname, label) {
  if (!isAbsolute(pathname)) {
    throw new Error(`${label} must be an absolute path`);
  }
  return pathname;
}

function canonicalRegularFile(pathname, label) {
  const absolute = requireAbsolutePath(pathname, label);
  if (!existsSync(absolute)) {
    throw new Error(`${label} is missing: ${absolute}`);
  }
  const metadata = lstatSync(absolute);
  if (!metadata.isFile() || metadata.isSymbolicLink()) {
    throw new Error(`${label} must be a regular non-symlink file: ${absolute}`);
  }
  return realpathSync(absolute);
}

function sha256File(pathname) {
  return createHash("sha256").update(readFileSync(pathname)).digest("hex");
}

function writeJson(pathname, value, { exclusive = false } = {}) {
  writeFileSync(pathname, `${JSON.stringify(value, null, 2)}\n`, {
    encoding: "utf8",
    mode: 0o600,
    flag: exclusive ? "wx" : "w",
  });
}

function writeText(pathname, value) {
  writeFileSync(pathname, value, {
    encoding: "utf8",
    mode: 0o600,
  });
}

function resultCodeForFailure(code) {
  return code === TargetTransportBackendCode.NOT_SUPPORTED
    ? Gate6Status.BLOCKED
    : Gate6Status.FAIL;
}

function typedFailure(code, message, evidence = {}) {
  return {
    code,
    message,
    evidence,
  };
}

function stageFailure(code, message, evidence = {}) {
  return {
    status: resultCodeForFailure(code),
    code,
    message,
    evidence,
  };
}

function stageSuccess(message, evidence = {}, additional = {}) {
  return {
    status: Gate6Status.PASS,
    code: TargetTransportBackendCode.SUCCESS,
    message,
    evidence,
    ...additional,
  };
}

function parseArchitectureOutput(output) {
  return output
    .trim()
    .split(/\s+/)
    .filter((value) => value.length > 0);
}

function inspectArchitectures(pathname) {
  const result = spawnSync("lipo", ["-archs", pathname], {
    encoding: "utf8",
    timeout: 10_000,
  });
  if (result.error || result.status !== 0) {
    return {
      valid: false,
      message: result.error?.message ??
        result.stderr.trim() ??
        `lipo exited ${result.status}`,
      stdout: result.stdout ?? "",
      stderr: result.stderr ?? "",
      architectures: [],
    };
  }
  return {
    valid: true,
    message: "Mach-O architectures inspected",
    stdout: result.stdout,
    stderr: result.stderr,
    architectures: parseArchitectureOutput(result.stdout),
  };
}

function parseHostKeyValueOutput(value) {
  const firstLine = value
    .split("\n")
    .find((line) => line.startsWith("[OPUS/BOOTSTRAP]"));
  if (firstLine === undefined) {
    return {};
  }
  return Object.fromEntries(
    firstLine
      .split(/\s+/)
      .filter((token) => token.includes("="))
      .map((token) => token.split(/=(.*)/s, 2))
      .filter(([key, entry]) => key.length > 0 && entry.length > 0),
  );
}

function parseLifecycleEvents(pathname) {
  if (!existsSync(pathname)) {
    return [];
  }
  return readFileSync(pathname, "utf8")
    .split("\n")
    .filter((line) => line.trim().length > 0)
    .map((line, index) => {
      let event;
      try {
        event = JSON.parse(line);
      } catch (error) {
        throw new Error(
          `native lifecycle event ${index + 1} is not JSON: ${error.message}`,
        );
      }
      if (!isRecord(event) || event.schema !== lifecycleEventSchema) {
        throw new Error(
          `native lifecycle event ${index + 1} has an unrecognized schema`,
        );
      }
      return event;
    });
}

function eventMatchesStage(event, stage, expectedEvent) {
  return (
    event.iteration === stage &&
    event.iterations_requested === stage &&
    event.event === expectedEvent &&
    event.outcome === "Success"
  );
}

function lifecycleFailureFromEvents(events) {
  const candidate = events.find(
    (event) =>
      event.event === "BootstrapCleanupRequired" ||
      event.event === "BootstrapCleanupFailed",
  );
  if (candidate === undefined) {
    return null;
  }
  return {
    event: candidate.event,
    code: candidate.outcome,
    iteration: candidate.iteration,
    iterations_requested: candidate.iterations_requested,
    cleanup_complete: candidate.cleanup_complete,
  };
}

function operationForNativeFailure(failure) {
  if (failure === null) {
    return "load";
  }
  const code = failure.code ?? "";
  if (
    code === "BootstrapArtifactIdentityMismatch" ||
    code === "BootstrapArtifactInvalid"
  ) {
    return "verifyArtifact";
  }
  if (code === "BootstrapEntrypointMissing") {
    return "resolveEntrypoint";
  }
  if (code === "BootstrapHandshakeInvalid") {
    return "verifyHandshake";
  }
  if (
    code === "BootstrapStartFailed" ||
    code === "BootstrapNonceMismatch" ||
    code === "BootstrapAbiUnsupported"
  ) {
    return "start";
  }
  if (code === "BootstrapStopFailed") {
    return "stop";
  }
  if (
    code === "BootstrapCleanupFailed" ||
    code === "BootstrapUnloadFailed"
  ) {
    return "cleanup";
  }
  return "load";
}

function providerEvidenceBase(controlPlane) {
  return {
    control_plane: ownedNativeBootstrapControlPlaneId,
    scope: "opus-owned-cooperative-native-bootstrap-host-only",
    external_target_execution: false,
    run_id: controlPlane.binding.run_id,
    host_path: controlPlane.hostPath,
    host_sha256: controlPlane.expectedHostSha256,
    bootstrap_artifact: copyValue(controlPlane.binding.bootstrap_artifact),
  };
}

function readOwnedNativeBootstrapProfile(pathname = ownedNativeBootstrapProfilePath) {
  const path = canonicalRegularFile(pathname, "owned native bootstrap profile");
  const profile = JSON.parse(readFileSync(path, "utf8"));
  const validation = validateTargetProfile(profile);
  if (!validation.valid) {
    throw new Error(
      `invalid owned native bootstrap profile: ${validation.errors.join("; ")}`,
    );
  }
  if (
    profile.id !== "opus-owned-cooperative" ||
    profile.kind !== "generic-client"
  ) {
    throw new Error(
      "owned native bootstrap profile must be the opus-owned-cooperative Generic Client profile",
    );
  }
  return profile;
}

export class OwnedNativeBootstrapControlPlane {
  constructor({
    binding,
    hostPath,
    evidenceDir,
    expectedHostSha256,
    hostRunner = spawnSync,
  }) {
    const bindingValidation = validateTargetTransportBackendBinding(binding);
    if (!bindingValidation.valid) {
      throw new Error(
        `invalid owned native bootstrap binding: ${bindingValidation.errors.join("; ")}`,
      );
    }
    requireAbsolutePath(hostPath, "owned native bootstrap host");
    requireAbsolutePath(evidenceDir, "owned native bootstrap evidence directory");
    if (!isSha256(expectedHostSha256)) {
      throw new Error(
        "owned native bootstrap host identity must be a lowercase SHA-256",
      );
    }
    if (typeof hostRunner !== "function") {
      throw new Error("owned native bootstrap host runner must be a function");
    }

    this.binding = copyValue(binding);
    this.hostPath = hostPath;
    this.evidenceDir = evidenceDir;
    this.expectedHostSha256 = expectedHostSha256;
    this.hostRunner = hostRunner;
    this.identity = ownedNativeBootstrapControlPlaneId;
    this.prepared = false;
    this.artifactVerified = false;
    this.transaction = null;
    this.revalidationCount = 0;

    mkdirSync(this.evidenceDir, { recursive: false, mode: 0o700 });
    writeJson(
      join(this.evidenceDir, "control-plane-manifest.json"),
      {
        schema_version: ownedNativeBootstrapControlPlaneSchema,
        control_plane: ownedNativeBootstrapControlPlaneId,
        scope: "opus-owned-cooperative-native-bootstrap-host-only",
        external_target_execution: false,
        binding: this.binding,
        host: {
          path: this.hostPath,
          expected_sha256: this.expectedHostSha256,
        },
        lifecycle_execution_model:
          "existing-opus-bootstrap-host-atomic-native-transaction",
      },
      { exclusive: true },
    );
  }

  targetRevalidationEvidence() {
    return {
      ...providerEvidenceBase(this),
      target_identity_model:
        "source-controlled-bootstrap-host-executable-plus-run-instance",
      revalidation_count: this.revalidationCount,
    };
  }

  revalidateTarget(context) {
    this.revalidationCount += 1;
    const evidence = this.targetRevalidationEvidence();

    if (!isRecord(context) || context.run_id !== this.binding.run_id) {
      return typedFailure(
        TargetTransportBackendCode.RUN_CONTEXT_MISMATCH,
        "owned native bootstrap control plane received a different run context",
        evidence,
      );
    }
    if (
      !isRecord(context.target) ||
      context.target.identity !== this.binding.target_identity ||
      context.target.metadata?.process_identity !== this.binding.process_identity ||
      context.target.metadata?.instance_identity !== this.binding.instance_identity
    ) {
      return typedFailure(
        TargetTransportBackendCode.TARGET_CHANGED,
        "owned native bootstrap target identity does not match the bound run",
        evidence,
      );
    }
    if (!isConcreteString(this.binding.runtime)) {
      return typedFailure(
        TargetTransportBackendCode.RUNTIME_UNRESOLVED,
        "owned native bootstrap target runtime is unresolved",
        evidence,
      );
    }
    if (!existsSync(this.hostPath)) {
      return typedFailure(
        TargetTransportBackendCode.TARGET_CHANGED,
        "owned native bootstrap host no longer exists",
        evidence,
      );
    }

    let canonicalHost;
    let observedHostSha256;
    try {
      canonicalHost = canonicalRegularFile(
        this.hostPath,
        "owned native bootstrap host",
      );
      observedHostSha256 = sha256File(canonicalHost);
    } catch (error) {
      return typedFailure(
        TargetTransportBackendCode.TARGET_CHANGED,
        `owned native bootstrap host cannot be revalidated: ${error.message}`,
        evidence,
      );
    }
    if (observedHostSha256 !== this.expectedHostSha256) {
      return typedFailure(
        TargetTransportBackendCode.TARGET_CHANGED,
        "owned native bootstrap host executable identity changed during the run",
        {
          ...evidence,
          observed_host_path: canonicalHost,
          observed_host_sha256: observedHostSha256,
        },
      );
    }

    const architecture = inspectArchitectures(canonicalHost);
    if (!architecture.valid) {
      return typedFailure(
        TargetTransportBackendCode.FAILED,
        `could not inspect owned native bootstrap host architecture: ${architecture.message}`,
        {
          ...evidence,
          architecture_probe: architecture,
        },
      );
    }
    if (!architecture.architectures.includes(this.binding.architecture)) {
      return typedFailure(
        TargetTransportBackendCode.ARCHITECTURE_MISMATCH,
        "owned native bootstrap host does not contain the bound architecture",
        {
          ...evidence,
          architecture_probe: architecture,
        },
      );
    }

    return {
      code: TargetTransportBackendCode.SUCCESS,
      message: "owned native bootstrap target identity and host architecture match the bound run",
      evidence: {
        ...evidence,
        observed_host_path: canonicalHost,
        observed_host_sha256: observedHostSha256,
        architecture_probe: architecture,
      },
      process_identity: this.binding.process_identity,
      instance_identity: this.binding.instance_identity,
      architecture: this.binding.architecture,
      runtime: this.binding.runtime,
    };
  }

  prepare() {
    const evidence = providerEvidenceBase(this);
    const result = this.hostRunner(this.hostPath, [], {
      encoding: "utf8",
      timeout: 10_000,
    });
    const stdout = result.stdout ?? "";
    const stderr = result.stderr ?? "";
    const expectedUsage =
      result.error === undefined &&
      result.status === 2 &&
      stderr.includes("Usage: opus-bootstrap-host");
    if (!expectedUsage) {
      return {
        capability: "UNAVAILABLE",
        preparation: "FAILED",
        code: TargetTransportBackendCode.FAILED,
        message: "owned native bootstrap host launch-readiness probe failed",
        evidence: {
          ...evidence,
          host_launch: {
            status: result.status ?? null,
            signal: result.signal ?? null,
            error: result.error?.message ?? null,
            stdout,
            stderr,
          },
        },
      };
    }
    this.prepared = true;
    return {
      capability: "AVAILABLE",
      preparation: "READY",
      status: Gate6Status.PASS,
      code: TargetTransportBackendCode.SUCCESS,
      message: "owned native bootstrap host transport is available and ready",
      evidence: {
        ...evidence,
        transport: "ordinary-local-dlopen-through-opus-bootstrap-host",
        host_launch: {
          status: result.status,
          usage_verified: true,
        },
      },
    };
  }

  verifyArtifact(context) {
    const evidence = providerEvidenceBase(this);
    if (!this.prepared) {
      return stageFailure(
        TargetTransportBackendCode.FAILED,
        "owned native bootstrap artifact verification requires successful transport preparation",
        evidence,
      );
    }
    if (
      !isRecord(context?.bootstrap_artifact) ||
      context.bootstrap_artifact.artifact !== this.binding.bootstrap_artifact.artifact ||
      context.bootstrap_artifact.sha256 !== this.binding.bootstrap_artifact.sha256 ||
      context.bootstrap_artifact.version !== this.binding.bootstrap_artifact.version
    ) {
      return stageFailure(
        TargetTransportBackendCode.ARTIFACT_MISMATCH,
        "owned native bootstrap artifact does not match the bound run identity",
        evidence,
      );
    }

    let artifactPath;
    let observedSha256;
    try {
      artifactPath = canonicalRegularFile(
        this.binding.bootstrap_artifact.artifact,
        "owned native bootstrap artifact",
      );
      observedSha256 = sha256File(artifactPath);
    } catch (error) {
      return stageFailure(
        TargetTransportBackendCode.ARTIFACT_MISMATCH,
        `owned native bootstrap artifact cannot be verified: ${error.message}`,
        evidence,
      );
    }
    if (
      artifactPath !== this.binding.bootstrap_artifact.artifact ||
      observedSha256 !== this.binding.bootstrap_artifact.sha256
    ) {
      return stageFailure(
        TargetTransportBackendCode.ARTIFACT_MISMATCH,
        "owned native bootstrap artifact path or SHA-256 changed during the run",
        {
          ...evidence,
          observed_artifact: {
            artifact: artifactPath,
            sha256: observedSha256,
            version: this.binding.bootstrap_artifact.version,
          },
        },
      );
    }

    const architecture = inspectArchitectures(artifactPath);
    if (!architecture.valid) {
      return stageFailure(
        TargetTransportBackendCode.ARTIFACT_MISMATCH,
        `could not inspect owned native bootstrap artifact architecture: ${architecture.message}`,
        {
          ...evidence,
          artifact_architecture_probe: architecture,
        },
      );
    }
    if (!architecture.architectures.includes(this.binding.architecture)) {
      return stageFailure(
        TargetTransportBackendCode.ARCHITECTURE_MISMATCH,
        "owned native bootstrap artifact does not contain the bound architecture",
        {
          ...evidence,
          artifact_architecture_probe: architecture,
        },
      );
    }

    this.artifactVerified = true;
    return stageSuccess(
      "owned native bootstrap artifact path, SHA-256, version, and architecture verified",
      {
        ...evidence,
        artifact_architecture_probe: architecture,
      },
      {
        artifact: copyValue(this.binding.bootstrap_artifact),
      },
    );
  }

  executeNativeLadder() {
    if (this.transaction !== null) {
      return this.transaction;
    }
    const eventsPath = join(this.evidenceDir, "native-lifecycle-events.jsonl");
    writeText(eventsPath, "");
    const runs = [];

    for (const stage of requiredStabilityLadder) {
      const stdoutPath = join(this.evidenceDir, `host-stdout-${stage}.log`);
      const stderrPath = join(this.evidenceDir, `host-stderr-${stage}.log`);
      const arguments_ = [
        "--bootstrap",
        this.binding.bootstrap_artifact.artifact,
        "--bootstrap-sha256",
        this.binding.bootstrap_artifact.sha256,
        "--iterations",
        String(stage),
        "--session-nonce",
        baseSessionNonce,
        "--run-id",
        this.binding.run_id,
        "--events-file",
        eventsPath,
      ];
      const result = this.hostRunner(this.hostPath, arguments_, {
        encoding: "utf8",
        timeout: 30_000,
      });
      const stdout = result.stdout ?? "";
      const stderr = result.stderr ?? "";
      writeText(stdoutPath, stdout);
      writeText(stderrPath, stderr);
      const allEvents = parseLifecycleEvents(eventsPath);
      const stageEvents = allEvents.filter(
        (event) =>
          event.run_id === this.binding.run_id &&
          event.iterations_requested === stage,
      );
      const run = {
        stage,
        arguments: arguments_,
        stdout_path: stdoutPath,
        stderr_path: stderrPath,
        exit_status: result.status ?? null,
        signal: result.signal ?? null,
        error: result.error?.message ?? null,
        stdout: parseHostKeyValueOutput(stdout),
        failure: lifecycleFailureFromEvents(stageEvents),
        events: stageEvents,
      };
      runs.push(run);
      if (result.error !== undefined || result.status !== 0) {
        break;
      }
    }

    this.transaction = {
      schema_version: ownedNativeBootstrapControlPlaneSchema,
      run_id: this.binding.run_id,
      events_path: eventsPath,
      requested_ladder: [...requiredStabilityLadder],
      attempted_stages: runs.map((run) => run.stage),
      runs,
    };
    writeJson(
      join(this.evidenceDir, "native-lifecycle-transaction.json"),
      this.transaction,
    );
    return this.transaction;
  }

  operationEvidence(operation, expectedEvent) {
    const transaction = this.executeNativeLadder();
    const eventRuns = transaction.runs.map((run) => ({
      stage: run.stage,
      event: run.events.find((event) =>
        eventMatchesStage(event, run.stage, expectedEvent),
      ) ?? null,
      failure: run.failure,
      exit_status: run.exit_status,
      stdout_path: run.stdout_path,
      stderr_path: run.stderr_path,
    }));
    const missing = eventRuns.find((run) => run.event === null);
    return {
      transaction,
      event_runs: eventRuns,
      missing,
      native_failure: transaction.runs
        .map((run) => run.failure)
        .find((failure) => failure !== null) ?? null,
      expected_event: expectedEvent,
      operation,
    };
  }

  operationFailure(operation, expectedEvent, observation) {
    const nativeOperation = operationForNativeFailure(observation.native_failure);
    const isNativeFailureAtOperation = nativeOperation === operation;
    const code = observation.native_failure?.code ===
      "BootstrapArtifactIdentityMismatch"
      ? TargetTransportBackendCode.ARTIFACT_MISMATCH
      : TargetTransportBackendCode.FAILED;
    return stageFailure(
      code,
      isNativeFailureAtOperation
        ? `owned native bootstrap host reported ${observation.native_failure.code} at ${operation}`
        : `owned native bootstrap host did not emit ${expectedEvent} for every attempted ladder stage`,
      {
        ...providerEvidenceBase(this),
        lifecycle_event_evidence: observation,
      },
    );
  }

  lifecycleOperation(operation) {
    if (!this.artifactVerified) {
      return stageFailure(
        TargetTransportBackendCode.FAILED,
        `${operation} requires verified owned native bootstrap artifact identity`,
        providerEvidenceBase(this),
      );
    }
    const expectedEvent = lifecycleEventByProviderOperation[operation];
    const observation = this.operationEvidence(operation, expectedEvent);
    if (observation.missing !== undefined) {
      return this.operationFailure(operation, expectedEvent, observation);
    }

    const evidence = {
      ...providerEvidenceBase(this),
      lifecycle_event_evidence: observation,
    };
    const finalEvent = observation.event_runs.at(-1)?.event;
    if (operation === "start") {
      return stageSuccess(
        "owned native bootstrap start ABI acknowledgement observed",
        evidence,
        {
          nonce: finalEvent.session_nonce,
          nonce_mode: "deterministic-counter",
        },
      );
    }
    if (operation === "verifyHandshake") {
      const matchingHandshake = observation.event_runs.every(
        ({ event }) =>
          event.session_nonce === finalEvent.session_nonce ||
          (event.expected_handshake === event.observed_handshake &&
            event.session_nonce !== undefined),
      );
      if (
        !matchingHandshake ||
        finalEvent.expected_handshake !== finalEvent.observed_handshake
      ) {
        return stageFailure(
          TargetTransportBackendCode.FAILED,
          "owned native bootstrap handshake acknowledgement did not match",
          evidence,
        );
      }
      return stageSuccess(
        "owned native bootstrap nonce-derived handshake observed",
        evidence,
        {
          expected_nonce: finalEvent.session_nonce,
          observed_nonce: finalEvent.session_nonce,
        },
      );
    }
    return stageSuccess(
      `owned native bootstrap lifecycle witness ${expectedEvent} observed`,
      evidence,
    );
  }

  load() {
    return this.lifecycleOperation("load");
  }

  resolveEntrypoint() {
    return this.lifecycleOperation("resolveEntrypoint");
  }

  start() {
    return this.lifecycleOperation("start");
  }

  verifyHandshake() {
    return this.lifecycleOperation("verifyHandshake");
  }

  stop() {
    return this.lifecycleOperation("stop");
  }

  cleanup() {
    const result = this.lifecycleOperation("cleanup");
    if (result.status !== Gate6Status.PASS) {
      return result;
    }
    const transaction = this.transaction;
    const cleanupComplete = transaction.runs.every(({ stage, events }) =>
      events.some((event) =>
        eventMatchesStage(event, stage, "BootstrapCleanedUp") &&
        event.cleanup_complete === true,
      ),
    );
    if (!cleanupComplete) {
      return stageFailure(
        TargetTransportBackendCode.FAILED,
        "owned native bootstrap cleanup acknowledgement is incomplete",
        result.evidence,
      );
    }
    return result;
  }

  checkHealth() {
    if (!this.artifactVerified) {
      return stageFailure(
        TargetTransportBackendCode.FAILED,
        "target health requires verified owned native bootstrap artifact identity",
        providerEvidenceBase(this),
      );
    }
    const transaction = this.executeNativeLadder();
    const unhealthyRun = transaction.runs.find(
      (run) =>
        run.stdout.host_alive !== "true" ||
        run.stdout.cleanup !== "true" ||
        run.exit_status !== 0,
    );
    if (unhealthyRun !== undefined) {
      return stageFailure(
        TargetTransportBackendCode.TARGET_UNHEALTHY,
        "owned native bootstrap host did not retain a healthy post-cleanup observation",
        {
          ...providerEvidenceBase(this),
          lifecycle_transaction: transaction,
          unhealthy_run: unhealthyRun,
        },
      );
    }
    return stageSuccess(
      "owned native bootstrap host reported healthy after every completed cleanup",
      {
        ...providerEvidenceBase(this),
        lifecycle_transaction: transaction,
        health_observation:
          "host_alive=true was emitted by the native host before its normal process exit",
      },
    );
  }
}

export function ownedNativeBootstrapTargetOperations(controlPlane) {
  if (!(controlPlane instanceof OwnedNativeBootstrapControlPlane)) {
    throw new Error(
      "owned native bootstrap target operations require OwnedNativeBootstrapControlPlane",
    );
  }
  const targetObservation = (context, label) => {
    const revalidation = controlPlane.revalidateTarget(context);
    if (revalidation.code !== TargetTransportBackendCode.SUCCESS) {
      return {
        status: resultCodeForFailure(revalidation.code),
        code: revalidation.code,
        message: revalidation.message,
        evidence: revalidation.evidence,
      };
    }
    return stageSuccess(
      `owned native bootstrap target ${label}`,
      revalidation.evidence,
    );
  };
  return {
    resolve_target: (context) => targetObservation(context, "resolved"),
    validate_target: (context) => targetObservation(context, "validated"),
  };
}

export function createOwnedNativeBootstrapControlPlaneRun({
  evidenceDir,
  runId = `owned-native-bootstrap-${randomUUID()}`,
  profile = readOwnedNativeBootstrapProfile(),
  hostPath = join(
    opusRoot,
    "output",
    "injector-native-transport",
    "arm64",
    "opus-bootstrap-host",
  ),
  bootstrapPath = join(
    opusRoot,
    "output",
    "injector-native-transport",
    "arm64",
    "libopus-bootstrap.dylib",
  ),
  bootstrapVersion = defaultBootstrapVersion,
  hostRunner = spawnSync,
}) {
  const profileValidation = validateTargetProfile(profile);
  if (!profileValidation.valid || profile.kind !== "generic-client") {
    throw new Error(
      `owned native bootstrap run requires a valid Generic Client profile: ${profileValidation.errors.join("; ")}`,
    );
  }
  if (
    !isConcreteString(profile.architecture) ||
    !isConcreteString(profile.runtime)
  ) {
    throw new Error(
      "owned native bootstrap run requires concrete profile architecture and runtime",
    );
  }
  if (!isNonEmptyString(runId)) {
    throw new Error("owned native bootstrap run ID must be non-empty");
  }

  const canonicalHost = canonicalRegularFile(
    hostPath,
    "owned native bootstrap host",
  );
  const canonicalBootstrap = canonicalRegularFile(
    bootstrapPath,
    "owned native bootstrap artifact",
  );
  const hostSha256 = sha256File(canonicalHost);
  const bootstrapSha256 = sha256File(canonicalBootstrap);
  const targetIdentity =
    `owned-bootstrap-host:${hostSha256};run:${runId}`;
  const processIdentity = `owned-bootstrap-host-executable:${hostSha256}`;
  const instanceIdentity = `owned-bootstrap-host-run:${runId}`;
  const bootstrapArtifact = {
    artifact: canonicalBootstrap,
    sha256: bootstrapSha256,
    version: bootstrapVersion,
  };
  const backendBinding = {
    schema_version: "opus.m3.gate6.target-transport-backend-binding.v1",
    profile: profile.id,
    target_identity: targetIdentity,
    process_identity: processIdentity,
    instance_identity: instanceIdentity,
    architecture: profile.architecture,
    runtime: profile.runtime,
    backend_identity: ownedNativeBootstrapControlPlaneId,
    provider_identity: badlionNativeTransportProviderId,
    run_id: runId,
    bootstrap_artifact: bootstrapArtifact,
  };
  const bindingValidation = validateTargetTransportBackendBinding(backendBinding);
  if (!bindingValidation.valid) {
    throw new Error(
      `owned native bootstrap backend binding is invalid: ${bindingValidation.errors.join("; ")}`,
    );
  }

  const controlPlane = new OwnedNativeBootstrapControlPlane({
    binding: backendBinding,
    hostPath: canonicalHost,
    evidenceDir,
    expectedHostSha256: hostSha256,
    hostRunner,
  });
  const providerRecords = [];
  const evidenceSink = {
    record(record) {
      providerRecords.push(copyValue(record));
    },
  };
  const provider = new BadlionNativeControlPlaneTransportProvider({
    controlPlane,
    evidenceSink,
  });
  const backend = new TargetTransportBackend({
    binding: backendBinding,
    provider,
    evidenceSink,
  });
  const targetInstance = {
    identity: targetIdentity,
    architecture: profile.architecture,
    runtime: profile.runtime,
    metadata: {
      ...profile.metadata,
      process_identity: processIdentity,
      instance_identity: instanceIdentity,
      target_identity_model:
        "source-controlled-bootstrap-host-executable-plus-run-instance",
      host_path: canonicalHost,
      host_sha256: hostSha256,
    },
  };
  const adapter = new GenericClientAdapter({
    targetDescriptor: profile,
    targetInstance,
    bootstrapArtifact,
    operations: ownedNativeBootstrapTargetOperations(controlPlane),
    transportBackend: backend,
    evidenceSink,
  });
  const observations = executeTargetAdapter(adapter, {
    run_id: runId,
    iterations: {
      requested: requiredStabilityLadder.at(-1),
      completed: requiredStabilityLadder.at(-1),
      stability_ladder: [...requiredStabilityLadder],
      completed_stages: [...requiredStabilityLadder],
      policy: "general-gate6-enforced-through-owned-native-control-plane",
    },
    provenance: {
      kind: "owned-native-bootstrap-control-plane",
      test_fixture: false,
      evidence_dir: evidenceDir,
      external_target_execution: false,
    },
  });
  const session = normalizeGenericClientSession(observations);
  const evaluation = evaluateGate6Session(session);
  if (evaluation.status !== Gate6Status.PASS) {
    throw new Error(
      `owned native bootstrap control plane did not normalize to PASS: ${evaluation.errors.join("; ")}`,
    );
  }
  const observationsPath = join(evidenceDir, "generic-adapter-observations.json");
  const recordsPath = join(evidenceDir, "provider-observations.json");
  const sessionPath = join(evidenceDir, "gate6-session.json");
  writeJson(observationsPath, observations, { exclusive: true });
  writeJson(recordsPath, providerRecords, { exclusive: true });
  writeJson(sessionPath, session, { exclusive: true });

  return {
    profile: copyValue(profile),
    targetInstance,
    bootstrapArtifact,
    backendBinding,
    controlPlane,
    provider,
    backend,
    observations,
    session,
    evaluation,
    evidenceDir,
    observationsPath,
    recordsPath,
    sessionPath,
  };
}

function usage() {
  console.error(
    "Usage: node scripts/gate6-owned-native-bootstrap-control-plane.mjs " +
    "--evidence-dir <new-absolute-directory> [--run-id <identifier>] " +
    "[--profile <absolute-profile.json>] [--host <absolute-host>] " +
    "[--bootstrap <absolute-bootstrap>]",
  );
}

function parseOptions(argv) {
  const options = {};
  for (let index = 0; index < argv.length; index += 2) {
    const name = argv[index];
    const value = argv[index + 1];
    if (
      ![
        "--evidence-dir",
        "--run-id",
        "--profile",
        "--host",
        "--bootstrap",
      ].includes(name) ||
      value === undefined ||
      Object.hasOwn(options, name)
    ) {
      return null;
    }
    options[name] = value;
  }
  return options["--evidence-dir"] === undefined ? null : options;
}

function main() {
  const options = parseOptions(process.argv.slice(2));
  if (options === null) {
    usage();
    process.exitCode = 2;
    return;
  }
  const evidenceDir = requireAbsolutePath(
    options["--evidence-dir"],
    "--evidence-dir",
  );
  if (existsSync(evidenceDir)) {
    throw new Error("--evidence-dir must not already exist");
  }
  const profile = options["--profile"] === undefined
    ? readOwnedNativeBootstrapProfile()
    : readOwnedNativeBootstrapProfile(options["--profile"]);
  const result = createOwnedNativeBootstrapControlPlaneRun({
    evidenceDir,
    runId: options["--run-id"],
    profile,
    hostPath: options["--host"],
    bootstrapPath: options["--bootstrap"],
  });
  process.stdout.write(
    `${JSON.stringify({
      result: result.session.result,
      profile: result.session.target.profile,
      evidence_dir: result.evidenceDir,
      normalized_session_path: result.sessionPath,
      provider_interface: badlionNativeTransportProviderId,
      control_plane: ownedNativeBootstrapControlPlaneId,
      external_target_execution: false,
    }, null, 2)}\n`,
  );
}

if (
  process.argv[1] !== undefined &&
  resolve(process.argv[1]) === fileURLToPath(import.meta.url)
) {
  try {
    main();
  } catch (error) {
    console.error(
      `OPUS Gate 6 owned native bootstrap control plane failed: ${error.message}`,
    );
    process.exitCode = 1;
  }
}
