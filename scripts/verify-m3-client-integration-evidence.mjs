import { readFileSync, statSync } from "node:fs";
import { resolve } from "node:path";

const PROTOCOL_VERSION = 1;
const ARCHITECTURES = new Set(["arm64", "x86_64"]);
const TARGET_KINDS = new Set(["opus-owned-client", "vendor-approved-client"]);
const AUTHORIZATION_MODES = new Set(["opus-owned", "vendor-approved"]);
const FOUNDATION_JAVA_RUNTIME_VERSION = "not-built";
const EXPECTED_CYCLE_EVENTS = [
  ["health", "TargetAlive", "waiting"],
  ["load", "Ready", "running"],
  ["health", "TargetAlive", "running"],
  ["unload", "Stopped", "stopped"],
  ["health", "TargetAlive", "stopped"],
];

function usage(message) {
  if (message) {
    console.error(message);
  }
  console.error(
    "Usage: node scripts/verify-m3-client-integration-evidence.mjs <evidence.json>",
  );
  process.exit(1);
}

function assertRecord(value, label) {
  if (!value || typeof value !== "object" || Array.isArray(value)) {
    throw new Error(`${label} must be an object`);
  }
  return value;
}

function assertExactKeys(value, keys, label) {
  const record = assertRecord(value, label);
  const expected = new Set(keys);
  const actual = Object.keys(record);
  if (actual.length !== keys.length || actual.some((key) => !expected.has(key))) {
    throw new Error(`${label} must contain exactly: ${keys.join(", ")}`);
  }
  return record;
}

function assertString(value, label) {
  if (typeof value !== "string" || value.trim() === "") {
    throw new Error(`${label} must be a non-empty string`);
  }
  return value;
}

function assertSemanticVersion(value, label) {
  const version = assertString(value, label);
  if (!/^\d+\.\d+\.\d+(?:[-+][0-9A-Za-z.-]+)?$/.test(version)) {
    throw new Error(`${label} must be a semantic version`);
  }
  return version;
}

function assertFoundationJavaRuntimeVersion(value, label) {
  const version = assertString(value, label);
  if (version !== FOUNDATION_JAVA_RUNTIME_VERSION) {
    throw new Error(
      `${label} must remain ${FOUNDATION_JAVA_RUNTIME_VERSION} until opus-runtime.jar is built`,
    );
  }
  return version;
}

function assertSha256(value, label) {
  const digest = assertString(value, label);
  if (!/^[0-9a-f]{64}$/.test(digest)) {
    throw new Error(`${label} must be a lowercase SHA-256`);
  }
  return digest;
}

function assertArchitecture(value, label) {
  const architecture = assertString(value, label);
  if (!ARCHITECTURES.has(architecture)) {
    throw new Error(`${label} must be arm64 or x86_64`);
  }
  return architecture;
}

function assertBoolean(value, label, expected) {
  if (typeof value !== "boolean") {
    throw new Error(`${label} must be a boolean`);
  }
  if (arguments.length === 3 && value !== expected) {
    throw new Error(`${label} must be ${expected}`);
  }
  return value;
}

function assertPositiveInteger(value, label) {
  if (!Number.isInteger(value) || value < 1) {
    throw new Error(`${label} must be a positive integer`);
  }
  return value;
}

function assertSafeIdentifier(value, label) {
  const identifier = assertString(value, label);
  if (!/^[a-z0-9][a-z0-9.-]{2,127}$/.test(identifier)) {
    throw new Error(`${label} must be a lowercase dotted identifier`);
  }
  return identifier;
}

function assertAuthorizationReference(value, label) {
  const reference = assertString(value, label);
  if (!/^[A-Za-z0-9._:/#-]{3,200}$/.test(reference)) {
    throw new Error(
      `${label} may contain only letters, digits, dot, underscore, colon, slash, hash, and hyphen`,
    );
  }
  return reference;
}

function validateTarget(target) {
  const record = assertExactKeys(
    target,
    [
      "integrationId",
      "kind",
      "minecraftVersion",
      "targetVersion",
      "architecture",
      "clientBuildSha256",
      "authorization",
    ],
    "target",
  );
  assertSafeIdentifier(record.integrationId, "target.integrationId");
  const kind = assertString(record.kind, "target.kind");
  if (!TARGET_KINDS.has(kind)) {
    throw new Error(
      "target.kind must be opus-owned-client or vendor-approved-client; the OPUS authorized test harness is not a client integration",
    );
  }
  if (record.minecraftVersion !== "1.8.9") {
    throw new Error("target.minecraftVersion must be 1.8.9 for the current M3 gate");
  }
  assertSemanticVersion(record.targetVersion, "target.targetVersion");
  const architecture = assertArchitecture(record.architecture, "target.architecture");
  assertSha256(record.clientBuildSha256, "target.clientBuildSha256");

  const authorization = assertExactKeys(
    record.authorization,
    ["mode", "reference", "recordSha256", "approvedTransport"],
    "target.authorization",
  );
  const mode = assertString(authorization.mode, "target.authorization.mode");
  if (!AUTHORIZATION_MODES.has(mode)) {
    throw new Error(
      "target.authorization.mode must be opus-owned or vendor-approved",
    );
  }
  if (
    (kind === "opus-owned-client" && mode !== "opus-owned") ||
    (kind === "vendor-approved-client" && mode !== "vendor-approved")
  ) {
    throw new Error("target.kind and target.authorization.mode must agree");
  }
  assertAuthorizationReference(
    authorization.reference,
    "target.authorization.reference",
  );
  assertSha256(
    authorization.recordSha256,
    "target.authorization.recordSha256",
  );
  if (authorization.approvedTransport !== "cooperative-opt-in") {
    throw new Error(
      "target.authorization.approvedTransport must be cooperative-opt-in",
    );
  }
  return architecture;
}

function validateTransport(transport) {
  const record = assertExactKeys(
    transport,
    ["mode", "targetSelfLoadsAuthorizedRuntime", "modifiesUnrelatedProcess"],
    "transport",
  );
  if (record.mode !== "cooperative-opt-in") {
    throw new Error("transport.mode must be cooperative-opt-in");
  }
  assertBoolean(
    record.targetSelfLoadsAuthorizedRuntime,
    "transport.targetSelfLoadsAuthorizedRuntime",
    true,
  );
  assertBoolean(
    record.modifiesUnrelatedProcess,
    "transport.modifiesUnrelatedProcess",
    false,
  );
}

function validateRuntime(runtime) {
  const record = assertExactKeys(
    runtime,
    ["nativeRuntimeVersion", "javaRuntimeVersion", "nativeRuntimeSha256"],
    "runtime",
  );
  return {
    nativeRuntimeVersion: assertSemanticVersion(
      record.nativeRuntimeVersion,
      "runtime.nativeRuntimeVersion",
    ),
    javaRuntimeVersion: assertFoundationJavaRuntimeVersion(
      record.javaRuntimeVersion,
      "runtime.javaRuntimeVersion",
    ),
    nativeRuntimeSha256: assertSha256(
      record.nativeRuntimeSha256,
      "runtime.nativeRuntimeSha256",
    ),
  };
}

function validateHandshake(handshake, targetArchitecture, runtime) {
  const record = assertExactKeys(
    handshake,
    [
      "protocolVersion",
      "injectorVersion",
      "nativeRuntimeVersion",
      "javaRuntimeVersion",
      "targetArchitecture",
      "mappingSchemaVersion",
      "oneConfigAdapterVersion",
      "artifactChecksums",
    ],
    "handshake",
  );
  if (record.protocolVersion !== PROTOCOL_VERSION) {
    throw new Error(`handshake.protocolVersion must be ${PROTOCOL_VERSION}`);
  }
  assertSemanticVersion(record.injectorVersion, "handshake.injectorVersion");
  if (record.nativeRuntimeVersion !== runtime.nativeRuntimeVersion) {
    throw new Error(
      "handshake.nativeRuntimeVersion must match runtime.nativeRuntimeVersion",
    );
  }
  if (record.javaRuntimeVersion !== runtime.javaRuntimeVersion) {
    throw new Error(
      "handshake.javaRuntimeVersion must match runtime.javaRuntimeVersion",
    );
  }
  if (record.targetArchitecture !== targetArchitecture) {
    throw new Error(
      "handshake.targetArchitecture must match target.architecture",
    );
  }
  if (record.mappingSchemaVersion !== "not-applicable") {
    throw new Error(
      "handshake.mappingSchemaVersion must remain not-applicable during M3",
    );
  }
  if (record.oneConfigAdapterVersion !== "not-loaded") {
    throw new Error(
      "handshake.oneConfigAdapterVersion must remain not-loaded during M3",
    );
  }
  if (record.artifactChecksums !== "not-packaged") {
    throw new Error(
      "handshake.artifactChecksums must remain not-packaged during M3",
    );
  }
}

function validateCycleEvent(event, expected, cycleIndex, eventIndex) {
  const record = assertExactKeys(
    event,
    ["operation", "code", "state"],
    `cycles[${cycleIndex}].events[${eventIndex}]`,
  );
  const [operation, code, state] = expected;
  if (
    record.operation !== operation ||
    record.code !== code ||
    record.state !== state
  ) {
    throw new Error(
      `cycles[${cycleIndex}].events[${eventIndex}] must be ${operation}/${code}/${state}`,
    );
  }
}

function validateCycles(cycles) {
  if (!Array.isArray(cycles) || cycles.length < 3) {
    throw new Error("cycles must contain at least three complete lifecycle cycles");
  }
  for (let index = 0; index < cycles.length; index += 1) {
    const cycle = assertExactKeys(
      cycles[index],
      ["cycle", "events", "targetSurvived"],
      `cycles[${index}]`,
    );
    if (cycle.cycle !== index + 1) {
      throw new Error(`cycles[${index}].cycle must be ${index + 1}`);
    }
    if (
      !Array.isArray(cycle.events) ||
      cycle.events.length !== EXPECTED_CYCLE_EVENTS.length
    ) {
      throw new Error(
        `cycles[${index}].events must contain the complete health/load/unload lifecycle`,
      );
    }
    for (let eventIndex = 0; eventIndex < EXPECTED_CYCLE_EVENTS.length; eventIndex += 1) {
      validateCycleEvent(
        cycle.events[eventIndex],
        EXPECTED_CYCLE_EVENTS[eventIndex],
        index,
        eventIndex,
      );
    }
    assertBoolean(cycle.targetSurvived, `cycles[${index}].targetSurvived`, true);
  }
}

function validateStop(stop, schemaVersion) {
  const keys =
    schemaVersion === 3
      ? [
          "operation",
          "code",
          "state",
          "descriptorRemoved",
          "targetSurvivedAfterStop",
          "gameWindowReadyAfterStop",
          "gameStatusAfterStop",
        ]
      : ["operation", "code", "state", "descriptorRemoved"];
  const record = assertExactKeys(
    stop,
    keys,
    "stop",
  );
  if (
    record.operation !== "stop" ||
    record.code !== "TargetStopping" ||
    record.state !== "stopped"
  ) {
    throw new Error("stop must report stop/TargetStopping/stopped");
  }
  assertBoolean(record.descriptorRemoved, "stop.descriptorRemoved", true);
  if (schemaVersion === 3) {
    assertBoolean(
      record.targetSurvivedAfterStop,
      "stop.targetSurvivedAfterStop",
      true,
    );
    assertBoolean(
      record.gameWindowReadyAfterStop,
      "stop.gameWindowReadyAfterStop",
      true,
    );
    if (record.gameStatusAfterStop !== "running") {
      throw new Error("stop.gameStatusAfterStop must be running");
    }
  }
}

function validateCapture(capture, schemaVersion) {
  const keys =
    schemaVersion === 3
      ? ["observedAt", "fixture", "targetPid", "gameWindowReady", "gameStatus"]
      : ["observedAt", "fixture"];
  const record = assertExactKeys(
    capture,
    keys,
    "capture",
  );
  const observedAt = assertString(record.observedAt, "capture.observedAt");
  if (!/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}Z$/.test(observedAt)) {
    throw new Error("capture.observedAt must be a UTC ISO-8601 timestamp");
  }
  assertBoolean(record.fixture, "capture.fixture", false);
  if (schemaVersion === 3) {
    assertPositiveInteger(record.targetPid, "capture.targetPid");
    assertBoolean(record.gameWindowReady, "capture.gameWindowReady", true);
    if (record.gameStatus !== "running") {
      throw new Error("capture.gameStatus must be running");
    }
  }
}

function validateEvidence(evidence) {
  const record = assertExactKeys(
    evidence,
    [
      "schemaVersion",
      "scope",
      "capture",
      "target",
      "transport",
      "runtime",
      "handshake",
      "cycles",
      "stop",
    ],
    "evidence",
  );
  if (record.schemaVersion !== 2 && record.schemaVersion !== 3) {
    throw new Error("schemaVersion must be 2 or 3");
  }
  if (record.scope !== "m3-authorized-client-integration") {
    throw new Error("scope must be m3-authorized-client-integration");
  }

  validateCapture(record.capture, record.schemaVersion);
  const targetArchitecture = validateTarget(record.target);
  validateTransport(record.transport);
  const runtime = validateRuntime(record.runtime);
  validateHandshake(record.handshake, targetArchitecture, runtime);
  validateCycles(record.cycles);
  validateStop(record.stop, record.schemaVersion);
}

function main(args) {
  if (args.length !== 1) {
    usage();
  }
  const evidencePath = resolve(args[0]);
  if (!statSync(evidencePath).isFile()) {
    throw new Error(`Evidence path is not a regular file: ${evidencePath}`);
  }

  let evidence;
  try {
    evidence = JSON.parse(readFileSync(evidencePath, "utf8"));
  } catch (error) {
    throw new Error(`Cannot parse evidence JSON: ${error.message}`);
  }
  validateEvidence(evidence);
  console.log(
    "M3 authorized-client evidence has a valid structure. This is not by itself a production certification; review the authorized integration source and live target run.",
  );
}

try {
  main(process.argv.slice(2));
} catch (error) {
  console.error(`M3 client integration evidence verification failed: ${error.message}`);
  process.exitCode = 1;
}
