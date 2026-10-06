#!/usr/bin/env bash
set -euo pipefail

opus_root="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
runtime_library="${opus_root}/output/injector-foundation/libopus-runtime.dylib"
bridge_source="${opus_root}/runtime-java/src/main/java/dev/opus/runtime/bridge/NativeRuntimeBridge.java"
preview_jar="${opus_root}/runtime-java/build/libs/opus-owned-m3-bootstrap-0.1.0.jar"

if [[ ! -f "${runtime_library}" ]]; then
  echo "Build the native foundation before checking the M3 bridge ABI." >&2
  exit 1
fi
if [[ ! -f "${bridge_source}" ]]; then
  echo "The client-neutral NativeRuntimeBridge source is missing." >&2
  exit 1
fi

for symbol in \
  "Java_dev_opus_runtime_bridge_NativeRuntimeBridge_probe" \
  "Java_dev_opus_runtime_bridge_NativeRuntimeBridge_shutdown" \
  "Java_dev_opus_runtime_bridge_NativeRuntimeBridge_restart"; do
  if ! nm -gU "${runtime_library}" | grep -Fq "${symbol}"; then
    echo "Native runtime is missing required M3 bridge symbol: ${symbol}" >&2
    exit 1
  fi
done

if nm -gU "${runtime_library}" \
  | grep -Eq 'Java_dev_opus_runtime_(harness|ownedclient)_'; then
  echo "Native runtime still exports target-specific JNI bridge symbols." >&2
  exit 1
fi

for declaration in \
  "public static native String probe();" \
  "public static native String shutdown();" \
  "public static native String restart();"; do
  if ! grep -Fq "${declaration}" "${bridge_source}"; then
    echo "NativeRuntimeBridge is missing required declaration: ${declaration}" >&2
    exit 1
  fi
done

if rg -n \
  '^[[:space:]]*(public|private|protected)?[[:space:]]*static[[:space:]]+native' \
  "${opus_root}/runtime-java/src" \
  --glob '*.java' \
  | rg -Fv 'NativeRuntimeBridge.java'; then
  echo "Only NativeRuntimeBridge may declare M3 native methods." >&2
  exit 1
fi

"${opus_root}/runtime/gradlew" -p "${opus_root}/runtime-java" ownedM3BootstrapJar >/dev/null
if [[ ! -f "${preview_jar}" ]]; then
  echo "OPUS-owned preview bootstrap JAR was not created." >&2
  exit 1
fi
if ! jar tf "${preview_jar}" \
  | grep -Fqx 'dev/opus/runtime/bridge/NativeRuntimeBridge.class'; then
  echo "OPUS-owned preview bootstrap JAR does not include NativeRuntimeBridge." >&2
  exit 1
fi

echo "OPUS M3 native bridge ABI contract passed."
