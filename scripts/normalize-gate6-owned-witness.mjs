import { mkdirSync, readFileSync, writeFileSync } from "node:fs";
import { dirname, relative, resolve, sep } from "node:path";

import {
  Gate6Status,
  evaluateGate6Session,
  gate6SessionSchema,
  requiredStabilityLadder,
  validateTargetProfile,
} from "./gate6-lifecycle-core.mjs";

function usage() {
  console.error(
    "Usage: node scripts/normalize-gate6-owned-witness.mjs " +
      "--profile <absolute-profile.json> --evidence-dir <absolute-dir> " +
      "--output <absolute-session.json>",
  );
}

function fail(message) {
  throw new Error(message);
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
  if (
    Object.keys(options).length !== 3 ||
    !options["--profile"] ||
    !options["--evidence-dir"] ||
    !options["--output"]
  ) {
    return null;
  }
  return options;
}

function readJson(pathname, label) {
  try {
    return JSON.parse(readFileSync(pathname, "utf8"));
  } catch (error) {
    fail(`could not read ${label}: ${error.message}`);
  }
}

function readText(pathname, label) {
  try {
    return readFileSync(pathname, "utf8");
  } catch (error) {
    fail(`could not read ${label}: ${error.message}`);
  }
}

function requireAbsolute(pathname, label) {
  const absolute = resolve(pathname);
  if (absolute !== pathname) {
    fail(`${label} must be absolute`);
  }
  return absolute;
}

function isInside(child, parent) {
  const childRelative = relative(parent, child);
  return (
    childRelative !== "" &&
    !childRelative.startsWith(`..${sep}`) &&
    childRelative !== ".." &&
    !childRelative.includes(`${sep}..${sep}`)
  );
}

function requireLine(text, expected, label) {
  if (!text.includes(expected)) {
    fail(`${label} is missing ${expected}`);
  }
}

function outputValue(text, key, label) {
  const match = text.match(
    new RegExp(`(?:^|\\s)${key.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")}=([^\\s]+)`),
  );
  if (!match) {
    fail(`${label} is missing ${key}`);
  }
  return match[1];
}

function readJsonLines(pathname) {
  const content = readText(pathname, "lifecycle event witness");
  return content
    .split("\n")
    .filter((line) => line.trim() !== "")
    .map((line, index) => {
      try {
        return JSON.parse(line);
      } catch (error) {
        fail(`lifecycle event ${index + 1} is not JSON: ${error.message}`);
      }
    });
}

function requireEvent(events, predicate, label) {
  if (!events.some(predicate)) {
    fail(`lifecycle witness is missing ${label}`);
  }
}

function expectedCodeForStage(stage) {
  return stage === requiredStabilityLadder.at(-1)
    ? "BootstrapLoadReady"
    : "BootstrapLoadObserved";
}

function normalize() {
  const options = parseOptions(process.argv.slice(2));
  if (options === null) {
    usage();
    process.exitCode = 2;
    return;
  }

  const profilePath = requireAbsolute(options["--profile"], "--profile");
  const evidenceDir = requireAbsolute(options["--evidence-dir"], "--evidence-dir");
  const outputPath = requireAbsolute(options["--output"], "--output");
  if (!isInside(outputPath, evidenceDir)) {
    fail("--output must be inside --evidence-dir");
  }

  const profile = readJson(profilePath, "target profile");
  const profileValidation = validateTargetProfile(profile);
  if (!profileValidation.valid) {
    fail(`invalid target profile: ${profileValidation.errors.join("; ")}`);
  }
  if (profile.kind !== "opus-owned-client") {
    fail("owned witness normalizer requires an opus-owned-client profile");
  }

  const manifest = readJson(
    resolve(evidenceDir, "manifest.json"),
    "owned-harness manifest",
  );
  const identity = readJson(
    resolve(evidenceDir, "artifact-identity.json"),
    "artifact identity",
  );
  const cleanup = readJson(resolve(evidenceDir, "cleanup.json"), "cleanup witness");
  const events = readJsonLines(resolve(evidenceDir, "lifecycle-events.jsonl"));

  if (
    manifest.schema !== "opus.m3.gate6.run-manifest.v1" ||
    identity.schema !== "opus.m3.gate6.artifact-identity.v1" ||
    cleanup.schema !== "opus.m3.gate6.cleanup.v1"
  ) {
    fail("owned witness schemas are not recognized");
  }
  if (
    typeof manifest.run_id !== "string" ||
    manifest.run_id !== identity.run_id ||
    manifest.run_id !== cleanup.run_id
  ) {
    fail("owned witness run IDs do not agree");
  }
  if (
    !Array.isArray(manifest.stages) ||
    manifest.stages.join(",") !== requiredStabilityLadder.join(",")
  ) {
    fail("owned witness does not record the 1, 3, 10, 25 ladder");
  }
  if (cleanup.cleanup !== true || cleanup.exit_code !== 0) {
    fail("owned witness cleanup is not successful");
  }
  if (
    identity.bootstrap?.path === undefined ||
    identity.bootstrap?.sha256 === undefined ||
    identity.abi?.version === undefined
  ) {
    fail("owned witness artifact identity is incomplete");
  }
  for (const event of ["TargetResolved", "TransportReady"]) {
    requireEvent(
      events,
      (candidate) =>
        candidate.run_id === manifest.run_id &&
        candidate.event === event &&
        candidate.outcome === "Success",
      event,
    );
  }

  const stageOutputs = [];
  for (const stage of requiredStabilityLadder) {
    const output = readText(
      resolve(evidenceDir, `host-stdout-${stage}.log`),
      `host stdout for stage ${stage}`,
    );
    const expectedCode = expectedCodeForStage(stage);
    for (const expected of [
      `code=${expectedCode}`,
      "artifact_identity=verified",
      "handshake_verified=true",
      "stop_acknowledged=true",
      "cleanup=true",
      "host_alive=true",
      `iterations_completed=${stage}`,
      `iterations_requested=${stage}`,
    ]) {
      requireLine(output, expected, `host stdout for stage ${stage}`);
    }
    const outputIdentity = {
      expectedBootstrapSha256: outputValue(
        output,
        "expected_bootstrap_sha256",
        `stage ${stage}`,
      ),
      observedBootstrapSha256: outputValue(
        output,
        "observed_bootstrap_sha256",
        `stage ${stage}`,
      ),
    };
    if (
      outputIdentity.expectedBootstrapSha256 !== identity.bootstrap.sha256 ||
      outputIdentity.observedBootstrapSha256 !== identity.bootstrap.sha256
    ) {
      fail(`stage ${stage} does not retain the artifact identity tuple`);
    }
    const stageOutput = {
      stage,
      sessionNonce: outputValue(output, "session_nonce", `stage ${stage}`),
      expectedHandshake: outputValue(
        output,
        "expected_handshake",
        `stage ${stage}`,
      ),
      observedHandshake: outputValue(
        output,
        "observed_handshake",
        `stage ${stage}`,
      ),
    };
    if (stageOutput.expectedHandshake !== stageOutput.observedHandshake) {
      fail(`stage ${stage} does not retain a matching handshake`);
    }
    stageOutputs.push(stageOutput);
  }

  const baseNonce = BigInt(stageOutputs[0].sessionNonce);
  for (const stageOutput of stageOutputs) {
    const expectedNonce = baseNonce + BigInt(stageOutput.stage - 1);
    if (BigInt(stageOutput.sessionNonce) !== expectedNonce) {
      fail(
        `stage ${stageOutput.stage} does not retain the deterministic nonce counter`,
      );
    }
  }

  for (const stage of requiredStabilityLadder) {
    const finalIteration = stage;
    for (const event of [
      "ArtifactVerified",
      "BootstrapModuleLoaded",
      "BootstrapEntrypointReady",
      "BootstrapStarted",
      "BootstrapHandshakeOk",
      "BootstrapLoadObserved",
      "BootstrapStopped",
      "BootstrapCleanedUp",
    ]) {
      requireEvent(
        events,
        (candidate) =>
          candidate.run_id === manifest.run_id &&
          candidate.iterations_requested === stage &&
          candidate.iteration === finalIteration &&
          candidate.event === event &&
          candidate.outcome === "Success",
        `${event} for stage ${stage}`,
      );
    }
  }
  requireEvent(
    events,
    (candidate) =>
      candidate.run_id === manifest.run_id &&
      candidate.iterations_requested === requiredStabilityLadder.at(-1) &&
      candidate.iteration === requiredStabilityLadder.at(-1) &&
      candidate.event === "BootstrapLoadReady" &&
      candidate.outcome === "Success",
    "final BootstrapLoadReady",
  );

  const finalStage = stageOutputs.at(-1);
  const session = {
    schema_version: gate6SessionSchema,
    run_id: manifest.run_id,
    target: {
      profile: profile.id,
      identity: "opus-bootstrap-host",
      architecture: identity.host?.architectures ?? profile.architecture,
      runtime: profile.runtime,
      metadata: {
        ...profile.metadata,
        scope: manifest.scope,
        source_witness_dir: evidenceDir,
      },
      status: Gate6Status.PASS,
    },
    bootstrap: {
      artifact: identity.bootstrap.path,
      sha256: identity.bootstrap.sha256,
      version: `abi-v${identity.abi.version}`,
    },
    transport: {
      status: Gate6Status.PASS,
      evidence: "TargetResolved and TransportReady lifecycle witnesses",
    },
    bootstrap_artifact: {
      status: Gate6Status.PASS,
      evidence: "ArtifactVerified lifecycle witness and artifact-identity.json",
    },
    load: {
      status: Gate6Status.PASS,
      evidence: "BootstrapModuleLoaded lifecycle witness",
    },
    entrypoint: {
      status: Gate6Status.PASS,
      evidence: "BootstrapEntrypointReady lifecycle witness",
    },
    start: {
      status: Gate6Status.PASS,
      nonce: finalStage.sessionNonce,
      nonce_mode: "deterministic-counter",
    },
    handshake: {
      status: Gate6Status.PASS,
      expected_nonce: finalStage.sessionNonce,
      observed_nonce: finalStage.sessionNonce,
      expected_handshake: finalStage.expectedHandshake,
      observed_handshake: finalStage.observedHandshake,
    },
    stop: {
      status: Gate6Status.PASS,
      evidence: "BootstrapStopped lifecycle witness",
    },
    cleanup: {
      status: Gate6Status.PASS,
      evidence: "BootstrapCleanedUp lifecycle witness and cleanup.json",
    },
    target_health: {
      status: Gate6Status.PASS,
      evidence: "owned host reported host_alive=true",
    },
    iterations: {
      requested: requiredStabilityLadder.at(-1),
      completed: requiredStabilityLadder.at(-1),
      stability_ladder: [...requiredStabilityLadder],
      completed_stages: [...requiredStabilityLadder],
      policy: "general-gate6-enforced",
    },
    result: Gate6Status.PASS,
    provenance: {
      kind: "normalized-owned-harness-witness",
      raw_witnesses: [
        "manifest.json",
        "artifact-identity.json",
        "lifecycle-events.jsonl",
        "cleanup.json",
        ...requiredStabilityLadder.map((stage) => `host-stdout-${stage}.log`),
      ],
    },
  };

  const evaluation = evaluateGate6Session(session);
  if (evaluation.status !== Gate6Status.PASS) {
    fail(`normalized session is not PASS: ${evaluation.errors.join("; ")}`);
  }

  mkdirSync(dirname(outputPath), { recursive: true, mode: 0o700 });
  writeFileSync(outputPath, `${JSON.stringify(session, null, 2)}\n`, {
    encoding: "utf8",
    mode: 0o600,
  });
  console.log(
    `OPUS Gate 6 Branch A witness normalized: result=PASS run_id=${session.run_id} output=${outputPath}`,
  );
}

try {
  normalize();
} catch (error) {
  console.error(`OPUS Gate 6 witness normalization failed: ${error.message}`);
  process.exitCode = 1;
}
