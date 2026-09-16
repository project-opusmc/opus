import { mkdirSync, readFileSync, writeFileSync } from "node:fs";
import { dirname, resolve } from "node:path";

import {
  normalizeGenericClientSession,
} from "./gate6-generic-client-adapter.mjs";

function usage() {
  console.error(
    "Usage: node scripts/normalize-gate6-generic-observations.mjs " +
      "--observations <absolute-observations.json> --output <absolute-session.json>",
  );
}

function parseOptions(argv) {
  const options = {};
  for (let index = 0; index < argv.length; index += 2) {
    const name = argv[index];
    const value = argv[index + 1];
    if (
      !["--observations", "--output"].includes(name) ||
      value === undefined ||
      Object.hasOwn(options, name)
    ) {
      return null;
    }
    options[name] = value;
  }
  return Object.keys(options).length === 2 ? options : null;
}

function requireAbsolute(pathname, label) {
  const absolute = resolve(pathname);
  if (absolute !== pathname) {
    throw new Error(`${label} must be absolute`);
  }
  return absolute;
}

function normalize() {
  const options = parseOptions(process.argv.slice(2));
  if (options === null) {
    usage();
    process.exitCode = 2;
    return;
  }
  const observationsPath = requireAbsolute(
    options["--observations"],
    "--observations",
  );
  const outputPath = requireAbsolute(options["--output"], "--output");
  const observations = JSON.parse(readFileSync(observationsPath, "utf8"));
  const session = normalizeGenericClientSession(observations);

  mkdirSync(dirname(outputPath), { recursive: true, mode: 0o700 });
  writeFileSync(outputPath, `${JSON.stringify(session, null, 2)}\n`, {
    encoding: "utf8",
    mode: 0o600,
  });
  console.log(
    `OPUS Gate 6 Generic Client observations normalized: result=${session.result} output=${outputPath}`,
  );
}

try {
  normalize();
} catch (error) {
  console.error(`OPUS Gate 6 Generic Client normalization failed: ${error.message}`);
  process.exitCode = 1;
}
