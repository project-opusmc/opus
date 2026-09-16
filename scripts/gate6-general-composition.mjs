import { readFileSync } from "node:fs";
import { dirname, join, resolve } from "node:path";
import { fileURLToPath } from "node:url";

import {
  aggregateGate6,
  gate6CompositionSchema,
  sealGate6Aggregate,
  validateTargetProfile,
} from "./gate6-lifecycle-core.mjs";

const scriptDir = dirname(fileURLToPath(import.meta.url));
const opusRoot = resolve(scriptDir, "..");
const profileRoot = join(opusRoot, "config", "gate6", "profiles");

export const generalGate6Composition = Object.freeze({
  schema_version: gate6CompositionSchema,
  id: "opus.m3.general-bootstrap-lifecycle.v1",
  branches: [
    {
      id: "branch-a",
      required_profiles: ["opus-owned"],
    },
    {
      id: "branch-b",
      required_profiles: ["badlion", "lunar"],
    },
  ],
});

export const generalGate6Slots = Object.freeze({
  owned: "opus-owned",
  badlion: "badlion",
  lunar: "lunar",
});

export const generalGate6ProfilePaths = Object.freeze({
  [generalGate6Slots.owned]: join(profileRoot, "opus-owned.json"),
  [generalGate6Slots.badlion]: join(profileRoot, "badlion.json"),
  [generalGate6Slots.lunar]: join(profileRoot, "lunar.json"),
});

function readJson(pathname) {
  return JSON.parse(readFileSync(pathname, "utf8"));
}

export function loadGeneralGate6Profiles() {
  return Object.fromEntries(
    Object.entries(generalGate6ProfilePaths).map(([expectedId, pathname]) => {
      const profile = readJson(pathname);
      const validation = validateTargetProfile(profile);
      if (!validation.valid) {
        throw new Error(
          `invalid Gate 6 profile ${pathname}: ${validation.errors.join("; ")}`,
        );
      }
      if (profile.id !== expectedId) {
        throw new Error(
          `Gate 6 profile ${pathname} has id ${profile.id}, expected ${expectedId}`,
        );
      }
      return [expectedId, profile];
    }),
  );
}

export function aggregateGeneralGate6(
  { sessions, ownerConfirmation },
  options = {},
) {
  return aggregateGate6(
    {
      composition: generalGate6Composition,
      sessions,
      owner_confirmation: ownerConfirmation,
    },
    options,
  );
}

export function sealGeneralGate6(aggregate) {
  return sealGate6Aggregate(aggregate, generalGate6Composition);
}
