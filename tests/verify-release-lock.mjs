import { createHash } from "node:crypto";
import { execFileSync, spawnSync } from "node:child_process";
import { mkdtempSync, mkdirSync, readFileSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { dirname, join, resolve } from "node:path";
import { fileURLToPath } from "node:url";

const opusRoot = resolve(dirname(fileURLToPath(import.meta.url)), "..");
const verifier = join(opusRoot, "scripts", "verify-release-lock.mjs");

function runVerifier(root, ...arguments_) {
  return spawnSync(process.execPath, [verifier, root, ...arguments_], {
    encoding: "utf8",
  });
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

function createGitRepository(repositoryRoot, files) {
  mkdirSync(repositoryRoot, { recursive: true });
  for (const [relativePath, contents] of Object.entries(files)) {
    const destination = join(repositoryRoot, relativePath);
    mkdirSync(dirname(destination), { recursive: true });
    writeFileSync(destination, contents);
  }
  execFileSync("git", ["init", "--quiet", repositoryRoot]);
  execFileSync("git", ["-C", repositoryRoot, "add", "."]);
  execFileSync(
    "git",
    [
      "-C",
      repositoryRoot,
      "-c",
      "user.name=OPUS Test",
      "-c",
      "user.email=opus-test@example.invalid",
      "commit",
      "--quiet",
      "-m",
      "fixture",
    ],
  );
  return execFileSync("git", ["-C", repositoryRoot, "rev-parse", "HEAD"], {
    encoding: "utf8",
  }).trim();
}

const currentProfile = runVerifier(opusRoot);
requireSuccess(currentProfile, "active profile validation");

const printedProfile = runVerifier(opusRoot, "--print-profile");
requireSuccess(printedProfile, "active profile selection");
if (printedProfile.stdout.trim() !== "injector-development") {
  throw new Error(`Unexpected active profile: ${printedProfile.stdout}`);
}

requireFailure(
  runVerifier(opusRoot, "--require-manifest"),
  "does not provide a Forge runtime manifest",
  "foundation manifest rejection",
);

const temporaryRoot = mkdtempSync(join(tmpdir(), "opus-release-lock-test-"));
try {
  mkdirSync(join(temporaryRoot, "release"), { recursive: true });
  mkdirSync(join(temporaryRoot, "injector"), { recursive: true });
  mkdirSync(join(temporaryRoot, "runtime-native"), { recursive: true });
  mkdirSync(join(temporaryRoot, "runtime-java"), { recursive: true });
  writeFileSync(
    join(temporaryRoot, "injector", "Cargo.toml"),
    "[package]\nname = \"opus-injector\"\nversion = \"0.1.0\"\n",
  );
  for (const [relativePath, contents] of [
    ["injector/src/authorized_target.rs", "// fixture\n"],
    [
      "runtime-java/src/main/java/dev/opus/runtime/harness/AuthorizedRuntimeTarget.java",
      "// fixture\n",
    ],
    ["scripts/check-injector-authorized-target.sh", "#!/usr/bin/env bash\n"],
  ]) {
    const destination = join(temporaryRoot, relativePath);
    mkdirSync(dirname(destination), { recursive: true });
    writeFileSync(destination, contents);
  }

  const invalidLock = JSON.parse(
    readFileSync(join(opusRoot, "release", "opus.lock.json"), "utf8"),
  );
  invalidLock.buildProfiles["injector-development"].artifacts.state = "generated";
  writeFileSync(
    join(temporaryRoot, "release", "opus.lock.json"),
    `${JSON.stringify(invalidLock, null, 2)}\n`,
  );

  requireFailure(
    runVerifier(temporaryRoot),
    "artifacts.state must be not-generated",
    "generated-artifact rejection",
  );

  const legacyManifest = "{\"schemaVersion\":1,\"fixture\":true}\n";
  const launcherCommit = createGitRepository(join(temporaryRoot, "launcher"), {
    "launcher.txt": "fixture\n",
  });
  const runtimeCommit = createGitRepository(join(temporaryRoot, "runtime"), {
    "build/runtime/runtime-manifest.json": legacyManifest,
  });
  const legacyLock = JSON.parse(
    readFileSync(join(opusRoot, "release", "opus.lock.json"), "utf8"),
  );
  legacyLock.activeBuildProfile = "legacy-forge-rollback";
  legacyLock.buildProfiles["legacy-forge-rollback"].launcher.commit = launcherCommit;
  legacyLock.buildProfiles["legacy-forge-rollback"].runtime.commit = runtimeCommit;
  legacyLock.buildProfiles["legacy-forge-rollback"].runtime.manifestSha256 = createHash("sha256")
    .update(legacyManifest)
    .digest("hex");
  writeFileSync(
    join(temporaryRoot, "release", "opus.lock.json"),
    `${JSON.stringify(legacyLock, null, 2)}\n`,
  );

  requireSuccess(
    runVerifier(temporaryRoot, "--require-manifest"),
    "legacy rollback profile verification",
  );
  requireSuccess(
    runVerifier(temporaryRoot, "--require-packageable"),
    "legacy rollback packaging eligibility",
  );
} finally {
  rmSync(temporaryRoot, { recursive: true, force: true });
}

console.log("Release-lock contract tests passed.");
