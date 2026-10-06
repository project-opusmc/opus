#!/usr/bin/env node

import { createHash } from "node:crypto";
import { execFileSync, spawnSync } from "node:child_process";
import {
  cpSync,
  existsSync,
  mkdtempSync,
  readFileSync,
  readdirSync,
  rmSync,
  statSync,
  writeFileSync,
} from "node:fs";
import { tmpdir } from "node:os";
import { basename, dirname, join, resolve } from "node:path";
import { fileURLToPath } from "node:url";

function requireCondition(condition, message) {
  if (!condition) {
    throw new Error(message);
  }
}

function sha256(path) {
  return createHash("sha256").update(readFileSync(path)).digest("hex");
}

function globToRegExp(pattern) {
  const escaped = pattern.replace(/[|\\{}()[\]^$+?.]/g, "\\$&");
  return new RegExp(`^${escaped.replaceAll("*", ".*")}$`);
}

function requireSameSet(actual, expected, label) {
  requireCondition(
    actual.size === expected.size && [...expected].every((value) => actual.has(value)),
    `${label} does not match the canonical role set`,
  );
}

const scriptDirectory = dirname(fileURLToPath(import.meta.url));
const opusRoot = resolve(scriptDirectory, "..");
const contractPath = join(
  opusRoot,
  "docs",
  "protocol",
  "runtime-artifact-roles.json",
);
const runtimeOutput = join(opusRoot, "runtime", "build", "runtime");
const manifestPath = join(runtimeOutput, "runtime-manifest.json");
const checksumsPath = join(runtimeOutput, "runtime-checksums.json");
const runtimeBuildPath = join(opusRoot, "runtime", "build.gradle.kts");
const launcherStagePath = join(
  opusRoot,
  "launcher",
  "scripts",
  "stage-runtime-artifacts.mjs",
);
const documentationPaths = [
  join(opusRoot, "docs", "protocol", "runtime-artifacts.md"),
  join(opusRoot, "runtime", "README.md"),
  join(opusRoot, "launcher", "docs", "launcher-runtime.md"),
];

const contract = JSON.parse(readFileSync(contractPath, "utf8"));
requireCondition(
  contract.schemaVersion === 1 &&
    contract.contract === "legacy-forge-1.8.9" &&
    contract.minecraftVersion === "1.8.9" &&
    contract.protocolVersion === 1 &&
    Array.isArray(contract.roles),
  "Unsupported canonical runtime artifact role contract",
);

const contractByRole = new Map();
for (const record of contract.roles) {
  requireCondition(
    record &&
      typeof record.role === "string" &&
      typeof record.filePattern === "string" &&
      typeof record.stage === "string" &&
      !contractByRole.has(record.role),
    "Invalid or duplicate canonical runtime artifact role",
  );
  contractByRole.set(record.role, record);
}
requireCondition(contractByRole.size === 7, "Schema v1 must define exactly seven roles");
const expectedRoles = new Set(contractByRole.keys());

const runtimeBuild = readFileSync(runtimeBuildPath, "utf8");
const configuredRoles = new Set(
  [...runtimeBuild.matchAll(/role\s*=\s*"([^"]+)"/g)].map((match) => match[1]),
);
requireSameSet(configuredRoles, expectedRoles, "Runtime build role list");

const launcherStage = readFileSync(launcherStagePath, "utf8");
for (const role of expectedRoles) {
  requireCondition(
    launcherStage.includes(`"${role}"`),
    `Launcher staging does not name canonical role ${role}`,
  );
}

for (const documentationPath of documentationPaths) {
  const documentation = readFileSync(documentationPath, "utf8");
  for (const role of expectedRoles) {
    requireCondition(
      documentation.includes(role),
      `${documentationPath} does not document canonical role ${role}`,
    );
  }
}

const manifest = JSON.parse(readFileSync(manifestPath, "utf8"));
const checksums = JSON.parse(readFileSync(checksumsPath, "utf8"));
requireCondition(
  manifest.schemaVersion === 1 &&
    manifest.protocolVersion === contract.protocolVersion &&
    manifest.minecraftVersion === contract.minecraftVersion &&
    typeof manifest.runtimeVersion === "string" &&
    Array.isArray(manifest.artifacts),
  "Unsupported Runtime manifest contract",
);
requireCondition(
  checksums.schemaVersion === 1 &&
    checksums.algorithm === "SHA-256" &&
    checksums.files &&
    typeof checksums.files === "object",
  "Unsupported Runtime checksum contract",
);

const manifestByRole = new Map();
for (const artifact of manifest.artifacts) {
  requireCondition(
    artifact &&
      typeof artifact.role === "string" &&
      typeof artifact.file === "string" &&
      Number.isSafeInteger(artifact.size) &&
      artifact.size > 0 &&
      typeof artifact.sha256 === "string" &&
      /^[0-9a-f]{64}$/.test(artifact.sha256) &&
      !manifestByRole.has(artifact.role),
    "Invalid or duplicate Runtime artifact record",
  );
  manifestByRole.set(artifact.role, artifact);
}
requireSameSet(new Set(manifestByRole.keys()), expectedRoles, "Runtime manifest role list");

const expectedFiles = new Set();
for (const [role, contractRecord] of contractByRole) {
  const artifact = manifestByRole.get(role);
  requireCondition(
    basename(artifact.file) === artifact.file &&
      globToRegExp(contractRecord.filePattern).test(artifact.file),
    `Runtime artifact file does not match ${role}: ${artifact.file}`,
  );
  const artifactPath = join(runtimeOutput, "artifacts", artifact.file);
  requireCondition(
    existsSync(artifactPath) && statSync(artifactPath).isFile(),
    `Runtime artifact is missing: ${artifactPath}`,
  );
  requireCondition(
    statSync(artifactPath).size === artifact.size &&
      sha256(artifactPath) === artifact.sha256 &&
      checksums.files[artifact.file] === artifact.sha256,
    `Runtime artifact integrity mismatch: ${artifact.file}`,
  );
  expectedFiles.add(artifact.file);
}
requireSameSet(
  new Set(Object.keys(checksums.files)),
  expectedFiles,
  "Runtime checksum file list",
);

const temporaryRoot = mkdtempSync(join(tmpdir(), "opus-runtime-artifact-contract-"));
try {
  const stagedRuntime = join(temporaryRoot, "staged");
  execFileSync(
    process.execPath,
    [launcherStagePath, runtimeOutput, stagedRuntime],
    { stdio: "inherit" },
  );

  const stagedFiles = new Set(
    readdirSync(stagedRuntime, { withFileTypes: true })
      .filter((entry) => entry.isFile())
      .map((entry) => entry.name),
  );
  for (const file of expectedFiles) {
    requireCondition(
      stagedFiles.has(file),
      `Launcher staging omitted canonical artifact ${file}`,
    );
  }
  requireCondition(
    stagedFiles.has("runtime-manifest.json") &&
      stagedFiles.has("runtime-checksums.json"),
    "Launcher staging omitted Runtime manifests",
  );

  const invalidRuntime = join(temporaryRoot, "invalid-runtime");
  cpSync(runtimeOutput, invalidRuntime, { recursive: true });
  const invalidManifestPath = join(invalidRuntime, "runtime-manifest.json");
  const invalidManifest = JSON.parse(readFileSync(invalidManifestPath, "utf8"));
  invalidManifest.artifacts[0].role = "unexpected-role";
  writeFileSync(invalidManifestPath, `${JSON.stringify(invalidManifest, null, 2)}\n`);

  const invalidResult = spawnSync(
    process.execPath,
    [launcherStagePath, invalidRuntime, join(temporaryRoot, "invalid-stage")],
    { encoding: "utf8" },
  );
  requireCondition(
    invalidResult.status !== 0,
    "Launcher staging accepted an unknown runtime artifact role",
  );
} finally {
  rmSync(temporaryRoot, { recursive: true, force: true });
}

console.log(
  `Runtime artifact contract passed: ${expectedRoles.size} legacy Forge roles are aligned.`,
);
