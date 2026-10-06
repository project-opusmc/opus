import assert from "node:assert/strict";
import { spawnSync } from "node:child_process";
import {
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
  createNotTestedSession,
  evaluateGate6Session,
  gate7SessionReady,
  gate6SessionSchema,
  requiredStabilityLadder,
  validateGate6Seal,
  validateOwnerConfirmation,
  validateTargetProfile,
} from "../scripts/gate6-lifecycle-core.mjs";
import {
  aggregateGeneralGate6,
  generalGate6Composition,
  loadGeneralGate6Profiles,
  sealGeneralGate6,
} from "../scripts/gate6-general-composition.mjs";
import { runGenericClientAdapterChecks } from "./verify-gate6-generic-client-adapter.mjs";
import { runTargetTransportBackendChecks } from "./verify-gate6-target-transport-backend.mjs";

const testDir = dirname(fileURLToPath(import.meta.url));
const opusRoot = resolve(testDir, "..");
const fixturesRoot = join(testDir, "fixtures", "gate6");
const evaluationCli = join(opusRoot, "scripts", "evaluate-gate6.mjs");

function parseOptions(argv) {
  if (argv.length === 0) {
    return { ownedSession: null };
  }
  if (argv.length === 2 && argv[0] === "--owned-session") {
    return { ownedSession: resolve(argv[1]) };
  }
  throw new Error(
    "Usage: node tests/verify-gate6-general-lifecycle.mjs [--owned-session <absolute-session.json>]",
  );
}

function readJson(pathname) {
  return JSON.parse(readFileSync(pathname, "utf8"));
}

function statusObject(status) {
  return { status };
}

function passingSession(targetProfile) {
  return {
    schema_version: gate6SessionSchema,
    run_id: `test-${targetProfile.id}-run`,
    target: {
      profile: targetProfile.id,
      identity: `${targetProfile.id}-target`,
      architecture: targetProfile.architecture === "unresolved"
        ? "arm64"
        : targetProfile.architecture,
      runtime: targetProfile.runtime === "unresolved"
        ? "generic-runtime"
        : targetProfile.runtime,
      metadata: { ...targetProfile.metadata, test_fixture: true },
      status: Gate6Status.PASS,
    },
    bootstrap: {
      artifact: `/test-fixtures/${targetProfile.id}/libopus-bootstrap.dylib`,
      sha256: "a".repeat(64),
      version: "abi-v1",
    },
    transport: statusObject(Gate6Status.PASS),
    bootstrap_artifact: statusObject(Gate6Status.PASS),
    load: statusObject(Gate6Status.PASS),
    entrypoint: statusObject(Gate6Status.PASS),
    start: {
      status: Gate6Status.PASS,
      nonce: "0x4f50555347415436",
      nonce_mode: "deterministic-counter",
    },
    handshake: {
      status: Gate6Status.PASS,
      expected_nonce: "0x4f50555347415436",
      observed_nonce: "0x4f50555347415436",
    },
    stop: statusObject(Gate6Status.PASS),
    cleanup: statusObject(Gate6Status.PASS),
    target_health: statusObject(Gate6Status.PASS),
    iterations: {
      requested: 25,
      completed: 25,
      stability_ladder: [...requiredStabilityLadder],
      completed_stages: [...requiredStabilityLadder],
    },
    result: Gate6Status.PASS,
    provenance: {
      kind: "test-fixture",
      test_fixture: true,
    },
  };
}

function failedSession(targetProfile) {
  const session = createNotTestedSession(targetProfile, { test_fixture: true });
  session.target.status = Gate6Status.FAIL;
  for (const field of [
    "transport",
    "bootstrap_artifact",
    "load",
    "entrypoint",
    "start",
    "handshake",
    "stop",
    "cleanup",
    "target_health",
  ]) {
    session[field].status = Gate6Status.FAIL;
  }
  session.result = Gate6Status.FAIL;
  return session;
}

function aggregate(sessions, confirmation, options) {
  return aggregateGeneralGate6(
    {
      sessions,
      ownerConfirmation: confirmation,
    },
    options,
  );
}

function assertCannotSeal(aggregateResult, message) {
  assert.throws(
    () => sealGeneralGate6(aggregateResult),
    /Gate 6 aggregate cannot be sealed/,
    message,
  );
}

function runEvaluationCli(arguments_) {
  const result = spawnSync(
    process.execPath,
    [evaluationCli, ...arguments_],
    { encoding: "utf8" },
  );
  if (result.error) {
    throw result.error;
  }
  return result;
}

function writeJson(pathname, value) {
  writeFileSync(pathname, `${JSON.stringify(value, null, 2)}\n`, "utf8");
}

function assertOwnedOnlyEvaluation(output, message) {
  assert.equal(output.gate6, Gate6Status.NOT_TESTED, message);
  assert.equal(output.branches["branch-a"], Gate6Status.PASS, message);
  assert.equal(output.branches["branch-b"], Gate6Status.NOT_TESTED, message);
  assert.equal(output.targets["opus-owned"], Gate6Status.PASS, message);
  assert.equal(output.targets.badlion, Gate6Status.NOT_TESTED, message);
  assert.equal(output.targets.lunar, Gate6Status.NOT_TESTED, message);
  assert.equal(output.owner_confirmation, Gate6Status.BLOCKED, message);
  assert.equal(output.gate7_ready, false, message);
}

const profiles = loadGeneralGate6Profiles();
assert.deepEqual(
  Object.keys(profiles).sort(),
  ["badlion", "lunar", "opus-owned"],
  "the General Gate 6 composition must load all configured production profiles",
);
const owned = profiles["opus-owned"];
const badlion = profiles.badlion;
const lunar = profiles.lunar;
const genericCooperative = readJson(
  join(fixturesRoot, "profiles", "generic-cooperative.json"),
);
for (const targetProfile of [owned, badlion, lunar, genericCooperative]) {
  assert.equal(
    validateTargetProfile(targetProfile).valid,
    true,
    `${targetProfile.id} profile must validate`,
  );
}

const genericFixtureSession = passingSession(genericCooperative);
assert.equal(
  evaluateGate6Session(genericFixtureSession).status,
  Gate6Status.PASS,
  "the core must accept a generic adapter fixture without owned-host logic",
);
assert.equal(
  generalGate6Composition.id,
  "opus.m3.general-bootstrap-lifecycle.v1",
  "the configured General Gate 6 composition must identify the complete milestone",
);
assert.throws(
  () => gate7SessionReady(genericFixtureSession),
  /sealed PASS General Gate 6 aggregate/,
  "a generic individual PASS session must not be accepted as a Gate 7 handoff",
);

const ownedPass = passingSession(owned);
const badlionPass = passingSession(badlion);
const lunarPass = passingSession(lunar);
const badlionNotTested = createNotTestedSession(badlion);
const lunarNotTested = createNotTestedSession(lunar);
const lunarFail = failedSession(lunar);
const testConfirmation = readJson(
  join(
    fixturesRoot,
    "owner-confirmations",
    "all-targets-confirmed.test.json",
  ),
);
const options = parseOptions(process.argv.slice(2));

assert.equal(
  validateOwnerConfirmation(testConfirmation, {
    requiredProfiles: ["opus-owned", "badlion", "lunar"],
  }).status,
  Gate6Status.BLOCKED,
  "a test fixture must never become a production owner confirmation",
);
assert.equal(
  validateOwnerConfirmation(testConfirmation, {
    requiredProfiles: ["opus-owned", "badlion", "lunar"],
    allowTestFixture: true,
  }).status,
  Gate6Status.PASS,
  "a test fixture may only satisfy owner confirmation with an explicit test-only option",
);

const ownedOnly = aggregate([ownedPass], null);
const ownedAndBadlion = aggregate(
  [ownedPass, badlionPass, lunarNotTested],
  null,
);
const clientFailure = aggregate([ownedPass, badlionPass, lunarFail], null);
const allTargetsWithoutOwner = aggregate(
  [ownedPass, badlionPass, lunarPass],
  null,
);
const fullPass = aggregate(
  [ownedPass, badlionPass, lunarPass],
  testConfirmation,
  { allowTestOwnerConfirmation: true },
);

const cases = [
  {
    name: "owned PASS alone",
    result: ownedOnly,
    expected: Gate6Status.NOT_TESTED,
  },
  {
    name: "owned and Badlion PASS while Lunar is not tested",
    result: ownedAndBadlion,
    expected: Gate6Status.NOT_TESTED,
  },
  {
    name: "a required generic client fails",
    result: clientFailure,
    expected: Gate6Status.FAIL,
  },
  {
    name: "all targets pass without owner confirmation",
    result: allTargetsWithoutOwner,
    expected: Gate6Status.BLOCKED,
  },
  {
    name: "all targets pass with explicit test-only confirmation",
    result: fullPass,
    expected: Gate6Status.PASS,
  },
];

for (const testCase of cases) {
  assert.equal(testCase.result.status, testCase.expected, testCase.name);
  assert.equal(
    testCase.result.invariant.pass_equivalence,
    true,
    `${testCase.name} must preserve the Gate 6 PASS equivalence`,
  );
}

assert.throws(
  () => gate7SessionReady(ownedPass),
  /sealed PASS General Gate 6 aggregate/,
  "an individual owned PASS session must not unlock Gate 7",
);
assertCannotSeal(
  ownedOnly,
  "owned-only evidence must not seal the General Gate 6 aggregate",
);
assertCannotSeal(
  ownedAndBadlion,
  "owned plus Badlion evidence must not seal while Lunar remains untested",
);
assertCannotSeal(
  allTargetsWithoutOwner,
  "all target sessions must not seal without owner confirmation",
);
for (const [name, aggregateResult] of [
  ["owned-only aggregate", ownedOnly],
  ["owned-and-Badlion aggregate", ownedAndBadlion],
  ["all-targets-without-owner aggregate", allTargetsWithoutOwner],
]) {
  assert.throws(
    () => gate7SessionReady(aggregateResult),
    /sealed PASS General Gate 6 aggregate/,
    `${name} must remain blocked when passed directly to the Gate 7 handoff`,
  );
}
const fullSeal = sealGeneralGate6(fullPass);
assert.equal(
  validateGate6Seal(fullSeal).valid,
  true,
  "the only complete test combination must produce a valid Gate 6 seal",
);
assert.equal(
  gate7SessionReady(fullSeal).schema_version,
  "opus.m3.gate6.session-ready.v1",
  "Gate 7 may consume only the sealed complete General Gate 6 aggregate",
);

const cliFixtureRoot = mkdtempSync(join(tmpdir(), "opus-gate6-cli-"));
try {
  const ownedPath = join(cliFixtureRoot, "owned-pass.json");
  const badlionPath = join(cliFixtureRoot, "badlion-pass.json");
  const lunarPath = join(cliFixtureRoot, "lunar-pass.json");
  const ownerPath = join(cliFixtureRoot, "owner-confirmation.test.json");
  const outputPath = join(cliFixtureRoot, "owned-only-evaluation.json");
  writeJson(ownedPath, ownedPass);
  writeJson(badlionPath, badlionPass);
  writeJson(lunarPath, lunarPass);
  writeJson(ownerPath, testConfirmation);

  const ownedOnlyCli = runEvaluationCli([
    "--owned-session",
    ownedPath,
    "--output",
    outputPath,
  ]);
  assert.equal(
    ownedOnlyCli.status,
    0,
    `production CLI owned-only evaluation failed: ${ownedOnlyCli.stderr}`,
  );
  const ownedOnlyOutput = JSON.parse(ownedOnlyCli.stdout);
  assertOwnedOnlyEvaluation(
    ownedOnlyOutput,
    "an owned-only CLI evaluation must keep General Gate 6 NOT_TESTED",
  );
  assert.deepEqual(
    readJson(outputPath),
    ownedOnlyOutput,
    "the production CLI --output artifact must match its normalized stdout",
  );

  const mismatchCli = runEvaluationCli([
    "--badlion-session",
    ownedPath,
  ]);
  assert.equal(
    mismatchCli.status,
    2,
    "the production CLI must reject session evidence supplied in the wrong profile slot",
  );
  assert.match(
    mismatchCli.stderr,
    /target\.profile badlion, got opus-owned/,
    "the production CLI must report the mismatched profile slot",
  );

  const duplicateCli = runEvaluationCli([
    "--owned-session",
    ownedPath,
    "--owned-session",
    ownedPath,
  ]);
  assert.equal(
    duplicateCli.status,
    2,
    "the production CLI must reject duplicate session-slot arguments",
  );

  const testOwnerCli = runEvaluationCli([
    "--owned-session",
    ownedPath,
    "--badlion-session",
    badlionPath,
    "--lunar-session",
    lunarPath,
    "--owner-confirmation",
    ownerPath,
  ]);
  assert.equal(
    testOwnerCli.status,
    0,
    `production CLI test-owner evaluation failed: ${testOwnerCli.stderr}`,
  );
  const testOwnerOutput = JSON.parse(testOwnerCli.stdout);
  assert.equal(
    testOwnerOutput.gate6,
    Gate6Status.BLOCKED,
    "a test-only owner confirmation must not promote a production CLI result",
  );
  assert.equal(
    testOwnerOutput.owner_confirmation,
    Gate6Status.BLOCKED,
    "the production CLI must expose test-only owner confirmation as blocked",
  );
  assert.equal(
    testOwnerOutput.gate7_ready,
    false,
    "a blocked owner confirmation must keep Gate 7 unavailable",
  );
} finally {
  rmSync(cliFixtureRoot, { recursive: true, force: true });
}

if (options.ownedSession !== null) {
  const normalizedOwnedSession = readJson(options.ownedSession);
  assert.equal(
    evaluateGate6Session(normalizedOwnedSession).status,
    Gate6Status.PASS,
    "the normalized Branch A witness must be a PASS session",
  );
  assert.equal(
    normalizedOwnedSession.target.profile,
    owned.id,
    "the normalized witness must retain the Opus-owned profile",
  );
  const normalizedAggregate = aggregate(
    [normalizedOwnedSession, badlionNotTested, lunarNotTested],
    null,
  );
  assert.equal(
    normalizedAggregate.status,
    Gate6Status.NOT_TESTED,
    "Branch A PASS must not promote the General Gate 6 while Branch B is untested",
  );
  assertCannotSeal(
    normalizedAggregate,
    "the normalized Branch A witness must not be enough to seal General Gate 6",
  );

  const normalizedCliRoot = mkdtempSync(join(tmpdir(), "opus-gate6-owned-"));
  try {
    const outputPath = join(normalizedCliRoot, "general-gate6-evaluation.json");
    const result = runEvaluationCli([
      "--owned-session",
      options.ownedSession,
      "--output",
      outputPath,
    ]);
    assert.equal(
      result.status,
      0,
      `production CLI rejected the normalized owned session: ${result.stderr}`,
    );
    assertOwnedOnlyEvaluation(
      JSON.parse(readFileSync(outputPath, "utf8")),
      "a normalized owned witness must remain a Branch A-only result",
    );
  } finally {
    rmSync(normalizedCliRoot, { recursive: true, force: true });
  }
}

const coreText = readFileSync(
  join(opusRoot, "scripts", "gate6-lifecycle-core.mjs"),
  "utf8",
).toLowerCase();
assert.equal(
  /\b(badlion|lunar|opus-owned)\b/.test(coreText),
  false,
  "target-specific names must remain outside the Gate 6 core",
);

runGenericClientAdapterChecks();
runTargetTransportBackendChecks();

console.log(
  "OPUS General Gate 6 lifecycle contract passed: target-neutral core, Generic Client and target transport backend boundaries, sealed aggregate Gate 7 handoff, production evidence slots, explicit owner confirmation, and Branch A-only blocking verified.",
);
