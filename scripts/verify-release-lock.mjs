import { createHash } from "node:crypto";
import { execFileSync } from "node:child_process";
import { existsSync, readFileSync } from "node:fs";
import { join, resolve } from "node:path";

const opusRoot = resolve(process.argv[2] ?? process.cwd());
const requireManifest = process.argv.includes("--require-manifest");
const lock = JSON.parse(
  readFileSync(join(opusRoot, "release", "opus.lock.json"), "utf8"),
);

if (
  lock.schemaVersion !== 1 ||
  typeof lock.productVersion !== "string" ||
  typeof lock.launcher?.version !== "string" ||
  typeof lock.runtime?.version !== "string"
) {
  throw new Error("Unsupported OPUS release lock");
}

for (const componentName of ["launcher", "runtime"]) {
  const expectedCommit = lock[componentName]?.commit;
  if (typeof expectedCommit !== "string" || !/^[0-9a-f]{40}$/.test(expectedCommit)) {
    throw new Error(`Invalid ${componentName} commit in release lock`);
  }
  const actualCommit = execFileSync(
    "git",
    ["-C", join(opusRoot, componentName), "rev-parse", "HEAD"],
    { encoding: "utf8" },
  ).trim();
  if (actualCommit !== expectedCommit) {
    throw new Error(
      `${componentName} commit mismatch: expected ${expectedCommit}, got ${actualCommit}`,
    );
  }
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
  if (actualManifestSha256 !== lock.runtime.manifestSha256) {
    throw new Error(
      `Runtime manifest mismatch: expected ${lock.runtime.manifestSha256}, got ${actualManifestSha256}`,
    );
  }
}
