import { isAbsolute } from "node:path";

const statusValues = new Set(["PASS", "FAIL", "NOT_TESTED", "BLOCKED"]);

export const Gate6Status = Object.freeze({
  PASS: "PASS",
  FAIL: "FAIL",
  NOT_TESTED: "NOT_TESTED",
  BLOCKED: "BLOCKED",
});

export const gate6SessionSchema = "opus.m3.gate6.session.v1";
export const gate6TargetProfileSchema = "opus.m3.gate6.target-profile.v1";
export const gate6OwnerConfirmationSchema =
  "opus.m3.gate6.owner-confirmation.v1";
export const gate6CompositionSchema = "opus.m3.gate6.composition.v1";
export const gate6AggregateSchema = "opus.m3.gate6.aggregate.v1";
export const gate6SealSchema = "opus.m3.gate6.seal.v1";
export const gate6SessionReadySchema = "opus.m3.gate6.session-ready.v1";
export const requiredStabilityLadder = Object.freeze([1, 3, 10, 25]);
export const gate6LifecycleStages = Object.freeze([
  { key: "target", name: "TargetResolved" },
  { key: "transport", name: "TransportReady" },
  { key: "bootstrap_artifact", name: "BootstrapArtifactVerified" },
  { key: "load", name: "BootstrapLoaded" },
  { key: "entrypoint", name: "EntrypointReady" },
  { key: "start", name: "BootstrapStarted" },
  { key: "handshake", name: "HandshakeOk" },
  { key: "stop", name: "BootstrapStopped" },
  { key: "cleanup", name: "CleanupOk" },
  { key: "target_health", name: "TargetHealthy" },
]);

function isRecord(value) {
  return value !== null && typeof value === "object" && !Array.isArray(value);
}

function isNonEmptyString(value) {
  return typeof value === "string" && value.trim().length > 0;
}

function isConcreteString(value) {
  return (
    isNonEmptyString(value) &&
    !["unresolved", "unknown"].includes(value.trim().toLowerCase())
  );
}

function isSha256(value) {
  return typeof value === "string" && /^[0-9a-f]{64}$/.test(value);
}

function sameNumberArray(actual, expected) {
  return (
    Array.isArray(actual) &&
    actual.length === expected.length &&
    actual.every((value, index) => value === expected[index])
  );
}

function sameStringArray(actual, expected) {
  return (
    Array.isArray(actual) &&
    actual.length === expected.length &&
    actual.every((value, index) => value === expected[index])
  );
}

function statusFrom(values) {
  if (values.includes(Gate6Status.FAIL)) {
    return Gate6Status.FAIL;
  }
  if (values.includes(Gate6Status.BLOCKED)) {
    return Gate6Status.BLOCKED;
  }
  if (values.includes(Gate6Status.NOT_TESTED)) {
    return Gate6Status.NOT_TESTED;
  }
  return Gate6Status.PASS;
}

export function combineGate6Statuses(values) {
  return statusFrom(values);
}

function stageStatus(value, label, errors) {
  if (!isRecord(value) || !statusValues.has(value.status)) {
    errors.push(`${label}.status must be PASS, FAIL, NOT_TESTED, or BLOCKED`);
    return Gate6Status.FAIL;
  }
  return value.status;
}

function bootstrapArtifactStatus(session, errors) {
  if (Object.hasOwn(session, "bootstrap_artifact")) {
    return stageStatus(
      session.bootstrap_artifact,
      "bootstrap_artifact",
      errors,
    );
  }

  // Existing Branch A evidence predates the explicit stage object. Its
  // non-null identity was emitted only after the owned normalizer validated
  // the ArtifactVerified witness, so retain backwards-compatible evaluation.
  if (session.bootstrap === null || session.bootstrap === undefined) {
    return Gate6Status.NOT_TESTED;
  }
  if (!isRecord(session.bootstrap)) {
    errors.push("bootstrap must be an object or null");
    return Gate6Status.FAIL;
  }
  return Gate6Status.PASS;
}

function evaluatedStageStatuses(session, errors) {
  return gate6LifecycleStages.map((stage) => ({
    ...stage,
    status: stage.key === "bootstrap_artifact"
      ? bootstrapArtifactStatus(session, errors)
      : stageStatus(session[stage.key], stage.key, errors),
  }));
}

function uniqueStrings(values) {
  return [...new Set(values)];
}

export function validateTargetProfile(profile) {
  const errors = [];
  if (!isRecord(profile)) {
    return { valid: false, errors: ["profile must be an object"] };
  }
  if (profile.schema_version !== gate6TargetProfileSchema) {
    errors.push(`profile.schema_version must be ${gate6TargetProfileSchema}`);
  }
  for (const field of ["id", "kind", "architecture", "runtime"]) {
    if (!isNonEmptyString(profile[field])) {
      errors.push(`profile.${field} must be a non-empty string`);
    }
  }
  if (!isRecord(profile.metadata)) {
    errors.push("profile.metadata must be an object");
  }
  return { valid: errors.length === 0, errors };
}

export function createNotTestedSession(profile, metadata = {}) {
  const validation = validateTargetProfile(profile);
  if (!validation.valid) {
    throw new Error(`invalid Gate 6 target profile: ${validation.errors.join("; ")}`);
  }

  const notTested = () => ({ status: Gate6Status.NOT_TESTED });
  return {
    schema_version: gate6SessionSchema,
    run_id: null,
    target: {
      profile: profile.id,
      identity: null,
      architecture: profile.architecture,
      runtime: profile.runtime,
      metadata: { ...profile.metadata, ...metadata },
      status: Gate6Status.NOT_TESTED,
    },
    bootstrap: null,
    transport: notTested(),
    bootstrap_artifact: notTested(),
    load: notTested(),
    entrypoint: notTested(),
    start: { ...notTested(), nonce: null },
    handshake: {
      ...notTested(),
      expected_nonce: null,
      observed_nonce: null,
    },
    stop: notTested(),
    cleanup: notTested(),
    target_health: notTested(),
    iterations: {
      requested: 0,
      completed: 0,
      stability_ladder: [...requiredStabilityLadder],
      completed_stages: [],
    },
    result: Gate6Status.NOT_TESTED,
    provenance: {
      kind: "profile-placeholder",
      test_fixture: false,
    },
  };
}

export function evaluateGate6Session(session) {
  const errors = [];
  if (!isRecord(session)) {
    return {
      valid: false,
      errors: ["session must be an object"],
      status: Gate6Status.FAIL,
    };
  }

  if (session.schema_version !== gate6SessionSchema) {
    errors.push(`session.schema_version must be ${gate6SessionSchema}`);
  }
  if (!statusValues.has(session.result)) {
    errors.push("session.result must be PASS, FAIL, NOT_TESTED, or BLOCKED");
  }
  if (!isRecord(session.target)) {
    errors.push("session.target must be an object");
  } else {
    for (const field of ["profile", "architecture", "runtime"]) {
      if (!isNonEmptyString(session.target[field])) {
        errors.push(`session.target.${field} must be a non-empty string`);
      }
    }
    if (!isRecord(session.target.metadata)) {
      errors.push("session.target.metadata must be an object");
    }
  }

  const stageStatuses = evaluatedStageStatuses(session, errors);
  const statuses = stageStatuses.map((stage) => stage.status);
  const computedStatus = statusFrom(statuses);
  const firstNonPassStage = stageStatuses.find(
    (stage) => stage.status !== Gate6Status.PASS,
  ) ?? null;

  if (!isRecord(session.iterations)) {
    errors.push("session.iterations must be an object");
  } else {
    if (!sameNumberArray(session.iterations.stability_ladder, requiredStabilityLadder)) {
      errors.push("session.iterations.stability_ladder must be 1, 3, 10, 25");
    }
    for (const field of ["requested", "completed"]) {
      if (
        !Number.isInteger(session.iterations[field]) ||
        session.iterations[field] < 0
      ) {
        errors.push(`session.iterations.${field} must be a non-negative integer`);
      }
    }
    if (!Array.isArray(session.iterations.completed_stages)) {
      errors.push("session.iterations.completed_stages must be an array");
    }
  }

  if (computedStatus === Gate6Status.PASS) {
    if (!isNonEmptyString(session.run_id)) {
      errors.push("a PASS session must have a run_id");
    }
    if (!isConcreteString(session.target?.identity)) {
      errors.push("a PASS session must have a concrete target identity");
    }
    if (!isConcreteString(session.target?.architecture)) {
      errors.push("a PASS session must have a concrete target architecture");
    }
    if (!isConcreteString(session.target?.runtime)) {
      errors.push("a PASS session must have a concrete target runtime");
    }
    if (!isRecord(session.bootstrap)) {
      errors.push("a PASS session must have bootstrap artifact identity");
    } else {
      if (
        !isNonEmptyString(session.bootstrap.artifact) ||
        !isAbsolute(session.bootstrap.artifact)
      ) {
        errors.push("bootstrap.artifact must be an absolute path for PASS");
      }
      if (!isSha256(session.bootstrap.sha256)) {
        errors.push("bootstrap.sha256 must be a lowercase SHA-256 for PASS");
      }
      if (!isNonEmptyString(session.bootstrap.version)) {
        errors.push("bootstrap.version must be present for PASS");
      }
    }
    if (
      !isRecord(session.start) ||
      !isNonEmptyString(session.start.nonce) ||
      session.start.nonce_mode !== "deterministic-counter" ||
      !isRecord(session.handshake) ||
      !isNonEmptyString(session.handshake.expected_nonce) ||
      !isNonEmptyString(session.handshake.observed_nonce)
    ) {
      errors.push(
        "a PASS session must retain deterministic start and handshake nonce evidence",
      );
    } else if (
      session.start.nonce !== session.handshake.expected_nonce ||
      session.start.nonce !== session.handshake.observed_nonce
    ) {
      errors.push("start and handshake nonce evidence must match for PASS");
    }
    if (
      !isRecord(session.iterations) ||
      session.iterations.requested < requiredStabilityLadder.at(-1) ||
      session.iterations.completed < requiredStabilityLadder.at(-1) ||
      !sameNumberArray(
        session.iterations.completed_stages,
        requiredStabilityLadder,
      )
    ) {
      errors.push(
        "a PASS session must complete the enforced 1, 3, 10, 25 stability ladder",
      );
    }
  }

  if (errors.length === 0 && session.result !== computedStatus) {
    errors.push(
      `session.result (${session.result}) does not match lifecycle status (${computedStatus})`,
    );
  }

  return {
    valid: errors.length === 0,
    errors,
    status: errors.length === 0 ? computedStatus : Gate6Status.FAIL,
    first_non_pass_stage: errors.length === 0 ? firstNonPassStage : null,
  };
}

export function validateOwnerConfirmation(
  confirmation,
  { requiredProfiles = [], allowTestFixture = false } = {},
) {
  if (!isRecord(confirmation)) {
    return {
      valid: false,
      status: Gate6Status.BLOCKED,
      reason: "owner confirmation record is absent",
    };
  }
  if (confirmation.schema_version !== gate6OwnerConfirmationSchema) {
    return {
      valid: false,
      status: Gate6Status.BLOCKED,
      reason: "owner confirmation schema is invalid",
    };
  }
  if (confirmation.test_fixture === true && !allowTestFixture) {
    return {
      valid: false,
      status: Gate6Status.BLOCKED,
      reason: "test-only owner confirmation is not valid outside a test",
    };
  }
  if (
    !isNonEmptyString(confirmation.confirmation_id) ||
    !isNonEmptyString(confirmation.confirmed_at) ||
    !isNonEmptyString(confirmation.attester)
  ) {
    return {
      valid: false,
      status: Gate6Status.BLOCKED,
      reason: "owner confirmation provenance is incomplete",
    };
  }
  if (confirmation.confirmed !== true || !Array.isArray(confirmation.confirmed_targets)) {
    return {
      valid: false,
      status: Gate6Status.BLOCKED,
      reason: "owner confirmation is not explicit and complete",
    };
  }
  const confirmedTargets = new Set(confirmation.confirmed_targets);
  const missingTargets = uniqueStrings(requiredProfiles).filter(
    (profile) => !confirmedTargets.has(profile),
  );
  if (missingTargets.length > 0) {
    return {
      valid: false,
      status: Gate6Status.BLOCKED,
      reason: `owner confirmation omits required target profiles: ${missingTargets.join(", ")}`,
    };
  }
  return {
    valid: true,
    status: Gate6Status.PASS,
    reason: "explicit owner confirmation covers every required target profile",
  };
}

export function validateGate6Composition(composition) {
  const errors = [];
  if (!isRecord(composition)) {
    return { valid: false, errors: ["composition must be an object"] };
  }
  if (composition.schema_version !== gate6CompositionSchema) {
    errors.push(`composition.schema_version must be ${gate6CompositionSchema}`);
  }
  if (!isNonEmptyString(composition.id)) {
    errors.push("composition.id must be a non-empty string");
  }
  if (!Array.isArray(composition.branches) || composition.branches.length === 0) {
    errors.push("composition.branches must contain one or more branch definitions");
    return { valid: false, errors };
  }

  const branchIds = new Set();
  const profiles = new Set();
  for (const branch of composition.branches) {
    if (!isRecord(branch) || !isNonEmptyString(branch.id)) {
      errors.push("each composition branch must have a non-empty id");
      continue;
    }
    if (branchIds.has(branch.id)) {
      errors.push(`composition branch id is duplicated: ${branch.id}`);
    }
    branchIds.add(branch.id);
    if (
      !Array.isArray(branch.required_profiles) ||
      branch.required_profiles.length === 0 ||
      branch.required_profiles.some((profile) => !isNonEmptyString(profile))
    ) {
      errors.push(
        `composition branch ${branch.id} must contain one or more profile IDs`,
      );
      continue;
    }
    for (const profile of branch.required_profiles) {
      if (profiles.has(profile)) {
        errors.push(`composition profile is assigned more than once: ${profile}`);
      }
      profiles.add(profile);
    }
  }

  return {
    valid: errors.length === 0,
    errors,
    required_profiles: [...profiles],
  };
}

function evaluateBranch(branch, sessions) {
  const errors = [];
  if (!isRecord(branch) || !isNonEmptyString(branch.id)) {
    return {
      id: "invalid-branch",
      status: Gate6Status.FAIL,
      errors: ["branch.id must be a non-empty string"],
      sessions: [],
    };
  }

  const requiredProfiles = uniqueStrings(branch.required_profiles);
  const matchingSessions = [];
  const statuses = [];
  for (const profile of requiredProfiles) {
    const candidates = sessions.filter(
      (session) => isRecord(session) && isRecord(session.target) &&
        session.target.profile === profile,
    );
    if (candidates.length !== 1) {
      statuses.push(Gate6Status.NOT_TESTED);
      const error =
        `branch ${branch.id} requires exactly one session for profile ${profile}`;
      errors.push(error);
      matchingSessions.push({
        profile,
        status: Gate6Status.NOT_TESTED,
        errors: [error],
      });
      continue;
    }
    const evaluation = evaluateGate6Session(candidates[0]);
    statuses.push(evaluation.status);
    matchingSessions.push({
      profile,
      status: evaluation.status,
      errors: evaluation.errors,
      first_non_pass_stage: evaluation.first_non_pass_stage,
    });
  }

  return {
    id: branch.id,
    status: statusFrom(statuses),
    errors,
    sessions: matchingSessions,
    required_profiles: requiredProfiles,
  };
}

export function aggregateGate6(
  {
    composition,
    sessions,
    owner_confirmation: ownerConfirmation,
  },
  { allowTestOwnerConfirmation = false } = {},
) {
  const compositionValidation = validateGate6Composition(composition);
  if (!compositionValidation.valid || !Array.isArray(sessions)) {
    return {
      schema_version: gate6AggregateSchema,
      composition_id: isRecord(composition) ? composition.id ?? null : null,
      status: Gate6Status.FAIL,
      branches: [],
      targets: {},
      owner_confirmation: {
        valid: false,
        status: Gate6Status.BLOCKED,
        reason: compositionValidation.valid
          ? "Gate 6 sessions must be an array"
          : compositionValidation.errors.join("; "),
      },
      invariant: {
        all_required_sessions_pass: false,
        owner_confirmation: false,
        pass_equivalence: true,
      },
    };
  }

  const branchResults = composition.branches.map((branch) =>
    evaluateBranch(branch, sessions),
  );
  const requiredProfiles = compositionValidation.required_profiles;
  const unexpectedProfiles = sessions
    .map((session) =>
      isRecord(session) && isRecord(session.target)
        ? session.target.profile
        : null,
    )
    .filter(
      (profile) =>
        profile !== null &&
        !requiredProfiles.includes(profile),
    );
  const branchStatus = statusFrom([
    ...branchResults.map((branch) => branch.status),
    ...(unexpectedProfiles.length > 0 ? [Gate6Status.FAIL] : []),
  ]);
  const ownerResult = validateOwnerConfirmation(ownerConfirmation, {
    requiredProfiles,
    allowTestFixture: allowTestOwnerConfirmation,
  });
  const allRequiredSessionsPass = branchStatus === Gate6Status.PASS;
  const status = allRequiredSessionsPass
    ? ownerResult.status === Gate6Status.PASS
      ? Gate6Status.PASS
      : Gate6Status.BLOCKED
    : branchStatus;
  const ownerConfirmed = ownerResult.status === Gate6Status.PASS;
  const targets = Object.fromEntries(
    branchResults.flatMap((branch) =>
      branch.sessions.map((session) => [session.profile, session.status]),
    ),
  );

  return {
    schema_version: gate6AggregateSchema,
    composition_id: composition.id,
    status,
    branches: branchResults,
    targets,
    owner_confirmation: ownerResult,
    errors: unexpectedProfiles.length === 0
      ? []
      : [`unexpected profile evidence: ${uniqueStrings(unexpectedProfiles).join(", ")}`],
    invariant: {
      all_required_sessions_pass: allRequiredSessionsPass,
      owner_confirmation: ownerConfirmed,
      pass_equivalence:
        (status === Gate6Status.PASS) ===
        (allRequiredSessionsPass && ownerConfirmed),
    },
  };
}

export function validateGate6Aggregate(aggregate, composition) {
  const errors = [];
  const compositionValidation = validateGate6Composition(composition);
  if (!compositionValidation.valid) {
    return {
      valid: false,
      errors: compositionValidation.errors,
      status: Gate6Status.FAIL,
    };
  }
  if (!isRecord(aggregate)) {
    return {
      valid: false,
      errors: ["aggregate must be an object"],
      status: Gate6Status.FAIL,
    };
  }
  if (aggregate.schema_version !== gate6AggregateSchema) {
    errors.push(`aggregate.schema_version must be ${gate6AggregateSchema}`);
  }
  if (aggregate.composition_id !== composition.id) {
    errors.push("aggregate composition_id does not match the required composition");
  }
  if (aggregate.status !== Gate6Status.PASS) {
    errors.push("aggregate status must be PASS before it can be sealed");
  }
  if (!Array.isArray(aggregate.branches)) {
    errors.push("aggregate.branches must be an array");
  } else {
    for (const definition of composition.branches) {
      const matches = aggregate.branches.filter(
        (branch) => isRecord(branch) && branch.id === definition.id,
      );
      if (
        matches.length !== 1 ||
        matches[0].status !== Gate6Status.PASS ||
        !sameStringArray(
          matches[0].required_profiles,
          definition.required_profiles,
        )
      ) {
        errors.push(
          `aggregate branch ${definition.id} does not satisfy the required composition`,
        );
      }
    }
  }
  if (!isRecord(aggregate.targets)) {
    errors.push("aggregate.targets must be an object");
  } else {
    for (const profile of compositionValidation.required_profiles) {
      if (aggregate.targets[profile] !== Gate6Status.PASS) {
        errors.push(`aggregate target ${profile} must be PASS before sealing`);
      }
    }
  }
  if (
    !isRecord(aggregate.owner_confirmation) ||
    aggregate.owner_confirmation.valid !== true ||
    aggregate.owner_confirmation.status !== Gate6Status.PASS
  ) {
    errors.push("aggregate requires explicit valid owner confirmation");
  }
  if (
    !isRecord(aggregate.invariant) ||
    aggregate.invariant.all_required_sessions_pass !== true ||
    aggregate.invariant.owner_confirmation !== true ||
    aggregate.invariant.pass_equivalence !== true
  ) {
    errors.push("aggregate PASS invariant is not satisfied");
  }

  return {
    valid: errors.length === 0,
    errors,
    status: errors.length === 0 ? Gate6Status.PASS : Gate6Status.FAIL,
  };
}

export function sealGate6Aggregate(aggregate, composition) {
  const validation = validateGate6Aggregate(aggregate, composition);
  if (!validation.valid) {
    throw new Error(
      `Gate 6 aggregate cannot be sealed: ${validation.errors.join("; ")}`,
    );
  }
  return {
    schema_version: gate6SealSchema,
    composition,
    aggregate,
  };
}

export function validateGate6Seal(seal) {
  if (!isRecord(seal) || seal.schema_version !== gate6SealSchema) {
    return {
      valid: false,
      errors: [`seal.schema_version must be ${gate6SealSchema}`],
      status: Gate6Status.FAIL,
    };
  }
  return validateGate6Aggregate(seal.aggregate, seal.composition);
}

export function gate7SessionReady(seal) {
  const validation = validateGate6Seal(seal);
  if (!validation.valid) {
    throw new Error(
      `Gate 7 requires a sealed PASS General Gate 6 aggregate: ${validation.errors.join("; ")}`,
    );
  }
  return {
    schema_version: gate6SessionReadySchema,
    gate6_seal: seal,
  };
}
