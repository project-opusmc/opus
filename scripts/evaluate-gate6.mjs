import { readFileSync, statSync, writeFileSync } from "node:fs";
import { resolve } from "node:path";

import {
  createNotTestedSession,
  evaluateGate6Session,
  gate7SessionReady,
} from "./gate6-lifecycle-core.mjs";
import {
  aggregateGeneralGate6,
  generalGate6Slots,
  loadGeneralGate6Profiles,
  sealGeneralGate6,
} from "./gate6-general-composition.mjs";

const slotArguments = Object.freeze([
  {
    argument: "--owned-session",
    profile: generalGate6Slots.owned,
  },
  {
    argument: "--badlion-session",
    profile: generalGate6Slots.badlion,
  },
  {
    argument: "--lunar-session",
    profile: generalGate6Slots.lunar,
  },
]);

const acceptedArguments = new Set([
  ...slotArguments.map((slot) => slot.argument),
  "--owner-confirmation",
  "--output",
]);

function usage() {
  console.error(
    "Usage: node scripts/evaluate-gate6.mjs " +
      "[--owned-session <absolute-json>] " +
      "[--badlion-session <absolute-json>] " +
      "[--lunar-session <absolute-json>] " +
      "[--owner-confirmation <absolute-json>] " +
      "[--output <absolute-json>]",
  );
}

function requireAbsoluteExisting(pathname, label) {
  const absolute = resolve(pathname);
  if (absolute !== pathname) {
    throw new Error(`${label} must be an absolute path`);
  }
  const metadata = statSync(absolute);
  if (!metadata.isFile()) {
    throw new Error(`${label} must identify a regular file`);
  }
  return absolute;
}

function requireAbsoluteOutput(pathname) {
  const absolute = resolve(pathname);
  if (absolute !== pathname) {
    throw new Error("--output must be an absolute path");
  }
  return absolute;
}

function parseOptions(argv) {
  const options = {};
  for (let index = 0; index < argv.length; index += 2) {
    const argument = argv[index];
    const value = argv[index + 1];
    if (
      !acceptedArguments.has(argument) ||
      value === undefined ||
      Object.hasOwn(options, argument)
    ) {
      return null;
    }
    options[argument] = value;
  }
  return options;
}

function readJson(pathname, label) {
  try {
    return JSON.parse(readFileSync(pathname, "utf8"));
  } catch (error) {
    throw new Error(`could not read ${label}: ${error.message}`);
  }
}

function readSlotSession(options, slot, profile) {
  const input = options[slot.argument];
  if (input === undefined) {
    return createNotTestedSession(profile, {
      evidence: "not-supplied-to-evaluate-gate6",
    });
  }

  const pathname = requireAbsoluteExisting(input, slot.argument);
  const session = readJson(pathname, slot.argument);
  const evaluation = evaluateGate6Session(session);
  if (!evaluation.valid) {
    throw new Error(
      `${slot.argument} does not contain a valid Gate 6 session: ${evaluation.errors.join("; ")}`,
    );
  }
  if (session.target.profile !== slot.profile) {
    throw new Error(
      `${slot.argument} must have target.profile ${slot.profile}, got ${session.target.profile}`,
    );
  }
  return session;
}

function branchStatuses(aggregate) {
  return Object.fromEntries(
    aggregate.branches.map((branch) => [branch.id, branch.status]),
  );
}

function sessionOutcomes(sessions) {
  return Object.fromEntries(
    sessions.map((session) => {
      const evaluation = evaluateGate6Session(session);
      return [
        session.target.profile,
        {
          status: evaluation.status,
          first_non_pass_stage: evaluation.first_non_pass_stage,
        },
      ];
    }),
  );
}

function evaluate() {
  const options = parseOptions(process.argv.slice(2));
  if (options === null) {
    usage();
    process.exitCode = 2;
    return;
  }

  const profiles = loadGeneralGate6Profiles();
  const sessions = slotArguments.map((slot) =>
    readSlotSession(options, slot, profiles[slot.profile]),
  );
  const ownerConfirmation = options["--owner-confirmation"] === undefined
    ? undefined
    : readJson(
      requireAbsoluteExisting(
        options["--owner-confirmation"],
        "--owner-confirmation",
      ),
      "--owner-confirmation",
    );
  const aggregate = aggregateGeneralGate6({
    sessions,
    ownerConfirmation,
  });

  let gate7Ready = false;
  try {
    gate7SessionReady(sealGeneralGate6(aggregate));
    gate7Ready = true;
  } catch {
    gate7Ready = false;
  }

  const output = {
    schema_version: "opus.m3.gate6.evaluation.v1",
    gate6: aggregate.status,
    branches: branchStatuses(aggregate),
    targets: aggregate.targets,
    session_outcomes: sessionOutcomes(sessions),
    owner_confirmation: aggregate.owner_confirmation.status,
    invariant: aggregate.invariant,
    gate7_ready: gate7Ready,
  };
  const serialized = `${JSON.stringify(output, null, 2)}\n`;
  if (options["--output"] !== undefined) {
    writeFileSync(requireAbsoluteOutput(options["--output"]), serialized, "utf8");
  }
  process.stdout.write(serialized);
}

try {
  evaluate();
} catch (error) {
  console.error(`OPUS General Gate 6 evaluation failed: ${error.message}`);
  process.exitCode = 2;
}
