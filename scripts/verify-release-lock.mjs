import { createHash } from "node:crypto";
import { execFileSync } from "node:child_process";
import { existsSync, readFileSync, statSync } from "node:fs";
import { join, resolve, sep } from "node:path";

const REQUIRED_HANDSHAKE_FIELDS = [
  "protocolVersion",
  "injectorVersion",
  "nativeRuntimeVersion",
  "javaRuntimeVersion",
  "targetArchitecture",
  "mappingSchemaVersion",
  "oneConfigAdapterVersion",
  "artifactChecksums",
];

const REQUIRED_PREVIEW_ARTIFACT_FIELDS = [
  "componentVersions",
  "sha256",
  "sizes",
  "targetArchitecture",
  "javaBytecodeCompatibility",
  "mappingSchemaVersion",
  "oneConfigAdapterVersion",
];

function usage(message) {
  if (message) {
    console.error(message);
  }
  console.error(
    "Usage: node scripts/verify-release-lock.mjs [opus-root] [--profile <name>] [--print-profile] [--require-manifest] [--require-packageable]",
  );
  process.exit(1);
}

function parseArguments(args) {
  let suppliedRoot;
  let requestedProfile;
  let printProfile = false;
  let requireManifest = false;
  let requirePackageable = false;

  for (let index = 0; index < args.length; index += 1) {
    const argument = args[index];
    if (argument === "--profile") {
      requestedProfile = args[index + 1];
      if (!requestedProfile || requestedProfile.startsWith("--")) {
        usage("--profile requires a profile name.");
      }
      index += 1;
    } else if (argument === "--print-profile") {
      printProfile = true;
    } else if (argument === "--require-manifest") {
      requireManifest = true;
    } else if (argument === "--require-packageable") {
      requirePackageable = true;
    } else if (argument.startsWith("--")) {
      usage(`Unknown option: ${argument}`);
    } else if (suppliedRoot) {
      usage("Only one OPUS root path may be supplied.");
    } else {
      suppliedRoot = argument;
    }
  }

  if (printProfile && (requireManifest || requirePackageable)) {
    usage("--print-profile cannot be combined with requirement flags.");
  }

  return {
    opusRoot: resolve(suppliedRoot ?? process.cwd()),
    requestedProfile,
    printProfile,
    requireManifest,
    requirePackageable,
  };
}

function assertRecord(value, label) {
  if (!value || typeof value !== "object" || Array.isArray(value)) {
    throw new Error(`${label} must be an object`);
  }
  return value;
}

function assertString(value, label) {
  if (typeof value !== "string" || value.trim() === "") {
    throw new Error(`${label} must be a non-empty string`);
  }
  return value;
}

function assertStringArray(value, label) {
  if (!Array.isArray(value) || value.some((entry) => typeof entry !== "string" || entry === "")) {
    throw new Error(`${label} must be an array of non-empty strings`);
  }
  return value;
}

function assertVersion(value, label) {
  if (
    typeof value !== "string" ||
    !/^\d+\.\d+\.\d+(?:[-+][0-9A-Za-z.-]+)?$/.test(value)
  ) {
    throw new Error(`${label} must be a semantic version`);
  }
  return value;
}

function escapeRegularExpression(value) {
  return value.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}

function assertExactStringSet(value, expectedValues, label) {
  const entries = assertStringArray(value, label);
  const actual = new Set(entries);
  const expected = new Set(expectedValues);
  if (
    actual.size !== entries.length ||
    actual.size !== expected.size ||
    [...expected].some((entry) => !actual.has(entry))
  ) {
    throw new Error(`${label} must contain exactly: ${expectedValues.join(", ")}`);
  }
}

function assertSourceDirectory(opusRoot, sourcePath, label) {
  const relativePath = assertString(sourcePath, label);
  const resolvedPath = resolve(opusRoot, relativePath);
  if (
    resolvedPath === opusRoot ||
    !resolvedPath.startsWith(`${opusRoot}${sep}`) ||
    !existsSync(resolvedPath) ||
    !statSync(resolvedPath).isDirectory()
  ) {
    throw new Error(`${label} must reference an existing directory inside the OPUS root`);
  }
}

function assertSourceFile(opusRoot, sourcePath, label) {
  const relativePath = assertString(sourcePath, label);
  const resolvedPath = resolve(opusRoot, relativePath);
  if (
    resolvedPath === opusRoot ||
    !resolvedPath.startsWith(`${opusRoot}${sep}`) ||
    !existsSync(resolvedPath) ||
    !statSync(resolvedPath).isFile()
  ) {
    throw new Error(`${label} must reference an existing file inside the OPUS root`);
  }
}

function parseLegacyForgeMetadata(profile, label, expectedReleaseState) {
  const record = assertRecord(profile, label);
  if (expectedReleaseState && record.releaseState !== expectedReleaseState) {
    throw new Error(`${label}.releaseState must be ${expectedReleaseState}`);
  }

  const launcher = assertRecord(record.launcher, `${label}.launcher`);
  const runtime = assertRecord(record.runtime, `${label}.runtime`);
  for (const [componentName, component] of [
    ["launcher", launcher],
    ["runtime", runtime],
  ]) {
    assertString(component.version, `${label}.${componentName}.version`);
    if (typeof component.commit !== "string" || !/^[0-9a-f]{40}$/.test(component.commit)) {
      throw new Error(`${label}.${componentName}.commit must be a 40-character lowercase Git SHA`);
    }
  }
  if (
    typeof runtime.manifestSha256 !== "string" ||
    !/^[0-9a-f]{64}$/.test(runtime.manifestSha256)
  ) {
    throw new Error(`${label}.runtime.manifestSha256 must be a lowercase SHA-256`);
  }

  return { launcher, runtime };
}

function verifyLegacyForgeCheckout(opusRoot, legacyProfile, requireManifest) {
  const componentFailures = [];
  for (const componentName of ["launcher", "runtime"]) {
    const expectedCommit = legacyProfile[componentName].commit;
    const componentRoot = join(opusRoot, componentName);
    const actualCommit = execFileSync(
      "git",
      ["-C", componentRoot, "rev-parse", "HEAD"],
      { encoding: "utf8" },
    ).trim();
    if (actualCommit !== expectedCommit) {
      componentFailures.push(
        `${componentName} commit mismatch: expected ${expectedCommit}, got ${actualCommit}`,
      );
    }

    const worktreeStatus = execFileSync(
      "git",
      ["-C", componentRoot, "status", "--porcelain=v1", "--untracked-files=all"],
      { encoding: "utf8" },
    ).trim();
    if (worktreeStatus !== "") {
      componentFailures.push(
        `${componentName} worktree is dirty; a legacy Forge release lock cannot represent uncommitted artifacts`,
      );
    }
  }

  if (componentFailures.length > 0) {
    throw new Error(componentFailures.join("\n"));
  }

  const manifestPath = join(
    opusRoot,
    "runtime",
    "build",
    "runtime",
    "runtime-manifest.json",
  );
  if (requireManifest || existsSync(manifestPath)) {
    if (!existsSync(manifestPath)) {
      throw new Error("Runtime manifest is required but missing");
    }
    const actualManifestSha256 = createHash("sha256")
      .update(readFileSync(manifestPath))
      .digest("hex");
    if (actualManifestSha256 !== legacyProfile.runtime.manifestSha256) {
      throw new Error(
        `Runtime manifest mismatch: expected ${legacyProfile.runtime.manifestSha256}, got ${actualManifestSha256}`,
      );
    }
  }
}

function validateInjectorDevelopmentProfile(opusRoot, profile, label) {
  const record = assertRecord(profile, label);
  if (record.kind !== "injector-runtime-payload") {
    throw new Error(`${label}.kind must be injector-runtime-payload`);
  }
  if (record.releaseState !== "foundation-only") {
    throw new Error(`${label}.releaseState must be foundation-only until a payload release contract exists`);
  }

  const minecraft = assertRecord(record.minecraft, `${label}.minecraft`);
  if (minecraft.version !== "1.8.9") {
    throw new Error(`${label}.minecraft.version must be 1.8.9`);
  }
  if (minecraft.supportPolicy !== "adapter-certified-only") {
    throw new Error(`${label}.minecraft.supportPolicy must be adapter-certified-only`);
  }
  if (!Array.isArray(minecraft.certifiedAdapters) || minecraft.certifiedAdapters.length !== 0) {
    throw new Error(`${label}.minecraft.certifiedAdapters must be empty during the foundation phase`);
  }

  const compatibility = assertRecord(record.compatibility, `${label}.compatibility`);
  if (!Number.isInteger(compatibility.protocolVersion) || compatibility.protocolVersion < 1) {
    throw new Error(`${label}.compatibility.protocolVersion must be a positive integer`);
  }
  assertExactStringSet(
    compatibility.requiredHandshake,
    REQUIRED_HANDSHAKE_FIELDS,
    `${label}.compatibility.requiredHandshake`,
  );
  assertString(compatibility.loadSuccess, `${label}.compatibility.loadSuccess`);
  assertString(compatibility.unloadRequirement, `${label}.compatibility.unloadRequirement`);

  const components = assertRecord(record.components, `${label}.components`);
  const injector = assertRecord(components.injector, `${label}.components.injector`);
  assertSourceDirectory(opusRoot, injector.sourcePath, `${label}.components.injector.sourcePath`);
  if (injector.implementationLanguage !== "Rust") {
    throw new Error(`${label}.components.injector.implementationLanguage must be Rust`);
  }
  const injectorVersion = assertVersion(
    injector.version,
    `${label}.components.injector.version`,
  );
  const injectorManifestPath = join(opusRoot, injector.sourcePath, "Cargo.toml");
  if (!existsSync(injectorManifestPath)) {
    throw new Error(`${label}.components.injector must include Cargo.toml`);
  }
  const injectorManifest = readFileSync(injectorManifestPath, "utf8");
  if (
    !new RegExp(
      `^version\\s*=\\s*"${escapeRegularExpression(injectorVersion)}"\\s*$`,
      "m",
    ).test(injectorManifest)
  ) {
    throw new Error(
      `${label}.components.injector.version does not match injector/Cargo.toml`,
    );
  }
  if (
    injector.artifact !== "opus-injector" ||
    injector.state !== "preflight-and-authorized-target-fixture-proof"
  ) {
    throw new Error(
      `${label}.components.injector must remain the M3 preflight and authorized-target fixture proof`,
    );
  }
  assertSourceFile(
    opusRoot,
    join(injector.sourcePath, "src", "authorized_target.rs"),
    `${label}.components.injector.authorizedTargetSource`,
  );
  assertSourceFile(
    opusRoot,
    join("scripts", "check-injector-authorized-target.sh"),
    `${label}.components.injector.authorizedTargetCheck`,
  );

  const nativeRuntime = assertRecord(
    components.nativeRuntime,
    `${label}.components.nativeRuntime`,
  );
  assertSourceDirectory(
    opusRoot,
    nativeRuntime.sourcePath,
    `${label}.components.nativeRuntime.sourcePath`,
  );
  if (nativeRuntime.implementationLanguage !== "C++17") {
    throw new Error(`${label}.components.nativeRuntime.implementationLanguage must be C++17`);
  }
  assertVersion(
    nativeRuntime.version,
    `${label}.components.nativeRuntime.version`,
  );
  if (
    nativeRuntime.artifact !== "libopus-runtime.dylib" ||
    nativeRuntime.state !== "controlled-jvm-and-authorized-target-fixture-proof"
  ) {
    throw new Error(
      `${label}.components.nativeRuntime must remain a controlled-JVM and authorized-target fixture proof`,
    );
  }
  assertSourceFile(
    opusRoot,
    join(
      "runtime-java",
      "src",
      "main",
      "java",
      "dev",
      "opus",
      "runtime",
      "harness",
      "AuthorizedRuntimeTarget.java",
    ),
    `${label}.components.nativeRuntime.authorizedTargetSource`,
  );
  assertExactStringSet(
    nativeRuntime.supportedArchitectures,
    ["arm64", "x86_64"],
    `${label}.components.nativeRuntime.supportedArchitectures`,
  );

  const javaPayload = assertRecord(components.javaPayload, `${label}.components.javaPayload`);
  assertSourceDirectory(
    opusRoot,
    javaPayload.sourcePath,
    `${label}.components.javaPayload.sourcePath`,
  );
  if (javaPayload.implementationLanguage !== "Java") {
    throw new Error(`${label}.components.javaPayload.implementationLanguage must be Java`);
  }
  assertVersion(javaPayload.version, `${label}.components.javaPayload.version`);
  if (
    javaPayload.artifact !== "opus-runtime.jar" ||
    javaPayload.javaRelease !== 8 ||
    javaPayload.classfileMajor !== 52 ||
    javaPayload.bootstrapEntrypoint !== "dev.opus.runtime.Bootstrap.start" ||
    javaPayload.state !== "not-built"
  ) {
    throw new Error(
      `${label}.components.javaPayload must remain the unbuilt Java 8 Bootstrap payload contract`,
    );
  }

  const artifacts = assertRecord(record.artifacts, `${label}.artifacts`);
  if (artifacts.state !== "not-generated") {
    throw new Error(`${label}.artifacts.state must be not-generated during the foundation phase`);
  }
  assertExactStringSet(
    artifacts.requiredBeforePreview,
    REQUIRED_PREVIEW_ARTIFACT_FIELDS,
    `${label}.artifacts.requiredBeforePreview`,
  );
  assertString(artifacts.releaseRule, `${label}.artifacts.releaseRule`);
}

const options = parseArguments(process.argv.slice(2));
const lockPath = join(options.opusRoot, "release", "opus.lock.json");
const lock = JSON.parse(readFileSync(lockPath, "utf8"));

let selectedProfile;

if (lock.schemaVersion === 1) {
  if (options.requestedProfile && options.requestedProfile !== "legacy-forge") {
    throw new Error("Schema v1 release locks only provide the legacy-forge profile");
  }
  assertString(lock.productVersion, "productVersion");
  const legacyProfile = parseLegacyForgeMetadata(lock, "legacy-forge");
  selectedProfile = {
    name: "legacy-forge",
    kind: "forge-manifest",
    releaseState: "release-ready",
    legacyProfile,
  };
} else if (lock.schemaVersion === 2) {
  assertString(lock.productVersion, "productVersion");
  const profiles = assertRecord(lock.buildProfiles, "buildProfiles");
  const activeProfileName = assertString(lock.activeBuildProfile, "activeBuildProfile");
  const selectedProfileName = options.requestedProfile ?? activeProfileName;
  const profile = profiles[selectedProfileName];
  if (!profile) {
    throw new Error(`Release lock does not define the requested profile: ${selectedProfileName}`);
  }

  for (const [profileName, profileValue] of Object.entries(profiles)) {
    const profileRecord = assertRecord(profileValue, `buildProfiles.${profileName}`);
    if (profileRecord.kind === "injector-runtime-payload") {
      validateInjectorDevelopmentProfile(
        options.opusRoot,
        profileRecord,
        `buildProfiles.${profileName}`,
      );
    } else if (profileRecord.kind === "forge-manifest") {
      parseLegacyForgeMetadata(
        profileRecord,
        `buildProfiles.${profileName}`,
        "rollback-only",
      );
    } else {
      throw new Error(`buildProfiles.${profileName}.kind is unsupported`);
    }
  }

  if (profile.kind === "injector-runtime-payload") {
    selectedProfile = {
      name: selectedProfileName,
      kind: profile.kind,
      releaseState: profile.releaseState,
    };
  } else {
    selectedProfile = {
      name: selectedProfileName,
      kind: profile.kind,
      releaseState: profile.releaseState,
      legacyProfile: parseLegacyForgeMetadata(
        profile,
        `buildProfiles.${selectedProfileName}`,
        "rollback-only",
      ),
    };
  }
} else {
  throw new Error("Unsupported OPUS release lock schema");
}

if (options.printProfile) {
  console.log(selectedProfile.name);
  process.exit(0);
}

if (options.requirePackageable) {
  const packageableStates = new Set(["release-ready", "rollback-only"]);
  if (!packageableStates.has(selectedProfile.releaseState)) {
    throw new Error(
      `Profile ${selectedProfile.name} is ${selectedProfile.releaseState}; it cannot be packaged`,
    );
  }
}

if (selectedProfile.kind === "forge-manifest") {
  verifyLegacyForgeCheckout(
    options.opusRoot,
    selectedProfile.legacyProfile,
    options.requireManifest,
  );
} else if (options.requireManifest) {
  throw new Error(
    `Profile ${selectedProfile.name} is ${selectedProfile.releaseState}; it does not provide a Forge runtime manifest`,
  );
}

console.log(
  `Release lock profile ${selectedProfile.name} is valid (${selectedProfile.releaseState}).`,
);
