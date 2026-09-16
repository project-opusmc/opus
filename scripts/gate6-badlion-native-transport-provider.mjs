import {
  TargetTransportBackendCode,
} from "./gate6-target-transport-backend.mjs";

export const badlionNativeTransportProviderId =
  "badlion-native-control-plane-provider";

function notSupported(operation) {
  return {
    code: TargetTransportBackendCode.NOT_SUPPORTED,
    message: `${operation} has no enabled Badlion native control-plane implementation`,
    evidence: {
      provider: badlionNativeTransportProviderId,
      control_plane: "native-selected-target-control-plane",
      live_execution_performed: false,
    },
  };
}

export class BadlionNativeControlPlaneTransportProvider {
  constructor({ controlPlane = null, evidenceSink = null } = {}) {
    this.controlPlane = controlPlane;
    this.evidenceSink = evidenceSink;
    this.identity = badlionNativeTransportProviderId;
  }

  invoke(operation, context) {
    const handler = this.controlPlane?.[operation];
    const result = typeof handler === "function"
      ? handler.call(this.controlPlane, context)
      : notSupported(operation);
    if (
      this.evidenceSink !== null &&
      typeof this.evidenceSink.record === "function"
    ) {
      this.evidenceSink.record({
        operation,
        observation: structuredClone(result),
      });
    }
    return result;
  }

  revalidateTarget(context) {
    return this.invoke("revalidateTarget", context);
  }

  prepare(context) {
    return this.invoke("prepare", context);
  }

  verifyArtifact(context) {
    return this.invoke("verifyArtifact", context);
  }

  load(context) {
    return this.invoke("load", context);
  }

  resolveEntrypoint(context) {
    return this.invoke("resolveEntrypoint", context);
  }

  start(context) {
    return this.invoke("start", context);
  }

  verifyHandshake(context) {
    return this.invoke("verifyHandshake", context);
  }

  stop(context) {
    return this.invoke("stop", context);
  }

  cleanup(context) {
    return this.invoke("cleanup", context);
  }

  checkHealth(context) {
    return this.invoke("checkHealth", context);
  }
}
